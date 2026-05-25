import { CardSkeleton } from '../components/Skeleton'
import { useState, useEffect } from 'react'
import { Card, H5, Tag, Intent, InputGroup, Button } from '@blueprintjs/core'
import { useK8s } from '../hooks/useK8s'
import type { K8sEvent } from '../../shared/types'

interface GlobalEventsProps {
  clusters: string[]
  onBack: () => void
}

export function GlobalEvents({ clusters, onBack }: GlobalEventsProps) {
  const k8s = useK8s()
  const [query, setQuery] = useState('')
  const [cluster, setCluster] = useState(clusters[0] ?? '')
  const [events, setEvents] = useState<K8sEvent[]>([])
  const [loading, setLoading] = useState(false)

  const handleSearch = () => {
    setLoading(true)
    k8s.getGlobalEvents(cluster, query).then(setEvents).catch(() => setEvents([])).finally(() => setLoading(false))
  }

  useEffect(() => {
    handleSearch()
  }, [cluster])

  return (
    <div style={{ padding: 16, overflow: 'auto', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Button minimal icon="arrow-left" onClick={onBack} />
        <H5 style={{ margin: 0 }}>Global Events</H5>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <select
          value={cluster}
          onChange={(e) => setCluster(e.target.value)}
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 8px', fontSize: 13 }}
        >
          {clusters.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <InputGroup
          leftIcon="search"
          placeholder="Search events (OOMKilled, BackOff, pod name...)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          style={{ flex: 1 }}
        />
        <Button intent="primary" onClick={handleSearch} loading={loading}>Search</Button>
      </div>

      {loading ? (<CardSkeleton title lines={6} />) : (
        <Card style={{ padding: 0, borderRadius: 10, overflow: 'hidden' }}>
          {events.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
              {query ? 'No matching events' : 'No events'}
            </div>
          ) : (
            <div style={{ maxHeight: 600, overflow: 'auto' }}>
              <div className="timeline-list" style={{ padding: 12 }}>
                {events.map((event, i) => (
                  <div key={i} className={`timeline-event ${event.type === 'Warning' ? 'timeline-event-warning' : ''}`}>
                    <div className="timeline-dot-col">
                      <div className={`timeline-dot ${event.type === 'Warning' ? 'timeline-dot-warning' : 'timeline-dot-normal'}`} />
                      {i < events.length - 1 && <div className="timeline-connector" />}
                    </div>
                    <div className="timeline-content">
                      <div className="timeline-event-header">
                        <Tag minimal intent={event.type === 'Warning' ? Intent.WARNING : Intent.NONE}>
                          {event.reason}{event.count > 1 ? ` x${event.count}` : ''}
                        </Tag>
                        <span className="monospace" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{event.involvedObject}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatTs(event.timestamp)}</span>
                        {event.source && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{event.source}</span>}
                      </div>
                      <div className="timeline-event-message">{event.message}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                Showing {events.length} events (max 200)
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

function formatTs(ts: string): string {
  try { return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) }
  catch { return ts }
}
