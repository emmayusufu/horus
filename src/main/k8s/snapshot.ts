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
    const countSuffix = event.count > 1 ? ` (x${event.count})` : ''
    const sourcePrefix = event.source ? `[${event.source}] ` : ''
    lines.push(`- ${event.timestamp}  ${sourcePrefix}${event.reason}${countSuffix}: ${event.message}`)
  }
  lines.push('')

  lines.push('## Logs')
  for (const log of logs) {
    const initLabel = log.isInit ? ' (init)' : ''
    lines.push(`### Container: ${log.containerName}${initLabel}`)
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
