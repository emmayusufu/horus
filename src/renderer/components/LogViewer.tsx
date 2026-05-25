import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Card, H5, ButtonGroup, Button, InputGroup, Checkbox } from '@blueprintjs/core'
import { useK8s } from '../hooks/useK8s'
import type { ContainerLogs } from '../../shared/types'

interface LogViewerProps {
  logs: ContainerLogs[]
  cluster: string
  namespace: string
  podName: string
}

export function LogViewer({ logs, cluster, namespace, podName }: LogViewerProps) {
  const k8s = useK8s()
  const [selectedContainer, setSelectedContainer] = useState(0)
  const [showPrevious, setShowPrevious] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [following, setFollowing] = useState(false)
  const [timestamps, setTimestamps] = useState(false)
  const [currentLogs, setCurrentLogs] = useState<ContainerLogs[]>(logs)
  const [streamBuffer, setStreamBuffer] = useState('')
  const streamIdRef = useRef<string | null>(null)
  const preRef = useRef<HTMLPreElement>(null)

  useEffect(() => { setCurrentLogs(logs) }, [logs])

  const current = currentLogs[selectedContainer]
  const isPod = currentLogs.length > 0

  const stopStream = useCallback(async () => {
    if (streamIdRef.current) {
      await k8s.stopLogStream(streamIdRef.current)
      streamIdRef.current = null
    }
  }, [k8s])

  useEffect(() => {
    if (!following || !isPod || !current) return

    setStreamBuffer('')
    let cancelled = false

    const startStream = async () => {
      const id = await k8s.startLogStream(cluster, namespace, podName, current.containerName, timestamps)
      if (cancelled) {
        await k8s.stopLogStream(id)
        return
      }
      streamIdRef.current = id
    }

    const unsub = k8s.onLogChunk((chunk) => {
      if (chunk.streamId === streamIdRef.current) {
        setStreamBuffer((prev) => prev + chunk.data)
      }
    })

    startStream()

    return () => {
      cancelled = true
      stopStream()
      unsub()
    }
  }, [following, selectedContainer, timestamps, cluster, namespace, podName, current?.containerName])

  useEffect(() => {
    if (following && preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight
    }
  }, [streamBuffer, following])

  const handleTimestampsToggle = async () => {
    const next = !timestamps
    setTimestamps(next)
    if (!following && isPod) {
      const refreshed = await k8s.getLogs(cluster, namespace, podName, next)
      setCurrentLogs(refreshed)
    }
  }

  const handleFollowToggle = () => {
    if (following) {
      stopStream()
    }
    setFollowing(!following)
    setShowPrevious(false)
  }

  const handleContainerSelect = (index: number) => {
    if (following) stopStream()
    setSelectedContainer(index)
    setShowPrevious(false)
    setStreamBuffer('')
  }

  const rawText = following
    ? streamBuffer
    : (showPrevious ? current?.previous : current?.current) ?? ''

  const displayLines = useMemo(() => {
    const lines = rawText.split('\n')
    if (!searchQuery) return lines.map((line) => ({ text: line, match: true }))
    const lower = searchQuery.toLowerCase()
    return lines.map((line) => ({ text: line, match: line.toLowerCase().includes(lower) }))
  }, [rawText, searchQuery])

  const filteredLines = searchQuery ? displayLines.filter((l) => l.match) : displayLines

  if (!isPod) {
    return (<Card style={{ marginBottom: 12 }}><H5>Logs</H5><span className="bp5-text-muted">No logs available (not a Pod)</span></Card>)
  }

  return (
    <Card style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <H5 style={{ margin: 0 }}>Logs ({current?.containerName}{current?.isInit ? ' — init' : ''})</H5>
        <ButtonGroup minimal>
          {currentLogs.map((log, i) => (
            <Button
              key={i}
              text={log.isInit ? `${log.containerName} (init)` : log.containerName}
              active={i === selectedContainer}
              onClick={() => handleContainerSelect(i)}
              style={log.isInit ? { fontStyle: 'italic', opacity: 0.8 } : undefined}
            />
          ))}
          {current?.previous && !following && (
            <Button text={showPrevious ? 'current' : 'prev container'} active={showPrevious} onClick={() => setShowPrevious(!showPrevious)} />
          )}
          <Button icon="play" text={following ? 'Stop' : 'Follow'} active={following} intent={following ? 'success' : 'none'} onClick={handleFollowToggle} />
        </ButtonGroup>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
        <InputGroup
          leftIcon="search"
          placeholder="Filter logs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1 }}
          small
        />
        <Checkbox checked={timestamps} onChange={handleTimestampsToggle} label="Timestamps" style={{ margin: 0 }} />
      </div>
      <pre
        ref={preRef}
        className="monospace"
        style={{ maxHeight: 300, overflow: 'auto', margin: 0, padding: 8, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
      >
        {filteredLines.map((line, i) => (
          <div key={i}>{highlightMatch(line.text, searchQuery)}</div>
        ))}
        {filteredLines.length === 0 && <span className="bp5-text-muted">(no matching lines)</span>}
      </pre>
    </Card>
  )
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text
  const lower = text.toLowerCase()
  const qLower = query.toLowerCase()
  const idx = lower.indexOf(qLower)
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ backgroundColor: '#FBD065', color: '#1C2127', borderRadius: 2, padding: '0 1px' }}>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}
