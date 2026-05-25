import { useState } from 'react'
import { Button, Intent } from '@blueprintjs/core'
import { Modal } from './Modal'
import { useK8s } from '../hooks/useK8s'

interface PodActionsProps {
  cluster: string
  namespace: string
  name: string
  kind: string
  replicas?: number
}

export function PodActions({ cluster, namespace, name, kind, replicas }: PodActionsProps) {
  const k8s = useK8s()
  const [showConfirm, setShowConfirm] = useState(false)
  const [showScale, setShowScale] = useState(false)
  const [scaleValue, setScaleValue] = useState(replicas ?? 1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRestart = async () => {
    setLoading(true)
    setError(null)
    try {
      await k8s.deletePod(cluster, namespace, name)
      setShowConfirm(false)
    } catch (err: any) {
      setError(err.message ?? 'Failed to restart pod')
    }
    setLoading(false)
  }

  const handleScale = async () => {
    setLoading(true)
    setError(null)
    try {
      await k8s.scaleDeploy(cluster, namespace, name, scaleValue)
      setShowScale(false)
    } catch (err: any) {
      setError(err.message ?? 'Failed to scale deployment')
    }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {kind === 'Pod' && (
        <Button small minimal icon="reset" intent={Intent.WARNING} onClick={() => setShowConfirm(true)}>Restart</Button>
      )}
      {kind === 'Deployment' && (
        <Button small minimal icon="arrows-horizontal" onClick={() => { setScaleValue(replicas ?? 1); setShowScale(true) }}>Scale</Button>
      )}

      <Modal isOpen={showConfirm} onClose={() => { setShowConfirm(false); setError(null) }} title="Restart Pod" width={380}>
        <p style={{ margin: '0 0 12px', fontSize: 13 }}>Delete <strong className="monospace">{name}</strong> to trigger recreation?</p>
        {error && <div style={{ fontSize: 12, color: '#e5564f', marginBottom: 8 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button onClick={() => { setShowConfirm(false); setError(null) }}>Cancel</Button>
          <Button intent={Intent.DANGER} onClick={handleRestart} loading={loading}>Restart</Button>
        </div>
      </Modal>

      <Modal isOpen={showScale} onClose={() => { setShowScale(false); setError(null) }} title="Scale Deployment" width={380}>
        <p style={{ margin: '0 0 12px', fontSize: 13 }}>Scale <strong className="monospace">{name}</strong></p>
        {error && <div style={{ fontSize: 12, color: '#e5564f', marginBottom: 8 }}>{error}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Button icon="minus" minimal onClick={() => setScaleValue(Math.max(0, scaleValue - 1))} />
          <span className="monospace" style={{ fontSize: 24, fontWeight: 600, minWidth: 40, textAlign: 'center' }}>{scaleValue}</span>
          <Button icon="plus" minimal onClick={() => setScaleValue(scaleValue + 1)} />
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>replicas</span>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button onClick={() => setShowScale(false)}>Cancel</Button>
          <Button intent={Intent.PRIMARY} onClick={handleScale} loading={loading}>Apply</Button>
        </div>
      </Modal>
    </div>
  )
}
