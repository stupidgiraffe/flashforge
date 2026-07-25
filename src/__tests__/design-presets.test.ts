import { describe, expect, it } from 'vitest'
import { applyDesignPreset, DESIGN_PRESETS, getActiveDesignPreset, STYLE_FIELDS } from '@/lib/design-presets'
import { DEFAULT_PRINT_SETTINGS } from '@/lib/types'

describe('design presets', () => {
  it('provides the six classroom presets', () => {
    expect(DESIGN_PRESETS.map((preset) => preset.name)).toEqual([
      'Everyday Classroom',
      'Young Learner Illustrated',
      'Photo Vocabulary',
      'Question & Answer',
      'Fast Review',
      'Low-Ink Print',
    ])
  })

  it('never changes print geometry or duplex alignment fields', () => {
    const forbidden = ['cardsPerPage', 'paperSize', 'orientation', 'duplexMode', 'horizontalOffset', 'verticalOffset', 'backPageOffsetX', 'backPageOffsetY']
    for (const preset of DESIGN_PRESETS) {
      expect(Object.keys(preset.updates).filter((key) => forbidden.includes(key))).toEqual([])
    }
  })

  it('keeps image height ratios in the normalized print-settings range', () => {
    for (const preset of DESIGN_PRESETS) {
      expect(preset.updates.imageHeightRatio).toBeGreaterThanOrEqual(0.2)
      expect(preset.updates.imageHeightRatio).toBeLessThanOrEqual(0.95)
    }
  })

  it('applies every preset to valid print settings without changing layout geometry', () => {
    for (const preset of DESIGN_PRESETS) {
      const applied = { ...DEFAULT_PRINT_SETTINGS, ...preset.updates }
      expect(applied.cardsPerPage).toBe(DEFAULT_PRINT_SETTINGS.cardsPerPage)
      expect(applied.paperSize).toBe(DEFAULT_PRINT_SETTINGS.paperSize)
      expect(applied.orientation).toBe(DEFAULT_PRINT_SETTINGS.orientation)
      expect(applied.duplexMode).toBe(DEFAULT_PRINT_SETTINGS.duplexMode)
      expect(applied.imageHeightRatio).toBeGreaterThanOrEqual(0.2)
      expect(applied.imageHeightRatio).toBeLessThanOrEqual(0.95)
    }
  })

  it('gives every style a complete and materially distinct appearance', () => {
    const signatures = DESIGN_PRESETS.map((item) => JSON.stringify(item.updates))
    expect(new Set(signatures).size).toBe(DESIGN_PRESETS.length)
    for (const item of DESIGN_PRESETS) {
      expect(Object.keys(item.updates).sort()).toEqual([...STYLE_FIELDS].sort())
    }
  })

  it('detects the active style and reports manual appearance changes as customized', () => {
    const selected = DESIGN_PRESETS[0]
    const applied = applyDesignPreset(DEFAULT_PRINT_SETTINGS, selected)
    expect(getActiveDesignPreset(applied)?.id).toBe(selected.id)
    expect(getActiveDesignPreset({ ...applied, fontSize: applied.fontSize + 1 })).toBeNull()
  })

  it('applies appearance fields only and preserves geometry, duplex, and offsets', () => {
    const customLayout = {
      ...DEFAULT_PRINT_SETTINGS,
      paperSize: 'a4' as const,
      orientation: 'landscape' as const,
      cardsPerPage: 9 as const,
      duplexMode: 'short-edge' as const,
      horizontalOffset: 7,
      verticalOffset: -3,
      backPageOffsetX: 1.5,
      backPageOffsetY: -2,
    }
    const applied = applyDesignPreset(customLayout, DESIGN_PRESETS[2])
    expect(applied).toMatchObject({
      paperSize: 'a4',
      orientation: 'landscape',
      cardsPerPage: 9,
      duplexMode: 'short-edge',
      horizontalOffset: 7,
      verticalOffset: -3,
      backPageOffsetX: 1.5,
      backPageOffsetY: -2,
    })
  })
})
