import { ipcMain, dialog, BrowserWindow } from 'electron'
import { loadContexts, connectCluster, disconnectCluster, getClient } from './k8s/client'
import { startWatching, stopWatching } from './k8s/watcher'
import { ResourceCache } from './k8s/cache'
import { fetchLogs, startLogStream, stopLogStream, stopAllLogStreams } from './k8s/logs'
import { fetchRelated } from './k8s/related'
import { fetchPodMetrics, checkMetricsAvailable } from './k8s/metrics'
import { parseHelmLabels } from '../shared/helm'
import { generateSnapshot } from './k8s/snapshot'
import type { ClusterInfo, K8sEvent, ResourceDetail, ResourceUpdate } from '../shared/types'
import { writeFileSync } from 'fs'

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

  ipcMain.handle('k8s:get-logs', async (_event, cluster: string, namespace: string, pod: string, timestamps?: boolean) => {
    return fetchLogs(cluster, namespace, pod, timestamps)
  })

  ipcMain.handle('k8s:get-events', async (_event, cluster: string, namespace: string, name: string) => {
    const client = getClient(cluster)
    if (!client) throw new Error(`Not connected to ${cluster}`)

    const events = await client.coreApi.listNamespacedEvent({ namespace })
    return events.items
      .filter((e) => e.involvedObject?.name === name)
      .map((e): K8sEvent => ({
        timestamp: e.lastTimestamp?.toISOString() ?? e.eventTime?.toISOString() ?? '',
        type: e.type ?? 'Normal',
        reason: e.reason ?? '',
        message: e.message ?? '',
        involvedObject: `${e.involvedObject?.kind?.toLowerCase()}/${e.involvedObject?.name}`,
        count: e.count ?? 1,
        source: e.source?.component ?? ''
      }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  })

  ipcMain.handle('k8s:get-related', async (_event, cluster: string, namespace: string, name: string, kind: string) => {
    return fetchRelated(cluster, namespace, name, kind)
  })

  ipcMain.handle('k8s:helm-info', async (_event, _cluster: string, _namespace: string, labels: Record<string, string>) => {
    return parseHelmLabels(labels)
  })

  ipcMain.handle('k8s:get-resource-detail', async (_event, cluster: string, namespace: string, name: string, kind: string) => {
    const resources = cache.getAll(cluster)
    const resource = resources.find((r) => r.name === name && r.namespace === namespace && r.kind === kind)
    if (!resource) throw new Error(`Resource not found: ${kind}/${name}`)

    const client = getClient(cluster)
    if (!client) throw new Error(`Not connected to ${cluster}`)

    const eventsResult = await client.coreApi.listNamespacedEvent({ namespace })
    const filteredEvents: K8sEvent[] = eventsResult.items
      .filter((e) => e.involvedObject?.name === name)
      .map((e) => ({
        timestamp: e.lastTimestamp?.toISOString() ?? e.eventTime?.toISOString() ?? '',
        type: e.type ?? 'Normal',
        reason: e.reason ?? '',
        message: e.message ?? '',
        involvedObject: `${e.involvedObject?.kind?.toLowerCase()}/${e.involvedObject?.name}`,
        count: e.count ?? 1,
        source: e.source?.component ?? ''
      }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))

    const [logs, related, metrics] = await Promise.all([
      kind === 'Pod' ? fetchLogs(cluster, namespace, name) : Promise.resolve([]),
      fetchRelated(cluster, namespace, name, kind),
      kind === 'Pod' ? fetchPodMetrics(cluster, namespace, name) : Promise.resolve(null)
    ])

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
      helm: helm ?? undefined
    }

    return detail
  })

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

  ipcMain.handle('k8s:start-log-stream', (_event, cluster: string, namespace: string, pod: string, container: string, timestamps?: boolean) => {
    const streamId = startLogStream(cluster, namespace, pod, container, timestamps ?? false, (data) => {
      mainWindow.webContents.send('k8s:log-chunk', { streamId, data })
    })
    return streamId
  })

  ipcMain.handle('k8s:stop-log-stream', (_event, streamId: string) => {
    stopLogStream(streamId)
  })
}
