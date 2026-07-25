import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  MODEL_BROWSER_PAGE_SIZE,
  filterModelOptions,
  getVisibleModelOptions,
  isIntentionalModelTap,
  readRecentModels,
  rememberRecentModel,
  type AiModelOption,
  type ModelHistoryStorage,
} from '@/lib/ai-models'

const browserSource = readFileSync(new URL('../components/AiModelBrowser.tsx', import.meta.url), 'utf8')
const pickerSource = readFileSync(new URL('../components/AiModelPicker.tsx', import.meta.url), 'utf8')

function models(count = 400): AiModelOption[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `provider/model-${index}`,
    name: `Classroom Model ${index}`,
    provider: 'openrouter',
    contextLength: 128_000 + index,
    structuredOutput: index % 2 === 0,
  }))
}

function storage(): ModelHistoryStorage & { value: string } {
  return {
    value: '',
    getItem() { return this.value || null },
    setItem(_key, value) { this.value = value },
  }
}

describe('AI model browser', () => {
  it('searches 400 options while rendering a bounded first page', () => {
    const options = models()
    expect(filterModelOptions(options, 'model-399')).toHaveLength(1)
    expect(getVisibleModelOptions(options, '')).toHaveLength(MODEL_BROWSER_PAGE_SIZE)
    expect(getVisibleModelOptions(options, '', MODEL_BROWSER_PAGE_SIZE * 2)).toHaveLength(120)
  })

  it('distinguishes an explicit tap from drag scrolling', () => {
    expect(isIntentionalModelTap({ x: 10, y: 10 }, { x: 13, y: 14 })).toBe(true)
    expect(isIntentionalModelTap({ x: 10, y: 10 }, { x: 10, y: 42 })).toBe(false)
    expect(browserSource).toContain('onPointerMove')
    expect(browserSource).toContain('if (pointerMovedRef.current && event.detail !== 0) return')
    expect(browserSource).toContain("import type { MouseEvent } from 'react'")
    expect(browserSource).toContain('event: MouseEvent<HTMLButtonElement>')
    expect(browserSource).not.toContain('React.MouseEvent')
  })

  it('persists recent model metadata without credentials', () => {
    const memory = storage()
    rememberRecentModel(models(1)[0], memory)
    expect(readRecentModels('openrouter', memory)).toHaveLength(1)
    expect(memory.value).not.toMatch(/apiKey|credential|token|secret/i)
  })

  it('retains manual entry and prevents long labels from widening the viewport', () => {
    expect(pickerSource).toContain('id="ai-model-id"')
    expect(browserSource).toContain('min-w-0')
    expect(browserSource).toContain('truncate')
    expect(browserSource).toContain('overscroll-contain')
    expect(browserSource).toContain('Load more')
  })
})
