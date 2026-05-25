import { describe, it, expect } from 'vitest'
import { parseHelmLabels } from '../src/shared/helm'

describe('parseHelmLabels', () => {
  it('returns null for non-Helm resources', () => {
    expect(parseHelmLabels({})).toBeNull()
    expect(parseHelmLabels({ app: 'test' })).toBeNull()
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
    const labels = { 'app.kubernetes.io/managed-by': 'Helm', 'helm.sh/chart': 'myapp' }
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
