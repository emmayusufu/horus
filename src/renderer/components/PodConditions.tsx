import { Card, H5, Tag, Intent } from '@blueprintjs/core'
import type { PodCondition } from '../../shared/types'

interface PodConditionsProps {
  conditions: PodCondition[]
}

export function PodConditions({ conditions }: PodConditionsProps) {
  if (conditions.length === 0) return null

  return (
    <Card style={{ marginBottom: 12 }}>
      <H5>Conditions</H5>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {conditions.map((c) => (
          <Tag
            key={c.type}
            large
            minimal
            intent={c.status === 'True' ? Intent.SUCCESS : c.status === 'False' ? Intent.WARNING : Intent.NONE}
            title={c.message || c.reason || ''}
          >
            {c.type}
            {c.reason ? ` (${c.reason})` : ''}
          </Tag>
        ))}
      </div>
    </Card>
  )
}
