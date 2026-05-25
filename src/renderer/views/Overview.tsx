import { useState } from 'react'
import { NonIdealState, Button } from '@blueprintjs/core'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { K8sResource, ClusterInfo } from '../../shared/types'

interface OverviewProps {
  clusters: ClusterInfo[]
  unhealthy: K8sResource[]
  allResources: K8sResource[]
  onSelectCluster: (name: string) => void
  onSelectResource: (resource: K8sResource) => void
}

const PAGE_SIZE = 8

export function Overview({ clusters, unhealthy, allResources, onSelectCluster, onSelectResource }: OverviewProps) {
  const [page, setPage] = useState(0)

  if (clusters.length === 0) {
    return (
      <div className="ov">
        <NonIdealState icon="offline" title="No clusters" description="Horus connects to all clusters in your kubeconfig on launch" />
      </div>
    )
  }

  const total = allResources.length
  const healthy = allResources.filter((r) => r.health === 'healthy').length
  const warning = allResources.filter((r) => r.health === 'warning').length
  const critical = allResources.filter((r) => r.health === 'critical').length
  const healthPct = total > 0 ? Math.round((healthy / total) * 100) : 0

  const kindCounts = new Map<string, number>()
  for (const r of allResources) kindCounts.set(r.kind, (kindCounts.get(r.kind) ?? 0) + 1)
  const kindData = [...kindCounts.entries()].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count)

  const circumference = 2 * Math.PI * 52
  const healthyOffset = circumference - (circumference * healthy) / (total || 1)
  const warningOffset = circumference - (circumference * warning) / (total || 1)
  const criticalOffset = circumference - (circumference * critical) / (total || 1)

  return (
    <div className="ov">
      <div className="ov-hero">
        <div className="ov-ring-section">
          <svg viewBox="0 0 120 120" className="ov-ring">
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" strokeWidth="6" />
            <circle cx="60" cy="60" r="52" fill="none" stroke="#e5564f" strokeWidth="6"
              strokeDasharray={circumference} strokeDashoffset={criticalOffset}
              strokeLinecap="round" transform="rotate(-90 60 60)" className="ov-ring-segment" style={{ animationDelay: '0.4s' }} />
            <circle cx="60" cy="60" r="52" fill="none" stroke="#cc8d35" strokeWidth="6"
              strokeDasharray={circumference} strokeDashoffset={warningOffset}
              strokeLinecap="round" transform={`rotate(${-90 + (critical / (total || 1)) * 360} 60 60)`} className="ov-ring-segment" style={{ animationDelay: '0.6s' }} />
            <circle cx="60" cy="60" r="52" fill="none" stroke="#3d9a5f" strokeWidth="6"
              strokeDasharray={circumference} strokeDashoffset={healthyOffset}
              strokeLinecap="round" transform={`rotate(${-90 + ((critical + warning) / (total || 1)) * 360} 60 60)`} className="ov-ring-segment" style={{ animationDelay: '0.2s' }} />
          </svg>
          <div className="ov-ring-center">
            <span className="ov-ring-pct">{healthPct}</span>
            <span className="ov-ring-label">% healthy</span>
          </div>
        </div>

        <div className="ov-metrics">
          <div className="ov-metric ov-fade" style={{ animationDelay: '0.1s' }}>
            <span className="ov-metric-val">{total}</span>
            <span className="ov-metric-label">resources</span>
          </div>
          <div className="ov-metric ov-fade" style={{ animationDelay: '0.2s' }}>
            <span className="ov-metric-val" style={{ color: '#3d9a5f' }}>{healthy}</span>
            <span className="ov-metric-label">healthy</span>
          </div>
          <div className="ov-metric ov-fade" style={{ animationDelay: '0.3s' }}>
            <span className="ov-metric-val" style={{ color: warning > 0 ? '#cc8d35' : undefined }}>{warning}</span>
            <span className="ov-metric-label">warning</span>
          </div>
          <div className="ov-metric ov-fade" style={{ animationDelay: '0.4s' }}>
            <span className="ov-metric-val" style={{ color: critical > 0 ? '#e5564f' : undefined }}>{critical}</span>
            <span className="ov-metric-label">critical</span>
          </div>
        </div>
      </div>

      <div className="ov-grid">
        <div className="ov-panel ov-fade" style={{ animationDelay: '0.3s' }}>
          <div className="ov-panel-head">Clusters</div>
          {clusters.map((c) => {
            const issues = c.resourceCounts.critical + c.resourceCounts.warning
            const clr = !c.connected ? '#e5564f' : issues > 0 ? '#cc8d35' : '#3d9a5f'
            return (
              <div key={c.name} className="ov-cluster" onClick={() => onSelectCluster(c.name)}>
                <div className="ov-cluster-left">
                  <span className="ov-pulse" style={{ background: clr, boxShadow: `0 0 6px ${clr}` }} />
                  <span className="monospace">{c.name}</span>
                </div>
                <div className="ov-cluster-right">
                  <span className="ov-cluster-detail">
                    {!c.connected ? 'unreachable' : issues > 0 ? `${issues} issues` : `${c.resourceCounts.total} resources`}
                  </span>
                  <svg width="14" height="14" viewBox="0 0 16 16" style={{ opacity: 0.3 }}>
                    <path d="M6 3l5 5-5 5" stroke="currentColor" fill="none" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
              </div>
            )
          })}
        </div>

        <div className="ov-panel ov-fade" style={{ animationDelay: '0.4s' }}>
          <div className="ov-panel-head">Resources by Kind</div>
          {kindData.length > 0 && (
            <ResponsiveContainer width="100%" height={kindData.length * 28 + 16}>
              <BarChart data={kindData} layout="vertical" margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="kind" width={85} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                  cursor={{ fill: 'var(--log-hover)' }}
                />
                <Bar dataKey="count" fill="#3d9a5f" radius={[0, 4, 4, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {unhealthy.length > 0 && (
        <div className="ov-fade" style={{ animationDelay: '0.5s' }}>
          <div className="ov-panel-head" style={{ marginBottom: 10 }}>
            Needs Attention
            <span className="ov-badge-critical">{unhealthy.length}</span>
          </div>
          <div className="ov-alerts">
            {unhealthy.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((r) => (
              <div key={r.uid} className="ov-alert" onClick={() => onSelectResource(r)}>
                <div className="ov-alert-indicator" style={{ background: r.health === 'critical' ? '#e5564f' : '#cc8d35' }} />
                <div className="ov-alert-body">
                  <div className="ov-alert-name monospace">{r.name}</div>
                  <div className="ov-alert-meta">
                    <span>{r.kind}</span>
                    <span className="ov-alert-status" style={{ color: r.health === 'critical' ? '#e5564f' : '#cc8d35' }}>{r.status}</span>
                    <span className="monospace">{r.namespace}</span>
                  </div>
                </div>
                <svg width="14" height="14" viewBox="0 0 16 16" style={{ opacity: 0.3, flexShrink: 0 }}>
                  <path d="M6 3l5 5-5 5" stroke="currentColor" fill="none" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
            ))}
          </div>
          {unhealthy.length > PAGE_SIZE && (
            <div className="overview-pagination">
              <Button small minimal icon="chevron-left" disabled={page === 0} onClick={() => setPage(page - 1)} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {page * PAGE_SIZE + 1} - {Math.min((page + 1) * PAGE_SIZE, unhealthy.length)} of {unhealthy.length}
              </span>
              <Button small minimal icon="chevron-right" disabled={(page + 1) * PAGE_SIZE >= unhealthy.length} onClick={() => setPage(page + 1)} />
            </div>
          )}
        </div>
      )}

      {unhealthy.length === 0 && (
        <div className="ov-all-clear ov-fade" style={{ animationDelay: '0.5s' }}>
          <svg width="20" height="20" viewBox="0 0 20 20" style={{ color: '#3d9a5f' }}>
            <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M6 10l3 3 5-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          All resources healthy
        </div>
      )}
    </div>
  )
}
