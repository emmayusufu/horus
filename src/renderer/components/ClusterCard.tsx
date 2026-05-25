import { Card, Tag, Intent } from '@blueprintjs/core'
import type { ClusterInfo } from '../../shared/types'

interface ClusterCardProps {
  cluster: ClusterInfo
  onClick: () => void
}

export function ClusterCard({ cluster, onClick }: ClusterCardProps) {
  const intent = !cluster.connected
    ? Intent.DANGER
    : cluster.resourceCounts.critical > 0
      ? Intent.DANGER
      : cluster.resourceCounts.warning > 0
        ? Intent.WARNING
        : Intent.SUCCESS

  const issueCount = cluster.resourceCounts.critical + cluster.resourceCounts.warning
  const label = !cluster.connected
    ? 'unreachable'
    : issueCount > 0
      ? `${issueCount} issue${issueCount > 1 ? 's' : ''}`
      : 'healthy'

  return (
    <Card interactive onClick={onClick} style={{ marginBottom: 4, padding: '8px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tag round minimal intent={intent} />
          <span className="monospace">{cluster.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span className="bp6-text-muted">{label}</span>
          {cluster.cpuPercent != null && <span className="bp6-text-muted monospace">{cluster.cpuPercent}% cpu</span>}
          {cluster.memPercent != null && <span className="bp6-text-muted monospace">{cluster.memPercent}% mem</span>}
        </div>
      </div>
    </Card>
  )
}
