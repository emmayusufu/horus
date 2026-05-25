import * as k8s from '@kubernetes/client-node'
import { PassThrough } from 'stream'
import type { ContainerLogs } from '../../shared/types'
import { getClient, getKubeConfig } from './client'

export async function fetchLogs(
  context: string,
  namespace: string,
  podName: string,
  timestamps = false
): Promise<ContainerLogs[]> {
  const client = getClient(context)
  if (!client) throw new Error(`Not connected to ${context}`)

  const pod = await client.coreApi.readNamespacedPod({ name: podName, namespace })
  const initContainers = pod.spec?.initContainers ?? []
  const containers = pod.spec?.containers ?? []
  const results: ContainerLogs[] = []

  for (const container of initContainers) {
    const logs = await fetchContainerLogs(client, namespace, podName, container.name, timestamps)
    results.push({ ...logs, isInit: true })
  }

  for (const container of containers) {
    const logs = await fetchContainerLogs(client, namespace, podName, container.name, timestamps)
    results.push({ ...logs, isInit: false })
  }

  return results
}

async function fetchContainerLogs(
  client: NonNullable<ReturnType<typeof getClient>>,
  namespace: string,
  podName: string,
  containerName: string,
  timestamps: boolean
): Promise<Omit<ContainerLogs, 'isInit'>> {
  let current = ''
  let previous: string | undefined

  try {
    current = await client.coreApi.readNamespacedPodLog({
      name: podName,
      namespace,
      container: containerName,
      tailLines: 200,
      timestamps
    })
  } catch {
    current = '(no logs available)'
  }

  try {
    previous = await client.coreApi.readNamespacedPodLog({
      name: podName,
      namespace,
      container: containerName,
      previous: true,
      tailLines: 200,
      timestamps
    })
  } catch {
    // no previous container
  }

  return { containerName, current, previous }
}

const activeStreams = new Map<string, PassThrough>()
let streamCounter = 0

export function startLogStream(
  context: string,
  namespace: string,
  podName: string,
  containerName: string,
  timestamps: boolean,
  onChunk: (data: string) => void
): string {
  const streamId = `stream-${++streamCounter}`
  const kc = getKubeConfig(context)
  const log = new k8s.Log(kc)

  const passthrough = new PassThrough()
  activeStreams.set(streamId, passthrough)

  passthrough.on('data', (chunk: Buffer) => {
    onChunk(chunk.toString('utf-8'))
  })

  passthrough.on('error', () => {
    activeStreams.delete(streamId)
  })

  log.log(namespace, podName, containerName, passthrough, {
    follow: true,
    tailLines: 200,
    timestamps
  }).catch(() => {
    activeStreams.delete(streamId)
  })

  return streamId
}

export function stopLogStream(streamId: string): void {
  const stream = activeStreams.get(streamId)
  if (stream) {
    stream.destroy()
    activeStreams.delete(streamId)
  }
}

export function stopAllLogStreams(): void {
  for (const [, stream] of activeStreams) {
    stream.destroy()
  }
  activeStreams.clear()
}
