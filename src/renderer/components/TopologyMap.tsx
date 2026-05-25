import { useState, useEffect } from 'react'
import { Card, H5, Spinner, Tag, Intent } from '@blueprintjs/core'
import { useK8s } from '../hooks/useK8s'
import type { TopologyNode, TopologyEdge } from '../../shared/types'

interface TopologyMapProps { cluster: string; namespace: string }

const KIND_COLORS: Record<string, string> = {
  Ingress: '#6e9fff',
  Service: '#cc8d35',
  Deployment: '#3d9a5f',
  Pod: '#8b8d94'
}

export function TopologyMap({ cluster, namespace }: TopologyMapProps) {
  const k8s = useK8s()
  const [nodes, setNodes] = useState<TopologyNode[]>([])
  const [edges, setEdges] = useState<TopologyEdge[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    k8s.getTopology(cluster, namespace)
      .then((data) => { setNodes(data.nodes); setEdges(data.edges) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [cluster, namespace])

  if (loading) return <Card style={{ marginBottom: 12 }}><H5>Topology</H5><Spinner size={20} /></Card>
  if (nodes.length === 0) return null

  const byKind = new Map<string, TopologyNode[]>()
  for (const n of nodes) {
    const list = byKind.get(n.kind) ?? []
    list.push(n)
    byKind.set(n.kind, list)
  }

  const kindOrder = ['Ingress', 'Service', 'Deployment']

  return (
    <Card style={{ marginBottom: 12 }}>
      <H5>Service Topology</H5>
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', overflowX: 'auto', padding: '8px 0' }}>
        {kindOrder.map((kind) => {
          const items = byKind.get(kind) ?? []
          if (items.length === 0) return null
          return (
            <div key={kind} style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 140 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{kind}s</div>
              {items.map((n) => {
                const outgoing = edges.filter((e) => e.from === n.id)
                return (
                  <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      padding: '6px 10px', borderRadius: 6, fontSize: 12,
                      border: `1px solid ${KIND_COLORS[kind] ?? 'var(--border)'}`,
                      background: `${KIND_COLORS[kind] ?? 'var(--border)'}15`,
                      whiteSpace: 'nowrap'
                    }} className="monospace">
                      {n.name}
                    </div>
                    {outgoing.length > 0 && (
                      <svg width="20" height="12" viewBox="0 0 20 12" style={{ opacity: 0.3, flexShrink: 0 }}>
                        <path d="M0 6h16M12 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
        {edges.length} connections, {nodes.length} resources
      </div>
    </Card>
  )
}
