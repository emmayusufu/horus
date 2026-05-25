import { useEffect, useState, useRef } from 'react'
import { Button, Tag, Intent, Spinner } from '@blueprintjs/core'
import { Timeline } from '../components/Timeline'
import { LogViewer } from '../components/LogViewer'
import { ResourceUsage } from '../components/ResourceUsage'
import { RelatedList } from '../components/RelatedList'
import { HelmBanner } from '../components/HelmBanner'
import { PodConditions } from '../components/PodConditions'
import { ContainerStates } from '../components/ContainerStates'
import { PodYamlView } from '../components/PodYamlView'
import { useK8s } from '../hooks/useK8s'
import type { K8sResource, ResourceDetail } from '../../shared/types'

interface DebugProps {
  resource: K8sResource
  onBack: () => void
  onNavigate: (ownerKind: string, ownerName: string, namespace: string, cluster: string) => void
}

export function Debug({ resource, onBack, onNavigate }: DebugProps) {
  const k8s = useK8s()
  const [detail, setDetail] = useState<ResourceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    k8s
      .getResourceDetail(resource.cluster, resource.namespace, resource.name, resource.kind)
      .then(setDetail)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [resource.uid])

  useEffect(() => {
    if (!detail) return

    intervalRef.current = setInterval(async () => {
      try {
        const events = await k8s.getEvents(resource.cluster, resource.namespace, resource.name)
        setDetail((prev) => (prev ? { ...prev, events } : prev))
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

  const handleExport = async () => {
    await k8s.exportSnapshot(detail)
  }

  const healthIntent =
    resource.health === 'critical' ? Intent.DANGER : resource.health === 'warning' ? Intent.WARNING : Intent.SUCCESS

  return (
    <div className="debug-page">
      <div className="debug-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button minimal icon="arrow-left" onClick={onBack} />
          <Tag large intent={healthIntent}>
            {resource.status}
          </Tag>
          <span className="debug-resource-name">{resource.name}</span>
          <Button
            minimal
            small
            icon="clipboard"
            onClick={() => navigator.clipboard.writeText(`${resource.namespace}/${resource.name}`)}
          />
        </div>
        <Button icon="export" text="Export" small onClick={handleExport} />
      </div>

      <div className="debug-meta">
        <div className="debug-meta-item">
          <span className="debug-meta-label">namespace</span>
          <span className="monospace">{resource.namespace}</span>
        </div>
        <div className="debug-meta-item">
          <span className="debug-meta-label">restarts</span>
          <span className="monospace">{resource.restarts}</span>
        </div>
        {resource.node && resource.node !== '-' && (
          <div className="debug-meta-item">
            <span className="debug-meta-label">node</span>
            <span className="monospace">{resource.node}</span>
          </div>
        )}
        {resource.ownerKind && (
          <div className="debug-meta-item">
            <span className="debug-meta-label">owner</span>
            <span
              className="monospace debug-owner-link"
              onClick={() => onNavigate(resource.ownerKind!, resource.ownerName!, resource.namespace, resource.cluster)}
            >
              {resource.ownerKind}/{resource.ownerName}
            </span>
          </div>
        )}
        <div className="debug-meta-item">
          <span className="debug-meta-label">cluster</span>
          <span className="monospace">{resource.cluster}</span>
        </div>
      </div>

      <div className="debug-columns">
        <div className="debug-sidebar">
          {detail.conditions && detail.conditions.length > 0 && <PodConditions conditions={detail.conditions} />}
          {detail.containers && detail.containers.length > 0 && <ContainerStates containers={detail.containers} />}
          <ResourceUsage {...detail.resources} />
          <RelatedList related={detail.related} />
          {detail.helm && <HelmBanner helm={detail.helm} />}
        </div>

        <div className="debug-main">
          <Timeline events={detail.events} />
          <LogViewer
            logs={detail.logs}
            cluster={resource.cluster}
            namespace={resource.namespace}
            podName={resource.name}
          />
          {resource.kind === 'Pod' && (
            <PodYamlView cluster={resource.cluster} namespace={resource.namespace} name={resource.name} />
          )}
        </div>
      </div>
    </div>
  )
}
