import { useState, useEffect, useMemo } from 'react'
import { Card, H5, Tag, Intent, InputGroup, HTMLSelect, Spinner, NonIdealState } from '@blueprintjs/core'
import { useK8s } from '../hooks/useK8s'
import type { K8sEvent } from '../../shared/types'

interface NamespaceEventsProps {
  cluster: string
  namespace: string
}

export function NamespaceEvents({ cluster, namespace }: NamespaceEventsProps) {
  const k8s = useK8s()
  const [events, setEvents] = useState<K8sEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'Normal' | 'Warning'>('all')

  useEffect(() => {
    setLoading(true)
    k8s
      .getNamespaceEvents(cluster, namespace)
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [cluster, namespace])

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (typeFilter !== 'all' && e.type !== typeFilter) return false
      if (search) {
        const lower = search.toLowerCase()
        return (
          e.message.toLowerCase().includes(lower) ||
          e.reason.toLowerCase().includes(lower) ||
          e.involvedObject.toLowerCase().includes(lower)
        )
      }
      return true
    })
  }, [events, typeFilter, search])

  if (loading) return <Spinner style={{ margin: 20 }} />

  return (
    <Card style={{ marginBottom: 12 }}>
      <H5>Namespace Events ({namespace})</H5>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <InputGroup
          leftIcon="search"
          placeholder="Filter events..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1 }}
          small
        />
        <HTMLSelect value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)} style={{ minWidth: 100 }}>
          <option value="all">All types</option>
          <option value="Warning">Warning</option>
          <option value="Normal">Normal</option>
        </HTMLSelect>
      </div>
      {filtered.length === 0 ? (
        <NonIdealState
          icon="search"
          title="No events"
          description={search ? 'No matching events' : 'No events in this namespace'}
        />
      ) : (
        <div className="timeline-list" style={{ maxHeight: 400, overflow: 'auto' }}>
          {filtered.map((event, i) => (
            <div key={i} className={`timeline-event ${event.type === 'Warning' ? 'timeline-event-warning' : ''}`}>
              <div className="timeline-dot-col">
                <div className={`timeline-dot ${event.type === 'Warning' ? 'timeline-dot-warning' : 'timeline-dot-normal'}`} />
                {i < filtered.length - 1 && <div className="timeline-connector" />}
              </div>
              <div className="timeline-content">
                <div className="timeline-event-header">
                  <Tag minimal intent={event.type === 'Warning' ? Intent.WARNING : Intent.NONE}>
                    {event.reason}{event.count > 1 ? ` x${event.count}` : ''}
                  </Tag>
                  <span className="bp6-text-muted" style={{ fontSize: 11 }}>{event.involvedObject}</span>
                  <span className="bp6-text-muted" style={{ fontSize: 11 }}>{formatTs(event.timestamp)}</span>
                  {event.source && <span className="bp6-text-muted" style={{ fontSize: 11 }}>{event.source}</span>}
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

function formatTs(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return ts
  }
}
