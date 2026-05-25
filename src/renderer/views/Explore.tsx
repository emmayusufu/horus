import { useState, useMemo } from 'react'
import { HTMLSelect, NonIdealState, Button } from '@blueprintjs/core'
import { Column, Table2, Cell } from '@blueprintjs/table'
import { HelmBanner } from '../components/HelmBanner'
import { NamespaceEvents } from '../components/NamespaceEvents'
import { HPAStatus } from '../components/HPAStatus'
import { PVCList } from '../components/PVCList'
import { QuotaView } from '../components/QuotaView'
import { ConfigChecks } from '../components/ConfigChecks'
import { TopologyMap } from '../components/TopologyMap'
import { HelmReleases } from '../components/HelmReleases'
import { SizingRecs } from '../components/SizingRecs'
import { OwnershipTree } from '../components/OwnershipTree'
import { DependencyGraph } from '../components/DependencyGraph'
import { NodeTopology } from '../components/NodeTopology'
import { parseHelmLabels } from '../../shared/helm'
import type { K8sResource, ResourceKind } from '../../shared/types'

interface ExploreProps {
  cluster: string
  resources: K8sResource[]
  onSelectResource: (resource: K8sResource) => void
  onShowNodes?: () => void
  onShowSecurity?: () => void
}

const KINDS: ResourceKind[] = [
  'Pod',
  'Deployment',
  'StatefulSet',
  'DaemonSet',
  'Job',
  'CronJob',
  'Service',
  'Ingress',
  'ConfigMap',
  'Secret'
]

function formatAge(isoTimestamp: string): string {
  const diff = Date.now() - new Date(isoTimestamp).getTime()
  if (diff < 0) return '0s'
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

export function Explore({ cluster, resources, onSelectResource, onShowNodes, onShowSecurity }: ExploreProps) {
  const [namespace, setNamespace] = useState<string>('all')
  const [kind, setKind] = useState<ResourceKind | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showEvents, setShowEvents] = useState(false)
  const [showInsights, setShowInsights] = useState(true)

  const namespaces = useMemo(() => {
    const ns = new Set(resources.map((r) => r.namespace))
    return ['all', ...Array.from(ns).sort()]
  }, [resources])

  const filtered = useMemo(() => {
    return resources.filter((r) => {
      if (namespace !== 'all' && r.namespace !== namespace) return false
      if (kind !== 'all' && r.kind !== kind) return false
      if (statusFilter === 'unhealthy' && r.health === 'healthy') return false
      return true
    })
  }, [resources, namespace, kind, statusFilter])

  const helmInfo = useMemo(() => {
    for (const r of filtered) {
      const helm = parseHelmLabels(r.labels)
      if (helm) return helm
    }
    return null
  }, [filtered])

  if (resources.length === 0) {
    return <NonIdealState icon="search" title="No resources" description={`No resources found in ${cluster}`} />
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', flex: 1, overflow: showInsights ? 'auto' : 'hidden' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <HTMLSelect value={namespace} onChange={(e) => setNamespace(e.target.value)}>
          {namespaces.map((ns) => (
            <option key={ns} value={ns}>
              {ns === 'all' ? 'All namespaces' : ns}
            </option>
          ))}
        </HTMLSelect>
        <HTMLSelect value={kind} onChange={(e) => setKind(e.target.value as any)}>
          <option value="all">All types ({resources.length})</option>
          {KINDS.map((k) => {
            const ct = resources.filter((r) => r.kind === k && (namespace === 'all' || r.namespace === namespace)).length
            return ct > 0 ? <option key={k} value={k}>{k} ({ct})</option> : null
          })}
        </HTMLSelect>
        <HTMLSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All status</option>
          <option value="unhealthy">Unhealthy only</option>
        </HTMLSelect>
        {namespace !== 'all' && (
          <Button
            small
            icon="timeline-events"
            text={showEvents ? 'Hide Events' : 'Namespace Events'}
            active={showEvents}
            onClick={() => setShowEvents(!showEvents)}
          />
        )}
        <Button
          small
          icon="dashboard"
          text={showInsights ? 'Hide Insights' : 'Insights'}
          active={showInsights}
          onClick={() => setShowInsights(!showInsights)}
        />
        {onShowNodes && <Button small icon="cloud" text="Nodes" onClick={onShowNodes} />}
        {onShowSecurity && <Button small icon="shield" text="Security" onClick={onShowSecurity} />}
      </div>
      {showEvents && namespace !== 'all' && <NamespaceEvents cluster={cluster} namespace={namespace} />}
      {showInsights && namespace !== 'all' && (
        <div style={{ marginBottom: 12 }}>
          <TopologyMap cluster={cluster} namespace={namespace} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <OwnershipTree resources={filtered} onSelect={onSelectResource} />
              <HPAStatus cluster={cluster} namespace={namespace} />
              <QuotaView cluster={cluster} namespace={namespace} />
              <SizingRecs cluster={cluster} namespace={namespace} />
            </div>
            <div>
              <DependencyGraph cluster={cluster} namespace={namespace} />
              <PVCList cluster={cluster} namespace={namespace} />
              <ConfigChecks cluster={cluster} namespace={namespace} />
            </div>
          </div>
        </div>
      )}
      {showInsights && namespace === 'all' && (
        <div style={{ marginBottom: 12 }}>
          <HelmReleases cluster={cluster} />
          <NodeTopology resources={resources} onSelect={onSelectResource} />
          <OwnershipTree resources={resources} onSelect={onSelectResource} />
        </div>
      )}
      {helmInfo && <HelmBanner helm={helmInfo} />}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Table2
          numRows={filtered.length}
          enableRowResizing={false}
          enableColumnResizing
          defaultColumnWidth={150}
          cellRendererDependencies={[filtered]}
        >
          <Column
            name="Name"
            cellRenderer={(row) => (
              <Cell>
                <div className="explore-cell" onClick={() => onSelectResource(filtered[row])}>
                  <span className="monospace">{filtered[row]?.name}</span>
                </div>
              </Cell>
            )}
          />
          <Column
            name="Kind"
            cellRenderer={(row) => (
              <Cell>
                <div className="explore-cell" onClick={() => onSelectResource(filtered[row])}>
                  {filtered[row]?.kind}
                </div>
              </Cell>
            )}
          />
          <Column
            name="Status"
            cellRenderer={(row) => {
              const r = filtered[row]
              const color = r?.health === 'critical' ? '#E76A6E' : r?.health === 'warning' ? '#D4A017' : undefined
              return (
                <Cell>
                  <div
                    className="explore-cell"
                    onClick={() => onSelectResource(r)}
                    style={color ? { color } : undefined}
                  >
                    {r?.status}
                  </div>
                </Cell>
              )
            }}
          />
          <Column
            name="Restarts"
            cellRenderer={(row) => (
              <Cell>
                <div className="explore-cell monospace" onClick={() => onSelectResource(filtered[row])}>
                  {filtered[row]?.restarts}
                </div>
              </Cell>
            )}
          />
          <Column
            name="Namespace"
            cellRenderer={(row) => (
              <Cell>
                <div className="explore-cell monospace" onClick={() => onSelectResource(filtered[row])}>
                  {filtered[row]?.namespace}
                </div>
              </Cell>
            )}
          />
          <Column
            name="Age"
            cellRenderer={(row) => (
              <Cell>
                <div className="explore-cell monospace" onClick={() => onSelectResource(filtered[row])}>
                  {formatAge(filtered[row]?.age ?? '')}
                </div>
              </Cell>
            )}
          />
        </Table2>
      </div>
    </div>
  )
}
