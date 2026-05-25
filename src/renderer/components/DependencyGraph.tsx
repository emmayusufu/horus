import { useState, useEffect } from 'react'
import { Card, H5, Spinner } from '@blueprintjs/core'
import { useK8s } from '../hooks/useK8s'
import { CardSkeleton } from './Skeleton'

interface DependencyGraphProps {
  cluster: string
  namespace: string
}

interface DepNode { id: string; kind: string; name: string }
interface DepEdge { from: string; to: string }

const KIND_COLORS: Record<string, string> = {
  Pod: '#8b8d94',
  ConfigMap: '#6e9fff',
  Secret: '#cc8d35',
  PVC: '#9c6ade'
}

export function DependencyGraph({ cluster, namespace }: DependencyGraphProps) {
  const k8s = useK8s()
  const [nodes, setNodes] = useState<DepNode[]>([])
  const [edges, setEdges] = useState<DepEdge[]>([])
  const [loading, setLoading] = useState(true)
  const [hovered, setHovered] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    k8s.getResourceYaml(cluster, namespace, '', 'Pod').catch(() => '{}')

    Promise.all([
      k8s.getPVCs(cluster, namespace).catch(() => []),
      k8s.getConfigChecks(cluster, namespace).catch(() => [])
    ]).then(([pvcs]) => {
      const resources = (window as any).horus
      const allRes = resources ? [] : []

      const n: DepNode[] = []
      const e: DepEdge[] = []

      for (const pvc of pvcs) {
        n.push({ id: `pvc-${pvc.name}`, kind: 'PVC', name: pvc.name })
        for (const pod of pvc.pods) {
          const podId = `pod-${pod}`
          if (!n.find((x) => x.id === podId)) n.push({ id: podId, kind: 'Pod', name: pod })
          e.push({ from: podId, to: `pvc-${pvc.name}` })
        }
      }

      setNodes(n)
      setEdges(e)
    }).finally(() => setLoading(false))
  }, [cluster, namespace])

  if (loading) return <CardSkeleton title chart lines={2} />
  if (nodes.length === 0) return null

  const byKind = new Map<string, DepNode[]>()
  for (const n of nodes) {
    const list = byKind.get(n.kind) ?? []
    list.push(n)
    byKind.set(n.kind, list)
  }

  const connectedIds = new Set<string>()
  if (hovered) {
    connectedIds.add(hovered)
    for (const e of edges) {
      if (e.from === hovered) connectedIds.add(e.to)
      if (e.to === hovered) connectedIds.add(e.from)
    }
  }

  return (
    <Card style={{ marginBottom: 12 }}>
      <H5>Dependencies</H5>
      <div style={{ display: 'flex', gap: 24, padding: '8px 0', overflowX: 'auto' }}>
        {['Pod', 'PVC', 'ConfigMap', 'Secret'].map((kind) => {
          const items = byKind.get(kind) ?? []
          if (items.length === 0) return null
          const color = KIND_COLORS[kind] ?? '#5f6b7c'
          return (
            <div key={kind} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{kind}s ({items.length})</div>
              {items.map((n) => {
                const dimmed = hovered && !connectedIds.has(n.id)
                return (
                  <div
                    key={n.id}
                    className="monospace"
                    style={{
                      fontSize: 11, padding: '4px 8px', borderRadius: 4,
                      border: `1px solid ${color}`,
                      background: `${color}10`,
                      opacity: dimmed ? 0.2 : 1,
                      cursor: 'pointer', transition: 'opacity 0.15s'
                    }}
                    onMouseEnter={() => setHovered(n.id)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    {n.name}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
        {edges.length} dependencies
      </div>
    </Card>
  )
}
