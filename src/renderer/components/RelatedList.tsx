import { Card, H5, Tag } from '@blueprintjs/core'
import type { RelatedResource } from '../../shared/types'

interface RelatedListProps {
  related: RelatedResource[]
}

export function RelatedList({ related }: RelatedListProps) {
  return (
    <Card style={{ marginBottom: 12 }}>
      <H5>Related</H5>
      {related.length === 0 && <span className="bp6-text-muted">No related resources found</span>}
      {related.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
          <Tag minimal>{r.kind}</Tag>
          <span className="monospace">{r.name}</span>
          <span className="bp6-text-muted">({r.detail})</span>
        </div>
      ))}
    </Card>
  )
}
