import type {
  ClusterInfo,
  ContainerLogs,
  K8sEvent,
  RelatedResource,
  HelmInfo,
  ResourceDetail,
  LogChunk,
  RolloutInfo,
  NodeInfo,
  CronJobRun,
  TrafficPath,
  HPAInfo,
  PVCInfo,
  ResourceQuota,
  ConfigCheck,
  RBACBinding,
  NetworkPolicySummary,
  SecurityIssue,
  SecretUsage,
  RootCause,
  TopologyNode,
  TopologyEdge,
  CostEstimate,
  HelmRelease,
  SizingRec,
  RequestTrace
} from '../../shared/types'

export function useK8s() {
  const api = window.horus
  return {
    listContexts: (): Promise<string[]> => api.listContexts(),
    connect: (context: string): Promise<ClusterInfo> => api.connect(context),
    disconnect: (context: string): Promise<void> => api.disconnect(context),
    getLogs: (cluster: string, ns: string, pod: string, timestamps?: boolean): Promise<ContainerLogs[]> =>
      api.getLogs(cluster, ns, pod, timestamps),
    getEvents: (cluster: string, ns: string, name: string): Promise<K8sEvent[]> => api.getEvents(cluster, ns, name),
    getRelated: (cluster: string, ns: string, name: string, kind: string): Promise<RelatedResource[]> =>
      api.getRelated(cluster, ns, name, kind),
    getHelmInfo: (cluster: string, ns: string, labels: Record<string, string>): Promise<HelmInfo | null> =>
      api.getHelmInfo(cluster, ns, labels),
    getResourceDetail: (cluster: string, ns: string, name: string, kind: string): Promise<ResourceDetail> =>
      api.getResourceDetail(cluster, ns, name, kind),
    exportSnapshot: (detail: ResourceDetail): Promise<string> => api.exportSnapshot(detail),
    getPodYaml: (cluster: string, ns: string, name: string): Promise<string> => api.getPodYaml(cluster, ns, name),
    getNamespaceEvents: (cluster: string, ns: string): Promise<K8sEvent[]> => api.getNamespaceEvents(cluster, ns),
    startLogStream: (
      cluster: string,
      ns: string,
      pod: string,
      container: string,
      timestamps?: boolean
    ): Promise<string> => api.startLogStream(cluster, ns, pod, container, timestamps),
    stopLogStream: (streamId: string): Promise<void> => api.stopLogStream(streamId),
    onLogChunk: (callback: (chunk: LogChunk) => void): (() => void) => api.onLogChunk(callback),
    getRollout: (cluster: string, ns: string, name: string): Promise<RolloutInfo> => api.getRollout(cluster, ns, name),
    getNodes: (cluster: string): Promise<NodeInfo[]> => api.getNodes(cluster),
    getCronJobRuns: (cluster: string, ns: string, name: string): Promise<CronJobRun[]> => api.getCronJobRuns(cluster, ns, name),
    getResourceYaml: (cluster: string, ns: string, name: string, kind: string): Promise<string> => api.getResourceYaml(cluster, ns, name, kind),
    getTrafficPath: (cluster: string, ns: string, serviceName: string): Promise<TrafficPath> => api.getTrafficPath(cluster, ns, serviceName),
    getHPAs: (cluster: string, ns: string): Promise<HPAInfo[]> => api.getHPAs(cluster, ns),
    getPVCs: (cluster: string, ns: string): Promise<PVCInfo[]> => api.getPVCs(cluster, ns),
    getResourceQuotas: (cluster: string, ns: string): Promise<ResourceQuota[]> => api.getResourceQuotas(cluster, ns),
    getConfigChecks: (cluster: string, ns: string): Promise<ConfigCheck[]> => api.getConfigChecks(cluster, ns),
    getRBAC: (cluster: string, ns: string): Promise<RBACBinding[]> => api.getRBAC(cluster, ns),
    getNetworkPolicies: (cluster: string, ns: string): Promise<NetworkPolicySummary[]> => api.getNetworkPolicies(cluster, ns),
    getSecurityScan: (cluster: string, ns: string): Promise<SecurityIssue[]> => api.getSecurityScan(cluster, ns),
    getSecretUsage: (cluster: string, ns: string): Promise<SecretUsage[]> => api.getSecretUsage(cluster, ns),
    deletePod: (cluster: string, ns: string, name: string): Promise<void> => api.deletePod(cluster, ns, name),
    scaleDeploy: (cluster: string, ns: string, name: string, replicas: number): Promise<void> => api.scaleDeploy(cluster, ns, name, replicas),
    startPortForward: (cluster: string, ns: string, pod: string, localPort: number, remotePort: number): Promise<string> => api.startPortForward(cluster, ns, pod, localPort, remotePort),
    stopPortForward: (id: string): Promise<void> => api.stopPortForward(id),
    getGlobalEvents: (cluster: string, query: string): Promise<K8sEvent[]> => api.getGlobalEvents(cluster, query),
    analyzeRootCause: (cluster: string, ns: string, name: string, kind: string): Promise<RootCause> => api.analyzeRootCause(cluster, ns, name, kind),
    getTopology: (cluster: string, ns: string): Promise<{ nodes: TopologyNode[]; edges: TopologyEdge[] }> => api.getTopology(cluster, ns),
    getCostEstimates: (cluster: string): Promise<CostEstimate[]> => api.getCostEstimates(cluster),
    getHelmReleases: (cluster: string): Promise<HelmRelease[]> => api.getHelmReleases(cluster),
    getSizingRecs: (cluster: string, ns: string): Promise<SizingRec[]> => api.getSizingRecs(cluster, ns),
    traceRequest: (cluster: string, host: string): Promise<RequestTrace> => api.traceRequest(cluster, host)
  }
}
