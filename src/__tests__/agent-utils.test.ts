import { describe, it, expect } from 'vitest'
import { mergeAgentResults, prependCard, reorderCardsById } from '../lib/agent-utils'
import type { FlashCard } from '../lib/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

describe('manual card ordering', () => {
  it('prepends a manually-created card without changing existing cards', () => {
    const existing = [makeCard({ id: 'old-1', frontText: 'Old', backText: 'Back' })]
    const newCard = makeCard({ id: 'new-1', frontText: '', backText: '' })
    const result = prependCard(existing, newCard)

    expect(result.map((card) => card.id)).toEqual(['new-1', 'old-1'])
    expect(result[1]).toBe(existing[0])
  })

  it('moves cards by id without mutating the original order', () => {
    const cards = [
      makeCard({ id: 'c1', frontText: 'One', backText: '1' }),
      makeCard({ id: 'c2', frontText: 'Two', backText: '2' }),
      makeCard({ id: 'c3', frontText: 'Three', backText: '3' }),
    ]
    const result = reorderCardsById(cards, 'c3', 'c1')

    expect(result.map((card) => card.id)).toEqual(['c3', 'c1', 'c2'])
    expect(cards.map((card) => card.id)).toEqual(['c1', 'c2', 'c3'])
  })

  it('returns the same array when a drag target is missing', () => {
    const cards = [makeCard({ id: 'c1', frontText: 'One', backText: '1' })]
    expect(reorderCardsById(cards, 'c1', 'missing')).toBe(cards)
  })
})

// ---------------------------------------------------------------------------
// create mode
// ---------------------------------------------------------------------------

describe('mergeAgentResults – create mode', () => {
  it('adds generated cards to an empty deck', () => {
    const result = mergeAgentResults(
      [],
      [{ id: 'c1', frontText: 'Hello', backText: 'こんにちは' }],
      [],
      'create',
    )
    expect(result).toHaveLength(1)
    expect(result[0].frontText).toBe('Hello')
  })

  it('regression: generated cards survive after Phase-2 image updates (stale-snapshot bug)', () => {
    // Before the fix, Phase 2 called prev.cards.map() where prev was the
    // frozen pre-Phase-1 snapshot (0 cards), wiping everything Phase 1 saved.
    const generated = [
      { id: 'c1', frontText: 'Cat', backText: 'ねこ' },
      { id: 'c2', frontText: 'Dog', backText: 'いぬ' },
    ]
    const imageUpdates = [
      { cardId: 'c1', side: 'front' as const, imageUrl: 'https://example.com/cat.jpg' },
      { cardId: 'c2', side: 'front' as const, imageUrl: 'https://example.com/dog.jpg' },
    ]

    const result = mergeAgentResults([], generated, imageUpdates, 'create')

    // Both generated cards must be present — the bug would return []
    expect(result).toHaveLength(2)
    expect(result[0].frontText).toBe('Cat')
    expect(result[0].frontImageUrl).toBe('https://example.com/cat.jpg')
    expect(result[1].frontText).toBe('Dog')
    expect(result[1].frontImageUrl).toBe('https://example.com/dog.jpg')
  })

  it('partial success: cards with no matching image are still present', () => {
    const generated = [
      { id: 'c1', frontText: 'Cat', backText: 'ねこ' },
      { id: 'c2', frontText: 'Dog', backText: 'いぬ' },
    ]
    // Only c1 got an image
    const imageUpdates = [
      { cardId: 'c1', side: 'front' as const, imageUrl: 'https://example.com/cat.jpg' },
    ]

    const result = mergeAgentResults([], generated, imageUpdates, 'create')

    expect(result).toHaveLength(2)
    expect(result[0].frontImageUrl).toBe('https://example.com/cat.jpg')
    // c2 has no image but must still exist
    expect(result[1].frontText).toBe('Dog')
    expect(result[1].frontImageUrl).toBeUndefined()
  })

  it('prepends generated cards while preserving existing cards unchanged', () => {
    const existing = [makeCard({ id: 'existing-1', frontText: 'Old', backText: 'Old back' })]
    const generated = [{ id: 'new-1', frontText: 'New', backText: 'New back' }]

    const result = mergeAgentResults(existing, generated, [], 'create')

    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('new-1')
    expect(result[1]).toBe(existing[0])
    expect(result[1]).toMatchObject({ id: 'existing-1', frontText: 'Old', backText: 'Old back' })
  })

  it('applies back-side image updates correctly', () => {
    const generated = [{ id: 'c1', frontText: 'Apple', backText: 'りんご' }]
    const imageUpdates = [
      { cardId: 'c1', side: 'back' as const, imageUrl: 'https://example.com/apple-back.jpg' },
    ]

    const result = mergeAgentResults([], generated, imageUpdates, 'create')

    expect(result[0].backImageUrl).toBe('https://example.com/apple-back.jpg')
    expect(result[0].frontImageUrl).toBeUndefined()
  })

  it('sets neutral crop/zoom defaults for generated cards', () => {
    const result = mergeAgentResults(
      [],
      [{ id: 'c1', frontText: 'X', backText: 'Y' }],
      [],
      'create',
    )
    const card = result[0]
    expect(card.frontImageScale).toBe(1)
    expect(card.frontImageOffsetX).toBe(0)
    expect(card.frontImageOffsetY).toBe(0)
    expect(card.backImageScale).toBe(1)
    expect(card.backImageOffsetX).toBe(0)
    expect(card.backImageOffsetY).toBe(0)
  })

  it('resets crop/zoom to neutral when applying an image', () => {
    const generated = [{ id: 'c1', frontText: 'X', backText: 'Y' }]
    const imageUpdates = [
      { cardId: 'c1', side: 'front' as const, imageUrl: 'https://example.com/x.jpg' },
    ]

    const result = mergeAgentResults([], generated, imageUpdates, 'create')

    expect(result[0].frontImageScale).toBe(1)
    expect(result[0].frontImageOffsetX).toBe(0)
    expect(result[0].frontImageOffsetY).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// enhance mode
// ---------------------------------------------------------------------------

describe('mergeAgentResults – enhance mode', () => {
  it('updates text for matching cards', () => {
    const existing = [makeCard({ id: 'c1', frontText: 'Old Front', backText: 'Old Back' })]
    const generated = [{ id: 'c1', frontText: 'New Front', backText: 'New Back' }]

    const result = mergeAgentResults(existing, generated, [], 'enhance')

    expect(result).toHaveLength(1)
    expect(result[0].frontText).toBe('New Front')
    expect(result[0].backText).toBe('New Back')
  })

  it('leaves cards unchanged when not in generated set', () => {
    const existing = [
      makeCard({ id: 'c1', frontText: 'Keep me', backText: 'Back' }),
      makeCard({ id: 'c2', frontText: 'Update me', backText: 'Back2' }),
    ]
    const generated = [{ id: 'c2', frontText: 'Updated', backText: 'Updated back' }]

    const result = mergeAgentResults(existing, generated, [], 'enhance')

    expect(result).toHaveLength(2)
    expect(result[0].frontText).toBe('Keep me')
    expect(result[1].frontText).toBe('Updated')
  })

  it('applies image updates to enhanced cards', () => {
    const existing = [makeCard({ id: 'c1', frontText: 'Word', backText: 'Back' })]
    const generated = [{ id: 'c1', frontText: 'Word', backText: 'Back' }]
    const imageUpdates = [
      { cardId: 'c1', side: 'front' as const, imageUrl: 'https://example.com/word.jpg' },
    ]

    const result = mergeAgentResults(existing, generated, imageUpdates, 'enhance')

    expect(result[0].frontImageUrl).toBe('https://example.com/word.jpg')
  })
})
