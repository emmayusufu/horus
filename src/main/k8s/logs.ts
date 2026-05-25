import type { ContainerLogs } from '../../shared/types'
import { getClient } from './client'

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
