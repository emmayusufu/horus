import { useState, useEffect } from 'react'
import { Card, H5, Tag, Intent } from '@blueprintjs/core'
import { useK8s } from '../hooks/useK8s'
import type { ConfigCheck } from '../../shared/types'

interface ConfigChecksProps { cluster: string; namespace: string }

export function ConfigChecks({ cluster, namespace }: ConfigChecksProps) {
  const k8s = useK8s()
  const [checks, setChecks] = useState<ConfigCheck[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    k8s.getConfigChecks(cluster, namespace).then(setChecks).catch(() => {}).finally(() => setLoading(false))
  }, [cluster, namespace])

  if (loading || checks.length === 0) return null

  const totalIssues = checks.reduce((sum, c) => sum + c.issues.length, 0)

  return (
    <Card style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <H5 style={{ margin: 0 }}>Config Health</H5>
        <Tag minimal intent={Intent.WARNING}>{totalIssues} issues in {checks.length} pods</Tag>
      </div>
      <div style={{ maxHeight: 300, overflow: 'auto' }}>
        {checks.map((c) => (
          <div key={c.name} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            <div className="monospace" style={{ fontSize: 12, marginBottom: 4 }}>{c.name}</div>
            {c.issues.map((issue, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: 'var(--color-warn)', paddingLeft: 8 }}>
                <span style={{ opacity: 0.5 }}>-</span>
                <span>{issue}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Card>
  )
}
