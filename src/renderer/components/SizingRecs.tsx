import { useState, useEffect } from 'react'
import { Card, H5, Tag, Intent } from '@blueprintjs/core'
import { useK8s } from '../hooks/useK8s'
import { CardSkeleton } from './Skeleton'
import type { SizingRec } from '../../shared/types'

interface SizingRecsProps {
  cluster: string
  namespace: string
}

const FLAG_INTENT = { over: Intent.WARNING, tight: Intent.DANGER, ok: Intent.SUCCESS }
const FLAG_LABEL = { over: 'over-provisioned', tight: 'tight', ok: 'ok' }

export function SizingRecs({ cluster, namespace }: SizingRecsProps) {
  const k8s = useK8s()
  const [recs, setRecs] = useState<SizingRec[]>([])
  const [metricsAvailable, setMetricsAvailable] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    k8s
      .getSizingRecs(cluster, namespace)
      .then((res) => {
        setMetricsAvailable(res.metricsAvailable)
        setRecs(res.recs)
      })
      .catch(() => setMetricsAvailable(false))
      .finally(() => setLoading(false))
  }, [cluster, namespace])

  if (loading) return <CardSkeleton title lines={4} />

  if (!metricsAvailable) {
    return (
      <Card style={{ marginBottom: 12 }}>
        <H5>Resource Sizing</H5>
        <span className="bp6-text-muted" style={{ fontSize: 12 }}>
          metrics-server not available in this cluster
        </span>
      </Card>
    )
  }

  if (recs.length === 0) return null

  const overCount = recs.filter((r) => r.flag === 'over').length

  return (
    <Card style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <H5 style={{ margin: 0 }}>Resource Sizing</H5>
        {overCount > 0 && (
          <Tag minimal intent={Intent.WARNING}>
            {overCount} over-provisioned
          </Tag>
        )}
      </div>
      <div style={{ maxHeight: 320, overflow: 'auto' }}>
        {recs.map((r, i) => (
          <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Tag minimal intent={FLAG_INTENT[r.flag]} style={{ fontSize: 10 }}>
                {FLAG_LABEL[r.flag]}
              </Tag>
              <span className="monospace" style={{ fontSize: 11 }}>
                {r.pod}/{r.container}
              </span>
            </div>
            <UsageBar label="cpu" actual={r.cpuActual} request={r.cpuRequest} pct={r.cpuPct} />
            <UsageBar label="mem" actual={r.memActual} request={r.memRequest} pct={r.memPct} />
          </div>
        ))}
      </div>
    </Card>
  )
}

function UsageBar({ label, actual, request, pct }: { label: string; actual: string; request: string; pct: number }) {
  const hasReq = pct >= 0
  const color = pct > 90 ? '#e5564f' : pct < 30 ? '#cc8d35' : '#3d9a5f'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, fontSize: 11 }}>
      <span style={{ width: 28, color: 'var(--text-muted)' }}>{label}</span>
      <div style={{ flex: 1, height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
        {hasReq && <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, borderRadius: 3 }} />}
      </div>
      <span className="monospace" style={{ color: 'var(--text-muted)', minWidth: 110, textAlign: 'right' }}>
        {actual} / {request}
        {hasReq ? ` (${pct}%)` : ''}
      </span>
    </div>
  )
}
