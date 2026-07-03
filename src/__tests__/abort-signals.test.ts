import { describe, expect, it, vi } from 'vitest'
import { combineAbortSignals } from '@/lib/abort-signals'

describe('combineAbortSignals', () => {
  it('aborts when any source aborts without AbortSignal.any', () => {
    const original = AbortSignal.any
    vi.stubGlobal('AbortSignal', Object.assign(AbortSignal, { any: undefined }))
    const first = new AbortController()
    const second = new AbortController()
    const combined = combineAbortSignals([first.signal, second.signal])
    second.abort()
    expect(combined.aborted).toBe(true)
    Object.assign(AbortSignal, { any: original })
    vi.unstubAllGlobals()
  })
})
