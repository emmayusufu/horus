import { useState, useEffect } from 'react'
import { Card, H5, Tag, Intent, Spinner, Button } from '@blueprintjs/core'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useK8s } from '../hooks/useK8s'
import type { NodeInfo, K8sResource } from '../../shared/types'

interface NodeViewProps {
  cluster: string
  resources: K8sResource[]
  onBack: () => void
  onSelectResource: (resource: K8sResource) => void
}

export function NodeView({ cluster, resources, onBack, onSelectResource }: NodeViewProps) {
  const k8s = useK8s()
  const [nodes, setNodes] = useState<NodeInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    k8s.getNodes(cluster).then(setNodes).catch(() => {}).finally(() => setLoading(false))
  }, [cluster])

  if (loading) return <Spinner style={{ margin: 40 }} />

  const chartData = nodes.map((n) => ({
    name: n.name.length > 20 ? n.name.slice(0, 20) + '...' : n.name,
    pods: n.podCount,
    maxPods: parseInt(n.allocatable.pods) || 110
  }))

  const isReady = (n: NodeInfo) => n.conditions.some((c) => c.type === 'Ready' && c.status === 'True')
  const hasPressure = (n: NodeInfo) => n.conditions.some((c) => c.type !== 'Ready' && c.status === 'True')

  return (
    <div style={{ padding: 16, overflow: 'auto', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Button minimal icon="arrow-left" onClick={onBack} />
        <H5 style={{ margin: 0 }}>Nodes ({nodes.length})</H5>
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{cluster}</span>
      </div>

      {nodes.length > 1 && (
        <Card style={{ marginBottom: 16, padding: 16, borderRadius: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Pod Distribution</div>
          <ResponsiveContainer width="100%" height={nodes.length * 32 + 16}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={160} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} itemStyle={{ color: 'var(--text-primary)' }} />
              <Bar dataKey="pods" fill="#3d9a5f" radius={[0, 4, 4, 0]} barSize={14} name="Pods" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {nodes.map((n) => {
          const ready = isReady(n)
          const pressure = hasPressure(n)
          const podsOnNode = resources.filter((r) => r.node === n.name)
          const isExpanded = expanded === n.name

          return (
            <Card key={n.name} style={{ padding: 0, borderRadius: 10, overflow: 'hidden' }}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}
                onClick={() => setExpanded(isExpanded ? null : n.name)}
              >
                <span className="ov-pulse" style={{ background: ready ? '#3d9a5f' : '#e5564f', boxShadow: `0 0 6px ${ready ? '#3d9a5f' : '#e5564f'}` }} />
                <span className="monospace" style={{ flex: 1 }}>{n.name}</span>
                <Tag minimal intent={ready ? Intent.SUCCESS : Intent.DANGER}>{ready ? 'Ready' : 'NotReady'}</Tag>
                {pressure && <Tag minimal intent={Intent.WARNING}>Pressure</Tag>}
                <span className="monospace" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{n.podCount} pods</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>cpu: {n.allocatable.cpu}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>mem: {n.allocatable.memory}</span>
                <svg width="14" height="14" viewBox="0 0 16 16" style={{ opacity: 0.3, transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
                  <path d="M6 3l5 5-5 5" stroke="currentColor" fill="none" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>

              {isExpanded && (
                <div style={{ padding: '0 16px 14px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: 24, padding: '12px 0', fontSize: 12 }}>
                    <div>
                      <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Conditions</div>
                      {n.conditions.map((c) => (
                        <Tag key={c.type} minimal intent={c.type === 'Ready' ? (c.status === 'True' ? Intent.SUCCESS : Intent.DANGER) : (c.status === 'True' ? Intent.WARNING : Intent.NONE)} style={{ marginRight: 4, marginBottom: 4 }}>
                          {c.type}
                        </Tag>
                      ))}
                    </div>
                    {n.taints.length > 0 && (
                      <div>
                        <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Taints</div>
                        {n.taints.map((t, i) => (
                          <div key={i} className="monospace" style={{ fontSize: 11 }}>{t.key}={t.value}:{t.effect}</div>
                        ))}
                      </div>
                    )}
                  </div>
                  {podsOnNode.length > 0 && (
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 6 }}>Pods on this node ({podsOnNode.length})</div>
                      {podsOnNode.slice(0, 20).map((p) => (
                        <div key={p.uid} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', cursor: 'pointer', fontSize: 12 }} onClick={() => onSelectResource(p)}>
                          <span className="ov-pulse" style={{ width: 5, height: 5, background: p.health === 'critical' ? '#e5564f' : p.health === 'warning' ? '#cc8d35' : '#3d9a5f' }} />
                          <span className="monospace">{p.name}</span>
                          <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>{p.status}</span>
                        </div>
                      ))}
                      {podsOnNode.length > 20 && <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 0' }}>+{podsOnNode.length - 20} more</div>}
                    </div>
                  )}
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
