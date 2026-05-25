import { CardSkeleton } from './Skeleton'
import { useState, useEffect } from 'react'
import { Card, H5, Tag, Intent } from '@blueprintjs/core'
import { useK8s } from '../hooks/useK8s'
import type { RootCause } from '../../shared/types'

interface RootCausePanelProps { cluster: string; namespace: string; name: string; kind: string }

const CONF_INTENT = { high: Intent.DANGER, medium: Intent.WARNING, low: Intent.NONE }

export function RootCausePanel({ cluster, namespace, name, kind }: RootCausePanelProps) {
  const k8s = useK8s()
  const [result, setResult] = useState<RootCause | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    k8s.analyzeRootCause(cluster, namespace, name, kind).then(setResult).catch(() => setResult(null)).finally(() => setLoading(false))
  }, [cluster, namespace, name, kind])

  if (loading) return <CardSkeleton title lines={3} />
  if (!result || result.confidence === 'low') return null

  return (
    <Card style={{ marginBottom: 12, borderLeft: `3px solid ${result.confidence === 'high' ? '#e5564f' : '#cc8d35'}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <H5 style={{ margin: 0 }}>Root Cause</H5>
        <Tag minimal intent={CONF_INTENT[result.confidence]}>{result.confidence} confidence</Tag>
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>{result.summary}</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>{result.suggestion}</div>
      {result.evidence.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {result.evidence.map((e, i) => <div key={i} className="monospace" style={{ padding: '1px 0' }}>{e}</div>)}
        </div>
      )}
    </Card>
  )
}
