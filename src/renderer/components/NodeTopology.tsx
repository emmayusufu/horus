import { Card, H5, Tag, Intent } from '@blueprintjs/core'
import type { K8sResource } from '../../shared/types'

interface NodeTopologyProps {
  resources: K8sResource[]
  onSelect: (resource: K8sResource) => void
}

const HEALTH_COLORS = { healthy: '#3d9a5f', warning: '#cc8d35', critical: '#e5564f', unknown: '#5f6b7c' }

export function NodeTopology({ resources, onSelect }: NodeTopologyProps) {
  const pods = resources.filter((r) => r.kind === 'Pod')
  const nodeNames = [...new Set(pods.map((p) => p.node).filter((n) => n && n !== '-'))]

  if (nodeNames.length === 0) return null

  return (
    <Card style={{ marginBottom: 12 }}>
      <H5>Node Topology</H5>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 10 }}>
        {nodeNames.map((nodeName) => {
          const nodePods = pods.filter((p) => p.node === nodeName)
          const healthyCt = nodePods.filter((p) => p.health === 'healthy').length
          const unhealthyCt = nodePods.length - healthyCt

          return (
            <div key={nodeName} style={{
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '10px 12px',
              background: 'var(--bg-elevated)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <svg width="14" height="14" viewBox="0 0 14 14" style={{ opacity: 0.5 }}>
                  <rect x="1" y="1" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.2" />
                  <rect x="3" y="3" width="3" height="3" rx="0.5" fill="currentColor" opacity="0.4" />
                  <rect x="8" y="3" width="3" height="3" rx="0.5" fill="currentColor" opacity="0.4" />
                  <rect x="3" y="8" width="3" height="3" rx="0.5" fill="currentColor" opacity="0.4" />
                </svg>
                <span className="monospace" style={{ fontSize: 11, flex: 1 }}>{nodeName.length > 25 ? nodeName.slice(0, 25) + '..' : nodeName}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{nodePods.length}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {nodePods.map((p) => (
                  <div
                    key={p.uid}
                    title={`${p.name}\n${p.status}`}
                    onClick={() => onSelect(p)}
                    style={{
                      width: 12, height: 12, borderRadius: 2,
                      background: HEALTH_COLORS[p.health],
                      cursor: 'pointer',
                      transition: 'transform 0.1s'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.5)')}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                  />
                ))}
              </div>
              {unhealthyCt > 0 && (
                <div style={{ fontSize: 10, color: '#e5564f', marginTop: 4 }}>{unhealthyCt} unhealthy</div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
