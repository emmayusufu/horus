import { Card, H5 } from '@blueprintjs/core'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { K8sResource } from '../../shared/types'

interface NamespaceComparisonProps {
  resources: K8sResource[]
}

export function NamespaceComparison({ resources }: NamespaceComparisonProps) {
  const pods = resources.filter((r) => r.kind === 'Pod')
  if (pods.length === 0) return null

  const byNs = new Map<string, { pods: number; healthy: number; unhealthy: number }>()
  for (const p of pods) {
    const entry = byNs.get(p.namespace) ?? { pods: 0, healthy: 0, unhealthy: 0 }
    entry.pods++
    if (p.health === 'healthy') entry.healthy++
    else entry.unhealthy++
    byNs.set(p.namespace, entry)
  }

  const data = [...byNs.entries()]
    .map(([ns, counts]) => ({
      namespace: ns.length > 12 ? ns.slice(0, 12) + '..' : ns,
      healthy: counts.healthy,
      unhealthy: counts.unhealthy,
      total: counts.pods
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  return (
    <Card style={{ marginBottom: 12 }}>
      <H5>Namespace Comparison</H5>
      <ResponsiveContainer width="100%" height={data.length * 30 + 40}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="namespace"
            width={100}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 12
            }}
            itemStyle={{ color: 'var(--text-primary)' }}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-muted)' }} />
          <Bar dataKey="healthy" stackId="a" fill="#3d9a5f" radius={[0, 0, 0, 0]} barSize={14} name="Healthy" />
          <Bar dataKey="unhealthy" stackId="a" fill="#e5564f" radius={[0, 4, 4, 0]} barSize={14} name="Unhealthy" />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}
