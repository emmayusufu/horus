import { useState, useEffect, useRef } from 'react'
import type { K8sResource, ClusterInfo, ResourceUpdate } from '../../shared/types'

interface ResourceState {
  clusters: Map<string, ClusterInfo>
  resources: Map<string, K8sResource[]>
}

export function useResources() {
  const [state, setState] = useState<ResourceState>({
    clusters: new Map(),
    resources: new Map()
  })
  const unsubRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    unsubRef.current = window.horus.onResourceUpdate((update: ResourceUpdate) => {
      setState((prev) => {
        const clusters = new Map(prev.clusters)
        const resources = new Map(prev.resources)
        clusters.set(update.cluster, update.clusterInfo)
        resources.set(update.cluster, update.resources)
        return { clusters, resources }
      })
    })
    return () => {
      if (unsubRef.current) unsubRef.current()
    }
  }, [])

  const allResources = (): K8sResource[] => {
    const result: K8sResource[] = []
    for (const r of state.resources.values()) result.push(...r)
    return result
  }

  const unhealthy = (): K8sResource[] => {
    return allResources()
      .filter((r) => r.health !== 'healthy')
      .sort((a, b) => {
        const order = { critical: 0, warning: 1, unknown: 2, healthy: 3 }
        return order[a.health] - order[b.health]
      })
  }

  return {
    clusters: [...state.clusters.values()],
    resourcesByCluster: state.resources,
    allResources,
    unhealthy
  }
}
