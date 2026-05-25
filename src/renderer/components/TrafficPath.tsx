import { CardSkeleton } from './Skeleton'
import { useState, useEffect } from 'react'
import { Card, H5, Tag, Intent } from '@blueprintjs/core'
import { useK8s } from '../hooks/useK8s'
import type { TrafficPath as TrafficPathType } from '../../shared/types'

interface TrafficPathProps { cluster: string; namespace: string; serviceName: string }

export function TrafficPath({ cluster, namespace, serviceName }: TrafficPathProps) {
  const k8s = useK8s()
  const [data, setData] = useState<TrafficPathType | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    k8s.getTrafficPath(cluster, namespace, serviceName).then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [cluster, namespace, serviceName])

  if (loading) return <CardSkeleton lines={3} />
  if (!data) return null

  return (
    <Card style={{ marginBottom: 12 }}>
      <H5>Traffic Path</H5>
      <div className="traffic-flow">
        {data.ingress && (
          <>
            <div className="traffic-node">
              <Tag intent={Intent.PRIMARY} large>Ingress</Tag>
              <div className="traffic-detail monospace">
                <div>{data.ingress.name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{data.ingress.host}{data.ingress.path}</div>
              </div>
            </div>
            <div className="traffic-arrow">
              <svg width="24" height="24" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </div>
          </>
        )}
        <div className="traffic-node">
          <Tag intent={Intent.NONE} large>{data.service.type}</Tag>
          <div className="traffic-detail monospace">
            <div>{data.service.name}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{data.service.clusterIP}</div>
            {data.service.externalIP && <div style={{ color: 'var(--color-info)', fontSize: 11 }}>{data.service.externalIP}</div>}
            <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{data.service.ports.join(', ')}</div>
          </div>
        </div>
        <div className="traffic-arrow">
          <svg width="24" height="24" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </div>
        <div className="traffic-node">
          <Tag intent={data.endpoints.ready > 0 ? Intent.SUCCESS : Intent.DANGER} large>Endpoints</Tag>
          <div className="traffic-detail monospace">
            <div>{data.endpoints.ready} ready, {data.endpoints.notReady} not ready</div>
          </div>
        </div>
        <div className="traffic-arrow">
          <svg width="24" height="24" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </div>
        <div className="traffic-node">
          <Tag intent={Intent.NONE} large>Pods ({data.pods.length})</Tag>
          <div className="traffic-detail monospace" style={{ fontSize: 11 }}>
            {data.pods.slice(0, 5).map((p) => (
              <div key={p.name} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span className="ov-pulse" style={{ width: 5, height: 5, background: p.ready ? '#3d9a5f' : '#e5564f' }} />
                <span>{p.name}</span>
                <span style={{ color: 'var(--text-muted)' }}>{p.status}</span>
              </div>
            ))}
            {data.pods.length > 5 && <div style={{ color: 'var(--text-muted)' }}>+{data.pods.length - 5} more</div>}
          </div>
        </div>
      </div>
    </Card>
  )
}
