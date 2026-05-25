import { useState, useEffect } from 'react'
import { Card, H5, Tag, Intent, Spinner } from '@blueprintjs/core'
import { useK8s } from '../hooks/useK8s'
import type { SizingRec } from '../../shared/types'

interface SizingRecsProps { cluster: string; namespace: string }

export function SizingRecs({ cluster, namespace }: SizingRecsProps) {
  const k8s = useK8s()
  const [recs, setRecs] = useState<SizingRec[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    k8s.getSizingRecs(cluster, namespace).then(setRecs).catch(() => {}).finally(() => setLoading(false))
  }, [cluster, namespace])

  if (loading || recs.length === 0) return null

  return (
    <Card style={{ marginBottom: 12 }}>
      <H5>Resource Sizing ({recs.length} containers)</H5>
      <div style={{ maxHeight: 250, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ color: 'var(--text-muted)' }}>
              <th style={{ textAlign: 'left', padding: '4px 6px', fontWeight: 400 }}>Pod / Container</th>
              <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 400 }}>CPU Req</th>
              <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 400 }}>Mem Req</th>
            </tr>
          </thead>
          <tbody className="monospace">
            {recs.map((r, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '4px 6px' }}>
                  <span>{r.pod}</span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>/{r.container}</span>
                </td>
                <td style={{ textAlign: 'right', padding: '4px 6px' }}>{r.cpuRequest}</td>
                <td style={{ textAlign: 'right', padding: '4px 6px' }}>{r.memRequest}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
