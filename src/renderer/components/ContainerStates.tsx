import { Card, H5, Tag, Intent } from '@blueprintjs/core'
import type { ContainerStateInfo } from '../../shared/types'

interface ContainerStatesProps {
  containers: ContainerStateInfo[]
}

export function ContainerStates({ containers }: ContainerStatesProps) {
  if (containers.length === 0) return null

  return (
    <Card style={{ marginBottom: 12 }}>
      <H5>Containers</H5>
      <div className="monospace" style={{ fontSize: 12 }}>
        {containers.map((c) => (
          <div key={c.name} style={{ display: 'flex', gap: 8, padding: '2px 0', alignItems: 'center' }}>
            <Tag minimal intent={stateIntent(c)} style={{ minWidth: 80 }}>
              {c.state}
            </Tag>
            <span>{c.isInit ? `${c.name} (init)` : c.name}</span>
            <Tag minimal round intent={c.ready ? Intent.SUCCESS : Intent.NONE}>
              {c.ready ? 'ready' : 'not ready'}
            </Tag>
            {c.reason && <span className="bp5-text-muted">{c.reason}</span>}
            {c.exitCode !== undefined && <span className="bp5-text-muted">exit: {c.exitCode}</span>}
          </div>
        ))}
      </div>
    </Card>
  )
}

function stateIntent(c: ContainerStateInfo): Intent {
  if (c.state === 'running' && c.ready) return Intent.SUCCESS
  if (c.state === 'terminated') return c.exitCode === 0 ? Intent.NONE : Intent.DANGER
  if (c.state === 'waiting') return Intent.WARNING
  return Intent.NONE
}
