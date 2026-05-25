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

export async function startWatching(context: string, onUpdate: WatchCallback): Promise<void> {
  const kc = getKubeConfig(context)
  const coreApi = kc.makeApiClient(k8s.CoreV1Api)
  const appsApi = kc.makeApiClient(k8s.AppsV1Api)
  const batchApi = kc.makeApiClient(k8s.BatchV1Api)

  const resources: Map<string, K8sResource> = new Map()

  const emitUpdate = () => {
    onUpdate([...resources.values()])
  }

  try {
    const [pods, deployments, jobs] = await Promise.all([
      coreApi.listPodForAllNamespaces(),
      appsApi.listDeploymentForAllNamespaces(),
      batchApi.listJobForAllNamespaces()
    ])

    for (const pod of pods.items) {
      const r = podToResource(pod, context)
      resources.set(r.uid, r)
    }
    for (const dep of deployments.items) {
      const r = deploymentToResource(dep, context)
      resources.set(r.uid, r)
    }
    for (const job of jobs.items) {
      const r = jobToResource(job, context)
      resources.set(r.uid, r)
    }

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
          (err: any) => {
            if (abort.signal.aborted) return
            retryDelay = Math.min(retryDelay * 2, 30_000)
            setTimeout(startWatch, retryDelay)
          }
        )
        retryDelay = 1000
      } catch (err) {
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
