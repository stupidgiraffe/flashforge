import { describe, expect, it } from 'vitest'
import { DESIGN_PRESETS } from '@/lib/design-presets'
import { DEFAULT_PRINT_SETTINGS } from '@/lib/types'

describe('design presets', () => {
  it('provides the six classroom presets', () => {
    expect(DESIGN_PRESETS.map((preset) => preset.name)).toEqual([
      'Clean Classroom', 'Cute Young Learners', 'Picture Vocabulary', 'Bold Review', 'Ink Saver', 'Teacher Pro',
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
})
