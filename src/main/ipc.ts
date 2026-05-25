import { ipcMain, dialog, BrowserWindow, Notification } from 'electron'
import { loadContexts, connectCluster, disconnectCluster, getClient } from './k8s/client'
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

function mapEvent(e: any): K8sEvent {
  return {
    timestamp: e.lastTimestamp?.toISOString() ?? e.eventTime?.toISOString() ?? '',
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

  ipcMain.handle('k8s:get-resource-yaml', async (_event, cluster: string, namespace: string, name: string, kind: string) => {
    const client = getClient(cluster)
    if (!client) throw new Error(`Not connected to ${cluster}`)

    let resource: any
    switch (kind) {
      case 'Pod': resource = await client.coreApi.readNamespacedPod({ name, namespace }); break
      case 'Deployment': resource = await client.appsApi.readNamespacedDeployment({ name, namespace }); break
      case 'Service': resource = await client.coreApi.readNamespacedService({ name, namespace }); break
      case 'ConfigMap': resource = await client.coreApi.readNamespacedConfigMap({ name, namespace }); break
      case 'Job': resource = await client.batchApi.readNamespacedJob({ name, namespace }); break
      default: throw new Error(`Unsupported kind: ${kind}`)
    }
    return JSON.stringify(resource, null, 2)
  })
}
