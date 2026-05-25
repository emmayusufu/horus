# Horus

Kubernetes observability and incident debugger. When something breaks across your clusters, Horus shows you what's wrong and exactly where the problem is -- without running 10 kubectl commands.

## Features

**Overview** -- health ring, pod heatmap, namespace comparison chart, cluster status

**Explore** -- resource browser with filters. Switch to the Insights tab for service topology, ownership trees, dependency graphs, HPAs, PVCs, quotas, config health checks, and namespace events.

**Debug** -- full context for one resource on a single screen:
- Root cause analysis (automatic diagnosis for crashes, scheduling failures, image pull errors)
- Streaming logs with search, level coloring, timestamps, line numbers
- Traffic path tracing (Ingress > LB > Service > Endpoints > Pods)
- Deployment rollout progress with ReplicaSet chart
- CronJob run history with pass/fail visualization
- Pod lifecycle timeline and sidecar detection
- Pod conditions, container states, resource usage
- Related services, configmaps, secrets
- Port forwarding, pod restart, deployment scaling
- Helm release info and raw pod spec
- Markdown snapshot export

**Request Tracer** -- enter a hostname, trace the full request path hop-by-hop, find exactly where a 503 originates

**Nodes** -- node health, capacity, taints, pod distribution per node

**Security** -- RBAC bindings, network policy coverage, security posture scan, secret usage audit

**Compare** -- side-by-side diff of the same resource across two clusters

**Global Events** -- search events across all namespaces and clusters

Dark and light mode. Keyboard-driven: Cmd+K to search, Esc to go back, `l` to follow logs, `/` to search, `t` for timestamps.

## Getting started

```
npm install
npm run dev
```

Connects to all clusters in your kubeconfig on launch.

## Build

```
npm run build:mac    # .dmg
npm run build:linux  # AppImage
npm run build:win    # .exe
```

## Tests

```
npm test
```

## Lint / format

```
npm run lint
npm run format
```

## Stack

Electron, React 18, Blueprint 6, @kubernetes/client-node, Recharts, Vite, Vitest.

## License

MIT
