import { useState, useEffect, useCallback } from 'react'
import { TopBar } from './components/TopBar'
import { CommandPalette } from './components/CommandPalette'
import { Overview } from './views/Overview'
import { Explore } from './views/Explore'
import { Debug } from './views/Debug'
import { useResources } from './hooks/useResources'
import { useK8s } from './hooks/useK8s'
import type { K8sResource } from '../shared/types'

type View = { type: 'overview' } | { type: 'explore'; cluster: string } | { type: 'debug'; resource: K8sResource }

export function App() {
  const [view, setView] = useState<View>({ type: 'overview' })
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(true)

  useEffect(() => {
    document.body.classList.toggle('bp5-dark', darkMode)
    document.body.classList.toggle('horus-dark', darkMode)
    document.body.classList.toggle('horus-light', !darkMode)
  }, [darkMode])
  const { clusters, resourcesByCluster, allResources, unhealthy } = useResources()
  const k8s = useK8s()

  useEffect(() => {
    k8s.listContexts().then((contexts) => {
      for (const ctx of contexts) {
        k8s.connect(ctx)
      }
    })
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
      }
      if (e.key === 'Escape' && view.type !== 'overview') {
        if (view.type === 'debug') setView({ type: 'explore', cluster: view.resource.cluster })
        else setView({ type: 'overview' })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [view])

  const handleSelectResource = useCallback((resource: K8sResource) => {
    setView({ type: 'debug', resource })
  }, [])

  const handleNavigateOwner = useCallback(
    (ownerKind: string, ownerName: string, namespace: string, cluster: string) => {
      const resources = allResources()
      const owner = resources.find(
        (r) => r.kind === ownerKind && r.name === ownerName && r.namespace === namespace && r.cluster === cluster
      )
      if (owner) setView({ type: 'debug', resource: owner })
    },
    [allResources]
  )

  const breadcrumbs: { text: string; onClick?: () => void }[] = [
    { text: 'Horus', onClick: () => setView({ type: 'overview' }) }
  ]
  if (view.type === 'explore') {
    breadcrumbs.push({ text: view.cluster })
  }
  if (view.type === 'debug') {
    breadcrumbs.push({
      text: view.resource.cluster,
      onClick: () => setView({ type: 'explore', cluster: view.resource.cluster })
    })
    breadcrumbs.push({ text: view.resource.name })
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopBar breadcrumbs={breadcrumbs} onCommandPalette={() => setPaletteOpen(true)} darkMode={darkMode} onToggleDarkMode={() => setDarkMode(!darkMode)} />
      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        resources={allResources()}
        onSelect={handleSelectResource}
      />
      {view.type === 'overview' && (
        <Overview
          clusters={clusters}
          unhealthy={unhealthy()}
          allResources={allResources()}
          onSelectCluster={(name) => setView({ type: 'explore', cluster: name })}
          onSelectResource={handleSelectResource}
        />
      )}
      {view.type === 'explore' && (
        <Explore
          cluster={view.cluster}
          resources={resourcesByCluster.get(view.cluster) ?? []}
          onSelectResource={handleSelectResource}
        />
      )}
      {view.type === 'debug' && (
        <Debug
          resource={view.resource}
          onBack={() => setView({ type: 'explore', cluster: view.resource.cluster })}
          onNavigate={handleNavigateOwner}
        />
      )}
    </div>
  )
}
