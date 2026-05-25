import type { HelmInfo } from './types'

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
