import * as k8s from '@kubernetes/client-node'
import { getKubeConfig, getClient } from './client'

interface PodMetrics {
  cpuActual: string
  memActual: string
}

export async function checkMetricsAvailable(context: string): Promise<boolean> {
  try {
    const kc = getKubeConfig(context)
    const metricsClient = new k8s.Metrics(kc)
    await metricsClient.getNodeMetrics()
    const client = getClient(context)
    if (client) client.metricsAvailable = true
    return true
  } catch {
    return false
  }
}

export async function fetchPodMetrics(context: string, namespace: string, podName: string): Promise<PodMetrics | null> {
  try {
    const kc = getKubeConfig(context)
    const metricsClient = new k8s.Metrics(kc)
    const metrics = await metricsClient.getPodMetrics(namespace)
    const podMetric = metrics.items.find((m) => m.metadata?.name === podName)
    if (!podMetric) return null

    const containers = podMetric.containers ?? []
    let totalCpu = 0
    let totalMem = 0
    for (const c of containers) {
      const cpu = c.usage?.cpu ?? '0'
      const mem = c.usage?.memory ?? '0'
      totalCpu += parseCpuToMillicores(cpu)
      totalMem += parseMemToMi(mem)
    }

    return {
      cpuActual: `${totalCpu}m`,
      memActual: `${totalMem}Mi`
    }
  } catch {
    return null
  }
}

function parseCpuToMillicores(cpu: string): number {
  if (cpu.endsWith('n')) return Math.round(parseInt(cpu) / 1_000_000)
  if (cpu.endsWith('m')) return parseInt(cpu)
  return Math.round(parseFloat(cpu) * 1000)
}

function parseMemToMi(mem: string): number {
  if (mem.endsWith('Ki')) return Math.round(parseInt(mem) / 1024)
  if (mem.endsWith('Mi')) return parseInt(mem)
  if (mem.endsWith('Gi')) return parseInt(mem) * 1024
  return Math.round(parseInt(mem) / (1024 * 1024))
}
