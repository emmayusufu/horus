import { useEffect, useState, useRef } from 'react'
import { Button, Tag, Intent, Card, H5 } from '@blueprintjs/core'
import { Timeline } from '../components/Timeline'
import { LogViewer } from '../components/LogViewer'
import { ResourceUsage } from '../components/ResourceUsage'
import { RelatedList } from '../components/RelatedList'
import { HelmBanner } from '../components/HelmBanner'
import { PodConditions } from '../components/PodConditions'
import { ContainerStates } from '../components/ContainerStates'
import { PodYamlView } from '../components/PodYamlView'
import { RolloutStatus } from '../components/RolloutStatus'
import { CronJobRuns } from '../components/CronJobRuns'
import { TrafficPath } from '../components/TrafficPath'
import { PodActions } from '../components/PodActions'
import { PortForwardPanel } from '../components/PortForwardPanel'
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

  if (loading) return <DebugSkeleton />
  if (error) return <div style={{ padding: 16, color: 'red' }}>{error}</div>
  if (!detail) return null

  const handleExport = async () => {
    await k8s.exportSnapshot(detail)
  }

  const healthIntent =
    resource.health === 'critical'
      ? Intent.DANGER
      : resource.health === 'warning'
        ? Intent.WARNING
        : resource.health === 'healthy'
          ? Intent.SUCCESS
          : Intent.NONE

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
          <PodActions cluster={resource.cluster} namespace={resource.namespace} name={resource.name} kind={resource.kind} />
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
          {resource.kind === 'Pod' && <PortForwardPanel cluster={resource.cluster} namespace={resource.namespace} podName={resource.name} />}
        </div>

        <div className="debug-main">
          <Timeline events={detail.events} />
          <LogViewer
            logs={detail.logs}
            cluster={resource.cluster}
            namespace={resource.namespace}
            podName={resource.name}
          />
          {resource.kind === 'Service' && (
            <TrafficPath cluster={resource.cluster} namespace={resource.namespace} serviceName={resource.name} />
          )}
          {resource.kind === 'Deployment' && (
            <RolloutStatus cluster={resource.cluster} namespace={resource.namespace} name={resource.name} />
          )}
          {resource.kind === 'CronJob' && (
            <CronJobRuns cluster={resource.cluster} namespace={resource.namespace} name={resource.name} />
          )}
          {resource.kind === 'Pod' && (
            <PodYamlView cluster={resource.cluster} namespace={resource.namespace} name={resource.name} />
          )}
        </div>
      </div>
    </div>
  )
}

function DebugSkeleton() {
  const bar = (w: string) => <div className="bp6-skeleton" style={{ height: 14, width: w, borderRadius: 4 }} />
  return (
    <div className="debug-page">
      <div className="debug-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {bar('60px')}
          {bar('200px')}
        </div>
      </div>
      <div className="debug-meta">
        {bar('80px')}
        {bar('60px')}
        {bar('120px')}
        {bar('100px')}
      </div>
      <div className="debug-columns">
        <div className="debug-sidebar">
          <Card style={{ marginBottom: 12 }}>
            <H5>{bar('100px')}</H5>
            {bar('100%')}
            <br />
            {bar('80%')}
          </Card>
          <Card style={{ marginBottom: 12 }}>
            <H5>{bar('80px')}</H5>
            {bar('100%')}
            <br />
            {bar('60%')}
          </Card>
        </div>
        <div className="debug-main">
          <Card style={{ marginBottom: 12 }}>
            <H5>{bar('80px')}</H5>
            {bar('100%')}
            <br />
            {bar('90%')}
            <br />
            {bar('70%')}
          </Card>
          <Card style={{ marginBottom: 12 }}>
            <H5>{bar('60px')}</H5>
            <div style={{ height: 120 }}>
              {bar('100%')}
              <br />
              {bar('100%')}
              <br />
              {bar('80%')}
              <br />
              {bar('60%')}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
