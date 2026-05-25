# Horus - K8s Incident Debugger

A focused, keyboard-driven Electron desktop app that surfaces unhealthy Kubernetes
resources and aggregates debugging context into a single view. Not a general-purpose
cluster manager -- a tool that answers "what's broken and why" across 5+ clusters.

## Problem

When a pod crashloops or a job fails, debugging requires 5-10 kubectl commands:
describe, logs (current + previous), events, related services, configmaps, resource
usage, node conditions. Every time. Existing tools (Lens, K9s, Aptakube) show cluster
state but don't aggregate debugging context -- they're file browsers for your cluster.

## Target user

Senior/staff engineer managing 5+ Kubernetes clusters daily. Direct kubeconfig access.
Uses Helm for deployments. Wants to find what's broken fast, gather context, and share
it with teammates.

## Design principles

1. **Status-first, not resource-first.** Healthy clusters are boring (almost empty screen).
   Unhealthy resources surface automatically.
2. **One resource, full context.** Click a failing pod, get logs + events + related
   resources + resource usage on one scrollable page. No tab switching.
3. **Keyboard-driven.** Cmd+K command palette for jumping anywhere. Arrow keys to
   navigate. Minimal mouse dependency.
4. **Minimal chrome.** No sidebar. Top bar with breadcrumbs. Color only for status
   signals (healthy/warning/critical). Monospace for values, proportional for labels.
5. **Three views, not thirty.** Overview, Explore, Debug. That's the entire nav.

## Architecture

```
+---------------------------------------------------+
|                  Electron App                      |
|                                                    |
|  +----------------------------------------------+ |
|  |           Main Process                        | |
|  |                                               | |
|  |  +----------+  +----------+  +---------+      | |
|  |  | K8s      |  | Kubectl  |  | Config  |      | |
|  |  | Client   |  | Exec     |  | Store   |      | |
|  |  | (watch,  |  | (auth    |  | (safe   |      | |
|  |  |  list,   |  |  heavy   |  |  Storage|      | |
|  |  |  describe|  |  ops)    |  |  for    |      | |
|  |  |  )       |  |          |  |  prefs) |      | |
|  |  +----+-----+  +----+-----+  +----+----+      | |
|  |       +------+-------+            |            | |
|  |              | Typed IPC          |            | |
|  +--------------+--------------------+------------+ |
|                 |                    |              |
|  +--------------+--------------------+------------+ |
|  |  Renderer (contextIsolation: true)             | |
|  |              v                    v            | |
|  |  +------------+  +-------------------------------+
|  |  | Preload    |  |  React + Vite                 |
|  |  | API        |  |                               |
|  |  | (~10 typed |  |  Overview / Explore / Debug    |
|  |  |  methods)  |  |  Blueprint 6 components        |
|  |  |            |  |  Blueprint Omnibar (Cmd+K)     |
|  |  +------------+  +-------------------------------+
|  +----------------------------------------------+ |
+---------------------------------------------------+
```

### Security

- `contextIsolation: true`, `nodeIntegration: false`
- Preload script exposes a minimal typed API (~10 methods), not a generic bridge
- Renderer never imports `@kubernetes/client-node` or spawns processes
- Secret values are never sent to renderer -- only key names

### IPC channels

Each channel is a typed request/response or event stream:

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `k8s:list-contexts` | req/res | Return available kubeconfig contexts |
| `k8s:connect` | req/res | Connect to a cluster, start watchers |
| `k8s:disconnect` | req/res | Stop watchers for a cluster |
| `k8s:resource-update` | event | Push resource cache diffs to renderer |
| `k8s:get-logs` | req/res | Fetch logs for a container (current/previous) |
| `k8s:describe` | req/res | Full describe output for a resource |
| `k8s:get-events` | req/res | Events for a specific resource |
| `k8s:get-related` | req/res | Services, ingress, configmaps related to a resource |
| `k8s:helm-info` | req/res | Helm release info for a resource |
| `k8s:export-snapshot` | req/res | Generate markdown snapshot, return file path |

### Data flow

```
kubeconfig
    |
    v
Main Process
    |
    +-- on app start: parse kubeconfig, list contexts
    |
    +-- on connect: start Watch on pods, deployments, jobs,
    |   daemonsets, statefulsets, events per cluster
    |       |
    |       v
    |   In-memory resource cache (Map per cluster per namespace)
    |       |
    |       +-- on watch event: update cache, run health scorer,
    |       |   push diff to renderer via k8s:resource-update
    |       |
    |       +-- health scorer: simple rules, not ML
    |               CrashLoopBackOff = critical
    |               Pending > 5min = warning
    |               OOMKilled = critical
    |               ImagePullBackOff = critical
    |               Failed job = critical
    |               Completed job = healthy
    |               Running + ready = healthy
    |               Evicted = critical
    |
    +-- on-demand: logs, describe, related resources
    |   (only fetched when user opens Debug view)
    |
    +-- export-snapshot: gather debug view state, write .md
```

Watches keep the Overview live without polling. Heavy data (logs, full describe) is
fetched on demand only when the user navigates to a specific resource.

Cache is in-memory only. No local database.

## Views

### Overview (landing page)

Shows all connected clusters with health summary. Unhealthy resources float to top.
Healthy clusters collapse to a single line.

```
+--------------------------------------------------------------+
|  cluster-a v        search...  (Cmd+K)         =  settings   |
|--------------------------------------------------------------|
|                                                              |
|  CLUSTERS (5 connected)                                      |
|                                                              |
|  * cluster-prod-us     3 issues    ##- 72% cpu   ##- 61% mem|
|  * cluster-prod-eu     healthy     #-- 45% cpu   #-- 38% mem|
|  o cluster-staging     1 warning   #-- 31% cpu   #-- 22% mem|
|  * cluster-dev         healthy     --- 12% cpu   ---  9% mem|
|  x cluster-sandbox     unreachable                           |
|                                                              |
|  -----------------------------------------------------------  |
|                                                              |
|  NEEDS ATTENTION (cluster-prod-us)                           |
|                                                              |
|  x Pod  payment-svc-7f8b9-xk2m   CrashLoopBackOff   3m ago |
|  x Pod  payment-svc-7f8b9-lm4n   CrashLoopBackOff   3m ago |
|  ! Job  migrate-db-1705          BackoffLimitExceeded 11m   |
|                                                              |
|  RECENT EVENTS                                               |
|  | 2m   FailedScheduling  pod/cart-svc-... (insufficient cpu)|
|  | 5m   Unhealthy         pod/payment-svc-... (readiness)    |
|  | 11m  BackOff           job/migrate-db-... (exit code 1)   |
|                                                              |
+--------------------------------------------------------------+
```

- Click any red item to jump to Debug view
- Resource usage bars are inline text indicators
- Cross-cluster: all clusters visible, worst first

### Explore view

Browse resources when you know roughly where to look. This is the "kubectl get"
replacement.

```
+--------------------------------------------------------------+
|  cluster-prod-us v     search...  (Cmd+K)       =  settings  |
|--------------------------------------------------------------|
|                                                              |
|  namespace: payments v    resource: Pods v    status: All v  |
|                                                              |
|  NAME                    STATUS    RESTARTS  AGE    NODE     |
|  -----------------------------------------------------------  |
|  payment-svc-7f8b9-xk2m  CrashLoop  14     2h    node-03   |
|  payment-svc-7f8b9-lm4n  CrashLoop  14     2h    node-03   |
|  payment-svc-7f8b9-ab1c  Running     0     2h    node-01   |
|  payment-svc-7f8b9-qr9z  Running     0     2h    node-02   |
|  payment-worker-a8c3-x1  Running     0     5d    node-01   |
|  payment-worker-a8c3-y2  Running     0     5d    node-02   |
|                                                              |
|  -- Helm: payment-svc (chart: payment-v2.3.1, rev 14) ----- |
|                                                              |
|  Resource types: Pods(6) Services(2) Ingress(1) ConfigMaps(3)|
|                                                              |
|  [up/down navigate]  [enter = debug]  [/ filter]  [Cmd+K]   |
|                                                              |
+--------------------------------------------------------------+
```

- Blueprint Table2 with virtual scrolling for large namespaces
- Filter bar: namespace, resource type, status
- Helm release banner when resources belong to a Helm release
- Keyboard: arrows to move, Enter to open Debug view, / to filter

### Debug view (the differentiator)

One click aggregates everything needed to diagnose a failing resource:

```
+--------------------------------------------------------------+
|  cluster-prod-us v     search...  (Cmd+K)       =  settings  |
|--------------------------------------------------------------|
|  <- back    payment-svc-7f8b9-xk2m    [Export snapshot]      |
|                                                              |
|  STATUS: CrashLoopBackOff        RESTARTS: 14               |
|  NODE: node-03  (cpu: 89%, mem: 72%)                         |
|  OWNER: Deployment/payment-svc   HELM: payment-v2.3.1 rev14 |
|                                                              |
|  -- TIMELINE -----------------------------------------------  |
|  |                                                           |
|  | 14:02  Created (scheduled to node-03)                     |
|  | 14:02  Pulled image payment-svc:2.3.1                     |
|  | 14:02  Started                                            |
|  | 14:02  Readiness probe failed (connection refused :8080)  |
|  | 14:03  BackOff restarting (exit code 1)                   |
|  | 14:05  Started                                            |
|  | 14:05  Readiness probe failed (connection refused :8080)  |
|  | ...repeating                                              |
|                                                              |
|  -- LOGS (current) -------------------------[prev container] |
|  |                                                           |
|  | Error: ECONNREFUSED 10.0.3.12:5432                        |
|  | at TCPConnectWrap.afterConnect (net.js:1141)               |
|  | Failed to connect to database. Retrying in 5s...          |
|  | Error: ECONNREFUSED 10.0.3.12:5432                        |
|  |                                                           |
|  -- RESOURCES ----------------------------------------------  |
|  | requests: 256Mi mem, 250m cpu                             |
|  | limits:   512Mi mem, 500m cpu                             |
|  | actual:   180Mi mem, 45m cpu                              |
|  |                                                           |
|  -- RELATED ------------------------------------------------  |
|  | Service: payment-svc -> :8080 (0/4 endpoints ready)       |
|  | Ingress: api.example.com/payments -> payment-svc          |
|  | ConfigMap: payment-svc-config (DB_HOST=10.0.3.12)         |
|  | Secret: payment-svc-secrets (3 keys, values hidden)       |
|  |                                                           |
+--------------------------------------------------------------+
```

Sections:
- **Header**: status, restarts, node (with node resource pressure), owner, Helm release
- **Timeline**: K8s events in chronological order -- a story, not a table
- **Logs**: current container with toggle to previous (the one that crashed)
- **Resources**: requests vs limits vs actual usage (requires metrics-server; shows
  "metrics unavailable" gracefully if not installed)
- **Related**: owning deployment, service endpoints, ingress, configmaps (keys only),
  secrets (key names only, never values)

### Command palette (Cmd+K)

Built on Blueprint's Omnibar component. Fuzzy search across all connected clusters.

```
+--------------------------------------------------------------+
|                                                              |
|  +--------------------------------------------------------+  |
|  | > payment-svc_                                         |  |
|  |--------------------------------------------------------|  |
|  |  Pod   payment-svc-7f8b9-xk2m   cluster-prod-us       |  |
|  |  Pod   payment-svc-7f8b9-lm4n   cluster-prod-us       |  |
|  |  Dep   payment-svc              cluster-prod-us       |  |
|  |  Svc   payment-svc              cluster-prod-us       |  |
|  |  Pod   payment-svc-test-a1b2    cluster-staging       |  |
|  +--------------------------------------------------------+  |
|                                                              |
+--------------------------------------------------------------+
```

- Results show resource type, name, and cluster
- Enter jumps to Debug view for that resource
- No need to switch cluster context first -- search is global

## Snapshot export

The Debug view's "Export snapshot" button writes a markdown file:

```markdown
# Horus Debug Snapshot
**Resource:** payment-svc-7f8b9-xk2m
**Cluster:** cluster-prod-us
**Namespace:** payments
**Captured:** 2026-05-25 14:10:03 UTC

## Status
CrashLoopBackOff | 14 restarts | Node: node-03

## Timeline
- 14:02 Created (scheduled to node-03)
- 14:02 Pulled image payment-svc:2.3.1
- 14:05 Readiness probe failed (connection refused :8080)
- 14:05 BackOff restarting (exit code 1)

## Logs (last 50 lines)
    Error: ECONNREFUSED 10.0.3.12:5432
    Failed to connect to database. Retrying in 5s...

## Resources
requests: 256Mi mem, 250m cpu
limits: 512Mi mem, 500m cpu
actual: 180Mi mem, 45m cpu

## Related Resources
- Service: payment-svc (0/4 endpoints ready)
- ConfigMap: payment-svc-config (DB_HOST=10.0.3.12)
- Helm: payment-v2.3.1 rev 14
```

Saved via Electron's native file dialog. Pasteable into Slack, Jira, GitHub issues.

## Helm awareness

No Helm SDK or library needed. Two sources:

1. **Labels**: `app.kubernetes.io/managed-by: Helm` on resources, plus
   `helm.sh/chart` and `app.kubernetes.io/version` labels
2. **kubectl fallback**: `helm list -n <namespace> -o json` for release
   history when the user wants revision details

Helm info is displayed as a banner in Explore and a header field in Debug.
Not a separate Helm management view -- this isn't Helm Dashboard.

## Tech stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Shell | Electron 34+ | Desktop app, file system, tray, native dialogs |
| Renderer | React 19 + Vite | Fast dev, HMR |
| Components | Blueprint 6 (Palantir) | Desktop-first, data-dense, Table2, Omnibar, Tree |
| Styling | Blueprint SCSS + CSS modules | Cohesive desktop design language |
| K8s client | @kubernetes/client-node | Watch, list, describe |
| Metrics | K8s Metrics API | Actual resource usage; graceful fallback if unavailable |
| K8s fallback | kubectl exec via child_process | Auth plugin passthrough |
| Helm | Label parsing + helm CLI | No Helm SDK needed |
| Preferences | Electron safeStorage | Encrypted local store |
| Packaging | electron-builder | .dmg, .exe, .AppImage |
| Auto-update | electron-updater | GitHub Releases as update source |
| Testing | Vitest (unit) + Playwright (e2e) | |

## What's out of scope

- Cluster management (scale, delete, create resources)
- YAML editing or applying manifests
- Metrics dashboards or charts (not Grafana)
- Cluster topology visualization
- Role/RBAC management
- Multi-user or auth (single-user desktop app)
- SSH tunnel or bastion support (direct kubeconfig only)
- Real-time log streaming (fetch on demand, not WebSocket tail)

## Success criteria

1. Cold start under 2 seconds
2. Overview reflects cluster health within 5 seconds of connecting
3. Debug view loads full context for a resource in under 1 second
4. Handles 5+ clusters, 50+ namespaces, 1000+ resources without UI lag
5. Snapshot export produces a readable, pasteable markdown file
6. Keyboard-only navigation works for the entire app
