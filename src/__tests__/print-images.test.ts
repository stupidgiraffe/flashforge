import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')

function getRuleBody(selector: string, source = css): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return source.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm'))?.[1] ?? ''
}

describe('print image rendering', () => {
  it('keeps the print portal laid out before print so image geometry can be measured', () => {
    const basePrintRule = getRuleBody('.print-only')

    expect(basePrintRule).not.toMatch(/display:\s*none/)
    expect(basePrintRule).toMatch(/position:\s*fixed/)
    expect(basePrintRule).toMatch(/visibility:\s*hidden/)
    expect(basePrintRule).toMatch(/left:\s*-100000px/)
  })

  it('restores the print portal visibly in print media', () => {
    const printMedia = css.slice(css.indexOf('@media print'))
    const printRule = getRuleBody('.print-only', printMedia)

    expect(printRule).toMatch(/display:\s*block !important/)
    expect(printRule).toMatch(/position:\s*static !important/)
    expect(printRule).toMatch(/visibility:\s*visible !important/)
  })
})
