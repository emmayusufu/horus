export type HealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown'

export type ResourceKind =
  | 'Pod'
  | 'Deployment'
  | 'StatefulSet'
  | 'DaemonSet'
  | 'Job'
  | 'CronJob'
  | 'Service'
  | 'Ingress'
  | 'ConfigMap'
  | 'Secret'

export interface K8sResource {
  uid: string
  name: string
  namespace: string
  kind: ResourceKind
  cluster: string
  status: string
  health: HealthStatus
  restarts: number
  age: string
  node: string
  labels: Record<string, string>
  ownerKind?: string
  ownerName?: string
}

export interface ClusterInfo {
  name: string
  connected: boolean
  error?: string
  resourceCounts: { total: number; healthy: number; warning: number; critical: number }
  cpuPercent?: number
  memPercent?: number
}

export interface K8sEvent {
  timestamp: string
  type: string
  reason: string
  message: string
  involvedObject: string
  count: number
  source: string
}

export interface ContainerLogs {
  containerName: string
  current: string
  previous?: string
  isInit: boolean
}

export interface PodCondition {
  type: string
  status: 'True' | 'False' | 'Unknown'
  reason?: string
  message?: string
}

export interface ContainerStateInfo {
  name: string
  state: 'waiting' | 'running' | 'terminated'
  ready: boolean
  reason?: string
  exitCode?: number
  isInit: boolean
}

export interface ResourceDetail {
  resource: K8sResource
  events: K8sEvent[]
  logs: ContainerLogs[]
  resources: {
    cpuRequest?: string
    cpuLimit?: string
    cpuActual?: string
    memRequest?: string
    memLimit?: string
    memActual?: string
    metricsAvailable: boolean
  }
  related: RelatedResource[]
  helm?: HelmInfo
  conditions?: PodCondition[]
  containers?: ContainerStateInfo[]
}

export interface RelatedResource {
  kind: string
  name: string
  detail: string
}

export interface HelmInfo {
  chart: string
  version: string
  revision: number
  managedBy: string
}

export interface ResourceUpdate {
  cluster: string
  resources: K8sResource[]
  clusterInfo: ClusterInfo
}

export interface RolloutInfo {
  strategy: string
  maxSurge?: string
  maxUnavailable?: string
  replicas: number
  updatedReplicas: number
  readyReplicas: number
  availableReplicas: number
  replicaSets: ReplicaSetInfo[]
}

export interface ReplicaSetInfo {
  name: string
  revision: string
  replicas: number
  ready: number
  image: string
  isCurrent: boolean
}

export interface NodeInfo {
  name: string
  conditions: { type: string; status: string }[]
  capacity: { cpu: string; memory: string; pods: string }
  allocatable: { cpu: string; memory: string; pods: string }
  taints: { key: string; value?: string; effect: string }[]
  podCount: number
  labels: Record<string, string>
}

export interface CronJobRun {
  name: string
  status: 'Complete' | 'Failed' | 'Running'
  startTime: string
  duration: string
  pods: number
}

export interface DiffResult {
  path: string
  left: string
  right: string
}

export interface LogChunk {
  streamId: string
  data: string
}

export interface HorusAPI {
  listContexts: () => Promise<string[]>
  connect: (context: string) => Promise<ClusterInfo>
  disconnect: (context: string) => Promise<void>
  onResourceUpdate: (callback: (update: ResourceUpdate) => void) => () => void
  getLogs: (cluster: string, namespace: string, pod: string, timestamps?: boolean) => Promise<ContainerLogs[]>
  getEvents: (cluster: string, namespace: string, name: string) => Promise<K8sEvent[]>
  getRelated: (cluster: string, namespace: string, name: string, kind: string) => Promise<RelatedResource[]>
  getHelmInfo: (cluster: string, namespace: string, labels: Record<string, string>) => Promise<HelmInfo | null>
  getResourceDetail: (cluster: string, namespace: string, name: string, kind: string) => Promise<ResourceDetail>
  exportSnapshot: (detail: ResourceDetail) => Promise<string>
  startLogStream: (
    cluster: string,
    namespace: string,
    pod: string,
    container: string,
    timestamps?: boolean
  ) => Promise<string>
  stopLogStream: (streamId: string) => Promise<void>
  onLogChunk: (callback: (chunk: LogChunk) => void) => () => void
  getPodYaml: (cluster: string, namespace: string, name: string) => Promise<string>
  getNamespaceEvents: (cluster: string, namespace: string) => Promise<K8sEvent[]>
  getRollout: (cluster: string, namespace: string, name: string) => Promise<RolloutInfo>
  getNodes: (cluster: string) => Promise<NodeInfo[]>
  getCronJobRuns: (cluster: string, namespace: string, name: string) => Promise<CronJobRun[]>
  getResourceYaml: (cluster: string, namespace: string, name: string, kind: string) => Promise<string>
}

declare global {
  interface Window {
    horus: HorusAPI
  }
}
