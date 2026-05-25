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
          const totalCount =
            readyCount + (endpoints.subsets?.reduce((sum, s) => sum + (s.notReadyAddresses?.length ?? 0), 0) ?? 0)
          related.push({
            kind: 'Service',
            name: svc.metadata!.name!,
            detail: `${readyCount}/${totalCount} endpoints ready`
          })
        }
      }
    } catch {}

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
    } catch {}

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
    } catch {}

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
    } catch {}
  }

  return related
}
