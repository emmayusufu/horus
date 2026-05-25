import { Card, H5 } from '@blueprintjs/core'
import type { K8sResource } from '../../shared/types'

interface ResourceHeatmapProps {
  resources: K8sResource[]
  onSelect: (resource: K8sResource) => void
}

const HEALTH_COLORS = { healthy: '#3d9a5f', warning: '#cc8d35', critical: '#e5564f', unknown: '#5f6b7c' }

export function ResourceHeatmap({ resources, onSelect }: ResourceHeatmapProps) {
  const pods = resources.filter((r) => r.kind === 'Pod')
  if (pods.length === 0) return null

  const byNs = new Map<string, K8sResource[]>()
  for (const p of pods) {
    const list = byNs.get(p.namespace) ?? []
    list.push(p)
    byNs.set(p.namespace, list)
  }

  const sorted = [...byNs.entries()].sort((a, b) => b[1].length - a[1].length)

  return (
    <Card style={{ marginBottom: 12 }}>
      <H5>Pod Heatmap</H5>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.map(([ns, nsPods]) => (
          <div key={ns}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{ns} ({nsPods.length})</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {nsPods.map((p) => (
                <div
                  key={p.uid}
                  onClick={() => onSelect(p)}
                  title={`${p.name}\n${p.status}`}
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 3,
                    background: HEALTH_COLORS[p.health] ?? HEALTH_COLORS.unknown,
                    cursor: 'pointer',
                    opacity: 0.85,
                    transition: 'transform 0.1s'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.4)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 10, color: 'var(--text-muted)' }}>
        {Object.entries(HEALTH_COLORS).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: v }} />
            <span>{k}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}
