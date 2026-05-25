import type { ClusterInfo, ContainerLogs, K8sEvent, RelatedResource, HelmInfo, ResourceDetail, LogChunk } from '../../shared/types'

export function useK8s() {
  const api = window.horus
  return {
    listContexts: (): Promise<string[]> => api.listContexts(),
    connect: (context: string): Promise<ClusterInfo> => api.connect(context),
    disconnect: (context: string): Promise<void> => api.disconnect(context),
    getLogs: (cluster: string, ns: string, pod: string, timestamps?: boolean): Promise<ContainerLogs[]> => api.getLogs(cluster, ns, pod, timestamps),
    getEvents: (cluster: string, ns: string, name: string): Promise<K8sEvent[]> => api.getEvents(cluster, ns, name),
    getRelated: (cluster: string, ns: string, name: string, kind: string): Promise<RelatedResource[]> => api.getRelated(cluster, ns, name, kind),
    getHelmInfo: (cluster: string, ns: string, labels: Record<string, string>): Promise<HelmInfo | null> => api.getHelmInfo(cluster, ns, labels),
    getResourceDetail: (cluster: string, ns: string, name: string, kind: string): Promise<ResourceDetail> => api.getResourceDetail(cluster, ns, name, kind),
    exportSnapshot: (detail: ResourceDetail): Promise<string> => api.exportSnapshot(detail),
    getPodYaml: (cluster: string, ns: string, name: string): Promise<string> => api.getPodYaml(cluster, ns, name),
    getNamespaceEvents: (cluster: string, ns: string): Promise<K8sEvent[]> => api.getNamespaceEvents(cluster, ns),
    startLogStream: (cluster: string, ns: string, pod: string, container: string, timestamps?: boolean): Promise<string> =>
      api.startLogStream(cluster, ns, pod, container, timestamps),
    stopLogStream: (streamId: string): Promise<void> => api.stopLogStream(streamId),
    onLogChunk: (callback: (chunk: LogChunk) => void): (() => void) => api.onLogChunk(callback)
  }
}
