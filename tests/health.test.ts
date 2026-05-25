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
