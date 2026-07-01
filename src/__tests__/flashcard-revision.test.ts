import { describe, expect, it } from 'vitest'
import { applyRevisionPatches, getPatchChanges, validateRevisionPatches } from '../lib/flashcard-revision'
import type { FlashCard } from '../lib/types'

function makeCard(overrides: Partial<FlashCard> & { id: string; frontText: string; backText: string }): FlashCard {
  return { imagePosition: 'front', imageScale: 1, ...overrides }
}

describe('validateRevisionPatches', () => {
  it('accepts only selected card IDs and fields allowed by scope', () => {
    const result = validateRevisionPatches([
      { cardId: 'c1', field: 'frontText', value: 'Simpler' },
      { cardId: 'c1', field: 'frontImageQuery', value: 'clear apple photo' },
      { cardId: 'unknown', field: 'backText', value: 'Nope' },
    ], ['c1'], 'text')

    expect(result.validPatches).toEqual([{ cardId: 'c1', field: 'frontText', value: 'Simpler' }])
    expect(result.rejected).toEqual(['c1:frontImageQuery', 'unknown'])
  })

  it('deduplicates repeated field operations and rejects empty values', () => {
    const result = validateRevisionPatches([
      { cardId: 'c1', field: 'backText', value: 'First' },
      { cardId: 'c1', field: 'backText', value: 'Second' },
      { cardId: 'c1', field: 'frontText', value: '  ' },
    ], ['c1'], 'both')

    expect(result.validPatches).toEqual([{ cardId: 'c1', field: 'backText', value: 'First' }])
  })
})

describe('applyRevisionPatches', () => {
  it('changes only explicit text fields on selected cards', () => {
    const cards = [
      makeCard({ id: 'c1', frontText: 'Old 1', backText: 'Back 1', frontImageUrl: 'keep.jpg' }),
      makeCard({ id: 'c2', frontText: 'Old 2', backText: 'Back 2' }),
    ]
    const result = applyRevisionPatches(cards, [
      { cardId: 'c1', field: 'frontText', value: 'New 1' },
      { cardId: 'c2', field: 'backText', value: 'Should not apply' },
      { cardId: 'c1', field: 'frontImageQuery', value: 'replacement image' },
    ], ['c1'])

    expect(result[0]).toMatchObject({ frontText: 'New 1', backText: 'Back 1', frontImageUrl: 'keep.jpg' })
    expect(result[1]).toBe(cards[1])
  })

  it('is idempotent when the same patches are applied twice', () => {
    const cards = [makeCard({ id: 'c1', frontText: 'Old', backText: 'Back' })]
    const patches = [{ cardId: 'c1', field: 'frontText', value: 'New' }] as const
    const once = applyRevisionPatches(cards, [...patches], ['c1'])
    const twice = applyRevisionPatches(once, [...patches], ['c1'])

    expect(twice).toEqual(once)
  })
})

describe('getPatchChanges', () => {
  it('builds a preview for text and image-query operations', () => {
    const original = makeCard({ id: 'c1', frontText: 'Old front', backText: 'Old back', frontImageUrl: 'old.jpg' })
    const changes = getPatchChanges(original, [
      { cardId: 'c1', field: 'frontText', value: 'New front' },
      { cardId: 'c1', field: 'frontImageQuery', value: 'clear apple classroom photo' },
    ])

    expect(changes.map((change) => change.field)).toEqual(['frontText', 'frontImageQuery'])
    expect(changes[1].before).toBe('old.jpg')
  })
})
