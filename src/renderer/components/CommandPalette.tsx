import { useState, useEffect, useRef } from 'react'
import type { K8sResource } from '../../shared/types'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  resources: K8sResource[]
  onSelect: (resource: K8sResource) => void
}

const HEALTH_DOT: Record<string, string> = {
  healthy: '#3d9a5f',
  warning: '#cc8d35',
  critical: '#e5564f',
  unknown: '#5f6b7c'
}

export function CommandPalette({ isOpen, onClose, resources, onSelect }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered =
    query.length > 0 ? resources.filter((r) => r.name.toLowerCase().includes(query.toLowerCase())).slice(0, 20) : []

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setActiveIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && filtered[activeIndex]) {
      onSelect(filtered[activeIndex])
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="horus-modal-overlay" onClick={onClose}>
      <div className="horus-modal palette-modal" style={{ width: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="palette-input-wrap">
          <svg width="16" height="16" viewBox="0 0 16 16" style={{ opacity: 0.4 }}>
            <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            className="palette-input"
            placeholder="Search resources across all clusters..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        {filtered.length > 0 && (
          <div className="palette-results">
            {filtered.map((resource, i) => (
              <div
                key={resource.uid}
                className={`palette-item ${i === activeIndex ? 'palette-item-active' : ''}`}
                onClick={() => { onSelect(resource); onClose() }}
                onMouseEnter={() => setActiveIndex(i)}
              >
                <span className="palette-dot" style={{ background: HEALTH_DOT[resource.health] ?? HEALTH_DOT.unknown }} />
                <span className="palette-icon">{kindToIcon(resource.kind)}</span>
                <span className="palette-name monospace">{resource.name}</span>
                <span className="palette-ns monospace">{resource.namespace}</span>
                <span className="palette-cluster">{resource.cluster}</span>
              </div>
            ))}
          </div>
        )}
        {query.length > 0 && filtered.length === 0 && (
          <div style={{ padding: '14px 18px', color: 'var(--text-muted)', fontSize: 13 }}>No matching resources</div>
        )}
      </div>
    </div>
  )
}

function kindToIcon(kind: string): string {
  switch (kind) {
    case 'Pod': return '■'
    case 'Deployment': return '▣'
    case 'Service': return '◉'
    case 'Job': return '▶'
    case 'StatefulSet': return '▦'
    case 'DaemonSet': return '▤'
    default: return '▫'
  }
}
