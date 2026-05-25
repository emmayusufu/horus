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
  getLogs: (cluster, namespace, pod, timestamps) => ipcRenderer.invoke('k8s:get-logs', cluster, namespace, pod, timestamps),
  getEvents: (cluster, namespace, name) => ipcRenderer.invoke('k8s:get-events', cluster, namespace, name),
  getRelated: (cluster, namespace, name, kind) => ipcRenderer.invoke('k8s:get-related', cluster, namespace, name, kind),
  getHelmInfo: (cluster, namespace, labels) => ipcRenderer.invoke('k8s:helm-info', cluster, namespace, labels),
  getResourceDetail: (cluster, namespace, name, kind) => ipcRenderer.invoke('k8s:get-resource-detail', cluster, namespace, name, kind),
  exportSnapshot: (detail) => ipcRenderer.invoke('k8s:export-snapshot', detail),
  getPodYaml: (cluster, namespace, name) => ipcRenderer.invoke('k8s:get-pod-yaml', cluster, namespace, name),
  getNamespaceEvents: (cluster, namespace) => ipcRenderer.invoke('k8s:get-namespace-events', cluster, namespace),
  startLogStream: (cluster, namespace, pod, container, timestamps) =>
    ipcRenderer.invoke('k8s:start-log-stream', cluster, namespace, pod, container, timestamps),
  stopLogStream: (streamId) => ipcRenderer.invoke('k8s:stop-log-stream', streamId),
  onLogChunk: (callback) => {
    const handler = (_event: any, chunk: any) => callback(chunk)
    ipcRenderer.on('k8s:log-chunk', handler)
    return () => ipcRenderer.removeListener('k8s:log-chunk', handler)
  }
}

contextBridge.exposeInMainWorld('horus', api)
