import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8')

describe('mobile revision dialog', () => {
  it('keeps running controls and status inside a dynamic-viewport dialog', () => {
    expect(appSource).toContain('calc(100dvh-1rem)')
    expect(appSource).toContain('grid-rows-[auto_minmax(0,1fr)_auto]')
    expect(appSource).toContain('sticky top-0')
    expect(appSource).toContain('sticky bottom-0')
    expect(appSource).toContain('overflow-y-auto overscroll-contain')
    expect(appSource).toContain('aria-live="polite"')
    expect(appSource).toContain('Cancel and keep progress')
  })

  it('aborts the active request while preserving a saved job', () => {
    expect(appSource).toMatch(/function cancelRevisionAndKeepProgress\(\)[\s\S]*revisionCancelRef\.current\?\.abort\(\)/)
    expect(appSource).toMatch(/markRevisionJob\(activeJob, wasCancelled \? 'cancelled' : 'failed'\)[\s\S]*persistRevisionJob/)
  })

  it('keeps Done separate from confirmed discard and partial apply', () => {
    expect(appSource).toMatch(/Done[\s\S]*setRevisionDialogOpen/)
    expect(appSource).toContain('<AlertDialog open={revisionDiscardOpen}')
    expect(appSource).toContain('Discard saved revision?')
    expect(appSource).toContain('Apply completed changes')
    expect(appSource).toContain('revalidateRevisionJobForApply(revisionJob, set.cards)')
  })
})
