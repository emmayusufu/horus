import { useState, useEffect } from 'react'
import { Card, H5, Tag, Intent } from '@blueprintjs/core'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from 'recharts'
import { useK8s } from '../hooks/useK8s'
import type { HPAInfo } from '../../shared/types'

interface HPAStatusProps { cluster: string; namespace: string }

export function HPAStatus({ cluster, namespace }: HPAStatusProps) {
  const k8s = useK8s()
  const [hpas, setHpas] = useState<HPAInfo[]>([])

  useEffect(() => {
    k8s.getHPAs(cluster, namespace).then(setHpas).catch(() => {})
  }, [cluster, namespace])

  if (hpas.length === 0) return null

  return (
    <Card style={{ marginBottom: 12 }}>
      <H5>Autoscalers ({hpas.length})</H5>
      {hpas.map((h) => {
        const pct = h.maxReplicas > 0 ? Math.round((h.currentReplicas / h.maxReplicas) * 100) : 0
        const scaling = h.desiredReplicas !== h.currentReplicas
        const chartData = [
          { name: 'Current', value: h.currentReplicas, color: '#3d9a5f' },
          { name: 'Desired', value: h.desiredReplicas, color: scaling ? '#cc8d35' : '#3d9a5f' },
          { name: 'Max', value: h.maxReplicas, color: 'var(--border)' }
        ]

        return (
          <div key={h.name} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span className="monospace" style={{ fontWeight: 500 }}>{h.name}</span>
              <Tag minimal intent={scaling ? Intent.WARNING : Intent.SUCCESS}>{scaling ? 'Scaling' : 'Stable'}</Tag>
              <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 'auto' }}>{h.targetKind}/{h.targetName}</span>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, marginBottom: 8 }}>
              <span>Replicas: <strong>{h.currentReplicas}</strong> / {h.maxReplicas}</span>
              <span>Min: {h.minReplicas}</span>
              <span>Desired: {h.desiredReplicas}</span>
            </div>
            {h.metrics.length > 0 && (
              <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                {h.metrics.map((m) => (
                  <div key={m.name} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{m.name}:</span>
                    <span style={{ color: parseInt(m.current) > parseInt(m.target) ? '#cc8d35' : '#3d9a5f' }}>{m.current}%</span>
                    <span style={{ color: 'var(--text-muted)' }}>/ {m.target}%</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: scaling ? '#cc8d35' : '#3d9a5f', borderRadius: 3, transition: 'width 0.3s' }} />
            </div>
          </div>
        )
      })}
    </Card>
  )
}
