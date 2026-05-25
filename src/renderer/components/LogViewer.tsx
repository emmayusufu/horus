import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Card, H5, ButtonGroup, Button, InputGroup, Checkbox, Tag } from '@blueprintjs/core'
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
  const [wordWrap, setWordWrap] = useState(true)
  const [currentLogs, setCurrentLogs] = useState<ContainerLogs[]>(logs)
  const [streamBuffer, setStreamBuffer] = useState('')
  const streamIdRef = useRef<string | null>(null)
  const preRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setCurrentLogs(logs)
  }, [logs])

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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (e.key === 'l') {
        e.preventDefault()
        handleFollowToggle()
      }
      if (e.key === '/' && isPod) {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 't') {
        e.preventDefault()
        handleTimestampsToggle()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [following, timestamps, isPod])

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

  const rawText = following ? streamBuffer : ((showPrevious ? current?.previous : current?.current) ?? '')

  const displayLines = useMemo(() => {
    const lines = rawText.split('\n')
    if (!searchQuery) return lines.map((line) => ({ text: line, match: true }))
    const lower = searchQuery.toLowerCase()
    return lines.map((line) => ({ text: line, match: line.toLowerCase().includes(lower) }))
  }, [rawText, searchQuery])

  const filteredLines = searchQuery ? displayLines.filter((l) => l.match) : displayLines
  const matchCount = searchQuery ? displayLines.filter((l) => l.match).length : 0
  const totalLines = displayLines.length

  if (!isPod) {
    return (
      <Card style={{ marginBottom: 12 }}>
        <H5>Logs</H5>
        <span className="bp5-text-muted">No logs available (not a Pod)</span>
      </Card>
    )
  }

  return (
    <Card style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <H5 style={{ margin: 0 }}>
          Logs ({current?.containerName}
          {current?.isInit ? ' — init' : ''})
        </H5>
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
            <Button
              text={showPrevious ? 'current' : 'prev container'}
              active={showPrevious}
              onClick={() => setShowPrevious(!showPrevious)}
            />
          )}
          <Button
            icon="play"
            text={following ? 'Stop' : 'Follow'}
            active={following}
            intent={following ? 'success' : 'none'}
            onClick={handleFollowToggle}
          />
        </ButtonGroup>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
        <InputGroup
          inputRef={searchRef}
          leftIcon="search"
          placeholder="Filter logs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1 }}
          small
        />
        {searchQuery && (
          <Tag minimal round>
            {matchCount}/{totalLines}
          </Tag>
        )}
        <Checkbox checked={timestamps} onChange={handleTimestampsToggle} label="Timestamps" style={{ margin: 0 }} />
        <Button
          small
          minimal
          icon={wordWrap ? 'align-justify' : 'arrow-right'}
          title={wordWrap ? 'Wrap on' : 'Wrap off'}
          onClick={() => setWordWrap(!wordWrap)}
          active={wordWrap}
        />
        <Button small minimal icon="clipboard" onClick={() => navigator.clipboard.writeText(rawText)} />
      </div>
      <div
        ref={preRef}
        className="log-viewer-output"
        style={{
          maxHeight: 500,
          overflow: 'auto',
          margin: 0,
          backgroundColor: 'rgba(0,0,0,0.35)',
          borderRadius: 6
        }}
      >
        {filteredLines.map((line, i) => (
          <div key={i} className="log-line" style={getLogLevelStyle(line.text)}>
            <span className="log-line-number">{searchQuery ? displayLines.indexOf(line) + 1 : i + 1}</span>
            <span
              className="log-line-content"
              style={wordWrap ? undefined : { whiteSpace: 'pre', overflow: 'visible' }}
            >
              {renderLogContent(line.text, searchQuery)}
            </span>
          </div>
        ))}
        {filteredLines.length === 0 && (
          <div className="log-line" style={{ padding: 8 }}>
            <span className="bp5-text-muted">(no matching lines)</span>
          </div>
        )}
      </div>
    </Card>
  )
}

function renderLogContent(text: string, query: string): React.ReactNode {
  if (!text) return text

  const jsonMatch = text.match(/^(.*?)(\{[\s\S]*\})\s*$/)
  if (jsonMatch) {
    const [, prefix, jsonStr] = jsonMatch
    try {
      const parsed = JSON.parse(jsonStr)
      const formatted = JSON.stringify(parsed, null, 2)
      return (
        <>
          {prefix && highlightMatch(prefix, query)}
          <span className="log-json">{highlightMatch(formatted, query)}</span>
        </>
      )
    } catch {}
  }

  return highlightMatch(text, query)
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
      <mark className="log-highlight">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

function getLogLevelStyle(text: string): React.CSSProperties | undefined {
  const upper = text.toUpperCase()
  if (upper.includes('ERROR') || upper.includes('FATAL') || upper.includes('PANIC')) {
    return { color: '#e5564f' }
  }
  if (upper.includes('WARN')) {
    return { color: '#cc8d35' }
  }
  if (upper.includes('DEBUG') || upper.includes('TRACE')) {
    return { color: '#6e9fff', opacity: 0.7 }
  }
  return undefined
}
