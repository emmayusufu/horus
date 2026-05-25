import { useState, useEffect } from 'react'
import { Card, H5, Tag, Intent } from '@blueprintjs/core'
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useK8s } from '../hooks/useK8s'
import type { CronJobRun } from '../../shared/types'

interface CronJobRunsProps {
  cluster: string
  namespace: string
  name: string
}

const STATUS_COLORS = { Complete: '#3d9a5f', Failed: '#e5564f', Running: '#cc8d35' }

export function CronJobRuns({ cluster, namespace, name }: CronJobRunsProps) {
  const k8s = useK8s()
  const [runs, setRuns] = useState<CronJobRun[]>([])

  useEffect(() => {
    k8s.getCronJobRuns(cluster, namespace, name).then(setRuns).catch(() => {})
  }, [cluster, namespace, name])

  if (runs.length === 0) return null

  const chartData = [...runs].reverse().map((r) => ({
    name: formatTime(r.startTime),
    duration: parseDuration(r.duration),
    status: r.status
  }))

  const successRate = runs.filter((r) => r.status === 'Complete').length
  const failRate = runs.filter((r) => r.status === 'Failed').length

  return (
    <Card style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <H5 style={{ margin: 0 }}>Job Runs ({runs.length})</H5>
        <div style={{ display: 'flex', gap: 8 }}>
          <Tag minimal intent={Intent.SUCCESS}>{successRate} passed</Tag>
          {failRate > 0 && <Tag minimal intent={Intent.DANGER}>{failRate} failed</Tag>}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={100}>
        <BarChart data={chartData} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
            itemStyle={{ color: 'var(--text-primary)' }}
            formatter={(value: number) => [`${value}s`, 'Duration']}
          />
          <Bar dataKey="duration" radius={[3, 3, 0, 0]} barSize={20}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={STATUS_COLORS[d.status] ?? '#5f6b7c'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="monospace" style={{ fontSize: 11, marginTop: 8 }}>
        {runs.map((r) => (
          <div key={r.name} style={{ display: 'flex', gap: 10, padding: '3px 0', alignItems: 'center' }}>
            <span className="ov-pulse" style={{ width: 5, height: 5, background: STATUS_COLORS[r.status] }} />
            <span style={{ minWidth: 60, color: 'var(--text-muted)' }}>{formatTime(r.startTime)}</span>
            <Tag minimal intent={r.status === 'Complete' ? Intent.SUCCESS : r.status === 'Failed' ? Intent.DANGER : Intent.WARNING} style={{ fontSize: 10 }}>
              {r.status}
            </Tag>
            <span style={{ color: 'var(--text-muted)' }}>{r.duration}</span>
            <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>{r.pods} pods</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

function formatTime(iso: string): string {
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  catch { return iso }
}

function parseDuration(d: string): number {
  const m = d.match(/^(\d+)(s|m)$/)
  if (!m) return 0
  return m[2] === 'm' ? parseInt(m[1]) * 60 : parseInt(m[1])
}
