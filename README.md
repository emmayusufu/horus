# Horus

Kubernetes incident debugger. When a pod crashes, instead of running kubectl logs/describe/get events/etc across 5+ clusters, open it in Horus and get everything on one screen.

## Features

Three views: **Overview** (cluster health, what's broken), **Explore** (browse resources with filters), **Debug** (full context for one resource).

The Debug view pulls together:
- Streaming logs with search, level coloring, and timestamps
- Init container logs
- K8s events with source and repeat count
- Pod conditions and container states
- CPU/memory usage (requires metrics-server)
- Related services, ingress, configmaps, secrets
- Helm release info
- Raw pod spec (collapsible)
- Exportable markdown snapshot

Keyboard-driven: Cmd+K to search, Esc to go back.

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
