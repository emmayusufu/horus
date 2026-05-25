import { describe, it, expect } from 'vitest'
import { generateSnapshot } from '../src/main/k8s/snapshot'
import type { ResourceDetail } from '../src/shared/types'

function makeDetail(overrides: Partial<ResourceDetail> = {}): ResourceDetail {
  return {
    resource: {
      uid: '1',
      name: 'payment-svc-abc',
      namespace: 'payments',
      kind: 'Pod',
      cluster: 'cluster-prod-us',
      status: 'CrashLoopBackOff',
      health: 'critical',
      restarts: 14,
      age: '2h',
      node: 'node-03',
      labels: {},
      ownerKind: 'Deployment',
      ownerName: 'payment-svc'
    },
    events: [
      {
        timestamp: '14:02',
        type: 'Normal',
        reason: 'Created',
        message: 'Created container',
        involvedObject: 'pod/payment-svc-abc',
        count: 1,
        source: 'kubelet'
      },
      {
        timestamp: '14:05',
        type: 'Warning',
        reason: 'BackOff',
        message: 'Back-off restarting',
        involvedObject: 'pod/payment-svc-abc',
        count: 3,
        source: 'kubelet'
      }
    ],
    logs: [
      { containerName: 'main', current: 'Error: ECONNREFUSED\nRetrying...', previous: 'OOM killed', isInit: false }
    ],
    resources: {
      cpuRequest: '250m',
      cpuLimit: '500m',
      memRequest: '256Mi',
      memLimit: '512Mi',
      metricsAvailable: false
    },
    related: [{ kind: 'Service', name: 'payment-svc', detail: '0/4 endpoints ready' }],
    helm: { chart: 'payment', version: '2.3.1', revision: 14, managedBy: 'Helm' },
    conditions: [
      { type: 'Ready', status: 'False' as const, reason: 'ContainersNotReady' },
      { type: 'ContainersReady', status: 'False' as const },
      { type: 'Initialized', status: 'True' as const },
      { type: 'PodScheduled', status: 'True' as const }
    ],
    containers: [{ name: 'main', state: 'waiting' as const, ready: false, reason: 'CrashLoopBackOff', isInit: false }],
    ...overrides
  }
}

describe('generateSnapshot', () => {
  it('generates valid markdown', () => {
    const md = generateSnapshot(makeDetail())
    expect(md).toContain('# Horus Debug Snapshot')
    expect(md).toContain('payment-svc-abc')
    expect(md).toContain('cluster-prod-us')
    expect(md).toContain('payments')
  })
  it('includes timeline events', () => {
    const md = generateSnapshot(makeDetail())
    expect(md).toContain('14:02')
    expect(md).toContain('Created')
    expect(md).toContain('BackOff')
  })
  it('includes logs', () => {
    const md = generateSnapshot(makeDetail())
    expect(md).toContain('ECONNREFUSED')
  })
  it('includes resource usage', () => {
    const md = generateSnapshot(makeDetail())
    expect(md).toContain('250m')
    expect(md).toContain('512Mi')
  })
  it('shows metrics unavailable when not available', () => {
    const md = generateSnapshot(makeDetail())
    expect(md).toContain('unavailable')
  })
  it('includes related resources', () => {
    const md = generateSnapshot(makeDetail())
    expect(md).toContain('payment-svc')
    expect(md).toContain('0/4 endpoints ready')
  })
  it('includes helm info when present', () => {
    const md = generateSnapshot(makeDetail())
    expect(md).toContain('payment')
    expect(md).toContain('2.3.1')
  })
  it('omits helm section when no helm info', () => {
    const md = generateSnapshot(makeDetail({ helm: undefined }))
    expect(md).not.toContain('Helm Release')
  })

  it('shows event count when greater than 1', () => {
    const md = generateSnapshot(
      makeDetail({
        events: [
          {
            timestamp: '14:05',
            type: 'Warning',
            reason: 'BackOff',
            message: 'Back-off restarting',
            involvedObject: 'pod/test',
            count: 5,
            source: 'kubelet'
          }
        ]
      })
    )
    expect(md).toContain('(x5)')
    expect(md).toContain('[kubelet]')
  })

  it('marks init containers in logs', () => {
    const md = generateSnapshot(
      makeDetail({
        logs: [
          { containerName: 'init-db', current: 'migrating...', isInit: true },
          { containerName: 'main', current: 'running', isInit: false }
        ]
      })
    )
    expect(md).toContain('init-db (init)')
    expect(md).not.toContain('main (init)')
  })

  it('includes pod conditions', () => {
    const md = generateSnapshot(
      makeDetail({
        conditions: [
          { type: 'Ready', status: 'False', reason: 'ContainersNotReady' },
          { type: 'PodScheduled', status: 'True' }
        ]
      })
    )
    expect(md).toContain('## Conditions')
    expect(md).toContain('Ready: False (ContainersNotReady)')
    expect(md).toContain('PodScheduled: True')
  })

  it('includes container states', () => {
    const md = generateSnapshot(
      makeDetail({
        containers: [
          { name: 'main', state: 'waiting' as const, ready: false, reason: 'CrashLoopBackOff', isInit: false },
          { name: 'init-db', state: 'terminated' as const, ready: false, exitCode: 0, isInit: true }
        ]
      })
    )
    expect(md).toContain('## Containers')
    expect(md).toContain('main: waiting [not ready]')
    expect(md).toContain('CrashLoopBackOff')
    expect(md).toContain('init-db (init): terminated')
    expect(md).toContain('exit:0')
  })

  it('omits conditions section when not present', () => {
    const md = generateSnapshot(makeDetail({ conditions: undefined }))
    expect(md).not.toContain('## Conditions')
  })
})
