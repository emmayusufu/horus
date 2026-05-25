import { Navbar, Button, Breadcrumbs, type BreadcrumbProps } from '@blueprintjs/core'

interface TopBarProps {
  breadcrumbs: BreadcrumbProps[]
  onCommandPalette: () => void
  onSettings?: () => void
}

export function TopBar({ breadcrumbs, onCommandPalette, onSettings }: TopBarProps) {
  return (
    <Navbar style={{ height: 44, display: 'flex', alignItems: 'center' }}>
      <Navbar.Group style={{ flex: 1 }}>
        <Breadcrumbs items={breadcrumbs} />
      </Navbar.Group>
      <Navbar.Group align="right" style={{ paddingRight: 8 }}>
        <Button minimal icon="search" text="Search... (Cmd+K)" onClick={onCommandPalette} />
        {onSettings && <Button minimal icon="cog" onClick={onSettings} />}
      </Navbar.Group>
    </Navbar>
  )
}
