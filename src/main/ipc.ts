import { ipcMain, dialog, BrowserWindow, Notification } from 'electron'
import * as k8s from '@kubernetes/client-node'
import * as net from 'net'
import { loadContexts, connectCluster, disconnectCluster, getClient, getKubeConfig } from './k8s/client'
import { startWatching, stopWatching } from './k8s/watcher'
import { ResourceCache } from './k8s/cache'
import { fetchLogs, startLogStream, stopLogStream, stopAllLogStreams } from './k8s/logs'
import { fetchRelated } from './k8s/related'
import { fetchPodMetrics, checkMetricsAvailable } from './k8s/metrics'
import { parseHelmLabels } from '../shared/helm'
import { generateSnapshot } from './k8s/snapshot'
import type {
  ClusterInfo,
  K8sEvent,
  PodCondition,
  ContainerStateInfo,
  ResourceDetail,
  ResourceUpdate
} from '../shared/types'
import { writeFileSync } from 'fs'

function parseCpu(val: string): number {
  if (!val) return 0
  if (val.endsWith('m')) return parseInt(val) / 1000
  if (val.endsWith('n')) return parseInt(val) / 1_000_000_000
  return parseFloat(val) || 0
}

function parseMem(val: string): number {
  if (!val) return 0
  const num = parseFloat(val)
  if (val.endsWith('Gi')) return num
  if (val.endsWith('Mi')) return num / 1024
  if (val.endsWith('Ki')) return num / (1024 * 1024)
  if (val.endsWith('G')) return num
  if (val.endsWith('M')) return num / 1000
  return num / (1024 * 1024 * 1024)
}

function toISO(val: any): string {
  if (!val) return ''
  if (typeof val === 'string') return val
  if (typeof val.toISOString === 'function') return val.toISOString()
  return String(val)
}

function mapEvent(e: any): K8sEvent {
  return {
    timestamp: toISO(e.lastTimestamp) || toISO(e.eventTime),
    type: e.type ?? 'Normal',
    reason: e.reason ?? '',
    message: e.message ?? '',
    involvedObject: `${e.involvedObject?.kind?.toLowerCase()}/${e.involvedObject?.name}`,
    count: e.count ?? 1,
    source: e.source?.component ?? ''
  }
}

function toContainerStateInfo(
  cs: {
    name: string
    ready: boolean
    state?: {
      waiting?: { reason?: string }
      running?: Record<string, unknown>
      terminated?: { reason?: string; exitCode?: number }
    }
  },
  isInit: boolean
): ContainerStateInfo {
  if (cs.state?.running) return { name: cs.name, state: 'running', ready: cs.ready, isInit }
  if (cs.state?.terminated)
    return {
      name: cs.name,
      state: 'terminated',
      ready: cs.ready,
      reason: cs.state.terminated.reason,
      exitCode: cs.state.terminated.exitCode,
      isInit
    }
  return { name: cs.name, state: 'waiting', ready: cs.ready, reason: cs.state?.waiting?.reason, isInit }
}

const cache = new ResourceCache()

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle('k8s:list-contexts', () => {
    return loadContexts()
  })

  ipcMain.handle('k8s:connect', async (_event, context: string): Promise<ClusterInfo> => {
    try {
      connectCluster(context)
      await checkMetricsAvailable(context)

      await startWatching(context, (resources) => {
        const previous = cache.getAll(context)

        for (const r of resources) {
          if (r.health === 'critical') {
            const prev = previous.find((p) => p.uid === r.uid)
            if (prev && prev.health !== 'critical') {
              new Notification({
                title: `${r.kind} unhealthy`,
                body: `${r.name} in ${r.namespace} — ${r.status}`
              }).show()
            }
          }
        }

        cache.set(context, resources)
        const info: ClusterInfo = {
          name: context,
          connected: true,
          resourceCounts: {
            total: resources.length,
            healthy: resources.filter((r) => r.health === 'healthy').length,
            warning: resources.filter((r) => r.health === 'warning').length,
            critical: resources.filter((r) => r.health === 'critical').length
          }
        }

        const update: ResourceUpdate = { cluster: context, resources, clusterInfo: info }
        mainWindow.webContents.send('k8s:resource-update', update)
      })

      return {
        name: context,
        connected: true,
        resourceCounts: { total: 0, healthy: 0, warning: 0, critical: 0 }
      }
    } catch (err: any) {
      return {
        name: context,
        connected: false,
        error: err.message,
        resourceCounts: { total: 0, healthy: 0, warning: 0, critical: 0 }
      }
    }
  })

  ipcMain.handle('k8s:disconnect', async (_event, context: string) => {
    stopAllLogStreams()
    stopWatching(context)
    disconnectCluster(context)
    cache.clear(context)
  })

  ipcMain.handle(
    'k8s:get-logs',
    async (_event, cluster: string, namespace: string, pod: string, timestamps?: boolean) => {
      return fetchLogs(cluster, namespace, pod, timestamps)
    }
  )

  ipcMain.handle('k8s:get-events', async (_event, cluster: string, namespace: string, name: string) => {
    const client = getClient(cluster)
    if (!client) throw new Error(`Not connected to ${cluster}`)

    const events = await client.coreApi.listNamespacedEvent({ namespace })
    return events.items
      .filter((e) => e.involvedObject?.name === name)
      .map(mapEvent)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  })

  ipcMain.handle('k8s:get-related', async (_event, cluster: string, namespace: string, name: string, kind: string) => {
    return fetchRelated(cluster, namespace, name, kind)
  })

  ipcMain.handle(
    'k8s:helm-info',
    async (_event, _cluster: string, _namespace: string, labels: Record<string, string>) => {
      return parseHelmLabels(labels)
    }
  )

  ipcMain.handle(
    'k8s:get-resource-detail',
    async (_event, cluster: string, namespace: string, name: string, kind: string) => {
      const resources = cache.getAll(cluster)
      const resource = resources.find((r) => r.name === name && r.namespace === namespace && r.kind === kind)
      if (!resource) throw new Error(`Resource not found: ${kind}/${name}`)

      const client = getClient(cluster)
      if (!client) throw new Error(`Not connected to ${cluster}`)

      const [eventsResult, logs, related, metrics, pod] = await Promise.all([
        client.coreApi.listNamespacedEvent({ namespace }),
        kind === 'Pod' ? fetchLogs(cluster, namespace, name) : Promise.resolve([]),
        fetchRelated(cluster, namespace, name, kind),
        kind === 'Pod' ? fetchPodMetrics(cluster, namespace, name) : Promise.resolve(null),
        kind === 'Pod' ? client.coreApi.readNamespacedPod({ name, namespace }) : Promise.resolve(null)
      ])

      const filteredEvents: K8sEvent[] = eventsResult.items
        .filter((e) => e.involvedObject?.name === name)
        .map(mapEvent)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp))

      let conditions: PodCondition[] | undefined
      let containers: ContainerStateInfo[] | undefined

      if (pod) {
        conditions = (pod.status?.conditions ?? []).map((c) => ({
          type: c.type,
          status: c.status as 'True' | 'False' | 'Unknown',
          reason: c.reason,
          message: c.message
        }))

        const initStatuses = (pod.status?.initContainerStatuses ?? []).map((cs) => toContainerStateInfo(cs, true))
        const regularStatuses = (pod.status?.containerStatuses ?? []).map((cs) => toContainerStateInfo(cs, false))
        containers = [...initStatuses, ...regularStatuses]
      }

      const helm = parseHelmLabels(resource.labels)

      const detail: ResourceDetail = {
        resource,
        events: filteredEvents,
        logs,
        resources: {
          cpuActual: metrics?.cpuActual,
          memActual: metrics?.memActual,
          metricsAvailable: client.metricsAvailable
        },
        related,
        helm: helm ?? undefined,
        conditions,
        containers
      }

      return detail
    }
  )

  ipcMain.handle('k8s:export-snapshot', async (_event, detail: ResourceDetail) => {
    const markdown = generateSnapshot(detail)
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `horus-snapshot-${detail.resource.name}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })

    if (!result.canceled && result.filePath) {
      writeFileSync(result.filePath, markdown, 'utf-8')
      return result.filePath
    }
    return null
  })

  ipcMain.handle('k8s:get-pod-yaml', async (_event, cluster: string, namespace: string, name: string) => {
    const client = getClient(cluster)
    if (!client) throw new Error(`Not connected to ${cluster}`)
    const pod = await client.coreApi.readNamespacedPod({ name, namespace })
    return JSON.stringify(pod, null, 2)
  })

  ipcMain.handle('k8s:get-namespace-events', async (_event, cluster: string, namespace: string) => {
    const client = getClient(cluster)
    if (!client) throw new Error(`Not connected to ${cluster}`)

    const events = await client.coreApi.listNamespacedEvent({ namespace })
    return events.items.map(mapEvent).sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  })

  ipcMain.handle(
    'k8s:start-log-stream',
    (_event, cluster: string, namespace: string, pod: string, container: string, timestamps?: boolean) => {
      const streamId = startLogStream(cluster, namespace, pod, container, timestamps ?? false, (data) => {
        mainWindow.webContents.send('k8s:log-chunk', { streamId, data })
      })
      return streamId
    }
  )

  ipcMain.handle('k8s:stop-log-stream', (_event, streamId: string) => {
    stopLogStream(streamId)
  })

  ipcMain.handle('k8s:get-rollout', async (_event, cluster: string, namespace: string, name: string) => {
    const client = getClient(cluster)
    if (!client) throw new Error(`Not connected to ${cluster}`)

    const dep = await client.appsApi.readNamespacedDeployment({ name, namespace })
    const rsResult = await client.appsApi.listNamespacedReplicaSet({ namespace })

    const ownedRs = rsResult.items.filter(
      (rs) => rs.metadata?.ownerReferences?.some((o) => o.name === name && o.kind === 'Deployment')
    )

    const currentRevision = dep.metadata?.annotations?.['deployment.kubernetes.io/revision'] ?? '0'

    const replicaSets = ownedRs
      .map((rs) => ({
        name: rs.metadata?.name ?? '',
        revision: rs.metadata?.annotations?.['deployment.kubernetes.io/revision'] ?? '0',
        replicas: rs.status?.replicas ?? 0,
        ready: rs.status?.readyReplicas ?? 0,
        image: rs.spec?.template?.spec?.containers?.[0]?.image ?? '',
        isCurrent: (rs.metadata?.annotations?.['deployment.kubernetes.io/revision'] ?? '0') === currentRevision
      }))
      .filter((rs) => rs.replicas > 0 || rs.isCurrent)
      .sort((a, b) => parseInt(b.revision) - parseInt(a.revision))

    return {
      strategy: dep.spec?.strategy?.type ?? 'RollingUpdate',
      maxSurge: dep.spec?.strategy?.rollingUpdate?.maxSurge?.toString(),
      maxUnavailable: dep.spec?.strategy?.rollingUpdate?.maxUnavailable?.toString(),
      replicas: dep.spec?.replicas ?? 0,
      updatedReplicas: dep.status?.updatedReplicas ?? 0,
      readyReplicas: dep.status?.readyReplicas ?? 0,
      availableReplicas: dep.status?.availableReplicas ?? 0,
      replicaSets
    }
  })

  ipcMain.handle('k8s:get-nodes', async (_event, cluster: string) => {
    const client = getClient(cluster)
    if (!client) throw new Error(`Not connected to ${cluster}`)

    const nodes = await client.coreApi.listNode()
    const pods = cache.getAll(cluster)

    return nodes.items.map((n) => ({
      name: n.metadata?.name ?? '',
      conditions: (n.status?.conditions ?? []).map((c) => ({ type: c.type, status: c.status })),
      capacity: {
        cpu: n.status?.capacity?.cpu ?? '0',
        memory: n.status?.capacity?.memory ?? '0',
        pods: n.status?.capacity?.pods ?? '0'
      },
      allocatable: {
        cpu: n.status?.allocatable?.cpu ?? '0',
        memory: n.status?.allocatable?.memory ?? '0',
        pods: n.status?.allocatable?.pods ?? '0'
      },
      taints: (n.spec?.taints ?? []).map((t) => ({ key: t.key, value: t.value, effect: t.effect })),
      podCount: pods.filter((p) => p.node === n.metadata?.name).length,
      labels: n.metadata?.labels ?? {}
    }))
  })

  ipcMain.handle('k8s:get-cronjob-runs', async (_event, cluster: string, namespace: string, name: string) => {
    const client = getClient(cluster)
    if (!client) throw new Error(`Not connected to ${cluster}`)

    const jobs = await client.batchApi.listNamespacedJob({ namespace })
    const owned = jobs.items
      .filter((j) => j.metadata?.ownerReferences?.some((o) => o.name === name && o.kind === 'CronJob'))
      .sort((a, b) => (b.metadata?.creationTimestamp?.getTime() ?? 0) - (a.metadata?.creationTimestamp?.getTime() ?? 0))
      .slice(0, 15)

    return owned.map((j) => {
      const failed = j.status?.conditions?.find((c) => c.type === 'Failed' && c.status === 'True')
      const complete = j.status?.conditions?.find((c) => c.type === 'Complete' && c.status === 'True')
      const start = j.status?.startTime?.getTime() ?? 0
      const end = j.status?.completionTime?.getTime() ?? Date.now()
      const durationMs = start ? end - start : 0
      const durationStr = durationMs < 60000 ? `${Math.round(durationMs / 1000)}s` : `${Math.round(durationMs / 60000)}m`

      return {
        name: j.metadata?.name ?? '',
        status: failed ? 'Failed' as const : complete ? 'Complete' as const : 'Running' as const,
        startTime: j.metadata?.creationTimestamp?.toISOString() ?? '',
        duration: durationStr,
        pods: (j.status?.active ?? 0) + (j.status?.succeeded ?? 0) + (j.status?.failed ?? 0)
      }
    })
  })

  ipcMain.handle('k8s:get-traffic-path', async (_event, cluster: string, namespace: string, serviceName: string) => {
    const client = getClient(cluster)
    if (!client) throw new Error(`Not connected to ${cluster}`)

    const svc = await client.coreApi.readNamespacedService({ name: serviceName, namespace })
    const slices = await client.discoveryApi
      .listNamespacedEndpointSlice({ namespace, labelSelector: `kubernetes.io/service-name=${serviceName}` })
      .catch(() => ({ items: [] }))

    const readyAddresses: string[] = []
    const notReadyAddresses: string[] = []
    for (const slice of (slices as any).items) {
      for (const ep of slice.endpoints ?? []) {
        const addrs = ep.addresses ?? []
        if (ep.conditions?.ready) readyAddresses.push(...addrs)
        else notReadyAddresses.push(...addrs)
      }
    }

    const pods = cache.getAll(cluster).filter((p) => p.kind === 'Pod' && p.namespace === namespace)
    const selector = svc.spec?.selector ?? {}
    const matchingPods = pods.filter((p) =>
      Object.entries(selector).every(([k, v]) => p.labels[k] === v)
    )

    let ingress: any = undefined
    try {
      const ingresses = await client.networkApi.listNamespacedIngress({ namespace })
      for (const ing of ingresses.items) {
        for (const rule of ing.spec?.rules ?? []) {
          for (const path of rule.http?.paths ?? []) {
            if (path.backend?.service?.name === serviceName) {
              ingress = { name: ing.metadata?.name ?? '', host: rule.host ?? '*', path: path.path ?? '/', serviceName }
              break
            }
          }
          if (ingress) break
        }
        if (ingress) break
      }
    } catch {}

    return {
      ingress,
      service: {
        name: serviceName,
        type: svc.spec?.type ?? 'ClusterIP',
        clusterIP: svc.spec?.clusterIP ?? '',
        externalIP: svc.status?.loadBalancer?.ingress?.[0]?.ip ?? svc.status?.loadBalancer?.ingress?.[0]?.hostname,
        ports: (svc.spec?.ports ?? []).map((p) => `${p.port}/${p.protocol ?? 'TCP'}`)
      },
      endpoints: { ready: readyAddresses.length, notReady: notReadyAddresses.length, addresses: readyAddresses.slice(0, 10) },
      pods: matchingPods.map((p) => ({ name: p.name, ready: p.health === 'healthy', status: p.status }))
    }
  })

  ipcMain.handle('k8s:get-hpas', async (_event, cluster: string, namespace: string) => {
    const client = getClient(cluster)
    if (!client) throw new Error(`Not connected to ${cluster}`)

    const result = await client.autoscalingApi.listNamespacedHorizontalPodAutoscaler({ namespace })
    return result.items.map((h) => ({
      name: h.metadata?.name ?? '',
      targetKind: h.spec?.scaleTargetRef?.kind ?? '',
      targetName: h.spec?.scaleTargetRef?.name ?? '',
      minReplicas: h.spec?.minReplicas ?? 1,
      maxReplicas: h.spec?.maxReplicas ?? 1,
      currentReplicas: h.status?.currentReplicas ?? 0,
      desiredReplicas: h.status?.desiredReplicas ?? 0,
      metrics: (h.status?.currentMetrics ?? []).map((m) => ({
        name: m.resource?.name ?? m.type ?? '',
        current: m.resource?.current?.averageUtilization?.toString() ?? '?',
        target: (h.spec?.metrics?.find((sm) => sm.resource?.name === m.resource?.name)?.resource?.target?.averageUtilization?.toString()) ?? '?'
      }))
    }))
  })

  ipcMain.handle('k8s:get-pvcs', async (_event, cluster: string, namespace: string) => {
    const client = getClient(cluster)
    if (!client) throw new Error(`Not connected to ${cluster}`)

    const pvcs = await client.coreApi.listNamespacedPersistentVolumeClaim({ namespace })
    const pods = cache.getAll(cluster).filter((p) => p.kind === 'Pod' && p.namespace === namespace)

    return pvcs.items.map((pvc) => {
      const pvcName = pvc.metadata?.name ?? ''
      const mountedBy = pods.filter((p) => {
        const allResources = cache.getAll(cluster)
        return allResources.some((r) => r.kind === 'Pod' && r.name === p.name)
      }).map((p) => p.name).slice(0, 5)

      return {
        name: pvcName,
        namespace: pvc.metadata?.namespace ?? '',
        status: pvc.status?.phase ?? 'Unknown',
        capacity: pvc.status?.capacity?.storage ?? pvc.spec?.resources?.requests?.storage ?? '?',
        storageClass: pvc.spec?.storageClassName ?? '',
        accessModes: pvc.spec?.accessModes ?? [],
        volumeName: pvc.spec?.volumeName ?? '',
        pods: mountedBy
      }
    })
  })

  ipcMain.handle('k8s:get-resource-quotas', async (_event, cluster: string, namespace: string) => {
    const client = getClient(cluster)
    if (!client) throw new Error(`Not connected to ${cluster}`)

    const quotas = await client.coreApi.listNamespacedResourceQuota({ namespace })
    return quotas.items.map((q) => ({
      name: q.metadata?.name ?? '',
      namespace: q.metadata?.namespace ?? '',
      items: Object.keys(q.status?.hard ?? {}).map((resource) => ({
        resource,
        used: q.status?.used?.[resource] ?? '0',
        hard: q.status?.hard?.[resource] ?? '0'
      }))
    }))
  })

  ipcMain.handle('k8s:get-config-checks', async (_event, cluster: string, namespace: string) => {
    const client = getClient(cluster)
    if (!client) throw new Error(`Not connected to ${cluster}`)

    const pods = await client.coreApi.listNamespacedPod({ namespace })
    return pods.items.map((pod) => {
      const issues: string[] = []
      for (const c of pod.spec?.containers ?? []) {
        if (!c.resources?.requests && !c.resources?.limits) issues.push(`${c.name}: no resource limits`)
        if (!c.livenessProbe) issues.push(`${c.name}: no liveness probe`)
        if (!c.readinessProbe) issues.push(`${c.name}: no readiness probe`)
      }
      if (pod.spec?.securityContext?.runAsUser === 0) issues.push('running as root')
      const runAsRoot = pod.spec?.containers?.some((c) => c.securityContext?.runAsUser === 0)
      if (runAsRoot) issues.push('container running as root')

      return {
        name: pod.metadata?.name ?? '',
        namespace: pod.metadata?.namespace ?? '',
        kind: 'Pod' as const,
        issues
      }
    }).filter((c) => c.issues.length > 0)
  })

  ipcMain.handle('k8s:get-rbac', async (_event, cluster: string, namespace: string) => {
    const client = getClient(cluster)
    if (!client) throw new Error(`Not connected to ${cluster}`)

    const bindings = await client.rbacApi.listNamespacedRoleBinding({ namespace })
    return bindings.items.map((b) => ({
      name: b.metadata?.name ?? '',
      role: b.roleRef?.name ?? '',
      roleKind: b.roleRef?.kind ?? '',
      subjects: (b.subjects ?? []).map((s) => ({ kind: s.kind, name: s.name, namespace: s.namespace }))
    }))
  })

  ipcMain.handle('k8s:get-network-policies', async (_event, cluster: string, namespace: string) => {
    const client = getClient(cluster)
    if (!client) throw new Error(`Not connected to ${cluster}`)

    const policies = await client.networkApi.listNamespacedNetworkPolicy({ namespace })
    const pods = cache.getAll(cluster).filter((p) => p.kind === 'Pod' && p.namespace === namespace)

    return policies.items.map((np) => {
      const selector = np.spec?.podSelector?.matchLabels ?? {}
      const matching = Object.keys(selector).length === 0
        ? pods.length
        : pods.filter((p) => Object.entries(selector).every(([k, v]) => p.labels[k] === v)).length

      return {
        name: np.metadata?.name ?? '',
        podSelector: selector,
        matchingPods: matching,
        ingressRules: np.spec?.ingress?.length ?? 0,
        egressRules: np.spec?.egress?.length ?? 0
      }
    })
  })

  ipcMain.handle('k8s:get-security-scan', async (_event, cluster: string, namespace: string) => {
    const client = getClient(cluster)
    if (!client) throw new Error(`Not connected to ${cluster}`)

    const pods = await client.coreApi.listNamespacedPod({ namespace })
    const netpols = await client.networkApi.listNamespacedNetworkPolicy({ namespace }).catch(() => ({ items: [] }))

    return pods.items.map((pod) => {
      const issues: string[] = []
      const labels = pod.metadata?.labels ?? {}

      for (const c of pod.spec?.containers ?? []) {
        if (c.image?.includes(':latest') || !c.image?.includes(':')) issues.push(`${c.name}: using :latest or untagged image`)
        if (c.securityContext?.privileged) issues.push(`${c.name}: privileged container`)
        if (c.securityContext?.runAsUser === 0) issues.push(`${c.name}: running as root`)
      }

      if (pod.spec?.hostNetwork) issues.push('hostNetwork enabled')
      if (pod.spec?.automountServiceAccountToken !== false) {
        const sa = pod.spec?.serviceAccountName ?? 'default'
        if (sa === 'default') issues.push('using default service account')
      }

      const covered = netpols.items.some((np) => {
        const sel = np.spec?.podSelector?.matchLabels ?? {}
        return Object.keys(sel).length === 0 || Object.entries(sel).every(([k, v]) => labels[k] === v)
      })
      if (!covered) issues.push('no network policy')

      return { pod: pod.metadata?.name ?? '', namespace: pod.metadata?.namespace ?? '', issues }
    }).filter((s) => s.issues.length > 0)
  })

  ipcMain.handle('k8s:get-secret-usage', async (_event, cluster: string, namespace: string) => {
    const client = getClient(cluster)
    if (!client) throw new Error(`Not connected to ${cluster}`)

    const [secrets, pods] = await Promise.all([
      client.coreApi.listNamespacedSecret({ namespace }),
      client.coreApi.listNamespacedPod({ namespace })
    ])

    return secrets.items.map((s) => {
      const secretName = s.metadata?.name ?? ''
      const referencedBy: string[] = []

      for (const pod of pods.items) {
        const refs = [
          ...(pod.spec?.containers?.flatMap((c) => c.envFrom ?? []) ?? []).filter((e) => e.secretRef?.name === secretName),
          ...(pod.spec?.containers?.flatMap((c) => c.env ?? []) ?? []).filter((e) => e.valueFrom?.secretKeyRef?.name === secretName),
          ...(pod.spec?.volumes ?? []).filter((v) => v.secret?.secretName === secretName)
        ]
        if (refs.length > 0) referencedBy.push(pod.metadata?.name ?? '')
      }

      const age = s.metadata?.creationTimestamp?.toISOString() ?? ''

      return {
        name: secretName,
        namespace: s.metadata?.namespace ?? '',
        type: s.type ?? 'Opaque',
        age,
        referencedBy: referencedBy.slice(0, 10)
      }
    })
  })

  ipcMain.handle('k8s:delete-pod', async (_event, cluster: string, namespace: string, name: string) => {
    const client = getClient(cluster)
    if (!client) throw new Error(`Not connected to ${cluster}`)
    await client.coreApi.deleteNamespacedPod({ name, namespace })
  })

  ipcMain.handle('k8s:scale-deploy', async (_event, cluster: string, namespace: string, name: string, replicas: number) => {
    const client = getClient(cluster)
    if (!client) throw new Error(`Not connected to ${cluster}`)
    await client.appsApi.patchNamespacedDeploymentScale({
      name,
      namespace,
      body: { spec: { replicas } }
    })
  })

  const portForwards = new Map<string, net.Server>()
  let pfCounter = 0

  ipcMain.handle('k8s:start-port-forward', async (_event, cluster: string, namespace: string, pod: string, localPort: number, remotePort: number) => {
    const kc = getKubeConfig(cluster)
    const forward = new k8s.PortForward(kc)
    const id = `pf-${++pfCounter}`

    const server = net.createServer((socket) => {
      forward.portForward(namespace, pod, [remotePort], socket, null, socket)
    })

    server.listen(localPort, '127.0.0.1')
    portForwards.set(id, server)
    return id
  })

  ipcMain.handle('k8s:stop-port-forward', (_event, id: string) => {
    const server = portForwards.get(id)
    if (server) {
      server.close()
      portForwards.delete(id)
    }
  })

  ipcMain.handle('k8s:get-global-events', async (_event, cluster: string, query: string) => {
    const client = getClient(cluster)
    if (!client) throw new Error(`Not connected to ${cluster}`)

    const events = await client.coreApi.listEventForAllNamespaces()
    const lower = query.toLowerCase()
    return events.items
      .filter((e) => {
        if (!query) return true
        return (e.reason?.toLowerCase().includes(lower) ||
          e.message?.toLowerCase().includes(lower) ||
          e.involvedObject?.name?.toLowerCase().includes(lower) ||
          e.involvedObject?.namespace?.toLowerCase().includes(lower))
      })
      .map(mapEvent)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 200)
  })

  ipcMain.handle('k8s:analyze-root-cause', async (_event, cluster: string, namespace: string, name: string, kind: string) => {
    const client = getClient(cluster)
    if (!client) throw new Error(`Not connected to ${cluster}`)

    const eventsResult = await client.coreApi.listNamespacedEvent({ namespace })
    const events = eventsResult.items.filter((e) => e.involvedObject?.name === name)

    const evidence: string[] = []
    let summary = ''
    let suggestion = ''
    let confidence: 'high' | 'medium' | 'low' = 'low'

    const reasons = events.map((e) => e.reason ?? '').filter(Boolean)
    const messages = events.map((e) => e.message ?? '').filter(Boolean)

    if (kind === 'Pod') {
      const pod = await client.coreApi.readNamespacedPod({ name, namespace })
      const statuses = pod.status?.containerStatuses ?? []

      for (const cs of statuses) {
        if (cs.state?.waiting?.reason === 'CrashLoopBackOff') {
          evidence.push(`Container ${cs.name} in CrashLoopBackOff`)
          if (cs.lastState?.terminated?.reason === 'OOMKilled') {
            summary = 'Pod is being OOM killed repeatedly'
            suggestion = 'Increase memory limits for this container or investigate memory leaks'
            confidence = 'high'
            evidence.push(`Last termination: OOMKilled (exit code ${cs.lastState.terminated.exitCode})`)
          } else if (cs.lastState?.terminated?.exitCode === 1) {
            summary = 'Application is crashing on startup'
            suggestion = 'Check the logs for stack traces or config errors. The container starts but exits immediately.'
            confidence = 'high'
            evidence.push(`Last exit code: ${cs.lastState.terminated.exitCode}`)
          } else {
            summary = 'Pod is in a crash loop'
            suggestion = 'Check container logs for the crash reason. Look for missing env vars, bad config, or dependency failures.'
            confidence = 'medium'
          }
          evidence.push(`Restart count: ${cs.restartCount}`)
        }

        if (cs.state?.waiting?.reason === 'ImagePullBackOff' || cs.state?.waiting?.reason === 'ErrImagePull') {
          summary = 'Container image cannot be pulled'
          suggestion = 'Check the image name and tag. If private registry, verify imagePullSecrets.'
          confidence = 'high'
          evidence.push(`Image: ${cs.image}`)
          evidence.push(`Reason: ${cs.state.waiting.reason}`)
        }

        if (cs.state?.waiting?.reason === 'CreateContainerConfigError') {
          summary = 'Container config is invalid'
          suggestion = 'A referenced ConfigMap or Secret likely does not exist. Check env and volume references.'
          confidence = 'high'
          evidence.push(`Reason: ${cs.state.waiting.message ?? cs.state.waiting.reason}`)
        }
      }

      if (!summary && pod.status?.phase === 'Pending') {
        const scheduling = events.find((e) => e.reason === 'FailedScheduling')
        if (scheduling) {
          summary = 'Pod cannot be scheduled'
          evidence.push(scheduling.message ?? '')
          if (scheduling.message?.includes('Insufficient cpu') || scheduling.message?.includes('Insufficient memory')) {
            suggestion = 'Cluster does not have enough resources. Scale up nodes or reduce resource requests.'
            confidence = 'high'
          } else if (scheduling.message?.includes('node(s) had taint')) {
            suggestion = 'No nodes match the pod tolerations. Add tolerations or remove taints.'
            confidence = 'high'
          } else {
            suggestion = 'Check node affinity, tolerations, and available cluster resources.'
            confidence = 'medium'
          }
        }
      }

      if (!summary && reasons.includes('Unhealthy')) {
        const unhealthyMsgs = messages.filter((m) => m.includes('probe failed'))
        summary = 'Health probes are failing'
        suggestion = 'The readiness or liveness probe is failing. Check the probe config and ensure the app is responding on the configured port/path.'
        confidence = 'medium'
        for (const m of unhealthyMsgs.slice(0, 3)) evidence.push(m)
      }

      if (!summary && reasons.includes('Evicted')) {
        summary = 'Pod was evicted'
        suggestion = 'The node ran out of resources (disk, memory, or PIDs). Check node conditions.'
        confidence = 'high'
        evidence.push(`Status: ${pod.status?.reason ?? 'Evicted'}`)
      }
    }

    if (!summary) {
      summary = 'No clear root cause identified'
      suggestion = 'Review the events and logs manually for clues.'
      confidence = 'low'
      for (const m of messages.slice(0, 5)) evidence.push(m)
    }

    return { summary, confidence, evidence, suggestion }
  })

  ipcMain.handle('k8s:get-topology', async (_event, cluster: string, namespace: string) => {
    const client = getClient(cluster)
    if (!client) throw new Error(`Not connected to ${cluster}`)

    const [pods, services, deployments, ingresses] = await Promise.all([
      client.coreApi.listNamespacedPod({ namespace }),
      client.coreApi.listNamespacedService({ namespace }),
      client.appsApi.listNamespacedDeployment({ namespace }),
      client.networkApi.listNamespacedIngress({ namespace }).catch(() => ({ items: [] }))
    ])

    const nodes: any[] = []
    const edges: any[] = []

    for (const dep of deployments.items) {
      const id = `dep-${dep.metadata?.name}`
      nodes.push({ id, kind: 'Deployment', name: dep.metadata?.name ?? '', health: 'healthy' })
    }

    for (const svc of services.items) {
      const id = `svc-${svc.metadata?.name}`
      nodes.push({ id, kind: 'Service', name: svc.metadata?.name ?? '', health: 'healthy' })

      const selector = svc.spec?.selector ?? {}
      for (const pod of pods.items) {
        const labels = pod.metadata?.labels ?? {}
        if (Object.entries(selector).every(([k, v]) => labels[k] === v)) {
          const owner = pod.metadata?.ownerReferences?.[0]
          if (owner?.kind === 'ReplicaSet') {
            const depName = deployments.items.find((d) =>
              d.metadata?.name && owner.name?.startsWith(d.metadata.name)
            )?.metadata?.name
            if (depName) {
              edges.push({ from: `svc-${svc.metadata?.name}`, to: `dep-${depName}`, label: '' })
            }
          }
        }
      }
    }

    for (const ing of ingresses.items) {
      const id = `ing-${ing.metadata?.name}`
      nodes.push({ id, kind: 'Ingress', name: ing.metadata?.name ?? '', health: 'healthy' })
      for (const rule of ing.spec?.rules ?? []) {
        for (const path of rule.http?.paths ?? []) {
          if (path.backend?.service?.name) {
            edges.push({ from: id, to: `svc-${path.backend.service.name}`, label: `${rule.host ?? '*'}${path.path ?? '/'}` })
          }
        }
      }
    }

    return { nodes, edges }
  })

  ipcMain.handle('k8s:get-sizing-recs', async (_event, cluster: string, namespace: string) => {
    const client = getClient(cluster)
    if (!client) throw new Error(`Not connected to ${cluster}`)

    const pods = await client.coreApi.listNamespacedPod({ namespace })

    const usage = new Map<string, { cpu: number; mem: number }>()
    try {
      const metricsClient = new k8s.Metrics(getKubeConfig(cluster))
      const podMetrics = await metricsClient.getPodMetrics(namespace)
      for (const pm of podMetrics.items) {
        for (const c of pm.containers ?? []) {
          usage.set(`${pm.metadata?.name}/${c.name}`, {
            cpu: parseCpu(c.usage?.cpu ?? '0'),
            mem: parseMem(c.usage?.memory ?? '0')
          })
        }
      }
    } catch {
      return { metricsAvailable: false, recs: [] }
    }

    const recs: any[] = []
    for (const pod of pods.items) {
      for (const c of pod.spec?.containers ?? []) {
        const cpuReq = parseCpu(c.resources?.requests?.cpu ?? '')
        const memReq = parseMem(c.resources?.requests?.memory ?? '')
        const actual = usage.get(`${pod.metadata?.name}/${c.name}`)
        if (!actual) continue

        const cpuPct = cpuReq > 0 ? Math.round((actual.cpu / cpuReq) * 100) : -1
        const memPct = memReq > 0 ? Math.round((actual.mem / memReq) * 100) : -1
        const overProvisioned = (cpuPct >= 0 && cpuPct < 30) || (memPct >= 0 && memPct < 30)
        const tight = cpuPct > 90 || memPct > 90

        recs.push({
          pod: pod.metadata?.name ?? '',
          namespace: pod.metadata?.namespace ?? '',
          container: c.name,
          cpuRequest: c.resources?.requests?.cpu ?? 'none',
          cpuActual: `${Math.round(actual.cpu * 1000)}m`,
          cpuPct,
          memRequest: c.resources?.requests?.memory ?? 'none',
          memActual: `${Math.round(actual.mem * 1024)}Mi`,
          memPct,
          flag: tight ? 'tight' : overProvisioned ? 'over' : 'ok'
        })
      }
    }

    recs.sort((a, b) => {
      const order = { over: 0, tight: 1, ok: 2 } as Record<string, number>
      return order[a.flag] - order[b.flag]
    })
    return { metricsAvailable: true, recs }
  })

  ipcMain.handle('k8s:trace-request', async (_event, cluster: string, host: string) => {
    const client = getClient(cluster)
    if (!client) throw new Error(`Not connected to ${cluster}`)

    const nodes: any[] = []
    const edges: any[] = []
    const add = (n: any) => { nodes.push(n); return n.id }
    const link = (from: string, to: string) => edges.push({ from, to })

    const ingresses = await client.networkApi.listIngressForAllNamespaces().catch(() => ({ items: [] }))
    let matchedIngress: any = null
    let ns = ''
    let matchedRule: any = null

    for (const ing of (ingresses as any).items) {
      for (const rule of ing.spec?.rules ?? []) {
        if (rule.host === host || host === '*') {
          matchedIngress = ing
          matchedRule = rule
          ns = ing.metadata?.namespace ?? ''
          break
        }
      }
      if (matchedIngress) break
    }

    if (!matchedIngress) {
      add({ id: 'host', kind: 'Host', label: host, status: 'error', issues: ['No ingress rule matches this host'] })
      return {
        url: host,
        nodes,
        edges,
        rootCause: `No ingress rule matches host "${host}"`,
        suggestion: 'Create an ingress with a rule for this hostname, or check for typos.'
      }
    }

    const tls = matchedIngress.spec?.tls?.some((t: any) => t.hosts?.includes(host))
    const ingressClass =
      matchedIngress.spec?.ingressClassName ??
      matchedIngress.metadata?.annotations?.['kubernetes.io/ingress.class'] ??
      'unknown'
    const hostId = add({
      id: 'host',
      kind: 'Host',
      label: host,
      sublabel: `${matchedIngress.metadata?.name} · ${ingressClass} · ${tls ? 'TLS' : 'no TLS'}`,
      status: 'ok',
      issues: []
    })

    const lbIp =
      matchedIngress.status?.loadBalancer?.ingress?.[0]?.ip ??
      matchedIngress.status?.loadBalancer?.ingress?.[0]?.hostname ??
      ''
    let entryId = hostId
    if (lbIp) {
      const lbId = add({ id: 'lb', kind: 'LoadBalancer', label: lbIp, sublabel: 'external', status: 'ok', issues: [] })
      link(hostId, lbId)
      entryId = lbId
    }

    const pods = await client.coreApi.listNamespacedPod({ namespace: ns }).catch(() => ({ items: [] }))

    let worstSummary = ''
    let worstSuggestion = ''
    let worstRank = -1
    const rank = (s: string) => (s === 'error' ? 2 : s === 'warning' ? 1 : 0)
    const consider = (status: string, summary: string, suggestion: string) => {
      if (rank(status) > worstRank) {
        worstRank = rank(status)
        worstSummary = summary
        worstSuggestion = suggestion
      }
    }

    const paths = matchedRule.http?.paths ?? []
    let pi = 0
    for (const path of paths) {
      pi++
      const svcName = path.backend?.service?.name ?? ''
      const pathStr = path.path ?? '/'
      const pathId = add({ id: `path-${pi}`, kind: 'Path', label: pathStr, sublabel: svcName, status: 'ok', issues: [] })
      link(entryId, pathId)

      if (!svcName) {
        nodes[nodes.length - 1].status = 'error'
        nodes[nodes.length - 1].issues = ['No backend service']
        consider('error', `Path ${pathStr} has no backend service`, 'Fix the ingress backend reference.')
        continue
      }

      let svc: any = null
      try {
        svc = await client.coreApi.readNamespacedService({ name: svcName, namespace: ns })
      } catch {}

      if (!svc) {
        const sId = add({ id: `svc-${pi}`, kind: 'Service', label: svcName, status: 'error', issues: ['Service not found'] })
        link(pathId, sId)
        consider('error', `Service "${svcName}" does not exist`, 'Create the service or fix the ingress backend.')
        continue
      }

      const ports = (svc.spec?.ports ?? []).map((p: any) => `${p.port}/${p.protocol ?? 'TCP'}`).join(', ')
      const svcId = add({
        id: `svc-${pi}`,
        kind: 'Service',
        label: svcName,
        sublabel: `${svc.spec?.type ?? 'ClusterIP'} · ${ports}`,
        status: 'ok',
        issues: []
      })
      link(pathId, svcId)

      // EndpointSlice (discovery.k8s.io/v1) keyed by service name label
      let ready = 0
      let notReady = 0
      const slices = await client.discoveryApi
        .listNamespacedEndpointSlice({ namespace: ns, labelSelector: `kubernetes.io/service-name=${svcName}` })
        .catch(() => ({ items: [] }))
      for (const slice of (slices as any).items) {
        for (const ep of slice.endpoints ?? []) {
          const count = ep.addresses?.length ?? 1
          if (ep.conditions?.ready) ready += count
          else notReady += count
        }
      }

      const epStatus = ready > 0 ? (notReady > 0 ? 'warning' : 'ok') : 'error'
      const epIssues: string[] = []
      if (ready === 0 && notReady === 0) epIssues.push('No endpoints — selector matches zero pods')
      else if (ready === 0) epIssues.push(`0 ready, ${notReady} not ready`)
      const epId = add({
        id: `ep-${pi}`,
        kind: 'Endpoints',
        label: `${ready} ready`,
        sublabel: notReady > 0 ? `${notReady} not ready` : '',
        status: epStatus,
        issues: epIssues
      })
      link(svcId, epId)

      const selector = svc.spec?.selector ?? {}
      const matching = (pods as any).items.filter((p: any) => {
        const labels = p.metadata?.labels ?? {}
        return Object.keys(selector).length > 0 && Object.entries(selector).every(([k, v]) => labels[k] === v)
      })

      if (matching.length === 0) {
        const pid = add({ id: `pods-${pi}`, kind: 'Pod', label: 'no pods', status: 'error', issues: ['Selector matches no pods'] })
        link(epId, pid)
        consider('error', `${svcName}: selector matches zero pods`, 'Deployment may be scaled to 0 or the selector is wrong.')
        continue
      }

      for (const pod of matching.slice(0, 6)) {
        const isReady = pod.status?.conditions?.find((c: any) => c.type === 'Ready')?.status === 'True'
        const podIssues: string[] = []
        let podStatus: string = isReady ? 'ok' : 'warning'
        for (const cs of pod.status?.containerStatuses ?? []) {
          const reason = cs.state?.waiting?.reason
          if (reason === 'CrashLoopBackOff') {
            podStatus = 'error'
            const last = cs.lastState?.terminated?.reason ?? ''
            podIssues.push(`CrashLoopBackOff${last ? ` (${last})` : ''}`)
          } else if (reason === 'ImagePullBackOff' || reason === 'ErrImagePull') {
            podStatus = 'error'
            podIssues.push('ImagePullBackOff')
          } else if (cs.state?.terminated && cs.state.terminated.exitCode !== 0) {
            podStatus = 'error'
            podIssues.push(`exited ${cs.state.terminated.exitCode}`)
          }
        }
        const podId = add({
          id: `pod-${pi}-${pod.metadata?.uid}`,
          kind: 'Pod',
          label: pod.metadata?.name ?? '',
          sublabel: pod.status?.phase ?? '',
          status: podStatus,
          issues: podIssues
        })
        link(epId, podId)
      }

      const crashing = matching.some((p: any) =>
        p.status?.containerStatuses?.some((cs: any) =>
          ['CrashLoopBackOff', 'ImagePullBackOff', 'ErrImagePull'].includes(cs.state?.waiting?.reason)
        )
      )
      if (ready === 0 && crashing) {
        const oom = matching.some((p: any) =>
          p.status?.containerStatuses?.some((cs: any) => cs.lastState?.terminated?.reason === 'OOMKilled')
        )
        consider(
          'error',
          oom
            ? `503 on ${pathStr}: pods OOM killed, 0 ready endpoints`
            : `503 on ${pathStr}: pods crash-looping, 0 ready endpoints`,
          oom ? 'Increase memory limits.' : 'Check pod logs for the crash reason.'
        )
      } else if (ready === 0) {
        consider('error', `503 on ${pathStr}: 0 ready endpoints (readiness failing)`, 'Check readiness probe config and the port the app listens on.')
      } else if (notReady > 0) {
        consider('warning', `${pathStr}: ${notReady} backend(s) not ready, partially degraded`, 'Some pods are unhealthy; check their logs.')
      }
    }

    if (worstRank <= 0) {
      worstSummary = 'All paths healthy. Traffic reaches ready pods at every hop.'
      worstSuggestion = 'If you still see errors, the cause is inside the app (DB, upstream deps), not the routing path.'
    }

    return { url: host, nodes, edges, rootCause: worstSummary, suggestion: worstSuggestion }
  })
}
