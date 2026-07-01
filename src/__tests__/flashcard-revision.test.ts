import { describe, expect, it } from 'vitest'
import { getChangedFields, mergeRevisedCards, validateRevisionResult } from '../lib/flashcard-revision'
import type { FlashCard } from '../lib/types'

function makeCard(overrides: Partial<FlashCard> & { id: string; frontText: string; backText: string }): FlashCard {
  return {
    imagePosition: 'front',
    frontImageScale: 1,
    backImageScale: 1,
    frontImageOffsetX: 0,
    frontImageOffsetY: 0,
    backImageOffsetX: 0,
    backImageOffsetY: 0,
    imageScale: 1,
    ...overrides,
  }
}

describe('validateRevisionResult', () => {
  it('keeps selected ids and reports unknown ids', () => {
    const result = validateRevisionResult(
      [
        { id: 'c1', frontText: 'Updated' },
        { id: 'unknown', frontText: 'Nope' },
      ],
      ['c1', 'c2'],
    )

    expect(result.validCards.map((card) => card.id)).toEqual(['c1'])
    expect(result.unknownIds).toEqual(['unknown'])
  })

  it('blocks all revisions when no cards are selected', () => {
    const result = validateRevisionResult([{ id: 'c1', frontText: 'Updated' }], [])

    expect(result.validCards).toEqual([])
    expect(result.unknownIds).toEqual(['c1'])
  })
})

describe('mergeRevisedCards', () => {
  it('only changes selected cards with matching revised ids', () => {
    const cards = [
      makeCard({ id: 'c1', frontText: 'Old 1', backText: 'Back 1' }),
      makeCard({ id: 'c2', frontText: 'Old 2', backText: 'Back 2' }),
      makeCard({ id: 'c3', frontText: 'Old 3', backText: 'Back 3' }),
    ]

    const result = mergeRevisedCards(
      cards,
      [
        { id: 'c1', frontText: 'New 1', backText: 'New Back 1' },
        { id: 'c3', frontText: 'Should not apply' },
        { id: 'unknown', frontText: 'Should not exist' },
      ],
      ['c1', 'c2'],
    )

    expect(result).toHaveLength(3)
    expect(result[0]).toMatchObject({ id: 'c1', frontText: 'New 1', backText: 'New Back 1' })
    expect(result[1]).toMatchObject({ id: 'c2', frontText: 'Old 2', backText: 'Back 2' })
    expect(result[2]).toMatchObject({ id: 'c3', frontText: 'Old 3', backText: 'Back 3' })
  })

  it('does not blank original text from empty AI fields', () => {
    const cards = [makeCard({ id: 'c1', frontText: 'Keep front', backText: 'Keep back' })]
    const result = mergeRevisedCards(cards, [{ id: 'c1', frontText: ' ', backText: '' }], ['c1'])

    expect(result[0].frontText).toBe('Keep front')
    expect(result[0].backText).toBe('Keep back')
  })

  it('is idempotent when the same revision is merged again', () => {
    const cards = [makeCard({ id: 'c1', frontText: 'Old', backText: 'Back' })]
    const once = mergeRevisedCards(cards, [{ id: 'c1', frontText: 'New', backText: 'Back' }], ['c1'])
    const twice = mergeRevisedCards(once, [{ id: 'c1', frontText: 'New', backText: 'Back' }], ['c1'])

    expect(twice).toEqual(once)
  })
})

describe('getChangedFields', () => {
  it('reports text and image query suggestions for preview', () => {
    const original = makeCard({ id: 'c1', frontText: 'Old front', backText: 'Old back' })
    const changes = getChangedFields(original, {
      id: 'c1',
      frontText: 'New front',
      backText: 'Old back',
      frontImageQuery: 'clear apple classroom photo',
    })

    expect(changes.map((change) => change.field)).toEqual(['frontText', 'frontImageQuery'])
  })
})
