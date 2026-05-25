import * as k8s from '@kubernetes/client-node'

export interface ClusterClient {
  context: string
  coreApi: k8s.CoreV1Api
  appsApi: k8s.AppsV1Api
  batchApi: k8s.BatchV1Api
  networkApi: k8s.NetworkingV1Api
  autoscalingApi: k8s.AutoscalingV2Api
  rbacApi: k8s.RbacAuthorizationV1Api
  metricsAvailable: boolean
}

const clients = new Map<string, ClusterClient>()

export function loadContexts(): string[] {
  const kc = new k8s.KubeConfig()
  kc.loadFromDefault()

  const seen = new Map<string, string>()
  const unique: string[] = []

  for (const ctx of kc.contexts) {
    const cluster = kc.clusters.find((c) => c.name === ctx.cluster)
    const server = cluster?.server ?? ctx.name
    if (!seen.has(server)) {
      seen.set(server, ctx.name)
      unique.push(ctx.name)
    }
  }

  return unique
}

export function connectCluster(context: string): ClusterClient {
  if (clients.has(context)) return clients.get(context)!

  const kc = new k8s.KubeConfig()
  kc.loadFromDefault()
  kc.setCurrentContext(context)

  const client: ClusterClient = {
    context,
    coreApi: kc.makeApiClient(k8s.CoreV1Api),
    appsApi: kc.makeApiClient(k8s.AppsV1Api),
    batchApi: kc.makeApiClient(k8s.BatchV1Api),
    networkApi: kc.makeApiClient(k8s.NetworkingV1Api),
    autoscalingApi: kc.makeApiClient(k8s.AutoscalingV2Api),
    rbacApi: kc.makeApiClient(k8s.RbacAuthorizationV1Api),
    metricsAvailable: false
  }

  clients.set(context, client)
  return client
}

export function disconnectCluster(context: string): void {
  clients.delete(context)
}

export function getClient(context: string): ClusterClient | undefined {
  return clients.get(context)
}

export function getKubeConfig(context: string): k8s.KubeConfig {
  const kc = new k8s.KubeConfig()
  kc.loadFromDefault()
  kc.setCurrentContext(context)
  return kc
}
