import * as k8s from '@kubernetes/client-node'
import type { K8sResource } from '../../shared/types'
import { scoreHealth } from './health'
import { getKubeConfig } from './client'

export type WatchCallback = (resources: K8sResource[]) => void

interface ActiveWatch {
  abort: AbortController
}

const activeWatches = new Map<string, ActiveWatch[]>()

function podToResource(pod: k8s.V1Pod, cluster: string): K8sResource {
  const status = pod.status?.containerStatuses?.[0]?.state?.waiting?.reason ?? pod.status?.phase ?? 'Unknown'
  const ready = pod.status?.conditions?.some((c) => c.type === 'Ready' && c.status === 'True') ?? false
  const restarts = pod.status?.containerStatuses?.reduce((sum, c) => sum + (c.restartCount ?? 0), 0) ?? 0
  const owner = pod.metadata?.ownerReferences?.[0]

  return {
    uid: pod.metadata?.uid ?? '',
    name: pod.metadata?.name ?? '',
    namespace: pod.metadata?.namespace ?? '',
    kind: 'Pod',
    cluster,
    status,
    health: scoreHealth('Pod', status, ready, restarts),
    restarts,
    age: pod.metadata?.creationTimestamp?.toISOString() ?? '',
    node: pod.spec?.nodeName ?? '',
    labels: pod.metadata?.labels ?? {},
    ownerKind: owner?.kind,
    ownerName: owner?.name
  }
}

function deploymentToResource(dep: k8s.V1Deployment, cluster: string): K8sResource {
  const available = dep.status?.conditions?.find((c) => c.type === 'Available')
  const readyReplicas = dep.status?.readyReplicas ?? 0
  const desiredReplicas = dep.spec?.replicas ?? 0
  const status = available?.status === 'True' ? `${readyReplicas}/${desiredReplicas} ready` : 'Progressing'
  const ready = available?.status === 'True'

  return {
    uid: dep.metadata?.uid ?? '',
    name: dep.metadata?.name ?? '',
    namespace: dep.metadata?.namespace ?? '',
    kind: 'Deployment',
    cluster,
    status,
    health: ready ? 'healthy' : 'warning',
    restarts: 0,
    age: dep.metadata?.creationTimestamp?.toISOString() ?? '',
    node: '-',
    labels: dep.metadata?.labels ?? {},
    ownerKind: undefined,
    ownerName: undefined
  }
}

function jobToResource(job: k8s.V1Job, cluster: string): K8sResource {
  const failed = job.status?.conditions?.find((c) => c.type === 'Failed' && c.status === 'True')
  const complete = job.status?.conditions?.find((c) => c.type === 'Complete' && c.status === 'True')
  const succeeded = job.status?.succeeded ?? 0
  const desired = job.spec?.completions ?? 1
  const status = failed ? 'Failed' : complete ? `Complete (${succeeded}/${desired})` : 'Running'

  return {
    uid: job.metadata?.uid ?? '',
    name: job.metadata?.name ?? '',
    namespace: job.metadata?.namespace ?? '',
    kind: 'Job',
    cluster,
    status,
    health: scoreHealth('Job', failed ? 'Failed' : complete ? 'Complete' : 'Running', false, 0),
    restarts: job.status?.failed ?? 0,
    age: job.metadata?.creationTimestamp?.toISOString() ?? '',
    node: '-',
    labels: job.metadata?.labels ?? {},
    ownerKind: undefined,
    ownerName: undefined
  }
}

function serviceToResource(svc: k8s.V1Service, cluster: string): K8sResource {
  const type = svc.spec?.type ?? 'ClusterIP'
  const ports = (svc.spec?.ports ?? []).map((p) => `${p.port}`).join(',')

  return {
    uid: svc.metadata?.uid ?? '',
    name: svc.metadata?.name ?? '',
    namespace: svc.metadata?.namespace ?? '',
    kind: 'Service',
    cluster,
    status: `${type} ${ports}`,
    health: 'healthy',
    restarts: 0,
    age: svc.metadata?.creationTimestamp?.toISOString() ?? '',
    node: '-',
    labels: svc.metadata?.labels ?? {},
    ownerKind: undefined,
    ownerName: undefined
  }
}

function ingressToResource(ing: k8s.V1Ingress, cluster: string): K8sResource {
  const hosts = (ing.spec?.rules ?? []).map((r) => r.host ?? '*').join(', ')

  return {
    uid: ing.metadata?.uid ?? '',
    name: ing.metadata?.name ?? '',
    namespace: ing.metadata?.namespace ?? '',
    kind: 'Ingress',
    cluster,
    status: hosts,
    health: 'healthy',
    restarts: 0,
    age: ing.metadata?.creationTimestamp?.toISOString() ?? '',
    node: '-',
    labels: ing.metadata?.labels ?? {},
    ownerKind: undefined,
    ownerName: undefined
  }
}

function cronJobToResource(cj: k8s.V1CronJob, cluster: string): K8sResource {
  const suspended = cj.spec?.suspend ?? false
  const lastSchedule = cj.status?.lastScheduleTime?.toISOString() ?? ''
  const status = suspended ? 'Suspended' : lastSchedule ? 'Active' : 'Pending'

  return {
    uid: cj.metadata?.uid ?? '',
    name: cj.metadata?.name ?? '',
    namespace: cj.metadata?.namespace ?? '',
    kind: 'CronJob',
    cluster,
    status,
    health: suspended ? 'warning' : 'healthy',
    restarts: 0,
    age: cj.metadata?.creationTimestamp?.toISOString() ?? '',
    node: '-',
    labels: cj.metadata?.labels ?? {},
    ownerKind: undefined,
    ownerName: undefined
  }
}

export async function startWatching(context: string, onUpdate: WatchCallback): Promise<void> {
  const kc = getKubeConfig(context)
  const coreApi = kc.makeApiClient(k8s.CoreV1Api)
  const appsApi = kc.makeApiClient(k8s.AppsV1Api)
  const batchApi = kc.makeApiClient(k8s.BatchV1Api)
  const networkApi = kc.makeApiClient(k8s.NetworkingV1Api)

  const resources: Map<string, K8sResource> = new Map()

  const emitUpdate = () => {
    onUpdate([...resources.values()])
  }

  try {
    const [pods, deployments, jobs, cronJobs, services, ingresses] = await Promise.all([
      coreApi.listPodForAllNamespaces(),
      appsApi.listDeploymentForAllNamespaces(),
      batchApi.listJobForAllNamespaces(),
      batchApi.listCronJobForAllNamespaces(),
      coreApi.listServiceForAllNamespaces(),
      networkApi.listIngressForAllNamespaces().catch(() => ({ items: [] }))
    ])

    for (const pod of pods.items) resources.set(podToResource(pod, context).uid, podToResource(pod, context))
    for (const dep of deployments.items) resources.set(deploymentToResource(dep, context).uid, deploymentToResource(dep, context))
    for (const job of jobs.items) resources.set(jobToResource(job, context).uid, jobToResource(job, context))
    for (const cj of cronJobs.items) resources.set(cronJobToResource(cj, context).uid, cronJobToResource(cj, context))
    for (const svc of services.items) resources.set(serviceToResource(svc, context).uid, serviceToResource(svc, context))
    for (const ing of (ingresses as any).items) resources.set(ingressToResource(ing, context).uid, ingressToResource(ing, context))

    emitUpdate()
  } catch (err) {
    console.error(`Failed initial list for ${context}:`, err)
  }

  const watch = new k8s.Watch(kc)
  const watches: ActiveWatch[] = []

  const watchPath = async (path: string, toResource: (obj: any) => K8sResource) => {
    const abort = new AbortController()
    watches.push({ abort })
    let retryDelay = 1000

    const startWatch = async () => {
      try {
        await watch.watch(
          path,
          {},
          (type: string, obj: any) => {
            const r = toResource(obj)
            if (type === 'DELETED') {
              resources.delete(r.uid)
            } else {
              resources.set(r.uid, r)
            }
            emitUpdate()
          },
          () => {
            if (abort.signal.aborted) return
            retryDelay = Math.min(retryDelay * 2, 30_000)
            setTimeout(startWatch, retryDelay)
          }
        )
        retryDelay = 1000
      } catch {
        if (abort.signal.aborted) return
        retryDelay = Math.min(retryDelay * 2, 30_000)
        setTimeout(startWatch, retryDelay)
      }
    }

    startWatch()
  }

  watchPath('/api/v1/pods', (obj) => podToResource(obj, context))
  watchPath('/apis/apps/v1/deployments', (obj) => deploymentToResource(obj, context))
  watchPath('/apis/batch/v1/jobs', (obj) => jobToResource(obj, context))
  watchPath('/apis/batch/v1/cronjobs', (obj) => cronJobToResource(obj, context))
  watchPath('/api/v1/services', (obj) => serviceToResource(obj, context))
  watchPath('/apis/networking.k8s.io/v1/ingresses', (obj) => ingressToResource(obj, context))

  activeWatches.set(context, watches)
}

export function stopWatching(context: string): void {
  const watches = activeWatches.get(context)
  if (watches) {
    for (const w of watches) {
      w.abort.abort()
    }
    activeWatches.delete(context)
  }
}
