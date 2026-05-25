import { CardSkeleton } from './Skeleton'
import { useState, useEffect } from 'react'
import { Card, H5, Tag, Intent } from '@blueprintjs/core'
import { useK8s } from '../hooks/useK8s'
import type { HelmRelease } from '../../shared/types'

interface HelmReleasesProps { cluster: string }

export function HelmReleases({ cluster }: HelmReleasesProps) {
  const k8s = useK8s()
  const [releases, setReleases] = useState<HelmRelease[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    k8s.getHelmReleases(cluster).then(setReleases).catch(() => {}).finally(() => setLoading(false))
  }, [cluster])

  if (loading) return <CardSkeleton title lines={4} />
  if (releases.length === 0) return null

  return (
    <Card style={{ marginBottom: 12 }}>
      <H5>Helm Releases ({releases.length})</H5>
      <div className="monospace" style={{ fontSize: 12 }}>
        {releases.map((r) => (
          <div key={`${r.namespace}/${r.name}`} style={{ display: 'flex', gap: 8, padding: '5px 0', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
            <Tag minimal intent={r.status === 'deployed' ? Intent.SUCCESS : r.status === 'failed' ? Intent.DANGER : Intent.NONE} style={{ fontSize: 10 }}>
              {r.status}
            </Tag>
            <span style={{ flex: 1 }}>{r.name}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{r.namespace}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>rev {r.revision}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}
