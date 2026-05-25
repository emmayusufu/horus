import { useState, useEffect } from 'react'
import { Card, H5, Tag, Intent } from '@blueprintjs/core'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts'
import type { RolloutInfo } from '../../shared/types'

interface RolloutStatusProps {
  cluster: string
  namespace: string
  name: string
}

export function RolloutStatus({ cluster, namespace, name }: RolloutStatusProps) {
  const [rollout, setRollout] = useState<RolloutInfo | null>(null)

  useEffect(() => {
    window.horus.getRollout(cluster, namespace, name).then(setRollout).catch(() => {})
  }, [cluster, namespace, name])

  if (!rollout) return null

  const pct = rollout.replicas > 0 ? Math.round((rollout.availableReplicas / rollout.replicas) * 100) : 0
  const isComplete = rollout.availableReplicas === rollout.replicas && rollout.updatedReplicas === rollout.replicas

  const chartData = rollout.replicaSets.map((rs) => ({
    name: rs.name.slice(-10),
    replicas: rs.replicas,
    ready: rs.ready,
    isCurrent: rs.isCurrent
  }))

  return (
    <Card style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <H5 style={{ margin: 0 }}>Rollout</H5>
        <Tag intent={isComplete ? Intent.SUCCESS : Intent.WARNING} minimal>
          {isComplete ? 'Complete' : `${pct}% rolled out`}
        </Tag>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 12 }}>
        <span>Strategy: <strong>{rollout.strategy}</strong></span>
        {rollout.maxSurge && <span>Max surge: <strong>{rollout.maxSurge}</strong></span>}
        {rollout.maxUnavailable && <span>Max unavailable: <strong>{rollout.maxUnavailable}</strong></span>}
      </div>

      <div className="rollout-progress" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 4, height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--border)' }}>
          <div style={{ width: `${(rollout.availableReplicas / (rollout.replicas || 1)) * 100}%`, background: '#3d9a5f', borderRadius: 4, transition: 'width 0.3s' }} />
          <div style={{ width: `${((rollout.updatedReplicas - rollout.availableReplicas) / (rollout.replicas || 1)) * 100}%`, background: '#cc8d35', borderRadius: 4, transition: 'width 0.3s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          <span>{rollout.availableReplicas}/{rollout.replicas} available</span>
          <span>{rollout.updatedReplicas}/{rollout.replicas} updated</span>
          <span>{rollout.readyReplicas}/{rollout.replicas} ready</span>
        </div>
      </div>

      {chartData.length > 0 && (
        <>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>ReplicaSets</div>
          <ResponsiveContainer width="100%" height={chartData.length * 32 + 16}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={80} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Bar dataKey="replicas" radius={[0, 4, 4, 0]} barSize={14}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.isCurrent ? '#3d9a5f' : '#5f6b7c'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="monospace" style={{ fontSize: 11, marginTop: 8 }}>
            {rollout.replicaSets.map((rs) => (
              <div key={rs.name} style={{ display: 'flex', gap: 8, padding: '2px 0', opacity: rs.isCurrent ? 1 : 0.6 }}>
                <Tag minimal round intent={rs.isCurrent ? Intent.SUCCESS : Intent.NONE} style={{ fontSize: 10 }}>
                  rev {rs.revision}
                </Tag>
                <span>{rs.ready}/{rs.replicas} ready</span>
                <span style={{ color: 'var(--text-muted)' }}>{rs.image.split('/').pop()}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}
