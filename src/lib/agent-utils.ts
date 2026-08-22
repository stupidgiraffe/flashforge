import type { FlashCard } from './types'

export interface AgentGeneratedCard {
  id: string
  frontText: string
  backText: string
}

export interface AgentImageUpdate {
  cardId: string
  side: 'front' | 'back'
  imageUrl: string
}

export type AgentMode = 'create' | 'enhance'

export function prependCard(cards: FlashCard[], newCard: FlashCard): FlashCard[] {
  return [newCard, ...cards]
}

export function reorderCardsById(cards: FlashCard[], activeId: string, overId: string): FlashCard[] {
  const oldIndex = cards.findIndex((card) => card.id === activeId)
  const newIndex = cards.findIndex((card) => card.id === overId)
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return cards
  const reordered = [...cards]
  const [moved] = reordered.splice(oldIndex, 1)
  reordered.splice(newIndex, 0, moved)
  return reordered
}

/**
 * Pure helper that merges agent-generated cards and image updates with the
 * existing deck.  Extracted from `runImageAgent` so it can be unit-tested
 * without network access.
 *
 * Phase 1 — card generation:
 *   create:  prepends `generatedCards` before `existingCards` without
 *            modifying any existing card
 *   enhance: updates matching existing cards with new text
 *
 * Phase 2 — image application:
 *   Updates the working copy in-place by card id.  Crucially this does NOT
 *   derive the card list from `existingCards` again, which was the stale-
 *   snapshot bug: Phase-2 used to call `prev.cards.map(...)` where `prev`
 *   was the frozen pre-Phase-1 snapshot (0 cards), wiping everything.
 *
 * @returns Final array of cards that should be persisted to the set.
 */
export function mergeAgentResults(
  existingCards: FlashCard[],
  generatedCards: AgentGeneratedCard[],
  imageUpdates: AgentImageUpdate[],
  mode: AgentMode,
): FlashCard[] {
  // ── Phase 1: build working copy ─────────────────────────────────────────
  let workingCards: FlashCard[]

  if (mode === 'create') {
    const newCards: FlashCard[] = generatedCards.map((c) => ({
      id: c.id,
      frontText: c.frontText,
      backText: c.backText,
      imagePosition: 'front' as const,
      frontImageScale: 1,
      backImageScale: 1,
      frontImageOffsetX: 0,
      frontImageOffsetY: 0,
      backImageOffsetX: 0,
      backImageOffsetY: 0,
      imageScale: 1,
    }))
    workingCards = [...newCards, ...existingCards]
  } else {
    const byId = new Map(generatedCards.map((c) => [c.id, c]))
    workingCards = existingCards.map((card) => {
      const gen = byId.get(card.id)
      if (!gen) return card
      return {
        ...card,
        frontText: gen.frontText || card.frontText,
        backText: gen.backText || card.backText,
      }
    })
  }

  // ── Phase 2: apply image updates to the working copy ────────────────────
  for (const update of imageUpdates) {
    const idx = workingCards.findIndex((c) => c.id === update.cardId)
    if (idx < 0) continue
    const card = workingCards[idx]
    workingCards[idx] = {
      ...card,
      ...(update.side === 'front'
        ? { frontImageUrl: update.imageUrl, frontImageScale: 1, frontImageOffsetX: 0, frontImageOffsetY: 0 }
        : { backImageUrl: update.imageUrl, backImageScale: 1, backImageOffsetX: 0, backImageOffsetY: 0 }),
    }
  }

  return workingCards
}
