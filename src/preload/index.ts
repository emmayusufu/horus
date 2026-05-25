import { contextBridge, ipcRenderer } from 'electron'
import type { HorusAPI } from '../shared/types'

const api: HorusAPI = {
  listContexts: () => ipcRenderer.invoke('k8s:list-contexts'),
  connect: (context) => ipcRenderer.invoke('k8s:connect', context),
  disconnect: (context) => ipcRenderer.invoke('k8s:disconnect', context),
  onResourceUpdate: (callback) => {
    const handler = (_event: any, update: any) => callback(update)
    ipcRenderer.on('k8s:resource-update', handler)
    return () => ipcRenderer.removeListener('k8s:resource-update', handler)
  },
  getLogs: (cluster, namespace, pod, timestamps) =>
    ipcRenderer.invoke('k8s:get-logs', cluster, namespace, pod, timestamps),
  getEvents: (cluster, namespace, name) => ipcRenderer.invoke('k8s:get-events', cluster, namespace, name),
  getRelated: (cluster, namespace, name, kind) => ipcRenderer.invoke('k8s:get-related', cluster, namespace, name, kind),
  getHelmInfo: (cluster, namespace, labels) => ipcRenderer.invoke('k8s:helm-info', cluster, namespace, labels),
  getResourceDetail: (cluster, namespace, name, kind) =>
    ipcRenderer.invoke('k8s:get-resource-detail', cluster, namespace, name, kind),
  exportSnapshot: (detail) => ipcRenderer.invoke('k8s:export-snapshot', detail),
  getPodYaml: (cluster, namespace, name) => ipcRenderer.invoke('k8s:get-pod-yaml', cluster, namespace, name),
  getNamespaceEvents: (cluster, namespace) => ipcRenderer.invoke('k8s:get-namespace-events', cluster, namespace),
  startLogStream: (cluster, namespace, pod, container, timestamps) =>
    ipcRenderer.invoke('k8s:start-log-stream', cluster, namespace, pod, container, timestamps),
  stopLogStream: (streamId) => ipcRenderer.invoke('k8s:stop-log-stream', streamId),
  getRollout: (cluster, namespace, name) => ipcRenderer.invoke('k8s:get-rollout', cluster, namespace, name),
  getNodes: (cluster) => ipcRenderer.invoke('k8s:get-nodes', cluster),
  getCronJobRuns: (cluster, namespace, name) => ipcRenderer.invoke('k8s:get-cronjob-runs', cluster, namespace, name),
  getResourceYaml: (cluster, namespace, name, kind) => ipcRenderer.invoke('k8s:get-resource-yaml', cluster, namespace, name, kind),
  getTrafficPath: (cluster, namespace, serviceName) => ipcRenderer.invoke('k8s:get-traffic-path', cluster, namespace, serviceName),
  getHPAs: (cluster, namespace) => ipcRenderer.invoke('k8s:get-hpas', cluster, namespace),
  getPVCs: (cluster, namespace) => ipcRenderer.invoke('k8s:get-pvcs', cluster, namespace),
  getResourceQuotas: (cluster, namespace) => ipcRenderer.invoke('k8s:get-resource-quotas', cluster, namespace),
  getConfigChecks: (cluster, namespace) => ipcRenderer.invoke('k8s:get-config-checks', cluster, namespace),
  getRBAC: (cluster, namespace) => ipcRenderer.invoke('k8s:get-rbac', cluster, namespace),
  getNetworkPolicies: (cluster, namespace) => ipcRenderer.invoke('k8s:get-network-policies', cluster, namespace),
  getSecurityScan: (cluster, namespace) => ipcRenderer.invoke('k8s:get-security-scan', cluster, namespace),
  getSecretUsage: (cluster, namespace) => ipcRenderer.invoke('k8s:get-secret-usage', cluster, namespace),
  onLogChunk: (callback) => {
    const handler = (_event: any, chunk: any) => callback(chunk)
    ipcRenderer.on('k8s:log-chunk', handler)
    return () => ipcRenderer.removeListener('k8s:log-chunk', handler)
  }
}

contextBridge.exposeInMainWorld('horus', api)
