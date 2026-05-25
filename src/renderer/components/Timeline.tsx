import { Card, H5, Tag, Intent } from '@blueprintjs/core'
import type { K8sEvent } from '../../shared/types'

interface TimelineProps {
  events: K8sEvent[]
}

export function Timeline({ events }: TimelineProps) {
  return (
    <Card style={{ marginBottom: 12 }}>
      <H5>Events ({events.length})</H5>
      {events.length === 0 ? (
        <span className="bp5-text-muted">No events</span>
      ) : (
        <div className="timeline-list">
          {events.map((event, i) => (
            <div key={i} className={`timeline-event ${event.type === 'Warning' ? 'timeline-event-warning' : ''}`}>
              <div className="timeline-dot-col">
                <div className={`timeline-dot ${event.type === 'Warning' ? 'timeline-dot-warning' : 'timeline-dot-normal'}`} />
                {i < events.length - 1 && <div className="timeline-connector" />}
              </div>
              <div className="timeline-content">
                <div className="timeline-event-header">
                  <Tag minimal intent={event.type === 'Warning' ? Intent.WARNING : Intent.NONE}>
                    {event.reason}
                    {event.count > 1 ? ` x${event.count}` : ''}
                  </Tag>
                  <span className="bp5-text-muted" style={{ fontSize: 11 }}>{formatTimestamp(event.timestamp)}</span>
                  {event.source && <span className="bp5-text-muted" style={{ fontSize: 11 }}>{event.source}</span>}
                </div>
                <div className="timeline-event-message">{event.message}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return ts
  }
}
