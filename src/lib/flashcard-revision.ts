import type { FlashCard } from './types'

export type RevisionScope = 'text' | 'images' | 'both'
export type RevisionPatchField = 'frontText' | 'backText' | 'frontImageQuery' | 'backImageQuery'

export interface RevisionPatchOperation {
  cardId: string
  field: RevisionPatchField
  value: string
}

export interface RevisionFieldChange {
  field: RevisionPatchField
  before: string
  after: string
}

const TEXT_FIELDS = new Set<RevisionPatchField>(['frontText', 'backText'])
const IMAGE_FIELDS = new Set<RevisionPatchField>(['frontImageQuery', 'backImageQuery'])

function fieldAllowed(field: RevisionPatchField, scope: RevisionScope): boolean {
  if (scope === 'both') return true
  return scope === 'text' ? TEXT_FIELDS.has(field) : IMAGE_FIELDS.has(field)
}

export function validateRevisionPatches(
  patches: RevisionPatchOperation[],
  selectedIds: Iterable<string>,
  scope: RevisionScope,
): { validPatches: RevisionPatchOperation[]; rejected: string[] } {
  const selected = new Set(selectedIds)
  const seen = new Set<string>()
  const validPatches: RevisionPatchOperation[] = []
  const rejected: string[] = []

  for (const patch of patches) {
    const cardId = typeof patch?.cardId === 'string' ? patch.cardId.trim() : ''
    const field = patch?.field as RevisionPatchField
    const value = typeof patch?.value === 'string' ? patch.value.trim() : ''
    const key = `${cardId}:${field}`
    if (!cardId || !selected.has(cardId)) {
      rejected.push(cardId || 'missing card id')
      continue
    }
    if ((!TEXT_FIELDS.has(field) && !IMAGE_FIELDS.has(field)) || !fieldAllowed(field, scope)) {
      rejected.push(key)
      continue
    }
    if (!value || seen.has(key)) continue
    seen.add(key)
    validPatches.push({ cardId, field, value })
  }

  return { validPatches, rejected }
}

export function applyRevisionPatches(
  cards: FlashCard[],
  patches: RevisionPatchOperation[],
  selectedIds: Iterable<string>,
): FlashCard[] {
  const selected = new Set(selectedIds)
  const textPatches = patches.filter((patch) => TEXT_FIELDS.has(patch.field) && selected.has(patch.cardId))
  const byCard = new Map<string, RevisionPatchOperation[]>()
  for (const patch of textPatches) {
    byCard.set(patch.cardId, [...(byCard.get(patch.cardId) ?? []), patch])
  }

  return cards.map((card) => {
    const cardPatches = byCard.get(card.id)
    if (!cardPatches) return card
    const updates: Partial<FlashCard> = {}
    for (const patch of cardPatches) {
      if (patch.field === 'frontText' && patch.value !== card.frontText) updates.frontText = patch.value
      if (patch.field === 'backText' && patch.value !== card.backText) updates.backText = patch.value
    }
    return Object.keys(updates).length > 0 ? { ...card, ...updates } : card
  })
}

export function getPatchChanges(
  originalCard: FlashCard,
  patches: RevisionPatchOperation[],
): RevisionFieldChange[] {
  return patches
    .filter((patch) => patch.cardId === originalCard.id)
    .map((patch) => ({
      field: patch.field,
      before: patch.field === 'frontText'
        ? originalCard.frontText
        : patch.field === 'backText'
          ? originalCard.backText
          : patch.field === 'frontImageQuery'
            ? originalCard.frontImage?.title || originalCard.frontImageUrl || 'Current front image'
            : originalCard.backImage?.title || originalCard.backImageUrl || 'Current back image',
      after: patch.value,
    }))
    .filter((change) => change.before !== change.after)
}
