import { useState, useEffect, useRef } from 'react'
import { Dialog, InputGroup, Menu, MenuItem } from '@blueprintjs/core'
import type { K8sResource } from '../../shared/types'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  resources: K8sResource[]
  onSelect: (resource: K8sResource) => void
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
    if (e.key === 'ArrowDown') {
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

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      canOutsideClickClose
      canEscapeKeyClose
      style={{ width: 560, paddingBottom: 0, borderRadius: 8 }}
    >
      <div style={{ padding: 0 }}>
        <InputGroup
          inputRef={inputRef}
          leftIcon="search"
          placeholder="Search resources across all clusters..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          large
          style={{ borderRadius: '8px 8px 0 0' }}
        />
        {filtered.length > 0 && (
          <Menu style={{ maxHeight: 320, overflow: 'auto', borderRadius: '0 0 8px 8px' }}>
            {filtered.map((resource, i) => (
              <MenuItem
                key={resource.uid}
                text={resource.name}
                label={resource.cluster}
                icon={kindToIcon(resource.kind)}
                active={i === activeIndex}
                onClick={() => {
                  onSelect(resource)
                  onClose()
                }}
                roleStructure="listoption"
              />
            ))}
          </Menu>
        )}
        {query.length > 0 && filtered.length === 0 && (
          <div style={{ padding: '12px 16px', opacity: 0.5 }}>No matching resources</div>
        )}
      </div>
    </Dialog>
  )
}

function kindToIcon(kind: string): string {
  switch (kind) {
    case 'Pod':
      return 'cube'
    case 'Deployment':
      return 'layers'
    case 'Service':
      return 'globe-network'
    case 'Job':
      return 'play'
    case 'StatefulSet':
      return 'database'
    case 'DaemonSet':
      return 'grid-view'
    default:
      return 'box'
  }
}
