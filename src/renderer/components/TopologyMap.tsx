import { useState, useEffect, useMemo } from 'react'
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

const NOISE_PATTERNS = [/^cm-acme-/, /^cert-manager/, /^kube-/, /^default-http-backend/]

export function TopologyMap({ cluster, namespace }: TopologyMapProps) {
  const k8s = useK8s()
  const [nodes, setNodes] = useState<TopologyNode[]>([])
  const [edges, setEdges] = useState<TopologyEdge[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    setLoading(true)
    k8s
      .getTopology(cluster, namespace)
      .then((data) => {
        setNodes(data.nodes)
        setEdges(data.edges)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [cluster, namespace])

  const filtered = useMemo(() => {
    let visibleNodes = nodes.filter((n) => !NOISE_PATTERNS.some((p) => p.test(n.name)))
    if (filter) {
      const lower = filter.toLowerCase()
      visibleNodes = visibleNodes.filter((n) => n.name.toLowerCase().includes(lower))
    }
    const visibleIds = new Set(visibleNodes.map((n) => n.id))
    const visibleEdges = edges.filter((e) => visibleIds.has(e.from) && visibleIds.has(e.to))
    return { nodes: visibleNodes, edges: visibleEdges }
  }, [nodes, edges, filter])

  if (loading)
    return (
      <Card style={{ marginBottom: 12 }}>
        <H5>Topology</H5>
        <Spinner size={20} />
      </Card>
    )
  if (nodes.length === 0) return null

  const byKind = new Map<string, TopologyNode[]>()
  for (const n of filtered.nodes) {
    const list = byKind.get(n.kind) ?? []
    list.push(n)
    byKind.set(n.kind, list)
  }

  const kindOrder = ['Ingress', 'Service', 'Deployment']

  return (
    <Card style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <H5 style={{ margin: 0 }}>Service Topology</H5>
        <InputGroup
          small
          leftIcon="filter"
          placeholder="Filter..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ width: 160 }}
        />
      </div>
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', overflowX: 'auto', padding: '8px 0' }}>
        {kindOrder.map((kind) => {
          const items = byKind.get(kind) ?? []
          if (items.length === 0) return null
          return (
            <div key={kind} style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 140 }}>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: 4
                }}
              >
                {kind}s ({items.length})
              </div>
              {items.map((n) => {
                const outgoing = filtered.edges.filter((e) => e.from === n.id)
                return (
                  <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        padding: '6px 10px',
                        borderRadius: 6,
                        fontSize: 12,
                        border: `1px solid ${KIND_COLORS[kind] ?? 'var(--border)'}`,
                        background: `${KIND_COLORS[kind] ?? 'var(--border)'}15`,
                        whiteSpace: 'nowrap'
                      }}
                      className="monospace"
                    >
                      {n.name}
                    </div>
                    {outgoing.length > 0 && (
                      <svg width="20" height="12" viewBox="0 0 20 12" style={{ opacity: 0.3, flexShrink: 0 }}>
                        <path
                          d="M0 6h16M12 2l4 4-4 4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
        {filtered.edges.length} connections, {filtered.nodes.length} resources
        {nodes.length !== filtered.nodes.length && ` (${nodes.length - filtered.nodes.length} hidden)`}
      </div>
    </Card>
  )
}
