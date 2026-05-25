import { useEffect, useState, useRef } from 'react'
import { Button, Tag, Intent, Spinner } from '@blueprintjs/core'
import { Timeline } from '../components/Timeline'
import { LogViewer } from '../components/LogViewer'
import { ResourceUsage } from '../components/ResourceUsage'
import { RelatedList } from '../components/RelatedList'
import { HelmBanner } from '../components/HelmBanner'
import { useK8s } from '../hooks/useK8s'
import type { K8sResource, ResourceDetail } from '../../shared/types'

interface DebugProps {
  resource: K8sResource
  onBack: () => void
}

export function Debug({ resource, onBack }: DebugProps) {
  const k8s = useK8s()
  const [detail, setDetail] = useState<ResourceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    k8s.getResourceDetail(resource.cluster, resource.namespace, resource.name, resource.kind)
      .then(setDetail)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [resource.uid])

  useEffect(() => {
    if (!detail) return

    intervalRef.current = setInterval(async () => {
      try {
        const events = await k8s.getEvents(resource.cluster, resource.namespace, resource.name)
        setDetail((prev) => prev ? { ...prev, events } : prev)
      } catch {
        // silently skip refresh on error
      }
    }, 15_000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [detail !== null, resource.uid])

  if (loading) return <Spinner style={{ margin: 40 }} />
  if (error) return <div style={{ padding: 16, color: 'red' }}>{error}</div>
  if (!detail) return null

  const handleExport = async () => { await k8s.exportSnapshot(detail) }

  const healthIntent = resource.health === 'critical' ? Intent.DANGER
    : resource.health === 'warning' ? Intent.WARNING : Intent.SUCCESS

  return (
    <div style={{ padding: 16, overflow: 'auto', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Button minimal icon="arrow-left" onClick={onBack} />
        <span className="monospace" style={{ fontSize: 16 }}>{resource.name}</span>
        <div style={{ marginLeft: 'auto' }}><Button icon="export" text="Export snapshot" onClick={handleExport} /></div>
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <Tag large intent={healthIntent}>{resource.status}</Tag>
        <span className="monospace">Restarts: {resource.restarts}</span>
        {resource.node && <span className="monospace">Node: {resource.node}</span>}
        {resource.ownerKind && <span className="monospace">Owner: {resource.ownerKind}/{resource.ownerName}</span>}
      </div>
      {detail.helm && <HelmBanner helm={detail.helm} />}
      <Timeline events={detail.events} />
      <LogViewer logs={detail.logs} cluster={resource.cluster} namespace={resource.namespace} podName={resource.name} />
      <ResourceUsage {...detail.resources} />
      <RelatedList related={detail.related} />
    </div>
  )
}
