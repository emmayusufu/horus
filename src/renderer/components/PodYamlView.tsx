import { useState } from 'react'
import { Card, H5, Button, Collapse } from '@blueprintjs/core'
import { useK8s } from '../hooks/useK8s'

interface PodYamlViewProps {
  cluster: string
  namespace: string
  name: string
}

export function PodYamlView({ cluster, namespace, name }: PodYamlViewProps) {
  const k8s = useK8s()
  const [isOpen, setIsOpen] = useState(false)
  const [yaml, setYaml] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleToggle = async () => {
    if (!isOpen && yaml === null) {
      setLoading(true)
      try {
        const result = await k8s.getPodYaml(cluster, namespace, name)
        setYaml(result)
      } catch (err: any) {
        setYaml(`Error: ${err.message}`)
      }
      setLoading(false)
    }
    setIsOpen(!isOpen)
  }

  return (
    <Card style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <H5 style={{ margin: 0 }}>Pod Spec</H5>
        <Button
          minimal
          icon={isOpen ? 'chevron-up' : 'chevron-down'}
          text={isOpen ? 'Collapse' : 'Expand'}
          onClick={handleToggle}
          loading={loading}
        />
      </div>
      <Collapse isOpen={isOpen}>
        <pre
          className="monospace"
          style={{
            maxHeight: 400,
            overflow: 'auto',
            margin: '8px 0 0',
            padding: 8,
            backgroundColor: 'rgba(0,0,0,0.2)',
            borderRadius: 4,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            fontSize: 11
          }}
        >
          {yaml ?? ''}
        </pre>
      </Collapse>
    </Card>
  )
}
