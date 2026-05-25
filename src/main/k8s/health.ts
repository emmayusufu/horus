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

export function scoreHealth(kind: string, status: string, ready: boolean, restarts: number): HealthStatus {
  if (CRITICAL_STATUSES.has(status)) return 'critical'
  if (kind === 'Job' && status === 'Failed') return 'critical'
  if (TERMINAL_HEALTHY.has(status)) return 'healthy'
  if (status === 'Running' && ready && restarts < 5) return 'healthy'
  if (status === 'Running' && ready && restarts >= 5) return 'warning'
  if (status === 'Running' && !ready) return 'warning'
  if (status === 'Pending') return 'warning'
  return 'unknown'
}
