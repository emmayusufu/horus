import { Card, H4, NonIdealState, Tag, Intent } from '@blueprintjs/core'
import { ClusterCard } from '../components/ClusterCard'
import type { K8sResource, ClusterInfo } from '../../shared/types'

interface OverviewProps {
  clusters: ClusterInfo[]
  unhealthy: K8sResource[]
  allResources: K8sResource[]
  onSelectCluster: (name: string) => void
  onSelectResource: (resource: K8sResource) => void
}

export function Overview({ clusters, unhealthy, allResources, onSelectCluster, onSelectResource }: OverviewProps) {
  const healthyPods = allResources.filter((r) => r.kind === 'Pod' && r.health === 'healthy')
  if (clusters.length === 0) {
    return (
      <NonIdealState
        icon="offline"
        title="No clusters connected"
        description="Connect to a cluster using the settings menu or Cmd+K"
      />
    )
  }

  const sorted = [...clusters].sort((a, b) => {
    const aIssues = a.resourceCounts.critical + a.resourceCounts.warning
    const bIssues = b.resourceCounts.critical + b.resourceCounts.warning
    return bIssues - aIssues
  })

  return (
    <div style={{ padding: 16, overflow: 'auto', flex: 1 }}>
      <H4>Clusters ({clusters.length} connected)</H4>
      {sorted.map((cluster) => (
        <ClusterCard key={cluster.name} cluster={cluster} onClick={() => onSelectCluster(cluster.name)} />
      ))}
      {unhealthy.length > 0 && (
        <>
          <H4 style={{ marginTop: 24 }}>Needs Attention</H4>
          {unhealthy.map((resource) => (
            <Card
              key={resource.uid}
              interactive
              onClick={() => onSelectResource(resource)}
              style={{ marginBottom: 4, padding: '8px 12px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tag intent={resource.health === 'critical' ? Intent.DANGER : Intent.WARNING} minimal round />
                <span className="bp5-text-muted">{resource.kind}</span>
                <span className="monospace">{resource.name}</span>
                <span className="bp5-text-muted" style={{ marginLeft: 'auto' }}>
                  {resource.status}
                </span>
                <span className="bp5-text-muted monospace">{resource.cluster}</span>
              </div>
            </Card>
          ))}
        </>
      )}
      {healthyPods.length > 0 && (
        <>
          <H4 style={{ marginTop: 24 }}>All Pods</H4>
          {healthyPods.map((resource) => (
            <Card
              key={resource.uid}
              interactive
              onClick={() => onSelectResource(resource)}
              style={{ marginBottom: 4, padding: '8px 12px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tag intent={Intent.SUCCESS} minimal round />
                <span className="bp5-text-muted">{resource.kind}</span>
                <span className="monospace">{resource.name}</span>
                <span className="bp5-text-muted" style={{ marginLeft: 'auto' }}>
                  {resource.status}
                </span>
                <span className="bp5-text-muted monospace">{resource.cluster}</span>
              </div>
            </Card>
          ))}
        </>
      )}
    </div>
  )
}
