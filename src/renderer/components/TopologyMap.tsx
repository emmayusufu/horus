import { useState, useEffect, useMemo, useRef } from 'react'
import { Card, H5, Spinner, InputGroup } from '@blueprintjs/core'
import { useK8s } from '../hooks/useK8s'
import type { TopologyNode, TopologyEdge } from '../../shared/types'

interface TopologyMapProps {
  cluster: string
  namespace: string
}

const KIND_COLORS: Record<string, string> = {
  Ingress: '#6e9fff',
  Service: '#cc8d35',
  Deployment: '#3d9a5f'
}

const KIND_ICONS: Record<string, string> = {
  Ingress: 'IN',
  Service: 'SV',
  Deployment: 'DP'
}

const NOISE_PATTERNS = [/^cm-acme-/, /^cert-manager/, /^kube-/, /^default-http-backend/]
const COLUMN_ORDER = ['Ingress', 'Service', 'Deployment']
const COL_WIDTH = 180
const NODE_H = 36
const NODE_GAP = 8
const COL_GAP = 100
const PAD = 24

export function TopologyMap({ cluster, namespace }: TopologyMapProps) {
  const k8s = useK8s()
  const [nodes, setNodes] = useState<TopologyNode[]>([])
  const [edges, setEdges] = useState<TopologyEdge[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [hovered, setHovered] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    k8s
      .getTopology(cluster, namespace)
      .then((data) => { setNodes(data.nodes); setEdges(data.edges) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [cluster, namespace])

  const filtered = useMemo(() => {
    let vis = nodes.filter((n) => !NOISE_PATTERNS.some((p) => p.test(n.name)))
    if (filter) {
      const lower = filter.toLowerCase()
      vis = vis.filter((n) => n.name.toLowerCase().includes(lower))
    }
    const ids = new Set(vis.map((n) => n.id))
    return { nodes: vis, edges: edges.filter((e) => ids.has(e.from) && ids.has(e.to)) }
  }, [nodes, edges, filter])

  if (loading) return <Card style={{ marginBottom: 12 }}><H5>Topology</H5><Spinner size={20} /></Card>
  if (nodes.length === 0) return null

  const columns = COLUMN_ORDER.map((kind) => filtered.nodes.filter((n) => n.kind === kind))
  const maxCol = Math.max(...columns.map((c) => c.length), 1)
  const svgH = Math.max(maxCol * (NODE_H + NODE_GAP) + PAD * 2, 120)
  const svgW = COLUMN_ORDER.length * (COL_WIDTH + COL_GAP) - COL_GAP + PAD * 2

  const nodePos = new Map<string, { x: number; y: number }>()
  columns.forEach((col, ci) => {
    const colX = PAD + ci * (COL_WIDTH + COL_GAP)
    const totalH = col.length * NODE_H + (col.length - 1) * NODE_GAP
    const startY = (svgH - totalH) / 2
    col.forEach((n, ni) => {
      nodePos.set(n.id, { x: colX, y: startY + ni * (NODE_H + NODE_GAP) })
    })
  })

  const connectedIds = new Set<string>()
  if (hovered) {
    connectedIds.add(hovered)
    for (const e of filtered.edges) {
      if (e.from === hovered) connectedIds.add(e.to)
      if (e.to === hovered) connectedIds.add(e.from)
    }
  }

  return (
    <Card style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <H5 style={{ margin: 0 }}>Service Topology</H5>
        <InputGroup small leftIcon="filter" placeholder="Filter..." value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 160 }} />
      </div>
      <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
        <svg width={svgW} height={svgH} style={{ display: 'block' }}>
          {COLUMN_ORDER.map((kind, ci) => (
            <text
              key={kind}
              x={PAD + ci * (COL_WIDTH + COL_GAP) + COL_WIDTH / 2}
              y={14}
              textAnchor="middle"
              fill="var(--text-muted)"
              fontSize={10}
              style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}
            >
              {kind}s
            </text>
          ))}

          {filtered.edges.map((e, i) => {
            const from = nodePos.get(e.from)
            const to = nodePos.get(e.to)
            if (!from || !to) return null
            const x1 = from.x + COL_WIDTH
            const y1 = from.y + NODE_H / 2
            const x2 = to.x
            const y2 = to.y + NODE_H / 2
            const cx1 = x1 + COL_GAP * 0.4
            const cx2 = x2 - COL_GAP * 0.4
            const isHighlighted = hovered && (connectedIds.has(e.from) && connectedIds.has(e.to))
            const opacity = hovered ? (isHighlighted ? 0.6 : 0.08) : 0.2
            return (
              <g key={i}>
                <path
                  d={`M${x1},${y1} C${cx1},${y1} ${cx2},${y2} ${x2},${y2}`}
                  fill="none"
                  stroke={isHighlighted ? KIND_COLORS[filtered.nodes.find((n) => n.id === e.from)?.kind ?? ''] ?? '#5f6b7c' : '#5f6b7c'}
                  strokeWidth={isHighlighted ? 2 : 1}
                  opacity={opacity}
                />
                <circle cx={x2} cy={y2} r={2.5} fill={isHighlighted ? KIND_COLORS[filtered.nodes.find((n) => n.id === e.to)?.kind ?? ''] ?? '#5f6b7c' : '#5f6b7c'} opacity={opacity} />
              </g>
            )
          })}

          {filtered.nodes.map((n) => {
            const pos = nodePos.get(n.id)
            if (!pos) return null
            const color = KIND_COLORS[n.kind] ?? '#5f6b7c'
            const dimmed = hovered && !connectedIds.has(n.id)
            return (
              <g
                key={n.id}
                onMouseEnter={() => setHovered(n.id)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: 'pointer' }}
                opacity={dimmed ? 0.2 : 1}
              >
                <rect
                  x={pos.x} y={pos.y}
                  width={COL_WIDTH} height={NODE_H}
                  rx={6} ry={6}
                  fill={`${color}10`}
                  stroke={color}
                  strokeWidth={hovered === n.id ? 2 : 1}
                  opacity={0.8}
                />
                <rect
                  x={pos.x} y={pos.y}
                  width={28} height={NODE_H}
                  rx={6} ry={0}
                  fill={`${color}25`}
                />
                <text x={pos.x + 14} y={pos.y + NODE_H / 2 + 4} textAnchor="middle" fill={color} fontSize={9} fontWeight={600}>
                  {KIND_ICONS[n.kind] ?? ''}
                </text>
                <text x={pos.x + 36} y={pos.y + NODE_H / 2 + 4} fill="var(--text-primary)" fontSize={11} style={{ fontFamily: "'Source Code Pro', monospace" }}>
                  {n.name.length > 18 ? n.name.slice(0, 18) + '..' : n.name}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
        {filtered.edges.length} connections, {filtered.nodes.length} resources
        {nodes.length !== filtered.nodes.length && ` (${nodes.length - filtered.nodes.length} filtered out)`}
      </div>
    </Card>
  )
}
