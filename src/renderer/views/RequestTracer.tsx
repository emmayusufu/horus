import { useState } from 'react'
import { Card, H5, InputGroup, Button } from '@blueprintjs/core'
import { useK8s } from '../hooks/useK8s'
import { CardSkeleton } from '../components/Skeleton'
import type { RequestTrace, TraceNode } from '../../shared/types'

interface RequestTracerProps {
  clusters: string[]
  onBack: () => void
}

const STATUS_COLOR = { ok: '#3d9a5f', warning: '#cc8d35', error: '#e5564f' }
const COLUMN_ORDER: TraceNode['kind'][] = ['Host', 'LoadBalancer', 'Path', 'Service', 'Endpoints', 'Pod']
const COL_LABEL: Record<string, string> = {
  Host: 'Host',
  LoadBalancer: 'Load Balancer',
  Path: 'Route',
  Service: 'Service',
  Endpoints: 'Endpoints',
  Pod: 'Pods'
}

const COL_W = 150
const COL_GAP = 56
const NODE_H = 46
const NODE_GAP = 12
const PAD_X = 16
const PAD_Y = 28

export function RequestTracer({ clusters, onBack }: RequestTracerProps) {
  const k8s = useK8s()
  const [host, setHost] = useState('')
  const [cluster, setCluster] = useState(clusters[0] ?? '')
  const [trace, setTrace] = useState<RequestTrace | null>(null)
  const [loading, setLoading] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)

  const handleTrace = async () => {
    if (!host.trim() || !cluster) return
    setLoading(true)
    setTrace(null)
    setHovered(null)
    try {
      setTrace(await k8s.traceRequest(cluster, host.trim()))
    } catch {
      setTrace(null)
    }
    setLoading(false)
  }

  const layout = trace ? buildLayout(trace) : null
  const connected = new Set<string>()
  if (trace && hovered) {
    const walk = (id: string, dir: 'down' | 'up') => {
      connected.add(id)
      for (const e of trace.edges) {
        if (dir === 'down' && e.from === id && !connected.has(e.to)) walk(e.to, 'down')
        if (dir === 'up' && e.to === id && !connected.has(e.from)) walk(e.from, 'up')
      }
    }
    walk(hovered, 'down')
    walk(hovered, 'up')
  }

  return (
    <div style={{ padding: 16, overflow: 'auto', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Button minimal icon="arrow-left" onClick={onBack} />
        <H5 style={{ margin: 0 }}>Request Tracer</H5>
      </div>

      <Card style={{ marginBottom: 16, padding: 16, borderRadius: 12 }}>
        <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--text-muted)' }}>
          Trace a hostname through the full routing path to find where traffic breaks.
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={cluster}
            onChange={(e) => setCluster(e.target.value)}
            style={{
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '6px 8px',
              fontSize: 13
            }}
          >
            {clusters.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
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
          <Button intent="primary" large onClick={handleTrace} loading={loading}>
            Trace
          </Button>
        </div>
      </Card>

      {loading && <CardSkeleton title chart lines={3} />}

      {trace && layout && (
        <>
          <Card style={{ marginBottom: 16, padding: 12, borderRadius: 12 }}>
            <svg
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              width="100%"
              height={layout.height}
              preserveAspectRatio="xMidYMin meet"
              style={{ display: 'block', maxWidth: layout.width }}
            >
              {COLUMN_ORDER.map((kind) => {
                if (!layout.columnHas[kind]) return null
                const ci = layout.colIndex.get(kind) ?? 0
                return (
                  <text
                    key={kind}
                    x={PAD_X + ci * (COL_W + COL_GAP) + COL_W / 2}
                    y={14}
                    textAnchor="middle"
                    fill="var(--text-muted)"
                    fontSize={10}
                    style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}
                  >
                    {COL_LABEL[kind]}
                  </text>
                )
              })}

              {trace.edges.map((e, i) => {
                const a = layout.pos.get(e.from)
                const b = layout.pos.get(e.to)
                if (!a || !b) return null
                const x1 = a.x + COL_W
                const y1 = a.y + NODE_H / 2
                const x2 = b.x
                const y2 = b.y + NODE_H / 2
                const hot = hovered ? connected.has(e.from) && connected.has(e.to) : false
                return (
                  <path
                    key={i}
                    d={`M${x1},${y1} C${x1 + COL_GAP * 0.5},${y1} ${x2 - COL_GAP * 0.5},${y2} ${x2},${y2}`}
                    fill="none"
                    stroke={hot ? '#6e9fff' : '#5f6b7c'}
                    strokeWidth={hot ? 2 : 1}
                    opacity={hovered ? (hot ? 0.8 : 0.08) : 0.25}
                  />
                )
              })}

              {trace.nodes.map((n) => {
                const p = layout.pos.get(n.id)
                if (!p) return null
                const color = STATUS_COLOR[n.status]
                const dimmed = hovered ? !connected.has(n.id) : false
                return (
                  <g
                    key={n.id}
                    opacity={dimmed ? 0.25 : 1}
                    onMouseEnter={() => setHovered(n.id)}
                    onMouseLeave={() => setHovered(null)}
                    style={{ cursor: 'default' }}
                  >
                    <rect
                      x={p.x}
                      y={p.y}
                      width={COL_W}
                      height={NODE_H}
                      rx={8}
                      fill={`${color}14`}
                      stroke={color}
                      strokeWidth={hovered === n.id ? 2 : 1}
                    />
                    <rect x={p.x} y={p.y} width={4} height={NODE_H} rx={2} fill={color} />
                    <text
                      x={p.x + 12}
                      y={p.y + (n.sublabel ? 19 : NODE_H / 2 + 4)}
                      fill="var(--text-primary)"
                      fontSize={11}
                      style={{ fontFamily: "'Source Code Pro', monospace" }}
                    >
                      {clip(n.label, 18)}
                    </text>
                    {n.sublabel && (
                      <text x={p.x + 12} y={p.y + 34} fill="var(--text-muted)" fontSize={9}>
                        {clip(n.sublabel, 22)}
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>
          </Card>

          {hovered && (() => {
            const n = trace.nodes.find((x) => x.id === hovered)
            if (!n || n.issues.length === 0) return null
            return (
              <Card style={{ marginBottom: 16, padding: 12, borderRadius: 10, borderLeft: `3px solid ${STATUS_COLOR[n.status]}` }}>
                <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>{n.label}</div>
                {n.issues.map((iss, i) => (
                  <div key={i} style={{ fontSize: 12, color: STATUS_COLOR[n.status] }}>{iss}</div>
                ))}
              </Card>
            )
          })()}

          <Card
            style={{
              padding: 16,
              borderRadius: 12,
              borderLeft: `3px solid ${trace.rootCause.startsWith('All paths healthy') ? '#3d9a5f' : '#e5564f'}`,
              background: trace.rootCause.startsWith('All paths healthy') ? 'rgba(61,154,95,0.06)' : 'rgba(229,86,79,0.06)'
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
              {trace.rootCause.startsWith('All paths healthy') ? 'Path is healthy' : 'Root Cause'}
            </div>
            <div style={{ fontSize: 13, marginBottom: 8 }}>{trace.rootCause}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{trace.suggestion}</div>
          </Card>
        </>
      )}

      {!trace && !loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 14 }}>Enter a hostname and click Trace</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            {'Maps every route under the host: Host > Service > Endpoints > Pods'}
          </div>
        </div>
      )}
    </div>
  )
}

function buildLayout(trace: RequestTrace) {
  const present = COLUMN_ORDER.filter((kind) => trace.nodes.some((n) => n.kind === kind))
  const colIndex = new Map(present.map((kind, i) => [kind, i]))

  const pos = new Map<string, { x: number; y: number }>()
  const columnHas: Record<string, boolean> = {}
  let maxRows = 0

  for (const kind of present) {
    const items = trace.nodes.filter((n) => n.kind === kind)
    columnHas[kind] = true
    maxRows = Math.max(maxRows, items.length)
    const x = PAD_X + (colIndex.get(kind) ?? 0) * (COL_W + COL_GAP)
    items.forEach((n, ri) => {
      pos.set(n.id, { x, y: PAD_Y + ri * (NODE_H + NODE_GAP) })
    })
  }

  return {
    pos,
    columnHas,
    colIndex,
    width: PAD_X * 2 + present.length * COL_W + (present.length - 1) * COL_GAP,
    height: PAD_Y + maxRows * (NODE_H + NODE_GAP) + 8
  }
}

function clip(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '..' : s
}
