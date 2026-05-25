import { useState } from 'react'
import { Card, NonIdealState, Tag, Intent, Button } from '@blueprintjs/core'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { K8sResource, ClusterInfo } from '../../shared/types'

interface OverviewProps {
  clusters: ClusterInfo[]
  unhealthy: K8sResource[]
  allResources: K8sResource[]
  onSelectCluster: (name: string) => void
  onSelectResource: (resource: K8sResource) => void
}

const HEALTH_COLORS = { healthy: '#32A467', warning: '#D4A017', critical: '#E76A6E' }

const PAGE_SIZE = 10

export function Overview({ clusters, unhealthy, allResources, onSelectCluster, onSelectResource }: OverviewProps) {
  const [page, setPage] = useState(0)

  if (clusters.length === 0) {
    return (
      <NonIdealState
        icon="offline"
        title="No clusters connected"
        description="Horus connects to all clusters in your kubeconfig on launch"
      />
    )
  }

  const totalResources = allResources.length
  const healthyCt = allResources.filter((r) => r.health === 'healthy').length
  const warningCt = allResources.filter((r) => r.health === 'warning').length
  const criticalCt = allResources.filter((r) => r.health === 'critical').length

  const healthData = [
    { name: 'Healthy', value: healthyCt, color: HEALTH_COLORS.healthy },
    { name: 'Warning', value: warningCt, color: HEALTH_COLORS.warning },
    { name: 'Critical', value: criticalCt, color: HEALTH_COLORS.critical }
  ].filter((d) => d.value > 0)

  const kindCounts = new Map<string, number>()
  for (const r of allResources) {
    kindCounts.set(r.kind, (kindCounts.get(r.kind) ?? 0) + 1)
  }
  const kindData = [...kindCounts.entries()].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count)

  return (
    <div className="overview-page">
      <div className="overview-stats">
        <StatCard label="Clusters" value={clusters.length} />
        <StatCard label="Resources" value={totalResources} />
        <StatCard label="Healthy" value={healthyCt} color={HEALTH_COLORS.healthy} />
        <StatCard label="Warning" value={warningCt} color={warningCt > 0 ? HEALTH_COLORS.warning : undefined} />
        <StatCard label="Critical" value={criticalCt} color={criticalCt > 0 ? HEALTH_COLORS.critical : undefined} />
      </div>

      <div className="overview-charts">
        <Card className="overview-chart-card">
          <div className="overview-chart-title">Health Distribution</div>
          {healthData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={healthData}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={78}
                  paddingAngle={4}
                  strokeWidth={0}
                  cornerRadius={4}
                >
                  {healthData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#252A31',
                    border: '1px solid #383E47',
                    borderRadius: 8,
                    padding: '8px 12px'
                  }}
                  itemStyle={{ color: '#F6F7F9' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="bp6-text-muted">No data</span>
            </div>
          )}
        </Card>

        <Card className="overview-chart-card">
          <div className="overview-chart-title">Resources by Kind</div>
          {kindData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={kindData} layout="vertical" margin={{ left: 10, right: 16, top: 8, bottom: 8 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="kind"
                  width={90}
                  tick={{ fill: '#A7B6C2', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ background: '#252A31', border: '1px solid #383E47', borderRadius: 4 }}
                  itemStyle={{ color: '#F6F7F9' }}
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                />
                <Bar dataKey="count" fill="#5C7080" radius={[0, 6, 6, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="bp6-text-muted">No data</span>
            </div>
          )}
        </Card>

        <Card className="overview-chart-card">
          <div className="overview-chart-title">Clusters</div>
          <div style={{ maxHeight: 180, overflow: 'auto' }}>
            {clusters.map((c) => {
              const issues = c.resourceCounts.critical + c.resourceCounts.warning
              return (
                <div key={c.name} className="overview-cluster-row" onClick={() => onSelectCluster(c.name)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      className="timeline-dot"
                      style={{
                        width: 6,
                        height: 6,
                        background: !c.connected
                          ? HEALTH_COLORS.critical
                          : issues > 0
                            ? HEALTH_COLORS.warning
                            : HEALTH_COLORS.healthy
                      }}
                    />
                    <span className="monospace" style={{ fontSize: 12 }}>
                      {c.name}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="bp6-text-muted" style={{ fontSize: 11 }}>
                      {!c.connected
                        ? 'unreachable'
                        : issues > 0
                          ? `${issues} issues`
                          : `${c.resourceCounts.total} resources`}
                    </span>
                    <span className="bp6-icon bp6-icon-chevron-right bp6-text-muted" style={{ opacity: 0.4 }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {unhealthy.length > 0 && (
        <div>
          <div className="overview-section-title">
            Needs Attention
            <Tag minimal round intent={Intent.DANGER} style={{ marginLeft: 8 }}>
              {unhealthy.length}
            </Tag>
          </div>
          <Card style={{ padding: 0, overflow: 'hidden', borderRadius: 12 }}>
            <table className="overview-table">
              <thead>
                <tr>
                  <th style={{ width: 20 }}></th>
                  <th>Name</th>
                  <th>Kind</th>
                  <th>Status</th>
                  <th>Cluster</th>
                  <th>Namespace</th>
                </tr>
              </thead>
              <tbody>
                {unhealthy.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((r) => (
                  <tr key={r.uid} onClick={() => onSelectResource(r)}>
                    <td>
                      <div
                        className="timeline-dot"
                        style={{
                          width: 6,
                          height: 6,
                          background: r.health === 'critical' ? HEALTH_COLORS.critical : HEALTH_COLORS.warning
                        }}
                      />
                    </td>
                    <td className="monospace">{r.name}</td>
                    <td>{r.kind}</td>
                    <td>{r.status}</td>
                    <td className="monospace">{r.cluster}</td>
                    <td className="monospace">{r.namespace}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {unhealthy.length > PAGE_SIZE && (
              <div className="overview-pagination">
                <Button small minimal icon="chevron-left" disabled={page === 0} onClick={() => setPage(page - 1)} />
                <span className="bp6-text-muted" style={{ fontSize: 12 }}>
                  {page * PAGE_SIZE + 1}--{Math.min((page + 1) * PAGE_SIZE, unhealthy.length)} of {unhealthy.length}
                </span>
                <Button
                  small
                  minimal
                  icon="chevron-right"
                  disabled={(page + 1) * PAGE_SIZE >= unhealthy.length}
                  onClick={() => setPage(page + 1)}
                />
              </div>
            )}
          </Card>
        </div>
      )}

      {unhealthy.length === 0 && (
        <Card
          style={{
            padding: 24,
            textAlign: 'center',
            borderRadius: 12,
            background: 'rgba(50, 164, 103, 0.08)',
            border: '1px solid rgba(50, 164, 103, 0.15)'
          }}
        >
          <span style={{ color: HEALTH_COLORS.healthy, fontSize: 14 }}>All resources healthy</span>
        </Card>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <Card className="overview-stat-card">
      <div className="overview-stat-value" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="overview-stat-label">{label}</div>
    </Card>
  )
}
