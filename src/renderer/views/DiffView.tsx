import { useState } from 'react'
import { Card, H5, HTMLSelect, Button, NonIdealState } from '@blueprintjs/core'
import { useK8s } from '../hooks/useK8s'
import type { K8sResource } from '../../shared/types'

interface DiffViewProps {
  clusters: string[]
  resources: K8sResource[]
  onBack: () => void
}

export function DiffView({ clusters, resources, onBack }: DiffViewProps) {
  const k8s = useK8s()
  const [leftCluster, setLeftCluster] = useState(clusters[0] ?? '')
  const [rightCluster, setRightCluster] = useState(clusters[1] ?? clusters[0] ?? '')
  const [selectedResource, setSelectedResource] = useState('')
  const [selectedKind, setSelectedKind] = useState('')
  const [selectedNs, setSelectedNs] = useState('')
  const [leftYaml, setLeftYaml] = useState<string | null>(null)
  const [rightYaml, setRightYaml] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resourceNames = [...new Set(resources.filter((r) => r.kind === 'Deployment' || r.kind === 'Service' || r.kind === 'ConfigMap').map((r) => `${r.kind}/${r.namespace}/${r.name}`))]

  const handleCompare = async () => {
    if (!selectedResource || !leftCluster || !rightCluster) return
    setLoading(true)
    setError(null)
    setLeftYaml(null)
    setRightYaml(null)

    const [left, right] = await Promise.all([
      k8s.getResourceYaml(leftCluster, selectedNs, selectedResource, selectedKind).catch(() => null),
      k8s.getResourceYaml(rightCluster, selectedNs, selectedResource, selectedKind).catch(() => null)
    ])

    if (!left && !right) {
      setError(`${selectedKind} "${selectedResource}" not found in either cluster.`)
    } else if (!left) {
      setError(`${selectedKind} "${selectedResource}" exists in ${rightCluster} but not in ${leftCluster}.`)
    } else if (!right) {
      setError(`${selectedKind} "${selectedResource}" exists in ${leftCluster} but not in ${rightCluster}.`)
    }
    setLeftYaml(left ?? '(not found in this cluster)')
    setRightYaml(right ?? '(not found in this cluster)')
    setLoading(false)
  }

  const handleResourceSelect = (val: string) => {
    const parts = val.split('/')
    if (parts.length === 3) {
      setSelectedKind(parts[0])
      setSelectedNs(parts[1])
      setSelectedResource(parts[2])
    }
  }

  const leftLines = leftYaml?.split('\n') ?? []
  const rightLines = rightYaml?.split('\n') ?? []
  const maxLines = Math.max(leftLines.length, rightLines.length)

  return (
    <div style={{ padding: 16, overflow: 'auto', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Button minimal icon="arrow-left" onClick={onBack} />
        <H5 style={{ margin: 0 }}>Compare Resources</H5>
      </div>

      <Card style={{ marginBottom: 16, padding: 14, borderRadius: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <HTMLSelect value={leftCluster} onChange={(e) => setLeftCluster(e.target.value)}>
            {clusters.map((c) => <option key={c} value={c}>{c}</option>)}
          </HTMLSelect>
          <span style={{ color: 'var(--text-muted)' }}>vs</span>
          <HTMLSelect value={rightCluster} onChange={(e) => setRightCluster(e.target.value)}>
            {clusters.map((c) => <option key={c} value={c}>{c}</option>)}
          </HTMLSelect>
          <HTMLSelect value={`${selectedKind}/${selectedNs}/${selectedResource}`} onChange={(e) => handleResourceSelect(e.target.value)}>
            <option value="">Select resource...</option>
            {resourceNames.map((r) => <option key={r} value={r}>{r}</option>)}
          </HTMLSelect>
          <Button text="Compare" intent="primary" onClick={handleCompare} disabled={!selectedResource || leftCluster === rightCluster} loading={loading} />
        </div>
      </Card>

      {error && <div style={{ color: '#e5564f', padding: 8 }}>{error}</div>}

      {leftYaml && rightYaml && (
        <div className="diff-container">
          <div className="diff-header">
            <span className="diff-header-label">{leftCluster}</span>
            <span className="diff-header-label">{rightCluster}</span>
          </div>
          <div className="diff-body log-viewer-output">
            {Array.from({ length: maxLines }).map((_, i) => {
              const l = leftLines[i] ?? ''
              const r = rightLines[i] ?? ''
              const isDiff = l !== r
              return (
                <div key={i} className={`diff-row ${isDiff ? 'diff-row-changed' : ''}`}>
                  <span className="log-line-number">{i + 1}</span>
                  <span className={`diff-cell ${isDiff && l && !r ? 'diff-removed' : isDiff ? 'diff-changed' : ''}`}>{l}</span>
                  <span className="diff-divider" />
                  <span className={`diff-cell ${isDiff && r && !l ? 'diff-added' : isDiff ? 'diff-changed' : ''}`}>{r}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!leftYaml && !rightYaml && !loading && !error && (
        <NonIdealState icon="comparison" title="Compare resources across clusters" description="Select two clusters and a resource to compare" />
      )}
    </div>
  )
}
