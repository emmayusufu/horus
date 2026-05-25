import type { K8sResource } from '../../shared/types'

const HEALTH_ORDER = { critical: 0, warning: 1, unknown: 2, healthy: 3 }

export class ResourceCache {
  private store = new Map<string, K8sResource[]>()

  set(cluster: string, resources: K8sResource[]): void {
    this.store.set(cluster, resources)
  }

  getAll(cluster: string): K8sResource[] {
    return this.store.get(cluster) ?? []
  }

  getByNamespace(cluster: string, namespace: string): K8sResource[] {
    return this.getAll(cluster).filter((r) => r.namespace === namespace)
  }

  getUnhealthy(cluster: string): K8sResource[] {
    return this.getAll(cluster)
      .filter((r) => r.health !== 'healthy')
      .sort((a, b) => HEALTH_ORDER[a.health] - HEALTH_ORDER[b.health])
  }

  getAllUnhealthy(): K8sResource[] {
    const result: K8sResource[] = []
    for (const resources of this.store.values()) {
      result.push(...resources.filter((r) => r.health !== 'healthy'))
    }
    return result.sort((a, b) => HEALTH_ORDER[a.health] - HEALTH_ORDER[b.health])
  }

  search(query: string): K8sResource[] {
    const lower = query.toLowerCase()
    const result: K8sResource[] = []
    for (const resources of this.store.values()) {
      result.push(...resources.filter((r) => r.name.toLowerCase().includes(lower)))
    }
    return result
  }

  clear(cluster: string): void {
    this.store.delete(cluster)
  }

  clusters(): string[] {
    return [...this.store.keys()]
  }
}
