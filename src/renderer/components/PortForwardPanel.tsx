import { useState } from 'react'
import { Card, H5, Button, Intent, InputGroup, Tag } from '@blueprintjs/core'
import { useK8s } from '../hooks/useK8s'

interface ActiveForward { id: string; localPort: number; remotePort: number }

interface PortForwardPanelProps {
  cluster: string
  namespace: string
  podName: string
}

export function PortForwardPanel({ cluster, namespace, podName }: PortForwardPanelProps) {
  const k8s = useK8s()
  const [localPort, setLocalPort] = useState('8080')
  const [remotePort, setRemotePort] = useState('80')
  const [forwards, setForwards] = useState<ActiveForward[]>([])
  const [loading, setLoading] = useState(false)

  const handleStart = async () => {
    const lp = parseInt(localPort)
    const rp = parseInt(remotePort)
    if (isNaN(lp) || isNaN(rp)) return
    setLoading(true)
    try {
      const id = await k8s.startPortForward(cluster, namespace, podName, lp, rp)
      setForwards([...forwards, { id, localPort: lp, remotePort: rp }])
    } catch {}
    setLoading(false)
  }

  const handleStop = async (id: string) => {
    await k8s.stopPortForward(id)
    setForwards(forwards.filter((f) => f.id !== id))
  }

  return (
    <Card style={{ marginBottom: 12 }}>
      <H5>Port Forward</H5>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <InputGroup small placeholder="Local" value={localPort} onChange={(e) => setLocalPort(e.target.value)} style={{ width: 70 }} className="monospace" />
        <span style={{ color: 'var(--text-muted)' }}>:</span>
        <InputGroup small placeholder="Remote" value={remotePort} onChange={(e) => setRemotePort(e.target.value)} style={{ width: 70 }} className="monospace" />
        <Button small intent={Intent.SUCCESS} onClick={handleStart} loading={loading}>Forward</Button>
      </div>
      {forwards.map((f) => (
        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12 }}>
          <Tag intent={Intent.SUCCESS} minimal round>active</Tag>
          <span className="monospace">localhost:{f.localPort} -> {f.remotePort}</span>
          <Button small minimal icon="cross" intent={Intent.DANGER} onClick={() => handleStop(f.id)} style={{ marginLeft: 'auto' }} />
        </div>
      ))}
    </Card>
  )
}
