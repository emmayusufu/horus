import { Card, H5, Tag, Intent } from '@blueprintjs/core'
import type { K8sEvent } from '../../shared/types'

interface TimelineProps { events: K8sEvent[] }

export function Timeline({ events }: TimelineProps) {
  return (
    <Card style={{ marginBottom: 12 }}>
      <H5>Timeline</H5>
      <div className="monospace" style={{ fontSize: 12 }}>
        {events.map((event, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, padding: '2px 0', alignItems: 'center' }}>
            <span className="bp5-text-muted" style={{ minWidth: 60 }}>{formatTimestamp(event.timestamp)}</span>
            {event.source && <span className="bp5-text-muted" style={{ minWidth: 70, fontSize: 11 }}>{event.source}</span>}
            <Tag minimal intent={event.type === 'Warning' ? Intent.WARNING : Intent.NONE} style={{ minWidth: 100 }}>
              {event.reason}{event.count > 1 ? ` x${event.count}` : ''}
            </Tag>
            <span>{event.message}</span>
          </div>
        ))}
        {events.length === 0 && <span className="bp5-text-muted">No events</span>}
      </div>
    </Card>
  )
}

function formatTimestamp(ts: string): string {
  try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  catch { return ts }
}
