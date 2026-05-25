import { useState } from 'react'
import { Navbar, Button, Breadcrumbs, Dialog, type BreadcrumbProps } from '@blueprintjs/core'

interface TopBarProps {
  breadcrumbs: BreadcrumbProps[]
  onCommandPalette: () => void
  darkMode: boolean
  onToggleDarkMode: () => void
}

const SHORTCUTS = [
  ['Cmd + K', 'Search resources'],
  ['Esc', 'Go back'],
  ['l', 'Toggle log follow'],
  ['/', 'Focus log search'],
  ['t', 'Toggle timestamps']
]

export function TopBar({ breadcrumbs, onCommandPalette, darkMode, onToggleDarkMode }: TopBarProps) {
  const [showHelp, setShowHelp] = useState(false)

  return (
    <>
      <Navbar style={{ height: 44, display: 'flex', alignItems: 'center' }}>
        <Navbar.Group style={{ flex: 1 }}>
          <Breadcrumbs items={breadcrumbs} />
        </Navbar.Group>
        <Navbar.Group align="right" style={{ paddingRight: 8, gap: 2 }}>
          <Button minimal icon="search" text="Search... (Cmd+K)" onClick={onCommandPalette} />
          <Button minimal icon="help" onClick={() => setShowHelp(true)} />
          <Button minimal icon={darkMode ? 'flash' : 'moon'} onClick={onToggleDarkMode} />
        </Navbar.Group>
      </Navbar>
      <Dialog isOpen={showHelp} onClose={() => setShowHelp(false)} title="Keyboard Shortcuts" style={{ width: 360 }}>
        <div style={{ padding: '12px 20px' }}>
          {SHORTCUTS.map(([key, desc]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{desc}</span>
              <kbd style={{
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                borderRadius: 4, padding: '2px 8px', fontSize: 12,
                fontFamily: "'Source Code Pro', monospace"
              }}>{key}</kbd>
            </div>
          ))}
        </div>
      </Dialog>
    </>
  )
}
