import { CardSkeleton } from './Skeleton'
import { useState, useEffect } from 'react'
import { Card, H5 } from '@blueprintjs/core'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useK8s } from '../hooks/useK8s'
import type { CostEstimate } from '../../shared/types'

interface CostViewProps { cluster: string }

export function CostView({ cluster }: CostViewProps) {
  const k8s = useK8s()
  const [costs, setCosts] = useState<CostEstimate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    k8s.getCostEstimates(cluster).then(setCosts).catch(() => {}).finally(() => setLoading(false))
  }, [cluster])

  if (loading) return <CardSkeleton title chart lines={2} />
  if (costs.length === 0) return null

  const total = costs.reduce((sum, c) => sum + c.monthlyCost, 0)
  const chartData = costs.slice(0, 10).map((c) => ({ name: c.namespace.length > 15 ? c.namespace.slice(0, 15) + '...' : c.namespace, cost: c.monthlyCost }))

  return (
    <Card style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <H5 style={{ margin: 0 }}>Estimated Cost</H5>
        <span className="monospace" style={{ fontSize: 16, fontWeight: 600 }}>${total.toFixed(0)}/mo</span>
      </div>
      <ResponsiveContainer width="100%" height={costs.slice(0, 10).length * 28 + 16}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={120} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} formatter={(v: number) => [`$${v.toFixed(2)}`, 'Monthly']} />
          <Bar dataKey="cost" fill="#6e9fff" radius={[0, 4, 4, 0]} barSize={14} />
        </BarChart>
      </ResponsiveContainer>
      <div className="monospace" style={{ fontSize: 11, marginTop: 8 }}>
        {costs.map((c) => (
          <div key={c.namespace} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: 'var(--text-muted)' }}>
            <span>{c.namespace}</span>
            <span>{c.pods} pods, {c.cpuCores.toFixed(1)} CPU, {c.memoryGB.toFixed(1)} GB = ${c.monthlyCost.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}
