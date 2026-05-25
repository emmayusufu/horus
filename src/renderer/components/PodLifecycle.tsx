import { Card, H5 } from '@blueprintjs/core'
import type { PodCondition } from '../../shared/types'

interface PodLifecycleProps {
  conditions: PodCondition[]
  age: string
}

const PHASE_ORDER = ['PodScheduled', 'Initialized', 'ContainersReady', 'Ready']
const PHASE_LABELS: Record<string, string> = { PodScheduled: 'Scheduled', Initialized: 'Init', ContainersReady: 'Containers', Ready: 'Ready' }

export function PodLifecycle({ conditions, age }: PodLifecycleProps) {
  if (conditions.length === 0) return null

  const condMap = new Map(conditions.map((c) => [c.type, c]))
  const lastTrue = PHASE_ORDER.filter((p) => condMap.get(p)?.status === 'True').length
  const stuckAt = PHASE_ORDER.find((p) => condMap.get(p)?.status === 'False')

  return (
    <Card style={{ marginBottom: 12 }}>
      <H5>Pod Lifecycle</H5>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '8px 0' }}>
        {PHASE_ORDER.map((phase, i) => {
          const cond = condMap.get(phase)
          const passed = cond?.status === 'True'
          const stuck = cond?.status === 'False'
          const color = passed ? '#3d9a5f' : stuck ? '#e5564f' : 'var(--border)'

          return (
            <div key={phase} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 60 }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: `${color}25`, border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {passed && <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5l2.5 2.5L8 3" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" /></svg>}
                  {stuck && <svg width="10" height="10" viewBox="0 0 10 10"><path d="M3 3l4 4M7 3l-4 4" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" /></svg>}
                </div>
                <span style={{ fontSize: 10, color: passed ? 'var(--text-primary)' : 'var(--text-muted)' }}>{PHASE_LABELS[phase]}</span>
                {stuck && cond?.reason && <span style={{ fontSize: 9, color: '#e5564f' }}>{cond.reason}</span>}
              </div>
              {i < PHASE_ORDER.length - 1 && (
                <div style={{ flex: 1, height: 2, background: i < lastTrue ? '#3d9a5f' : 'var(--border)', margin: '0 4px', marginBottom: 20 }} />
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
