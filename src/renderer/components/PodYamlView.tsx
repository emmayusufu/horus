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
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleToggle = async () => {
    if (!isOpen && content === null) {
      setLoading(true)
      try {
        const result = await k8s.getPodYaml(cluster, namespace, name)
        setContent(result)
      } catch (err: any) {
        setContent(`Error: ${err.message}`)
      }
      setLoading(false)
    }
    setIsOpen(!isOpen)
  }

  return (
    <Card style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <H5 style={{ margin: 0 }}>Pod Spec</H5>
        <div style={{ display: 'flex', gap: 4 }}>
          {isOpen && content && (
            <Button minimal small icon="clipboard" onClick={() => navigator.clipboard.writeText(content)} />
          )}
          <Button
            minimal
            icon={isOpen ? 'chevron-up' : 'chevron-down'}
            text={isOpen ? 'Collapse' : 'Expand'}
            onClick={handleToggle}
            loading={loading}
          />
        </div>
      </div>
      <Collapse isOpen={isOpen}>
        <div
          className="log-viewer-output"
          style={{
            maxHeight: 500,
            overflow: 'auto',
            margin: '8px 0 0',
            backgroundColor: 'rgba(0,0,0,0.3)',
            borderRadius: 4
          }}
        >
          {content && renderJson(content)}
        </div>
      </Collapse>
    </Card>
  )
}

function renderJson(raw: string): React.ReactNode {
  const lines = raw.split('\n')
  return lines.map((line, i) => (
    <div key={i} className="log-line">
      <span className="log-line-number">{i + 1}</span>
      <span className="log-line-content" style={{ whiteSpace: 'pre' }}>
        {colorizeJsonLine(line)}
      </span>
    </div>
  ))
}

function colorizeJsonLine(line: string): React.ReactNode {
  const keyMatch = line.match(/^(\s*)"([^"]+)"(:)/)
  if (keyMatch) {
    const [, indent, key, colon] = keyMatch
    const rest = line.slice(keyMatch[0].length)
    return (
      <>
        {indent}
        <span style={{ color: '#8ABBFF' }}>"{key}"</span>
        {colon}
        {colorizeValue(rest)}
      </>
    )
  }
  return colorizeValue(line)
}

function colorizeValue(text: string): React.ReactNode {
  const trimmed = text.trim().replace(/,$/, '')
  const trailing = text.trim().endsWith(',') ? ',' : ''
  const leading = text.slice(0, text.length - text.trimStart().length)

  if (trimmed.startsWith('"'))
    return (
      <>
        {leading}
        <span style={{ color: '#62D96B' }}>{trimmed}</span>
        {trailing}
      </>
    )
  if (trimmed === 'true' || trimmed === 'false')
    return (
      <>
        {leading}
        <span style={{ color: '#FBB360' }}>{trimmed}</span>
        {trailing}
      </>
    )
  if (trimmed === 'null')
    return (
      <>
        {leading}
        <span style={{ color: '#F5498B' }}>{trimmed}</span>
        {trailing}
      </>
    )
  if (/^-?\d/.test(trimmed))
    return (
      <>
        {leading}
        <span style={{ color: '#AD99FF' }}>{trimmed}</span>
        {trailing}
      </>
    )
  return text
}
