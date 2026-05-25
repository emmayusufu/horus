import { useState } from 'react'
import { Card, H5, InputGroup, Button, Intent, Tag } from '@blueprintjs/core'
import { useK8s } from '../hooks/useK8s'
import { CardSkeleton } from '../components/Skeleton'
import type { RequestTrace } from '../../shared/types'

interface RequestTracerProps {
  clusters: string[]
  onBack: () => void
}

const HOP_COLORS = { ok: '#3d9a5f', warning: '#cc8d35', error: '#e5564f' }
const HOP_ICONS: Record<string, string> = { Ingress: 'IN', LoadBalancer: 'LB', Service: 'SV', Endpoints: 'EP', Pod: 'PD' }

export function RequestTracer({ clusters, onBack }: RequestTracerProps) {
  const k8s = useK8s()
  const [host, setHost] = useState('')
  const [cluster, setCluster] = useState(clusters[0] ?? '')
  const [trace, setTrace] = useState<RequestTrace | null>(null)
  const [loading, setLoading] = useState(false)

  const handleTrace = async () => {
    if (!host.trim() || !cluster) return
    setLoading(true)
    setTrace(null)
    try {
      const result = await k8s.traceRequest(cluster, host.trim())
      setTrace(result)
    } catch {}
    setLoading(false)
  }

  return (
    <div style={{ padding: 16, overflow: 'auto', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Button minimal icon="arrow-left" onClick={onBack} />
        <H5 style={{ margin: 0 }}>Request Tracer</H5>
      </div>

      <Card style={{ marginBottom: 16, padding: 16, borderRadius: 12 }}>
        <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--text-muted)' }}>
          Enter a hostname to trace the request path through your K8s infrastructure
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={cluster}
            onChange={(e) => setCluster(e.target.value)}
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 4, padding: '6px 8px', fontSize: 13 }}
          >
            {clusters.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <InputGroup
            placeholder="api.example.com"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleTrace()}
            style={{ flex: 1 }}
            large
            className="monospace"
          />
          <Button intent="primary" large onClick={handleTrace} loading={loading}>Trace</Button>
        </div>
      </Card>

      {loading && <CardSkeleton title chart lines={4} />}

      {trace && (
        <>
          <div style={{ position: 'relative', padding: '0 0 0 32px', marginBottom: 16 }}>
            <div style={{ position: 'absolute', left: 15, top: 0, bottom: 0, width: 2, background: 'var(--border)' }} />

            {trace.hops.map((hop, i) => {
              const color = HOP_COLORS[hop.status]
              const icon = HOP_ICONS[hop.kind] ?? '??'
              const isLast = i === trace.hops.length - 1

              return (
                <div key={i} style={{ position: 'relative', marginBottom: isLast ? 0 : 16 }}>
                  <div style={{
                    position: 'absolute', left: -32, top: 2,
                    width: 28, height: 28, borderRadius: '50%',
                    background: `${color}20`, border: `2px solid ${color}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 700, color,
                    zIndex: 1
                  }}>
                    {icon}
                  </div>

                  <Card style={{
                    padding: '10px 14px', borderRadius: 8, marginLeft: 8,
                    borderLeft: `3px solid ${color}`
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 500, fontSize: 13 }}>{hop.kind}</span>
                      <span className="monospace" style={{ fontSize: 12 }}>{hop.name}</span>
                      <Tag minimal intent={hop.status === 'ok' ? Intent.SUCCESS : hop.status === 'warning' ? Intent.WARNING : Intent.DANGER} style={{ marginLeft: 'auto' }}>
                        {hop.status}
                      </Tag>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{hop.detail}</div>
                    {hop.issues.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        {hop.issues.map((issue, j) => (
                          <div key={j} style={{ fontSize: 12, color: '#e5564f', display: 'flex', gap: 4, alignItems: 'baseline' }}>
                            <span style={{ opacity: 0.5 }}>-</span>
                            <span>{issue}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>
              )
            })}
          </div>

          <Card style={{
            padding: 16, borderRadius: 12,
            borderLeft: `3px solid ${trace.rootCause.includes('All hops look healthy') ? '#3d9a5f' : '#e5564f'}`,
            background: trace.rootCause.includes('All hops look healthy') ? 'rgba(61,154,95,0.06)' : 'rgba(229,86,79,0.06)'
          }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
              {trace.rootCause.includes('All hops look healthy') ? 'Path is healthy' : 'Root Cause'}
            </div>
            <div style={{ fontSize: 13, marginBottom: 8 }}>{trace.rootCause}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{trace.suggestion}</div>
          </Card>
        </>
      )}

      {!trace && !loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.2 }}>
            <svg width="48" height="48" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor" /></svg>
          </div>
          <div style={{ fontSize: 14 }}>Enter a hostname and click Trace to debug the request path</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Traces: Ingress > LoadBalancer > Service > Endpoints > Pods</div>
        </div>
      )}
    </div>
  )
}
