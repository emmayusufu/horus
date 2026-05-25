import { useState, useEffect } from 'react'
import { Card, H5, Tag, Intent } from '@blueprintjs/core'
import { useK8s } from '../hooks/useK8s'
import type { PVCInfo } from '../../shared/types'

interface PVCListProps { cluster: string; namespace: string }

export function PVCList({ cluster, namespace }: PVCListProps) {
  const k8s = useK8s()
  const [pvcs, setPvcs] = useState<PVCInfo[]>([])

  useEffect(() => {
    k8s.getPVCs(cluster, namespace).then(setPvcs).catch(() => {})
  }, [cluster, namespace])

  if (pvcs.length === 0) return null

  return (
    <Card style={{ marginBottom: 12 }}>
      <H5>Volumes ({pvcs.length})</H5>
      <div className="monospace" style={{ fontSize: 12 }}>
        {pvcs.map((pvc) => {
          const intent = pvc.status === 'Bound' ? Intent.SUCCESS : pvc.status === 'Pending' ? Intent.WARNING : Intent.DANGER
          return (
            <div key={pvc.name} style={{ display: 'flex', gap: 10, padding: '4px 0', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
              <Tag minimal intent={intent} style={{ minWidth: 60 }}>{pvc.status}</Tag>
              <span style={{ flex: 1 }}>{pvc.name}</span>
              <span style={{ color: 'var(--text-muted)' }}>{pvc.capacity}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{pvc.storageClass}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{pvc.accessModes.join(', ')}</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
