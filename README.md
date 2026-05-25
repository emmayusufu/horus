# Horus

Kubernetes incident debugger. When a pod crashes, instead of running kubectl logs/describe/get events/etc across 5+ clusters, open it in Horus and get everything on one screen.

## Features

Five views: **Overview** (dashboard with health ring and charts), **Explore** (resource browser with filters), **Debug** (full context for one resource), **Nodes** (node health and pod distribution), **Compare** (multi-cluster diff).

The Debug view pulls together:
- Streaming logs with search, level coloring, and timestamps
- Init container logs
- K8s events with source and repeat count
- Pod conditions and container states
- Deployment rollout progress with ReplicaSet breakdown
- CronJob run history with pass/fail chart
- CPU/memory usage (requires metrics-server)
- Related services, ingress, configmaps, secrets
- Helm release info
- Raw pod spec (collapsible)
- Exportable markdown snapshot

Dark and light mode. Keyboard-driven: Cmd+K to search, Esc to go back, `l` to follow logs, `/` to search logs, `t` for timestamps.

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
