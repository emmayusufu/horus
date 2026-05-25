import { describe, it, expect, beforeEach } from 'vitest'
import { ResourceCache } from '../src/main/k8s/cache'
import type { K8sResource } from '../src/shared/types'

function makePod(overrides: Partial<K8sResource> = {}): K8sResource {
  return {
    uid: 'uid-1',
    name: 'test-pod',
    namespace: 'default',
    kind: 'Pod',
    cluster: 'cluster-a',
    status: 'Running',
    health: 'healthy',
    restarts: 0,
    age: '1h',
    node: 'node-01',
    labels: {},
    ...overrides
  }
}

describe('ResourceCache', () => {
  let cache: ResourceCache
  beforeEach(() => {
    cache = new ResourceCache()
  })

  it('sets and gets resources for a cluster', () => {
    const pod = makePod()
    cache.set('cluster-a', [pod])
    expect(cache.getAll('cluster-a')).toEqual([pod])
  })
  it('returns empty array for unknown cluster', () => {
    expect(cache.getAll('unknown')).toEqual([])
  })
  it('filters by namespace', () => {
    const podA = makePod({ uid: '1', namespace: 'payments' })
    const podB = makePod({ uid: '2', namespace: 'default' })
    cache.set('cluster-a', [podA, podB])
    expect(cache.getByNamespace('cluster-a', 'payments')).toEqual([podA])
  })
  it('returns unhealthy resources sorted critical first', () => {
    const healthy = makePod({ uid: '1', health: 'healthy' })
    const warning = makePod({ uid: '2', health: 'warning' })
    const critical = makePod({ uid: '3', health: 'critical' })
    cache.set('cluster-a', [healthy, warning, critical])
    const result = cache.getUnhealthy('cluster-a')
    expect(result).toEqual([critical, warning])
  })
  it('returns all unhealthy across clusters', () => {
    cache.set('cluster-a', [makePod({ uid: '1', health: 'critical', cluster: 'cluster-a' })])
    cache.set('cluster-b', [makePod({ uid: '2', health: 'warning', cluster: 'cluster-b' })])
    expect(cache.getAllUnhealthy()).toHaveLength(2)
  })
  it('clears a cluster', () => {
    cache.set('cluster-a', [makePod()])
    cache.clear('cluster-a')
    expect(cache.getAll('cluster-a')).toEqual([])
  })
  it('searches by name across clusters', () => {
    cache.set('cluster-a', [makePod({ uid: '1', name: 'payment-svc-abc' })])
    cache.set('cluster-b', [makePod({ uid: '2', name: 'cart-svc-xyz' })])
    expect(cache.search('payment')).toHaveLength(1)
    expect(cache.search('payment')[0].name).toBe('payment-svc-abc')
  })
})
