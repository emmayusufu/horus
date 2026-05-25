import { useState } from 'react'
import { Card, H5, Tag, Intent } from '@blueprintjs/core'
import type { K8sResource } from '../../shared/types'

interface OwnershipTreeProps {
  resources: K8sResource[]
  onSelect: (resource: K8sResource) => void
}

const HEALTH_COLORS = { healthy: '#3d9a5f', warning: '#cc8d35', critical: '#e5564f', unknown: '#5f6b7c' }

export function OwnershipTree({ resources, onSelect }: OwnershipTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const deployments = resources.filter((r) => r.kind === 'Deployment')
  const jobs = resources.filter((r) => r.kind === 'Job')
  const cronJobs = resources.filter((r) => r.kind === 'CronJob')
  const pods = resources.filter((r) => r.kind === 'Pod')

  if (deployments.length === 0 && cronJobs.length === 0) return null

  const toggle = (id: string) => {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id); else next.add(id)
    setExpanded(next)
  }

  const renderPods = (ownerName: string) => {
    const owned = pods.filter((p) => p.ownerName?.startsWith(ownerName) || p.ownerName === ownerName)
    return owned.map((p) => (
      <div
        key={p.uid}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0 3px 48px', cursor: 'pointer', fontSize: 12 }}
        onClick={() => onSelect(p)}
      >
        <span className="ov-pulse" style={{ width: 5, height: 5, background: HEALTH_COLORS[p.health] }} />
        <span className="monospace">{p.name}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 'auto' }}>{p.status}</span>
      </div>
    ))
  }

  return (
    <Card style={{ marginBottom: 12 }}>
      <H5>Ownership Tree</H5>
      <div style={{ fontSize: 12 }}>
        {deployments.map((dep) => {
          const isOpen = expanded.has(dep.uid)
          const ownedPods = pods.filter((p) => p.ownerName?.startsWith(dep.name))
          const healthyCount = ownedPods.filter((p) => p.health === 'healthy').length
          return (
            <div key={dep.uid} style={{ marginBottom: 4 }}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer' }}
                onClick={() => toggle(dep.uid)}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', opacity: 0.4 }}>
                  <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <Tag minimal intent={Intent.SUCCESS} style={{ fontSize: 10 }}>Deploy</Tag>
                <span className="monospace" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onSelect(dep) }}>{dep.name}</span>
                <span style={{ color: 'var(--text-muted)', marginLeft: 'auto', fontSize: 11 }}>{healthyCount}/{ownedPods.length} pods</span>
              </div>
              {isOpen && (
                <div style={{ borderLeft: '1px solid var(--border)', marginLeft: 6 }}>
                  {renderPods(dep.name)}
                  {ownedPods.length === 0 && <div style={{ padding: '3px 0 3px 48px', color: 'var(--text-muted)', fontSize: 11 }}>No pods</div>}
                </div>
              )}
            </div>
          )
        })}
        {cronJobs.map((cj) => {
          const isOpen = expanded.has(cj.uid)
          const ownedJobs = jobs.filter((j) => j.ownerName === cj.name)
          return (
            <div key={cj.uid} style={{ marginBottom: 4 }}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer' }}
                onClick={() => toggle(cj.uid)}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', opacity: 0.4 }}>
                  <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <Tag minimal intent={Intent.NONE} style={{ fontSize: 10 }}>CronJob</Tag>
                <span className="monospace" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onSelect(cj) }}>{cj.name}</span>
                <span style={{ color: 'var(--text-muted)', marginLeft: 'auto', fontSize: 11 }}>{ownedJobs.length} jobs</span>
              </div>
              {isOpen && (
                <div style={{ borderLeft: '1px solid var(--border)', marginLeft: 6 }}>
                  {ownedJobs.map((j) => (
                    <div key={j.uid} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0 3px 32px', cursor: 'pointer', fontSize: 12 }} onClick={() => onSelect(j)}>
                      <Tag minimal intent={j.health === 'healthy' ? Intent.SUCCESS : j.health === 'critical' ? Intent.DANGER : Intent.WARNING} style={{ fontSize: 9 }}>Job</Tag>
                      <span className="monospace">{j.name}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 'auto' }}>{j.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
