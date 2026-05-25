import { Navbar, Button, Breadcrumbs, type BreadcrumbProps } from '@blueprintjs/core'

interface TopBarProps {
  breadcrumbs: BreadcrumbProps[]
  onCommandPalette: () => void
  darkMode: boolean
  onToggleDarkMode: () => void
}

export function TopBar({ breadcrumbs, onCommandPalette, darkMode, onToggleDarkMode }: TopBarProps) {
  return (
    <Navbar style={{ height: 44, display: 'flex', alignItems: 'center' }}>
      <Navbar.Group style={{ flex: 1 }}>
        <Breadcrumbs items={breadcrumbs} />
      </Navbar.Group>
      <Navbar.Group align="right" style={{ paddingRight: 8, gap: 2 }}>
        <Button minimal icon="search" text="Search... (Cmd+K)" onClick={onCommandPalette} />
        <Button minimal icon={darkMode ? 'flash' : 'moon'} onClick={onToggleDarkMode} />
      </Navbar.Group>
    </Navbar>
  )
}
