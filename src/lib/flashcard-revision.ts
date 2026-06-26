import type { FlashCard } from './types'

export interface FlashcardRevisionCard extends Partial<FlashCard> {
  id: string
  frontImageQuery?: string
  backImageQuery?: string
}

export interface RevisionFieldChange {
  field: 'frontText' | 'backText' | 'frontImageQuery' | 'backImageQuery'
  before: string
  after: string
}

export function validateRevisionResult(
  revisedCards: FlashcardRevisionCard[],
  selectedIds: Iterable<string>,
): { validCards: FlashcardRevisionCard[]; unknownIds: string[] } {
  const selected = new Set(selectedIds)
  const seen = new Set<string>()
  const validCards: FlashcardRevisionCard[] = []
  const unknownIds: string[] = []

  for (const card of revisedCards) {
    if (!card?.id || seen.has(card.id)) continue
    seen.add(card.id)
    if (!selected.has(card.id)) {
      unknownIds.push(card.id)
      continue
    }
    validCards.push(card)
  }

  return { validCards, unknownIds }
}

function nextText(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return trimmed || fallback
}

export function mergeRevisedCards(
  originalCards: FlashCard[],
  revisedCards: FlashcardRevisionCard[],
  selectedIds: Iterable<string>,
  allowImageChanges = false,
): FlashCard[] {
  const selected = new Set(selectedIds)
  const { validCards } = validateRevisionResult(revisedCards, selected)
  const byId = new Map(validCards.map((card) => [card.id, card]))

  return originalCards.map((card) => {
    if (!selected.has(card.id)) return card
    const revised = byId.get(card.id)
    if (!revised) return card

    return {
      ...card,
      frontText: nextText(revised.frontText, card.frontText),
      backText: nextText(revised.backText, card.backText),
      ...(allowImageChanges && typeof revised.frontImageUrl === 'string' && revised.frontImageUrl.trim()
        ? { frontImageUrl: revised.frontImageUrl.trim(), frontImageScale: 1, frontImageOffsetX: 0, frontImageOffsetY: 0 }
        : {}),
      ...(allowImageChanges && typeof revised.backImageUrl === 'string' && revised.backImageUrl.trim()
        ? { backImageUrl: revised.backImageUrl.trim(), backImageScale: 1, backImageOffsetX: 0, backImageOffsetY: 0 }
        : {}),
    }
  })
}

export function getChangedFields(
  originalCard: FlashCard,
  revisedCard: FlashcardRevisionCard,
): RevisionFieldChange[] {
  const changes: RevisionFieldChange[] = []
  const frontText = nextText(revisedCard.frontText, originalCard.frontText)
  const backText = nextText(revisedCard.backText, originalCard.backText)

  if (frontText !== originalCard.frontText) {
    changes.push({ field: 'frontText', before: originalCard.frontText, after: frontText })
  }
  if (backText !== originalCard.backText) {
    changes.push({ field: 'backText', before: originalCard.backText, after: backText })
  }
  if (typeof revisedCard.frontImageQuery === 'string' && revisedCard.frontImageQuery.trim()) {
    changes.push({ field: 'frontImageQuery', before: '', after: revisedCard.frontImageQuery.trim() })
  }
  if (typeof revisedCard.backImageQuery === 'string' && revisedCard.backImageQuery.trim()) {
    changes.push({ field: 'backImageQuery', before: '', after: revisedCard.backImageQuery.trim() })
  }

  return changes
}
