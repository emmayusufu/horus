import { useState, useMemo } from 'react'
import { HTMLSelect, NonIdealState, Button } from '@blueprintjs/core'
import { Column, Table2, Cell } from '@blueprintjs/table'
import { HelmBanner } from '../components/HelmBanner'
import { NamespaceEvents } from '../components/NamespaceEvents'
import { parseHelmLabels } from '../../shared/helm'
import type { K8sResource, ResourceKind } from '../../shared/types'

interface ExploreProps {
  cluster: string
  resources: K8sResource[]
  onSelectResource: (resource: K8sResource) => void
}

const KINDS: ResourceKind[] = [
  'Pod',
  'Deployment',
  'StatefulSet',
  'DaemonSet',
  'Job',
  'Service',
  'Ingress',
  'ConfigMap',
  'Secret'
]

export function Explore({ cluster, resources, onSelectResource }: ExploreProps) {
  const [namespace, setNamespace] = useState<string>('all')
  const [kind, setKind] = useState<ResourceKind | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showEvents, setShowEvents] = useState(false)

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
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <HTMLSelect value={namespace} onChange={(e) => setNamespace(e.target.value)}>
          {namespaces.map((ns) => (
            <option key={ns} value={ns}>
              {ns === 'all' ? 'All namespaces' : ns}
            </option>
          ))}
        </HTMLSelect>
        <HTMLSelect value={kind} onChange={(e) => setKind(e.target.value as any)}>
          <option value="all">All types</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
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
      </div>
      {showEvents && namespace !== 'all' && <NamespaceEvents cluster={cluster} namespace={namespace} />}
      {helmInfo && <HelmBanner helm={helmInfo} />}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Table2
          numRows={filtered.length}
          enableRowResizing={false}
          columnWidths={[200, 100, 80, 60, 80, 100]}
          cellRendererDependencies={[filtered]}
        >
          <Column
            name="Name"
            cellRenderer={(row) => (
              <Cell interactive onClick={() => onSelectResource(filtered[row])}>
                <span className="monospace">{filtered[row]?.name}</span>
              </Cell>
            )}
          />
          <Column name="Kind" cellRenderer={(row) => <Cell>{filtered[row]?.kind}</Cell>} />
          <Column name="Status" cellRenderer={(row) => <Cell>{filtered[row]?.status}</Cell>} />
          <Column
            name="Restarts"
            cellRenderer={(row) => <Cell className="monospace">{filtered[row]?.restarts}</Cell>}
          />
          <Column
            name="Namespace"
            cellRenderer={(row) => <Cell className="monospace">{filtered[row]?.namespace}</Cell>}
          />
          <Column name="Node" cellRenderer={(row) => <Cell className="monospace">{filtered[row]?.node}</Cell>} />
        </Table2>
      </div>
    </div>
  )
}
