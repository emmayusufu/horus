import { Card, H5, Tag, Intent } from '@blueprintjs/core'
import type { ContainerStateInfo } from '../../shared/types'

interface SidecarInfoProps {
  containers: ContainerStateInfo[]
}

export function SidecarInfo({ containers }: SidecarInfoProps) {
  if (containers.length <= 1) return null

  const sidecars = containers.filter((c) => c.isInit && c.state === 'running')
  const main = containers.filter((c) => !c.isInit)
  const init = containers.filter((c) => c.isInit && c.state !== 'running')

  if (sidecars.length === 0) return null

  return (
    <Card style={{ marginBottom: 12 }}>
      <H5>Container Roles</H5>
      <div style={{ display: 'flex', gap: 16 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Main</div>
          {main.map((c) => (
            <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
              <span className="ov-pulse" style={{ width: 5, height: 5, background: c.ready ? '#3d9a5f' : '#e5564f' }} />
              <span className="monospace" style={{ fontSize: 12 }}>{c.name}</span>
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Sidecar</div>
          {sidecars.map((c) => (
            <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
              <Tag minimal intent={Intent.PRIMARY} style={{ fontSize: 10 }}>sidecar</Tag>
              <span className="monospace" style={{ fontSize: 12 }}>{c.name}</span>
            </div>
          ))}
        </div>
        {init.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Init</div>
            {init.map((c) => (
              <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
                <span className="monospace" style={{ fontSize: 12, opacity: 0.6 }}>{c.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
