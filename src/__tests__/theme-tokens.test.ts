import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
const darkBlock = css.match(/\.dark\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''

describe('application theme tokens', () => {
  it('defines complete dark-mode surface and interaction tokens', () => {
    const requiredTokens = [
      'background', 'foreground', 'card', 'card-foreground', 'popover', 'popover-foreground',
      'primary', 'primary-foreground', 'secondary', 'secondary-foreground', 'muted',
      'muted-foreground', 'accent', 'accent-foreground', 'destructive',
      'destructive-foreground', 'border', 'input', 'ring',
    ]

    for (const token of requiredTokens) {
      expect(darkBlock).toContain(`--${token}:`)
    }
  })

  it('keeps print rendering in the light color scheme', () => {
    expect(css).toMatch(/@media print[\s\S]*color-scheme:\s*light !important/)
    expect(css).toMatch(/@media print[\s\S]*background:\s*white !important/)
  })
})
