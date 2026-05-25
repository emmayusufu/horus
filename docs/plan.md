# Horus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a K8s incident debugger Electron desktop app that surfaces unhealthy resources and aggregates debugging context across multiple clusters.

**Architecture:** Electron main process holds K8s client connections, resource watchers, and an in-memory cache. A typed preload API (~10 methods) bridges to a React renderer with three views (Overview, Explore, Debug). Blueprint 6 provides desktop-optimized components.

**Tech Stack:** Electron 34+, React 19, Vite (via electron-vite), Blueprint 6, @kubernetes/client-node, Vitest, Playwright

---

## File Structure

```
horus/
├── package.json
├── electron.vite.config.ts
├── electron-builder.yml
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.web.json
├── src/
│   ├── main/
│   │   ├── index.ts              # App entry, window creation
│   │   ├── ipc.ts                # IPC handler registration
│   │   └── k8s/
│   │       ├── client.ts         # K8s client wrapper per cluster
│   │       ├── watcher.ts        # Watch API for resources + events
│   │       ├── cache.ts          # In-memory Map<cluster, Map<ns, resources>>
│   │       ├── health.ts         # Health scoring rules (pure functions)
│   │       ├── logs.ts           # Fetch container logs
│   │       ├── related.ts        # Find services, ingress, configmaps for a resource
│   │       ├── metrics.ts        # Metrics API (actual cpu/mem usage)
│   │       ├── helm.ts           # Helm label parsing + helm CLI
│   │       └── snapshot.ts       # Debug view -> markdown export
│   ├── preload/
│   │   └── index.ts              # contextBridge.exposeInMainWorld
│   ├── renderer/
│   │   ├── index.html
│   │   ├── main.tsx              # React entry
│   │   ├── App.tsx               # Root component, view routing
│   │   ├── App.scss              # Blueprint imports + global overrides
│   │   ├── hooks/
│   │   │   ├── useK8s.ts         # Typed wrapper around window.horus
│   │   │   └── useResources.ts   # Subscribe to resource-update events
│   │   ├── views/
│   │   │   ├── Overview.tsx
│   │   │   ├── Explore.tsx
│   │   │   └── Debug.tsx
│   │   └── components/
│   │       ├── TopBar.tsx         # Breadcrumb + Cmd+K trigger
│   │       ├── CommandPalette.tsx # Blueprint Omnibar
│   │       ├── ClusterCard.tsx    # Cluster health row
│   │       ├── Timeline.tsx       # Chronological events
│   │       ├── LogViewer.tsx      # Log display + prev toggle
│   │       ├── ResourceUsage.tsx  # Requests vs limits vs actual
│   │       ├── RelatedList.tsx    # Related resources
│   │       └── HelmBanner.tsx     # Helm release info
│   └── shared/
│       └── types.ts              # Types shared between main/preload/renderer
├── tests/
│   ├── health.test.ts
│   ├── cache.test.ts
│   ├── snapshot.test.ts
│   └── helm.test.ts
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `electron.vite.config.ts`
- Create: `electron-builder.yml`
- Create: `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`
- Create: `src/main/index.ts`
- Create: `src/preload/index.ts`
- Create: `src/renderer/index.html`
- Create: `src/renderer/main.tsx`
- Create: `src/renderer/App.tsx`
- Create: `src/renderer/App.scss`

- [ ] **Step 1: Initialize package.json**

```bash
cd /Users/emmanuelkimaswa/Desktop/horus
npm init -y
```

- [ ] **Step 2: Install dependencies**

```bash
npm install electron electron-vite vite @electron-toolkit/preload @electron-toolkit/utils --save-dev
npm install react react-dom @blueprintjs/core @blueprintjs/table @blueprintjs/select @blueprintjs/icons
npm install @types/react @types/react-dom typescript sass --save-dev
npm install @kubernetes/client-node
```

- [ ] **Step 3: Create electron.vite.config.ts**

```ts
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [react()],
    css: {
      preprocessorOptions: {
        scss: {}
      }
    }
  }
})
```

Also install the React Vite plugin:

```bash
npm install @vitejs/plugin-react --save-dev
```

- [ ] **Step 4: Create tsconfig.json**

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.web.json" }
  ]
}
```

- [ ] **Step 5: Create tsconfig.node.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "./out",
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src/main/**/*", "src/preload/**/*", "src/shared/**/*", "electron.vite.config.ts"]
}
```

- [ ] **Step 6: Create tsconfig.web.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "esModuleInterop": true,
    "outDir": "./out",
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["src/renderer/**/*", "src/shared/**/*"]
}
```

- [ ] **Step 7: Create src/renderer/index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Horus</title>
  </head>
  <body class="bp5-dark">
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 8: Create src/renderer/App.scss**

```scss
@import "@blueprintjs/core/lib/css/blueprint.css";
@import "@blueprintjs/table/lib/css/table.css";
@import "@blueprintjs/icons/lib/css/blueprint-icons.css";

html, body, #root {
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

#root {
  display: flex;
  flex-direction: column;
}

.monospace {
  font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
  font-size: 12px;
}
```

- [ ] **Step 9: Create src/renderer/main.tsx**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './App.scss'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

- [ ] **Step 10: Create src/renderer/App.tsx**

```tsx
import { useState } from 'react'

type View = 'overview' | 'explore' | 'debug'

export function App() {
  const [view, setView] = useState<View>('overview')

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 16 }}>
        <h1 className="bp5-heading">Horus</h1>
        <p className="bp5-text-muted">K8s Incident Debugger</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 11: Create src/preload/index.ts (minimal stub)**

```ts
import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('horus', {
  ping: () => 'pong'
})
```

- [ ] **Step 12: Create src/main/index.ts**

```ts
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
```

- [ ] **Step 13: Add scripts to package.json**

Add to package.json:
```json
{
  "main": "./out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 14: Create electron-builder.yml**

```yaml
appId: com.horus.app
productName: Horus
directories:
  buildResources: build
files:
  - "!**/.vscode/*"
  - "!src/*"
  - "!tests/*"
  - "!electron.vite.config.*"
  - "!{tsconfig,tsconfig.*}.json"
mac:
  target:
    - dmg
    - zip
  artifactName: ${name}-${version}-${arch}.${ext}
linux:
  target:
    - AppImage
    - deb
  artifactName: ${name}-${version}-${arch}.${ext}
win:
  target:
    - nsis
  artifactName: ${name}-${version}-setup.${ext}
```

- [ ] **Step 15: Run dev to verify the shell works**

```bash
npm run dev
```

Expected: Electron window opens with "Horus" heading and "K8s Incident Debugger" subtitle on a dark Blueprint background.

- [ ] **Step 16: Commit**

```bash
git add -A
git commit -m "feat: scaffold Electron + React + Blueprint app shell"
```

---

## Task 2: Shared Types

**Files:**
- Create: `src/shared/types.ts`

- [ ] **Step 1: Define all shared types**

```ts
export type HealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown'

export type ResourceKind =
  | 'Pod'
  | 'Deployment'
  | 'StatefulSet'
  | 'DaemonSet'
  | 'Job'
  | 'Service'
  | 'Ingress'
  | 'ConfigMap'
  | 'Secret'

export interface K8sResource {
  uid: string
  name: string
  namespace: string
  kind: ResourceKind
  cluster: string
  status: string
  health: HealthStatus
  restarts: number
  age: string
  node: string
  labels: Record<string, string>
  ownerKind?: string
  ownerName?: string
}

export interface ClusterInfo {
  name: string
  connected: boolean
  error?: string
  resourceCounts: { total: number; healthy: number; warning: number; critical: number }
  cpuPercent?: number
  memPercent?: number
}

export interface K8sEvent {
  timestamp: string
  type: string
  reason: string
  message: string
  involvedObject: string
}

export interface ContainerLogs {
  containerName: string
  current: string
  previous?: string
}

export interface ResourceDetail {
  resource: K8sResource
  events: K8sEvent[]
  logs: ContainerLogs[]
  resources: {
    cpuRequest?: string
    cpuLimit?: string
    cpuActual?: string
    memRequest?: string
    memLimit?: string
    memActual?: string
    metricsAvailable: boolean
  }
  related: RelatedResource[]
  helm?: HelmInfo
}

export interface RelatedResource {
  kind: string
  name: string
  detail: string
}

export interface HelmInfo {
  chart: string
  version: string
  revision: number
  managedBy: string
}

export interface ResourceUpdate {
  cluster: string
  resources: K8sResource[]
  clusterInfo: ClusterInfo
}

export interface HorusAPI {
  listContexts: () => Promise<string[]>
  connect: (context: string) => Promise<ClusterInfo>
  disconnect: (context: string) => Promise<void>
  onResourceUpdate: (callback: (update: ResourceUpdate) => void) => () => void
  getLogs: (cluster: string, namespace: string, pod: string) => Promise<ContainerLogs[]>
  getEvents: (cluster: string, namespace: string, name: string) => Promise<K8sEvent[]>
  getRelated: (cluster: string, namespace: string, name: string, kind: string) => Promise<RelatedResource[]>
  getHelmInfo: (cluster: string, namespace: string, labels: Record<string, string>) => Promise<HelmInfo | null>
  getResourceDetail: (cluster: string, namespace: string, name: string, kind: string) => Promise<ResourceDetail>
  exportSnapshot: (detail: ResourceDetail) => Promise<string>
}
```

- [ ] **Step 2: Add type declaration for renderer window**

Append to `src/shared/types.ts`:

```ts
declare global {
  interface Window {
    horus: HorusAPI
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add shared types for IPC contract"
```

---

## Task 3: Health Scorer (TDD)

**Files:**
- Create: `src/main/k8s/health.ts`
- Create: `tests/health.test.ts`

- [ ] **Step 1: Install vitest**

```bash
npm install vitest --save-dev
```

- [ ] **Step 2: Write failing tests**

```ts
// tests/health.test.ts
import { describe, it, expect } from 'vitest'
import { scoreHealth } from '../src/main/k8s/health'

describe('scoreHealth', () => {
  it('returns critical for CrashLoopBackOff', () => {
    expect(scoreHealth('Pod', 'CrashLoopBackOff', false, 0)).toBe('critical')
  })

  it('returns critical for OOMKilled', () => {
    expect(scoreHealth('Pod', 'OOMKilled', false, 0)).toBe('critical')
  })

  it('returns critical for ImagePullBackOff', () => {
    expect(scoreHealth('Pod', 'ImagePullBackOff', false, 0)).toBe('critical')
  })

  it('returns critical for Evicted', () => {
    expect(scoreHealth('Pod', 'Evicted', false, 0)).toBe('critical')
  })

  it('returns critical for failed jobs', () => {
    expect(scoreHealth('Job', 'Failed', false, 0)).toBe('critical')
  })

  it('returns healthy for running and ready pods', () => {
    expect(scoreHealth('Pod', 'Running', true, 0)).toBe('healthy')
  })

  it('returns warning for running but not ready pods', () => {
    expect(scoreHealth('Pod', 'Running', false, 0)).toBe('warning')
  })

  it('returns warning for Pending pods', () => {
    expect(scoreHealth('Pod', 'Pending', false, 0)).toBe('warning')
  })

  it('returns healthy for completed jobs', () => {
    expect(scoreHealth('Job', 'Complete', false, 0)).toBe('healthy')
  })

  it('returns healthy for succeeded pods', () => {
    expect(scoreHealth('Pod', 'Succeeded', false, 0)).toBe('healthy')
  })

  it('returns warning for pods with high restart count', () => {
    expect(scoreHealth('Pod', 'Running', true, 10)).toBe('warning')
  })

  it('returns unknown for unrecognized status', () => {
    expect(scoreHealth('Pod', 'SomethingWeird', false, 0)).toBe('unknown')
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx vitest run tests/health.test.ts
```

Expected: FAIL — `scoreHealth` not found.

- [ ] **Step 4: Implement health scorer**

```ts
// src/main/k8s/health.ts
import type { HealthStatus } from '../../shared/types'

const CRITICAL_STATUSES = new Set([
  'CrashLoopBackOff',
  'OOMKilled',
  'ImagePullBackOff',
  'Evicted',
  'Error',
  'CreateContainerConfigError',
  'InvalidImageName',
  'ErrImagePull'
])

const TERMINAL_HEALTHY = new Set(['Complete', 'Succeeded'])

export function scoreHealth(
  kind: string,
  status: string,
  ready: boolean,
  restarts: number
): HealthStatus {
  if (CRITICAL_STATUSES.has(status)) return 'critical'
  if (kind === 'Job' && status === 'Failed') return 'critical'
  if (TERMINAL_HEALTHY.has(status)) return 'healthy'
  if (status === 'Running' && ready && restarts < 5) return 'healthy'
  if (status === 'Running' && ready && restarts >= 5) return 'warning'
  if (status === 'Running' && !ready) return 'warning'
  if (status === 'Pending') return 'warning'
  return 'unknown'
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run tests/health.test.ts
```

Expected: All 12 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/k8s/health.ts tests/health.test.ts
git commit -m "feat: add health scorer with TDD"
```

---

## Task 4: Resource Cache (TDD)

**Files:**
- Create: `src/main/k8s/cache.ts`
- Create: `tests/cache.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/cache.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { ResourceCache } from '../src/main/k8s/cache'
import type { K8sResource } from '../src/shared/types'

function makePod(overrides: Partial<K8sResource> = {}): K8sResource {
  return {
    uid: 'uid-1',
    name: 'test-pod',
    namespace: 'default',
    kind: 'Pod',
    cluster: 'cluster-a',
    status: 'Running',
    health: 'healthy',
    restarts: 0,
    age: '1h',
    node: 'node-01',
    labels: {},
    ...overrides
  }
}

describe('ResourceCache', () => {
  let cache: ResourceCache

  beforeEach(() => {
    cache = new ResourceCache()
  })

  it('sets and gets resources for a cluster', () => {
    const pod = makePod()
    cache.set('cluster-a', [pod])
    expect(cache.getAll('cluster-a')).toEqual([pod])
  })

  it('returns empty array for unknown cluster', () => {
    expect(cache.getAll('unknown')).toEqual([])
  })

  it('filters by namespace', () => {
    const podA = makePod({ uid: '1', namespace: 'payments' })
    const podB = makePod({ uid: '2', namespace: 'default' })
    cache.set('cluster-a', [podA, podB])
    expect(cache.getByNamespace('cluster-a', 'payments')).toEqual([podA])
  })

  it('returns unhealthy resources sorted critical first', () => {
    const healthy = makePod({ uid: '1', health: 'healthy' })
    const warning = makePod({ uid: '2', health: 'warning' })
    const critical = makePod({ uid: '3', health: 'critical' })
    cache.set('cluster-a', [healthy, warning, critical])
    const result = cache.getUnhealthy('cluster-a')
    expect(result).toEqual([critical, warning])
  })

  it('returns all unhealthy across clusters', () => {
    cache.set('cluster-a', [makePod({ uid: '1', health: 'critical', cluster: 'cluster-a' })])
    cache.set('cluster-b', [makePod({ uid: '2', health: 'warning', cluster: 'cluster-b' })])
    expect(cache.getAllUnhealthy()).toHaveLength(2)
  })

  it('clears a cluster', () => {
    cache.set('cluster-a', [makePod()])
    cache.clear('cluster-a')
    expect(cache.getAll('cluster-a')).toEqual([])
  })

  it('searches by name across clusters', () => {
    cache.set('cluster-a', [makePod({ uid: '1', name: 'payment-svc-abc' })])
    cache.set('cluster-b', [makePod({ uid: '2', name: 'cart-svc-xyz' })])
    expect(cache.search('payment')).toHaveLength(1)
    expect(cache.search('payment')[0].name).toBe('payment-svc-abc')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/cache.test.ts
```

Expected: FAIL — `ResourceCache` not found.

- [ ] **Step 3: Implement cache**

```ts
// src/main/k8s/cache.ts
import type { K8sResource } from '../../shared/types'

const HEALTH_ORDER = { critical: 0, warning: 1, unknown: 2, healthy: 3 }

export class ResourceCache {
  private store = new Map<string, K8sResource[]>()

  set(cluster: string, resources: K8sResource[]): void {
    this.store.set(cluster, resources)
  }

  getAll(cluster: string): K8sResource[] {
    return this.store.get(cluster) ?? []
  }

  getByNamespace(cluster: string, namespace: string): K8sResource[] {
    return this.getAll(cluster).filter((r) => r.namespace === namespace)
  }

  getUnhealthy(cluster: string): K8sResource[] {
    return this.getAll(cluster)
      .filter((r) => r.health !== 'healthy')
      .sort((a, b) => HEALTH_ORDER[a.health] - HEALTH_ORDER[b.health])
  }

  getAllUnhealthy(): K8sResource[] {
    const result: K8sResource[] = []
    for (const resources of this.store.values()) {
      result.push(...resources.filter((r) => r.health !== 'healthy'))
    }
    return result.sort((a, b) => HEALTH_ORDER[a.health] - HEALTH_ORDER[b.health])
  }

  search(query: string): K8sResource[] {
    const lower = query.toLowerCase()
    const result: K8sResource[] = []
    for (const resources of this.store.values()) {
      result.push(...resources.filter((r) => r.name.toLowerCase().includes(lower)))
    }
    return result
  }

  clear(cluster: string): void {
    this.store.delete(cluster)
  }

  clusters(): string[] {
    return [...this.store.keys()]
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/cache.test.ts
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/k8s/cache.ts tests/cache.test.ts
git commit -m "feat: add resource cache with search and health filtering"
```

---

## Task 5: Snapshot Export (TDD)

**Files:**
- Create: `src/main/k8s/snapshot.ts`
- Create: `tests/snapshot.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/snapshot.test.ts
import { describe, it, expect } from 'vitest'
import { generateSnapshot } from '../src/main/k8s/snapshot'
import type { ResourceDetail } from '../src/shared/types'

function makeDetail(overrides: Partial<ResourceDetail> = {}): ResourceDetail {
  return {
    resource: {
      uid: '1',
      name: 'payment-svc-abc',
      namespace: 'payments',
      kind: 'Pod',
      cluster: 'cluster-prod-us',
      status: 'CrashLoopBackOff',
      health: 'critical',
      restarts: 14,
      age: '2h',
      node: 'node-03',
      labels: {},
      ownerKind: 'Deployment',
      ownerName: 'payment-svc'
    },
    events: [
      { timestamp: '14:02', type: 'Normal', reason: 'Created', message: 'Created container', involvedObject: 'pod/payment-svc-abc' },
      { timestamp: '14:05', type: 'Warning', reason: 'BackOff', message: 'Back-off restarting', involvedObject: 'pod/payment-svc-abc' }
    ],
    logs: [{ containerName: 'main', current: 'Error: ECONNREFUSED\nRetrying...', previous: 'OOM killed' }],
    resources: {
      cpuRequest: '250m',
      cpuLimit: '500m',
      memRequest: '256Mi',
      memLimit: '512Mi',
      metricsAvailable: false
    },
    related: [
      { kind: 'Service', name: 'payment-svc', detail: '0/4 endpoints ready' }
    ],
    helm: { chart: 'payment', version: '2.3.1', revision: 14, managedBy: 'Helm' },
    ...overrides
  }
}

describe('generateSnapshot', () => {
  it('generates valid markdown', () => {
    const md = generateSnapshot(makeDetail())
    expect(md).toContain('# Horus Debug Snapshot')
    expect(md).toContain('payment-svc-abc')
    expect(md).toContain('cluster-prod-us')
    expect(md).toContain('payments')
  })

  it('includes timeline events', () => {
    const md = generateSnapshot(makeDetail())
    expect(md).toContain('14:02')
    expect(md).toContain('Created')
    expect(md).toContain('BackOff')
  })

  it('includes logs', () => {
    const md = generateSnapshot(makeDetail())
    expect(md).toContain('ECONNREFUSED')
  })

  it('includes resource usage', () => {
    const md = generateSnapshot(makeDetail())
    expect(md).toContain('250m')
    expect(md).toContain('512Mi')
  })

  it('shows metrics unavailable when not available', () => {
    const md = generateSnapshot(makeDetail())
    expect(md).toContain('unavailable')
  })

  it('includes related resources', () => {
    const md = generateSnapshot(makeDetail())
    expect(md).toContain('payment-svc')
    expect(md).toContain('0/4 endpoints ready')
  })

  it('includes helm info when present', () => {
    const md = generateSnapshot(makeDetail())
    expect(md).toContain('payment')
    expect(md).toContain('2.3.1')
  })

  it('omits helm section when no helm info', () => {
    const md = generateSnapshot(makeDetail({ helm: undefined }))
    expect(md).not.toContain('Helm Release')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/snapshot.test.ts
```

- [ ] **Step 3: Implement snapshot generator**

```ts
// src/main/k8s/snapshot.ts
import type { ResourceDetail } from '../../shared/types'

export function generateSnapshot(detail: ResourceDetail): string {
  const { resource, events, logs, resources, related, helm } = detail
  const now = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z/, ' UTC')

  const lines: string[] = [
    '# Horus Debug Snapshot',
    `**Resource:** ${resource.name}`,
    `**Cluster:** ${resource.cluster}`,
    `**Namespace:** ${resource.namespace}`,
    `**Captured:** ${now}`,
    '',
    '## Status',
    `${resource.status} | ${resource.restarts} restarts | Node: ${resource.node}`,
    ''
  ]

  if (resource.ownerKind && resource.ownerName) {
    lines.push(`**Owner:** ${resource.ownerKind}/${resource.ownerName}`)
    lines.push('')
  }

  lines.push('## Timeline')
  for (const event of events) {
    lines.push(`- ${event.timestamp}  ${event.reason}: ${event.message}`)
  }
  lines.push('')

  lines.push('## Logs')
  for (const log of logs) {
    lines.push(`### Container: ${log.containerName}`)
    lines.push('```')
    lines.push(log.current)
    lines.push('```')
    if (log.previous) {
      lines.push('### Previous container')
      lines.push('```')
      lines.push(log.previous)
      lines.push('```')
    }
  }
  lines.push('')

  lines.push('## Resources')
  lines.push(`cpu request: ${resources.cpuRequest ?? 'none'} | limit: ${resources.cpuLimit ?? 'none'} | actual: ${resources.cpuActual ?? (resources.metricsAvailable ? 'n/a' : 'metrics unavailable')}`)
  lines.push(`mem request: ${resources.memRequest ?? 'none'} | limit: ${resources.memLimit ?? 'none'} | actual: ${resources.memActual ?? (resources.metricsAvailable ? 'n/a' : 'metrics unavailable')}`)
  lines.push('')

  lines.push('## Related Resources')
  for (const r of related) {
    lines.push(`- ${r.kind}: ${r.name} (${r.detail})`)
  }
  lines.push('')

  if (helm) {
    lines.push('## Helm Release')
    lines.push(`Chart: ${helm.chart} v${helm.version} | Revision: ${helm.revision}`)
    lines.push('')
  }

  return lines.join('\n')
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/snapshot.test.ts
```

Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/k8s/snapshot.ts tests/snapshot.test.ts
git commit -m "feat: add markdown snapshot generator with TDD"
```

---

## Task 6: Helm Label Parser (TDD)

**Files:**
- Create: `src/main/k8s/helm.ts`
- Create: `tests/helm.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/helm.test.ts
import { describe, it, expect } from 'vitest'
import { parseHelmLabels } from '../src/main/k8s/helm'

describe('parseHelmLabels', () => {
  it('returns null for non-Helm resources', () => {
    expect(parseHelmLabels({})).toBeNull()
    expect(parseHelmLabels({ 'app': 'test' })).toBeNull()
  })

  it('parses standard Helm labels', () => {
    const labels = {
      'app.kubernetes.io/managed-by': 'Helm',
      'helm.sh/chart': 'payment-2.3.1',
      'app.kubernetes.io/version': '1.0.0'
    }
    const result = parseHelmLabels(labels)
    expect(result).not.toBeNull()
    expect(result!.managedBy).toBe('Helm')
    expect(result!.chart).toBe('payment')
    expect(result!.version).toBe('2.3.1')
  })

  it('handles chart label without version suffix', () => {
    const labels = {
      'app.kubernetes.io/managed-by': 'Helm',
      'helm.sh/chart': 'myapp'
    }
    const result = parseHelmLabels(labels)
    expect(result).not.toBeNull()
    expect(result!.chart).toBe('myapp')
    expect(result!.version).toBe('unknown')
  })

  it('defaults revision to 0', () => {
    const labels = { 'app.kubernetes.io/managed-by': 'Helm' }
    const result = parseHelmLabels(labels)
    expect(result!.revision).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/helm.test.ts
```

- [ ] **Step 3: Implement Helm label parser**

```ts
// src/main/k8s/helm.ts
import type { HelmInfo } from '../../shared/types'

export function parseHelmLabels(labels: Record<string, string>): HelmInfo | null {
  const managedBy = labels['app.kubernetes.io/managed-by']
  if (managedBy !== 'Helm') return null

  const chartLabel = labels['helm.sh/chart'] ?? ''
  const lastDash = chartLabel.lastIndexOf('-')
  const hasVersion = lastDash > 0 && /^\d/.test(chartLabel.slice(lastDash + 1))

  const chart = hasVersion ? chartLabel.slice(0, lastDash) : chartLabel || 'unknown'
  const version = hasVersion ? chartLabel.slice(lastDash + 1) : 'unknown'

  return { chart, version, revision: 0, managedBy }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/helm.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/k8s/helm.ts tests/helm.test.ts
git commit -m "feat: add Helm label parser with TDD"
```

---

## Task 7: K8s Client + Watcher

**Files:**
- Create: `src/main/k8s/client.ts`
- Create: `src/main/k8s/watcher.ts`

- [ ] **Step 1: Create the K8s client wrapper**

```ts
// src/main/k8s/client.ts
import * as k8s from '@kubernetes/client-node'

export interface ClusterClient {
  context: string
  coreApi: k8s.CoreV1Api
  appsApi: k8s.AppsV1Api
  batchApi: k8s.BatchV1Api
  networkApi: k8s.NetworkingV1Api
  metricsAvailable: boolean
}

const clients = new Map<string, ClusterClient>()

export function loadContexts(): string[] {
  const kc = new k8s.KubeConfig()
  kc.loadFromDefault()
  return kc.contexts.map((c) => c.name)
}

export function connectCluster(context: string): ClusterClient {
  if (clients.has(context)) return clients.get(context)!

  const kc = new k8s.KubeConfig()
  kc.loadFromDefault()
  kc.setCurrentContext(context)

  const client: ClusterClient = {
    context,
    coreApi: kc.makeApiClient(k8s.CoreV1Api),
    appsApi: kc.makeApiClient(k8s.AppsV1Api),
    batchApi: kc.makeApiClient(k8s.BatchV1Api),
    networkApi: kc.makeApiClient(k8s.NetworkingV1Api),
    metricsAvailable: false
  }

  clients.set(context, client)
  return client
}

export function disconnectCluster(context: string): void {
  clients.delete(context)
}

export function getClient(context: string): ClusterClient | undefined {
  return clients.get(context)
}

export function getKubeConfig(context: string): k8s.KubeConfig {
  const kc = new k8s.KubeConfig()
  kc.loadFromDefault()
  kc.setCurrentContext(context)
  return kc
}
```

- [ ] **Step 2: Create the resource watcher**

```ts
// src/main/k8s/watcher.ts
import * as k8s from '@kubernetes/client-node'
import type { K8sResource } from '../../shared/types'
import { scoreHealth } from './health'
import { parseHelmLabels } from './helm'
import { getKubeConfig } from './client'

export type WatchCallback = (resources: K8sResource[]) => void

interface ActiveWatch {
  abort: AbortController
}

const activeWatches = new Map<string, ActiveWatch[]>()

function podToResource(pod: k8s.V1Pod, cluster: string): K8sResource {
  const status = pod.status?.containerStatuses?.[0]?.state?.waiting?.reason
    ?? pod.status?.phase
    ?? 'Unknown'
  const ready = pod.status?.conditions?.some((c) => c.type === 'Ready' && c.status === 'True') ?? false
  const restarts = pod.status?.containerStatuses?.reduce((sum, c) => sum + (c.restartCount ?? 0), 0) ?? 0
  const owner = pod.metadata?.ownerReferences?.[0]

  return {
    uid: pod.metadata?.uid ?? '',
    name: pod.metadata?.name ?? '',
    namespace: pod.metadata?.namespace ?? '',
    kind: 'Pod',
    cluster,
    status,
    health: scoreHealth('Pod', status, ready, restarts),
    restarts,
    age: pod.metadata?.creationTimestamp?.toISOString() ?? '',
    node: pod.spec?.nodeName ?? '',
    labels: pod.metadata?.labels ?? {},
    ownerKind: owner?.kind,
    ownerName: owner?.name
  }
}

function deploymentToResource(dep: k8s.V1Deployment, cluster: string): K8sResource {
  const available = dep.status?.conditions?.find((c) => c.type === 'Available')
  const status = available?.status === 'True' ? 'Available' : 'Progressing'
  const ready = available?.status === 'True'

  return {
    uid: dep.metadata?.uid ?? '',
    name: dep.metadata?.name ?? '',
    namespace: dep.metadata?.namespace ?? '',
    kind: 'Deployment',
    cluster,
    status,
    health: ready ? 'healthy' : 'warning',
    restarts: 0,
    age: dep.metadata?.creationTimestamp?.toISOString() ?? '',
    node: '',
    labels: dep.metadata?.labels ?? {},
    ownerKind: undefined,
    ownerName: undefined
  }
}

function jobToResource(job: k8s.V1Job, cluster: string): K8sResource {
  const failed = job.status?.conditions?.find((c) => c.type === 'Failed' && c.status === 'True')
  const complete = job.status?.conditions?.find((c) => c.type === 'Complete' && c.status === 'True')
  const status = failed ? 'Failed' : complete ? 'Complete' : 'Running'

  return {
    uid: job.metadata?.uid ?? '',
    name: job.metadata?.name ?? '',
    namespace: job.metadata?.namespace ?? '',
    kind: 'Job',
    cluster,
    status,
    health: scoreHealth('Job', status, false, 0),
    restarts: 0,
    age: job.metadata?.creationTimestamp?.toISOString() ?? '',
    node: '',
    labels: job.metadata?.labels ?? {},
    ownerKind: undefined,
    ownerName: undefined
  }
}

export async function startWatching(
  context: string,
  onUpdate: WatchCallback
): Promise<void> {
  const kc = getKubeConfig(context)
  const coreApi = kc.makeApiClient(k8s.CoreV1Api)
  const appsApi = kc.makeApiClient(k8s.AppsV1Api)
  const batchApi = kc.makeApiClient(k8s.BatchV1Api)

  const resources: Map<string, K8sResource> = new Map()

  const emitUpdate = () => {
    onUpdate([...resources.values()])
  }

  try {
    const [pods, deployments, jobs] = await Promise.all([
      coreApi.listPodForAllNamespaces(),
      appsApi.listDeploymentForAllNamespaces(),
      batchApi.listJobForAllNamespaces()
    ])

    for (const pod of pods.items) {
      const r = podToResource(pod, context)
      resources.set(r.uid, r)
    }
    for (const dep of deployments.items) {
      const r = deploymentToResource(dep, context)
      resources.set(r.uid, r)
    }
    for (const job of jobs.items) {
      const r = jobToResource(job, context)
      resources.set(r.uid, r)
    }

    emitUpdate()
  } catch (err) {
    console.error(`Failed initial list for ${context}:`, err)
  }

  const watch = new k8s.Watch(kc)
  const watches: ActiveWatch[] = []

  const watchPath = async (path: string, toResource: (obj: any) => K8sResource) => {
    const abort = new AbortController()
    watches.push({ abort })

    try {
      await watch.watch(
        path,
        {},
        (type: string, obj: any) => {
          const r = toResource(obj)
          if (type === 'DELETED') {
            resources.delete(r.uid)
          } else {
            resources.set(r.uid, r)
          }
          emitUpdate()
        },
        (err: any) => {
          if (err) console.error(`Watch error on ${path}:`, err)
        }
      )
    } catch (err) {
      console.error(`Failed to watch ${path}:`, err)
    }
  }

  watchPath('/api/v1/pods', (obj) => podToResource(obj, context))
  watchPath('/apis/apps/v1/deployments', (obj) => deploymentToResource(obj, context))
  watchPath('/apis/batch/v1/jobs', (obj) => jobToResource(obj, context))

  activeWatches.set(context, watches)
}

export function stopWatching(context: string): void {
  const watches = activeWatches.get(context)
  if (watches) {
    for (const w of watches) {
      w.abort.abort()
    }
    activeWatches.delete(context)
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/main/k8s/client.ts src/main/k8s/watcher.ts
git commit -m "feat: add K8s client wrapper and resource watcher"
```

---

## Task 8: On-Demand K8s Data (logs, events, related, metrics)

**Files:**
- Create: `src/main/k8s/logs.ts`
- Create: `src/main/k8s/related.ts`
- Create: `src/main/k8s/metrics.ts`

- [ ] **Step 1: Create log fetcher**

```ts
// src/main/k8s/logs.ts
import type { ContainerLogs } from '../../shared/types'
import { getClient } from './client'

export async function fetchLogs(
  context: string,
  namespace: string,
  podName: string
): Promise<ContainerLogs[]> {
  const client = getClient(context)
  if (!client) throw new Error(`Not connected to ${context}`)

  const pod = await client.coreApi.readNamespacedPod({ name: podName, namespace })
  const containers = pod.spec?.containers ?? []
  const results: ContainerLogs[] = []

  for (const container of containers) {
    let current = ''
    let previous: string | undefined

    try {
      current = await client.coreApi.readNamespacedPodLog({
        name: podName,
        namespace,
        container: container.name,
        tailLines: 200
      })
    } catch {
      current = '(no logs available)'
    }

    try {
      previous = await client.coreApi.readNamespacedPodLog({
        name: podName,
        namespace,
        container: container.name,
        previous: true,
        tailLines: 200
      })
    } catch {
      // no previous container
    }

    results.push({ containerName: container.name, current, previous })
  }

  return results
}
```

- [ ] **Step 2: Create related resource finder**

```ts
// src/main/k8s/related.ts
import type { RelatedResource } from '../../shared/types'
import { getClient } from './client'

export async function fetchRelated(
  context: string,
  namespace: string,
  name: string,
  kind: string
): Promise<RelatedResource[]> {
  const client = getClient(context)
  if (!client) throw new Error(`Not connected to ${context}`)

  const related: RelatedResource[] = []

  if (kind === 'Pod') {
    const pod = await client.coreApi.readNamespacedPod({ name, namespace })
    const podLabels = pod.metadata?.labels ?? {}

    try {
      const services = await client.coreApi.listNamespacedService({ namespace })
      for (const svc of services.items) {
        const selector = svc.spec?.selector ?? {}
        const matches = Object.entries(selector).every(([k, v]) => podLabels[k] === v)
        if (matches) {
          const endpoints = await client.coreApi.readNamespacedEndpoints({ name: svc.metadata!.name!, namespace })
          const readyCount = endpoints.subsets?.reduce((sum, s) => sum + (s.addresses?.length ?? 0), 0) ?? 0
          const totalCount = readyCount + (endpoints.subsets?.reduce((sum, s) => sum + (s.notReadyAddresses?.length ?? 0), 0) ?? 0)
          related.push({
            kind: 'Service',
            name: svc.metadata!.name!,
            detail: `${readyCount}/${totalCount} endpoints ready`
          })
        }
      }
    } catch { /* no services */ }

    try {
      const ingresses = await client.networkApi.listNamespacedIngress({ namespace })
      for (const ing of ingresses.items) {
        const rules = ing.spec?.rules ?? []
        for (const rule of rules) {
          const paths = rule.http?.paths ?? []
          for (const path of paths) {
            const backend = path.backend?.service?.name
            if (backend && related.some((r) => r.kind === 'Service' && r.name === backend)) {
              related.push({
                kind: 'Ingress',
                name: ing.metadata!.name!,
                detail: `${rule.host ?? '*'}${path.path ?? '/'} -> ${backend}`
              })
            }
          }
        }
      }
    } catch { /* no ingress */ }

    try {
      const configMaps = await client.coreApi.listNamespacedConfigMap({ namespace })
      const podCmRefs = new Set<string>()
      for (const env of pod.spec?.containers?.flatMap((c) => c.envFrom ?? []) ?? []) {
        if (env.configMapRef?.name) podCmRefs.add(env.configMapRef.name)
      }
      for (const env of pod.spec?.containers?.flatMap((c) => c.env ?? []) ?? []) {
        if (env.valueFrom?.configMapKeyRef?.name) podCmRefs.add(env.valueFrom.configMapKeyRef.name)
      }
      for (const vol of pod.spec?.volumes ?? []) {
        if (vol.configMap?.name) podCmRefs.add(vol.configMap.name)
      }

      for (const cm of configMaps.items) {
        if (podCmRefs.has(cm.metadata!.name!)) {
          const keys = Object.keys(cm.data ?? {})
          const preview = keys.slice(0, 3).join(', ')
          related.push({
            kind: 'ConfigMap',
            name: cm.metadata!.name!,
            detail: preview + (keys.length > 3 ? ` +${keys.length - 3} more` : '')
          })
        }
      }
    } catch { /* no configmaps */ }

    try {
      const secrets = await client.coreApi.listNamespacedSecret({ namespace })
      const podSecretRefs = new Set<string>()
      for (const env of pod.spec?.containers?.flatMap((c) => c.envFrom ?? []) ?? []) {
        if (env.secretRef?.name) podSecretRefs.add(env.secretRef.name)
      }
      for (const env of pod.spec?.containers?.flatMap((c) => c.env ?? []) ?? []) {
        if (env.valueFrom?.secretKeyRef?.name) podSecretRefs.add(env.valueFrom.secretKeyRef.name)
      }
      for (const vol of pod.spec?.volumes ?? []) {
        if (vol.secret?.secretName) podSecretRefs.add(vol.secret.secretName)
      }

      for (const secret of secrets.items) {
        if (podSecretRefs.has(secret.metadata!.name!)) {
          const keyCount = Object.keys(secret.data ?? {}).length
          related.push({
            kind: 'Secret',
            name: secret.metadata!.name!,
            detail: `${keyCount} keys, values hidden`
          })
        }
      }
    } catch { /* no secrets */ }
  }

  return related
}
```

- [ ] **Step 3: Create metrics fetcher**

```ts
// src/main/k8s/metrics.ts
import * as k8s from '@kubernetes/client-node'
import { getKubeConfig, getClient } from './client'

interface PodMetrics {
  cpuActual: string
  memActual: string
}

export async function checkMetricsAvailable(context: string): Promise<boolean> {
  try {
    const kc = getKubeConfig(context)
    const metricsClient = new k8s.Metrics(kc)
    await metricsClient.getNodeMetrics()
    const client = getClient(context)
    if (client) client.metricsAvailable = true
    return true
  } catch {
    return false
  }
}

export async function fetchPodMetrics(
  context: string,
  namespace: string,
  podName: string
): Promise<PodMetrics | null> {
  try {
    const kc = getKubeConfig(context)
    const metricsClient = new k8s.Metrics(kc)
    const metrics = await metricsClient.getPodMetrics(namespace)
    const podMetric = metrics.items.find((m) => m.metadata?.name === podName)
    if (!podMetric) return null

    const containers = podMetric.containers ?? []
    let totalCpu = 0
    let totalMem = 0
    for (const c of containers) {
      const cpu = c.usage?.cpu ?? '0'
      const mem = c.usage?.memory ?? '0'
      totalCpu += parseCpuToMillicores(cpu)
      totalMem += parseMemToMi(mem)
    }

    return {
      cpuActual: `${totalCpu}m`,
      memActual: `${totalMem}Mi`
    }
  } catch {
    return null
  }
}

function parseCpuToMillicores(cpu: string): number {
  if (cpu.endsWith('n')) return Math.round(parseInt(cpu) / 1_000_000)
  if (cpu.endsWith('m')) return parseInt(cpu)
  return Math.round(parseFloat(cpu) * 1000)
}

function parseMemToMi(mem: string): number {
  if (mem.endsWith('Ki')) return Math.round(parseInt(mem) / 1024)
  if (mem.endsWith('Mi')) return parseInt(mem)
  if (mem.endsWith('Gi')) return parseInt(mem) * 1024
  return Math.round(parseInt(mem) / (1024 * 1024))
}
```

- [ ] **Step 4: Commit**

```bash
git add src/main/k8s/logs.ts src/main/k8s/related.ts src/main/k8s/metrics.ts
git commit -m "feat: add log fetcher, related resource finder, and metrics client"
```

---

## Task 9: IPC Handlers + Preload API

**Files:**
- Create: `src/main/ipc.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Create IPC handler registration**

```ts
// src/main/ipc.ts
import { ipcMain, dialog, BrowserWindow } from 'electron'
import { loadContexts, connectCluster, disconnectCluster, getClient } from './k8s/client'
import { startWatching, stopWatching } from './k8s/watcher'
import { ResourceCache } from './k8s/cache'
import { fetchLogs } from './k8s/logs'
import { fetchRelated } from './k8s/related'
import { fetchPodMetrics, checkMetricsAvailable } from './k8s/metrics'
import { parseHelmLabels } from './k8s/helm'
import { generateSnapshot } from './k8s/snapshot'
import { scoreHealth } from './k8s/health'
import type { ClusterInfo, K8sEvent, ResourceDetail, ResourceUpdate } from '../shared/types'
import { writeFileSync } from 'fs'

const cache = new ResourceCache()

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle('k8s:list-contexts', () => {
    return loadContexts()
  })

  ipcMain.handle('k8s:connect', async (_event, context: string): Promise<ClusterInfo> => {
    try {
      connectCluster(context)
      const metricsAvailable = await checkMetricsAvailable(context)

      await startWatching(context, (resources) => {
        cache.set(context, resources)
        const info: ClusterInfo = {
          name: context,
          connected: true,
          resourceCounts: {
            total: resources.length,
            healthy: resources.filter((r) => r.health === 'healthy').length,
            warning: resources.filter((r) => r.health === 'warning').length,
            critical: resources.filter((r) => r.health === 'critical').length
          }
        }

        const update: ResourceUpdate = { cluster: context, resources, clusterInfo: info }
        mainWindow.webContents.send('k8s:resource-update', update)
      })

      return {
        name: context,
        connected: true,
        resourceCounts: { total: 0, healthy: 0, warning: 0, critical: 0 }
      }
    } catch (err: any) {
      return {
        name: context,
        connected: false,
        error: err.message,
        resourceCounts: { total: 0, healthy: 0, warning: 0, critical: 0 }
      }
    }
  })

  ipcMain.handle('k8s:disconnect', async (_event, context: string) => {
    stopWatching(context)
    disconnectCluster(context)
    cache.clear(context)
  })

  ipcMain.handle('k8s:get-logs', async (_event, cluster: string, namespace: string, pod: string) => {
    return fetchLogs(cluster, namespace, pod)
  })

  ipcMain.handle('k8s:get-events', async (_event, cluster: string, namespace: string, name: string) => {
    const client = getClient(cluster)
    if (!client) throw new Error(`Not connected to ${cluster}`)

    const events = await client.coreApi.listNamespacedEvent({ namespace })
    return events.items
      .filter((e) => e.involvedObject?.name === name)
      .map((e): K8sEvent => ({
        timestamp: e.lastTimestamp?.toISOString() ?? e.eventTime?.toISOString() ?? '',
        type: e.type ?? 'Normal',
        reason: e.reason ?? '',
        message: e.message ?? '',
        involvedObject: `${e.involvedObject?.kind?.toLowerCase()}/${e.involvedObject?.name}`
      }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  })

  ipcMain.handle('k8s:get-related', async (_event, cluster: string, namespace: string, name: string, kind: string) => {
    return fetchRelated(cluster, namespace, name, kind)
  })

  ipcMain.handle('k8s:helm-info', async (_event, _cluster: string, _namespace: string, labels: Record<string, string>) => {
    return parseHelmLabels(labels)
  })

  ipcMain.handle('k8s:get-resource-detail', async (_event, cluster: string, namespace: string, name: string, kind: string) => {
    const resources = cache.getAll(cluster)
    const resource = resources.find((r) => r.name === name && r.namespace === namespace && r.kind === kind)
    if (!resource) throw new Error(`Resource not found: ${kind}/${name}`)

    const [events, logs, related, helm, metrics] = await Promise.all([
      ipcMain.emit('k8s:get-events', null as any, cluster, namespace, name) as any,
      kind === 'Pod' ? fetchLogs(cluster, namespace, name) : Promise.resolve([]),
      fetchRelated(cluster, namespace, name, kind),
      Promise.resolve(parseHelmLabels(resource.labels)),
      kind === 'Pod' ? fetchPodMetrics(cluster, namespace, name) : Promise.resolve(null)
    ])

    const client = getClient(cluster)
    const eventsResult = await client!.coreApi.listNamespacedEvent({ namespace })
    const filteredEvents: K8sEvent[] = eventsResult.items
      .filter((e) => e.involvedObject?.name === name)
      .map((e) => ({
        timestamp: e.lastTimestamp?.toISOString() ?? e.eventTime?.toISOString() ?? '',
        type: e.type ?? 'Normal',
        reason: e.reason ?? '',
        message: e.message ?? '',
        involvedObject: `${e.involvedObject?.kind?.toLowerCase()}/${e.involvedObject?.name}`
      }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))

    const detail: ResourceDetail = {
      resource,
      events: filteredEvents,
      logs,
      resources: {
        cpuRequest: resource.labels['cpu-request'],
        cpuLimit: resource.labels['cpu-limit'],
        cpuActual: metrics?.cpuActual,
        memRequest: resource.labels['mem-request'],
        memLimit: resource.labels['mem-limit'],
        memActual: metrics?.memActual,
        metricsAvailable: client?.metricsAvailable ?? false
      },
      related,
      helm: helm ?? undefined
    }

    return detail
  })

  ipcMain.handle('k8s:export-snapshot', async (_event, detail: ResourceDetail) => {
    const markdown = generateSnapshot(detail)
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `horus-snapshot-${detail.resource.name}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })

    if (!result.canceled && result.filePath) {
      writeFileSync(result.filePath, markdown, 'utf-8')
      return result.filePath
    }
    return null
  })
}
```

- [ ] **Step 2: Update preload with full typed API**

Replace `src/preload/index.ts`:

```ts
import { contextBridge, ipcRenderer } from 'electron'
import type { HorusAPI } from '../shared/types'

const api: HorusAPI = {
  listContexts: () => ipcRenderer.invoke('k8s:list-contexts'),
  connect: (context) => ipcRenderer.invoke('k8s:connect', context),
  disconnect: (context) => ipcRenderer.invoke('k8s:disconnect', context),
  onResourceUpdate: (callback) => {
    const handler = (_event: any, update: any) => callback(update)
    ipcRenderer.on('k8s:resource-update', handler)
    return () => ipcRenderer.removeListener('k8s:resource-update', handler)
  },
  getLogs: (cluster, namespace, pod) => ipcRenderer.invoke('k8s:get-logs', cluster, namespace, pod),
  getEvents: (cluster, namespace, name) => ipcRenderer.invoke('k8s:get-events', cluster, namespace, name),
  getRelated: (cluster, namespace, name, kind) => ipcRenderer.invoke('k8s:get-related', cluster, namespace, name, kind),
  getHelmInfo: (cluster, namespace, labels) => ipcRenderer.invoke('k8s:helm-info', cluster, namespace, labels),
  getResourceDetail: (cluster, namespace, name, kind) => ipcRenderer.invoke('k8s:get-resource-detail', cluster, namespace, name, kind),
  exportSnapshot: (detail) => ipcRenderer.invoke('k8s:export-snapshot', detail)
}

contextBridge.exposeInMainWorld('horus', api)
```

- [ ] **Step 3: Update main/index.ts to register IPC handlers**

Replace `src/main/index.ts`:

```ts
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc'

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  registerIpcHandlers(win)

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

- [ ] **Step 4: Commit**

```bash
git add src/main/ipc.ts src/main/index.ts src/preload/index.ts
git commit -m "feat: wire IPC handlers and typed preload API"
```

---

## Task 10: React Hooks

**Files:**
- Create: `src/renderer/hooks/useK8s.ts`
- Create: `src/renderer/hooks/useResources.ts`

- [ ] **Step 1: Create useK8s hook**

```tsx
// src/renderer/hooks/useK8s.ts
import type { ClusterInfo, ContainerLogs, K8sEvent, RelatedResource, HelmInfo, ResourceDetail } from '../../shared/types'

export function useK8s() {
  const api = window.horus

  return {
    listContexts: (): Promise<string[]> => api.listContexts(),
    connect: (context: string): Promise<ClusterInfo> => api.connect(context),
    disconnect: (context: string): Promise<void> => api.disconnect(context),
    getLogs: (cluster: string, ns: string, pod: string): Promise<ContainerLogs[]> => api.getLogs(cluster, ns, pod),
    getEvents: (cluster: string, ns: string, name: string): Promise<K8sEvent[]> => api.getEvents(cluster, ns, name),
    getRelated: (cluster: string, ns: string, name: string, kind: string): Promise<RelatedResource[]> => api.getRelated(cluster, ns, name, kind),
    getHelmInfo: (cluster: string, ns: string, labels: Record<string, string>): Promise<HelmInfo | null> => api.getHelmInfo(cluster, ns, labels),
    getResourceDetail: (cluster: string, ns: string, name: string, kind: string): Promise<ResourceDetail> => api.getResourceDetail(cluster, ns, name, kind),
    exportSnapshot: (detail: ResourceDetail): Promise<string> => api.exportSnapshot(detail)
  }
}
```

- [ ] **Step 2: Create useResources hook**

```tsx
// src/renderer/hooks/useResources.ts
import { useState, useEffect, useRef } from 'react'
import type { K8sResource, ClusterInfo, ResourceUpdate } from '../../shared/types'

interface ResourceState {
  clusters: Map<string, ClusterInfo>
  resources: Map<string, K8sResource[]>
}

export function useResources() {
  const [state, setState] = useState<ResourceState>({
    clusters: new Map(),
    resources: new Map()
  })
  const unsubRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    unsubRef.current = window.horus.onResourceUpdate((update: ResourceUpdate) => {
      setState((prev) => {
        const clusters = new Map(prev.clusters)
        const resources = new Map(prev.resources)
        clusters.set(update.cluster, update.clusterInfo)
        resources.set(update.cluster, update.resources)
        return { clusters, resources }
      })
    })

    return () => {
      if (unsubRef.current) unsubRef.current()
    }
  }, [])

  const allResources = (): K8sResource[] => {
    const result: K8sResource[] = []
    for (const r of state.resources.values()) result.push(...r)
    return result
  }

  const unhealthy = (): K8sResource[] => {
    return allResources()
      .filter((r) => r.health !== 'healthy')
      .sort((a, b) => {
        const order = { critical: 0, warning: 1, unknown: 2, healthy: 3 }
        return order[a.health] - order[b.health]
      })
  }

  return {
    clusters: [...state.clusters.values()],
    resourcesByCluster: state.resources,
    allResources,
    unhealthy
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/hooks/
git commit -m "feat: add useK8s and useResources React hooks"
```

---

## Task 11: TopBar + Command Palette

**Files:**
- Create: `src/renderer/components/TopBar.tsx`
- Create: `src/renderer/components/CommandPalette.tsx`

- [ ] **Step 1: Create TopBar**

```tsx
// src/renderer/components/TopBar.tsx
import { Navbar, Button, Breadcrumbs, type BreadcrumbProps } from '@blueprintjs/core'

interface TopBarProps {
  breadcrumbs: BreadcrumbProps[]
  onCommandPalette: () => void
  onSettings?: () => void
}

export function TopBar({ breadcrumbs, onCommandPalette, onSettings }: TopBarProps) {
  return (
    <Navbar>
      <Navbar.Group>
        <Breadcrumbs items={breadcrumbs} />
      </Navbar.Group>
      <Navbar.Group align="right">
        <Button
          minimal
          icon="search"
          text="Search... (Cmd+K)"
          onClick={onCommandPalette}
        />
        {onSettings && (
          <Button minimal icon="cog" onClick={onSettings} />
        )}
      </Navbar.Group>
    </Navbar>
  )
}
```

- [ ] **Step 2: Create CommandPalette**

```tsx
// src/renderer/components/CommandPalette.tsx
import { useState } from 'react'
import { Omnibar } from '@blueprintjs/select'
import { MenuItem } from '@blueprintjs/core'
import type { K8sResource } from '../../shared/types'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  resources: K8sResource[]
  onSelect: (resource: K8sResource) => void
}

export function CommandPalette({ isOpen, onClose, resources, onSelect }: CommandPaletteProps) {
  return (
    <Omnibar<K8sResource>
      isOpen={isOpen}
      onClose={onClose}
      items={resources}
      itemPredicate={(query, resource) => {
        return resource.name.toLowerCase().includes(query.toLowerCase())
      }}
      itemRenderer={(resource, { handleClick, handleFocus, modifiers }) => {
        if (!modifiers.matchesPredicate) return null
        return (
          <MenuItem
            key={resource.uid}
            text={resource.name}
            label={resource.cluster}
            icon={kindToIcon(resource.kind)}
            active={modifiers.active}
            onClick={handleClick}
            onFocus={handleFocus}
            roleStructure="listoption"
          />
        )
      }}
      onItemSelect={(resource) => {
        onSelect(resource)
        onClose()
      }}
      inputProps={{ placeholder: 'Search resources across all clusters...' }}
    />
  )
}

function kindToIcon(kind: string): string {
  switch (kind) {
    case 'Pod': return 'cube'
    case 'Deployment': return 'layers'
    case 'Service': return 'globe-network'
    case 'Job': return 'play'
    case 'StatefulSet': return 'database'
    case 'DaemonSet': return 'grid-view'
    default: return 'box'
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/TopBar.tsx src/renderer/components/CommandPalette.tsx
git commit -m "feat: add TopBar and CommandPalette (Omnibar) components"
```

---

## Task 12: Overview View

**Files:**
- Create: `src/renderer/components/ClusterCard.tsx`
- Create: `src/renderer/views/Overview.tsx`

- [ ] **Step 1: Create ClusterCard**

```tsx
// src/renderer/components/ClusterCard.tsx
import { Card, Tag, Intent } from '@blueprintjs/core'
import type { ClusterInfo } from '../../shared/types'

interface ClusterCardProps {
  cluster: ClusterInfo
  onClick: () => void
}

export function ClusterCard({ cluster, onClick }: ClusterCardProps) {
  const intent = !cluster.connected
    ? Intent.DANGER
    : cluster.resourceCounts.critical > 0
      ? Intent.DANGER
      : cluster.resourceCounts.warning > 0
        ? Intent.WARNING
        : Intent.SUCCESS

  const issueCount = cluster.resourceCounts.critical + cluster.resourceCounts.warning
  const label = !cluster.connected
    ? 'unreachable'
    : issueCount > 0
      ? `${issueCount} issue${issueCount > 1 ? 's' : ''}`
      : 'healthy'

  return (
    <Card interactive onClick={onClick} style={{ marginBottom: 4, padding: '8px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tag round minimal intent={intent} />
          <span className="monospace">{cluster.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span className="bp5-text-muted">{label}</span>
          {cluster.cpuPercent != null && (
            <span className="bp5-text-muted monospace">{cluster.cpuPercent}% cpu</span>
          )}
          {cluster.memPercent != null && (
            <span className="bp5-text-muted monospace">{cluster.memPercent}% mem</span>
          )}
        </div>
      </div>
    </Card>
  )
}
```

- [ ] **Step 2: Create Overview view**

```tsx
// src/renderer/views/Overview.tsx
import { Card, H4, NonIdealState, Tag, Intent } from '@blueprintjs/core'
import { ClusterCard } from '../components/ClusterCard'
import type { K8sResource, ClusterInfo } from '../../shared/types'

interface OverviewProps {
  clusters: ClusterInfo[]
  unhealthy: K8sResource[]
  onSelectCluster: (name: string) => void
  onSelectResource: (resource: K8sResource) => void
}

export function Overview({ clusters, unhealthy, onSelectCluster, onSelectResource }: OverviewProps) {
  if (clusters.length === 0) {
    return (
      <NonIdealState
        icon="offline"
        title="No clusters connected"
        description="Connect to a cluster using the settings menu or Cmd+K"
      />
    )
  }

  const sorted = [...clusters].sort((a, b) => {
    const aIssues = a.resourceCounts.critical + a.resourceCounts.warning
    const bIssues = b.resourceCounts.critical + b.resourceCounts.warning
    return bIssues - aIssues
  })

  return (
    <div style={{ padding: 16, overflow: 'auto', flex: 1 }}>
      <H4>Clusters ({clusters.length} connected)</H4>
      {sorted.map((cluster) => (
        <ClusterCard
          key={cluster.name}
          cluster={cluster}
          onClick={() => onSelectCluster(cluster.name)}
        />
      ))}

      {unhealthy.length > 0 && (
        <>
          <H4 style={{ marginTop: 24 }}>Needs Attention</H4>
          {unhealthy.map((resource) => (
            <Card
              key={resource.uid}
              interactive
              onClick={() => onSelectResource(resource)}
              style={{ marginBottom: 4, padding: '8px 12px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tag
                  intent={resource.health === 'critical' ? Intent.DANGER : Intent.WARNING}
                  minimal
                  round
                />
                <span className="bp5-text-muted">{resource.kind}</span>
                <span className="monospace">{resource.name}</span>
                <span className="bp5-text-muted" style={{ marginLeft: 'auto' }}>
                  {resource.status}
                </span>
                <span className="bp5-text-muted monospace">{resource.cluster}</span>
              </div>
            </Card>
          ))}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/ClusterCard.tsx src/renderer/views/Overview.tsx
git commit -m "feat: add Overview view with cluster health cards"
```

---

## Task 13: Explore View

**Files:**
- Create: `src/renderer/components/HelmBanner.tsx`
- Create: `src/renderer/views/Explore.tsx`

- [ ] **Step 1: Create HelmBanner**

```tsx
// src/renderer/components/HelmBanner.tsx
import { Callout, Intent } from '@blueprintjs/core'
import type { HelmInfo } from '../../shared/types'

interface HelmBannerProps {
  helm: HelmInfo
}

export function HelmBanner({ helm }: HelmBannerProps) {
  return (
    <Callout intent={Intent.PRIMARY} icon="box" style={{ marginBottom: 8 }}>
      <span className="monospace">
        Helm: {helm.chart} (chart v{helm.version}, rev {helm.revision})
      </span>
    </Callout>
  )
}
```

- [ ] **Step 2: Create Explore view**

```tsx
// src/renderer/views/Explore.tsx
import { useState, useMemo } from 'react'
import { HTMLSelect, NonIdealState } from '@blueprintjs/core'
import { Column, Table2, Cell2 } from '@blueprintjs/table'
import { HelmBanner } from '../components/HelmBanner'
import { parseHelmLabels } from '../../shared/helm'
import type { K8sResource, ResourceKind } from '../../shared/types'

interface ExploreProps {
  cluster: string
  resources: K8sResource[]
  onSelectResource: (resource: K8sResource) => void
}

const KINDS: ResourceKind[] = ['Pod', 'Deployment', 'StatefulSet', 'DaemonSet', 'Job', 'Service', 'Ingress', 'ConfigMap', 'Secret']

export function Explore({ cluster, resources, onSelectResource }: ExploreProps) {
  const [namespace, setNamespace] = useState<string>('all')
  const [kind, setKind] = useState<ResourceKind | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const namespaces = useMemo(() => {
    const ns = new Set(resources.map((r) => r.namespace))
    return ['all', ...Array.from(ns).sort()]
  }, [resources])

  const filtered = useMemo(() => {
    return resources.filter((r) => {
      if (namespace !== 'all' && r.namespace !== namespace) return false
      if (kind !== 'all' && r.kind !== kind) return false
      if (statusFilter === 'unhealthy' && r.health === 'healthy') return false
      return true
    })
  }, [resources, namespace, kind, statusFilter])

  const helmInfo = useMemo(() => {
    for (const r of filtered) {
      const helm = parseHelmLabels(r.labels)
      if (helm) return helm
    }
    return null
  }, [filtered])

  if (resources.length === 0) {
    return <NonIdealState icon="search" title="No resources" description={`No resources found in ${cluster}`} />
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <HTMLSelect value={namespace} onChange={(e) => setNamespace(e.target.value)}>
          {namespaces.map((ns) => (
            <option key={ns} value={ns}>{ns === 'all' ? 'All namespaces' : ns}</option>
          ))}
        </HTMLSelect>
        <HTMLSelect value={kind} onChange={(e) => setKind(e.target.value as any)}>
          <option value="all">All types</option>
          {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </HTMLSelect>
        <HTMLSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All status</option>
          <option value="unhealthy">Unhealthy only</option>
        </HTMLSelect>
      </div>

      {helmInfo && <HelmBanner helm={helmInfo} />}

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Table2
          numRows={filtered.length}
          enableRowResizing={false}
          columnWidths={[200, 100, 80, 60, 80, 100]}
          cellRendererDependencies={[filtered]}
        >
          <Column name="Name" cellRenderer={(row) => (
            <Cell2
              interactive
              onClick={() => onSelectResource(filtered[row])}
            >
              <span className="monospace">{filtered[row]?.name}</span>
            </Cell2>
          )} />
          <Column name="Kind" cellRenderer={(row) => (
            <Cell2>{filtered[row]?.kind}</Cell2>
          )} />
          <Column name="Status" cellRenderer={(row) => (
            <Cell2>{filtered[row]?.status}</Cell2>
          )} />
          <Column name="Restarts" cellRenderer={(row) => (
            <Cell2 className="monospace">{filtered[row]?.restarts}</Cell2>
          )} />
          <Column name="Namespace" cellRenderer={(row) => (
            <Cell2 className="monospace">{filtered[row]?.namespace}</Cell2>
          )} />
          <Column name="Node" cellRenderer={(row) => (
            <Cell2 className="monospace">{filtered[row]?.node}</Cell2>
          )} />
        </Table2>
      </div>
    </div>
  )
}
```

**Important:** Before this step, move `parseHelmLabels` from `src/main/k8s/helm.ts` to `src/shared/helm.ts`. It's a pure function with no Node dependencies. Update the import in `src/main/k8s/helm.ts` to re-export from shared, and update `src/main/ipc.ts` imports accordingly. The Explore view imports from `../../shared/helm`.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/HelmBanner.tsx src/renderer/views/Explore.tsx
git commit -m "feat: add Explore view with Blueprint Table2 and filters"
```

---

## Task 14: Debug View

**Files:**
- Create: `src/renderer/components/Timeline.tsx`
- Create: `src/renderer/components/LogViewer.tsx`
- Create: `src/renderer/components/ResourceUsage.tsx`
- Create: `src/renderer/components/RelatedList.tsx`
- Create: `src/renderer/views/Debug.tsx`

- [ ] **Step 1: Create Timeline component**

```tsx
// src/renderer/components/Timeline.tsx
import { Card, H5, Tag, Intent } from '@blueprintjs/core'
import type { K8sEvent } from '../../shared/types'

interface TimelineProps {
  events: K8sEvent[]
}

export function Timeline({ events }: TimelineProps) {
  return (
    <Card style={{ marginBottom: 12 }}>
      <H5>Timeline</H5>
      <div className="monospace" style={{ fontSize: 12 }}>
        {events.map((event, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, padding: '2px 0' }}>
            <span className="bp5-text-muted" style={{ minWidth: 60 }}>
              {formatTimestamp(event.timestamp)}
            </span>
            <Tag
              minimal
              intent={event.type === 'Warning' ? Intent.WARNING : Intent.NONE}
              style={{ minWidth: 100 }}
            >
              {event.reason}
            </Tag>
            <span>{event.message}</span>
          </div>
        ))}
        {events.length === 0 && <span className="bp5-text-muted">No events</span>}
      </div>
    </Card>
  )
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ts
  }
}
```

- [ ] **Step 2: Create LogViewer component**

```tsx
// src/renderer/components/LogViewer.tsx
import { useState } from 'react'
import { Card, H5, ButtonGroup, Button } from '@blueprintjs/core'
import type { ContainerLogs } from '../../shared/types'

interface LogViewerProps {
  logs: ContainerLogs[]
}

export function LogViewer({ logs }: LogViewerProps) {
  const [selectedContainer, setSelectedContainer] = useState(0)
  const [showPrevious, setShowPrevious] = useState(false)

  if (logs.length === 0) {
    return (
      <Card style={{ marginBottom: 12 }}>
        <H5>Logs</H5>
        <span className="bp5-text-muted">No logs available (not a Pod)</span>
      </Card>
    )
  }

  const current = logs[selectedContainer]
  const text = showPrevious ? current?.previous : current?.current

  return (
    <Card style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <H5 style={{ margin: 0 }}>Logs ({current?.containerName})</H5>
        <ButtonGroup minimal>
          {logs.length > 1 && logs.map((log, i) => (
            <Button
              key={i}
              text={log.containerName}
              active={i === selectedContainer}
              onClick={() => { setSelectedContainer(i); setShowPrevious(false) }}
            />
          ))}
          {current?.previous && (
            <Button
              text={showPrevious ? 'current' : 'prev container'}
              active={showPrevious}
              onClick={() => setShowPrevious(!showPrevious)}
            />
          )}
        </ButtonGroup>
      </div>
      <pre
        className="monospace"
        style={{
          maxHeight: 300,
          overflow: 'auto',
          margin: 0,
          padding: 8,
          backgroundColor: 'rgba(0,0,0,0.2)',
          borderRadius: 4,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all'
        }}
      >
        {text ?? '(no logs)'}
      </pre>
    </Card>
  )
}
```

- [ ] **Step 3: Create ResourceUsage component**

```tsx
// src/renderer/components/ResourceUsage.tsx
import { Card, H5, HTMLTable } from '@blueprintjs/core'

interface ResourceUsageProps {
  cpuRequest?: string
  cpuLimit?: string
  cpuActual?: string
  memRequest?: string
  memLimit?: string
  memActual?: string
  metricsAvailable: boolean
}

export function ResourceUsage(props: ResourceUsageProps) {
  const actualLabel = props.metricsAvailable ? 'n/a' : 'metrics unavailable'

  return (
    <Card style={{ marginBottom: 12 }}>
      <H5>Resources</H5>
      <HTMLTable condensed className="monospace">
        <thead>
          <tr>
            <th></th>
            <th>request</th>
            <th>limit</th>
            <th>actual</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>cpu</td>
            <td>{props.cpuRequest ?? 'none'}</td>
            <td>{props.cpuLimit ?? 'none'}</td>
            <td>{props.cpuActual ?? actualLabel}</td>
          </tr>
          <tr>
            <td>mem</td>
            <td>{props.memRequest ?? 'none'}</td>
            <td>{props.memLimit ?? 'none'}</td>
            <td>{props.memActual ?? actualLabel}</td>
          </tr>
        </tbody>
      </HTMLTable>
    </Card>
  )
}
```

- [ ] **Step 4: Create RelatedList component**

```tsx
// src/renderer/components/RelatedList.tsx
import { Card, H5, Tag } from '@blueprintjs/core'
import type { RelatedResource } from '../../shared/types'

interface RelatedListProps {
  related: RelatedResource[]
}

export function RelatedList({ related }: RelatedListProps) {
  return (
    <Card style={{ marginBottom: 12 }}>
      <H5>Related</H5>
      {related.length === 0 && <span className="bp5-text-muted">No related resources found</span>}
      {related.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
          <Tag minimal>{r.kind}</Tag>
          <span className="monospace">{r.name}</span>
          <span className="bp5-text-muted">({r.detail})</span>
        </div>
      ))}
    </Card>
  )
}
```

- [ ] **Step 5: Create Debug view**

```tsx
// src/renderer/views/Debug.tsx
import { useEffect, useState } from 'react'
import { Button, Tag, Intent, Spinner, H4 } from '@blueprintjs/core'
import { Timeline } from '../components/Timeline'
import { LogViewer } from '../components/LogViewer'
import { ResourceUsage } from '../components/ResourceUsage'
import { RelatedList } from '../components/RelatedList'
import { HelmBanner } from '../components/HelmBanner'
import { useK8s } from '../hooks/useK8s'
import type { K8sResource, ResourceDetail } from '../../shared/types'

interface DebugProps {
  resource: K8sResource
  onBack: () => void
}

export function Debug({ resource, onBack }: DebugProps) {
  const k8s = useK8s()
  const [detail, setDetail] = useState<ResourceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    k8s.getResourceDetail(resource.cluster, resource.namespace, resource.name, resource.kind)
      .then(setDetail)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [resource.uid])

  if (loading) return <Spinner style={{ margin: 40 }} />
  if (error) return <div style={{ padding: 16, color: 'red' }}>{error}</div>
  if (!detail) return null

  const handleExport = async () => {
    await k8s.exportSnapshot(detail)
  }

  const healthIntent = resource.health === 'critical' ? Intent.DANGER
    : resource.health === 'warning' ? Intent.WARNING
    : Intent.SUCCESS

  return (
    <div style={{ padding: 16, overflow: 'auto', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Button minimal icon="arrow-left" onClick={onBack} />
        <span className="monospace" style={{ fontSize: 16 }}>{resource.name}</span>
        <div style={{ marginLeft: 'auto' }}>
          <Button icon="export" text="Export snapshot" onClick={handleExport} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <Tag large intent={healthIntent}>{resource.status}</Tag>
        <span className="monospace">Restarts: {resource.restarts}</span>
        {resource.node && <span className="monospace">Node: {resource.node}</span>}
        {resource.ownerKind && (
          <span className="monospace">Owner: {resource.ownerKind}/{resource.ownerName}</span>
        )}
      </div>

      {detail.helm && <HelmBanner helm={detail.helm} />}

      <Timeline events={detail.events} />
      <LogViewer logs={detail.logs} />
      <ResourceUsage {...detail.resources} />
      <RelatedList related={detail.related} />
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/Timeline.tsx src/renderer/components/LogViewer.tsx src/renderer/components/ResourceUsage.tsx src/renderer/components/RelatedList.tsx src/renderer/views/Debug.tsx
git commit -m "feat: add Debug view with timeline, logs, resources, and related"
```

---

## Task 15: Wire App.tsx with Routing + Keyboard Shortcuts

**Files:**
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Replace App.tsx with full routing**

```tsx
// src/renderer/App.tsx
import { useState, useEffect, useCallback } from 'react'
import { TopBar } from './components/TopBar'
import { CommandPalette } from './components/CommandPalette'
import { Overview } from './views/Overview'
import { Explore } from './views/Explore'
import { Debug } from './views/Debug'
import { useResources } from './hooks/useResources'
import { useK8s } from './hooks/useK8s'
import type { K8sResource, BreadcrumbProps } from '../shared/types'

type View =
  | { type: 'overview' }
  | { type: 'explore'; cluster: string }
  | { type: 'debug'; resource: K8sResource }

export function App() {
  const [view, setView] = useState<View>({ type: 'overview' })
  const [paletteOpen, setPaletteOpen] = useState(false)
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
      <TopBar
        breadcrumbs={breadcrumbs}
        onCommandPalette={() => setPaletteOpen(true)}
      />

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
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run dev to verify the full app loads**

```bash
npm run dev
```

Expected: Electron window opens. If kubeconfig has contexts, clusters auto-connect and Overview populates. Cmd+K opens the command palette. Clicking a cluster goes to Explore. Clicking a resource goes to Debug.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "feat: wire App routing, keyboard shortcuts, and auto-connect"
```

---

## Task 16: Packaging + Auto-Update

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install packaging dependencies**

```bash
npm install electron-builder electron-updater --save-dev
```

- [ ] **Step 2: Add build and publish scripts to package.json**

Add to scripts:

```json
{
  "scripts": {
    "build:mac": "electron-vite build && electron-builder --mac",
    "build:linux": "electron-vite build && electron-builder --linux",
    "build:win": "electron-vite build && electron-builder --win"
  }
}
```

- [ ] **Step 3: Test the build**

```bash
npm run build:mac
```

Expected: Produces a `.dmg` and `.zip` in `dist/`.

- [ ] **Step 4: Commit**

```bash
git add package.json electron-builder.yml
git commit -m "feat: add electron-builder packaging for mac/linux/win"
```

---

## Task 17: Final Integration Test

- [ ] **Step 1: Run all unit tests**

```bash
npx vitest run
```

Expected: All tests pass (health, cache, snapshot, helm).

- [ ] **Step 2: Run the app manually**

```bash
npm run dev
```

Verify:
1. App launches in under 2 seconds
2. Clusters from kubeconfig appear and auto-connect
3. Overview shows cluster health cards with issue counts
4. Unhealthy resources appear in "Needs Attention"
5. Clicking a cluster navigates to Explore with Table2
6. Clicking a resource navigates to Debug with full context
7. Cmd+K opens command palette, fuzzy search works across clusters
8. Export snapshot opens save dialog and writes valid markdown
9. Escape navigates back through views
10. Helm banner shows on Helm-managed resources

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration test fixes"
```
