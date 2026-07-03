import { describe, expect, it } from 'vitest'
import { DESIGN_PRESETS } from '@/lib/design-presets'

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
})
