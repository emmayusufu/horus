import { useState, useEffect } from 'react'
import { Card, H5 } from '@blueprintjs/core'
import { useK8s } from '../hooks/useK8s'
import type { ResourceQuota } from '../../shared/types'

interface QuotaViewProps { cluster: string; namespace: string }

export function QuotaView({ cluster, namespace }: QuotaViewProps) {
  const k8s = useK8s()
  const [quotas, setQuotas] = useState<ResourceQuota[]>([])

  useEffect(() => {
    k8s.getResourceQuotas(cluster, namespace).then(setQuotas).catch(() => {})
  }, [cluster, namespace])

  if (quotas.length === 0) return null

  return (
    <Card style={{ marginBottom: 12 }}>
      <H5>Resource Quotas</H5>
      {quotas.map((q) => (
        <div key={q.name} style={{ marginBottom: 12 }}>
          <div className="monospace" style={{ fontSize: 12, marginBottom: 6, color: 'var(--text-muted)' }}>{q.name}</div>
          {q.items.map((item) => {
            const used = parseFloat(item.used) || 0
            const hard = parseFloat(item.hard) || 1
            const pct = Math.min(Math.round((used / hard) * 100), 100)
            const color = pct > 90 ? '#e5564f' : pct > 70 ? '#cc8d35' : '#3d9a5f'
            return (
              <div key={item.resource} style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                  <span>{item.resource}</span>
                  <span className="monospace" style={{ color: 'var(--text-muted)' }}>{item.used} / {item.hard}</span>
                </div>
                <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </Card>
  )
}
