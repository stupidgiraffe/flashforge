import type { FlashCard } from './types'
import {
  validateRevisionPatches,
  type RevisionPatchOperation,
  type RevisionScope,
} from './flashcard-revision'

export const REVISION_JOB_VERSION = 1
export const REVISION_BATCH_SIZE = 5
export const REVISION_JOB_RETENTION_MS = 7 * 24 * 60 * 60 * 1000

export type RevisionJobStatus = 'running' | 'partial' | 'complete' | 'failed' | 'cancelled'

export interface RevisionJob {
  version: typeof REVISION_JOB_VERSION
  deckId: string
  selectedCardIds: string[]
  feedback: string
  scope: RevisionScope
  processedCardIds: string[]
  pendingCardIds: string[]
  previewPatches: RevisionPatchOperation[]
  rejectedOperationCount: number
  sourceCards: RevisionSourceCard[]
  createdAt: number
  updatedAt: number
  status: RevisionJobStatus
}

export type RevisionSourceCard = Pick<FlashCard, 'id' | 'frontText' | 'backText'> & {
  frontImageUrl?: string
  backImageUrl?: string
}

export interface RevisionProviderConfig {
  apiKey: string
  baseUrl: string
  model: string
}

export interface RevisionRequestPayload {
  mode: 'revise'
  instructions: string
  revisionScope: RevisionScope
  existingCards: Array<Pick<FlashCard, 'id' | 'frontText' | 'backText'> & {
    frontImageUrl?: string
    backImageUrl?: string
  }>
  aiApiKey: string
  aiBaseUrl: string
  aiModel: string
}

export interface RevisionStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function uniqueIds(ids: Iterable<string>): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of ids) {
    const id = typeof value === 'string' ? value.trim() : ''
    if (!id || seen.has(id)) continue
    seen.add(id)
    result.push(id)
  }
  return result
}

function safeRemoteImageUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

export function revisionJobStorageKey(deckId: string): string {
  return `flashforge_revision_job:v${REVISION_JOB_VERSION}:${deckId}`
}

export function createRevisionJob(
  deckId: string,
  selectedCardIds: Iterable<string>,
  feedback: string,
  scope: RevisionScope,
  now = Date.now(),
  cards: FlashCard[] = [],
): RevisionJob {
  const selected = uniqueIds(selectedCardIds)
  const selectedSet = new Set(selected)
  return {
    version: REVISION_JOB_VERSION,
    deckId,
    selectedCardIds: selected,
    feedback: feedback.trim(),
    scope,
    processedCardIds: [],
    pendingCardIds: [...selected],
    previewPatches: [],
    rejectedOperationCount: 0,
    sourceCards: cards
      .filter((card) => selectedSet.has(card.id))
      .map((card) => {
        const frontImageUrl = safeRemoteImageUrl(card.frontImage?.originalUrl || card.frontImageUrl)
        const backImageUrl = safeRemoteImageUrl(card.backImage?.originalUrl || card.backImageUrl)
        return {
          id: card.id,
          frontText: card.frontText,
          backText: card.backText,
          ...(frontImageUrl ? { frontImageUrl } : {}),
          ...(backImageUrl ? { backImageUrl } : {}),
        }
      }),
    createdAt: now,
    updatedAt: now,
    status: 'running',
  }
}

export function getNextRevisionBatch(job: RevisionJob, batchSize = REVISION_BATCH_SIZE): string[] {
  return job.pendingCardIds.slice(0, Math.max(1, batchSize))
}

export function mergeRevisionBatch(
  job: RevisionJob,
  batchCardIds: Iterable<string>,
  patches: RevisionPatchOperation[],
  providerRejectedCount = 0,
  now = Date.now(),
): RevisionJob {
  const batch = uniqueIds(batchCardIds).filter((id) => job.pendingCardIds.includes(id))
  const { validPatches, rejected } = validateRevisionPatches(patches, batch, job.scope)
  const existingKeys = new Set(job.previewPatches.map((patch) => `${patch.cardId}:${patch.field}`))
  const mergedPatches = [...job.previewPatches]
  let duplicateCount = 0

  for (const patch of validPatches) {
    const key = `${patch.cardId}:${patch.field}`
    if (existingKeys.has(key)) {
      duplicateCount += 1
      continue
    }
    existingKeys.add(key)
    mergedPatches.push(patch)
  }

  const processed = new Set(job.processedCardIds)
  batch.forEach((id) => processed.add(id))
  const pendingCardIds = job.selectedCardIds.filter((id) => !processed.has(id))

  return {
    ...job,
    processedCardIds: job.selectedCardIds.filter((id) => processed.has(id)),
    pendingCardIds,
    previewPatches: mergedPatches,
    rejectedOperationCount: job.rejectedOperationCount
      + rejected.length
      + duplicateCount
      + Math.max(0, providerRejectedCount),
    updatedAt: now,
    status: pendingCardIds.length === 0 ? 'complete' : 'partial',
  }
}

export function markRevisionJob(
  job: RevisionJob,
  status: Extract<RevisionJobStatus, 'running' | 'failed' | 'cancelled'>,
  now = Date.now(),
): RevisionJob {
  return { ...job, status, updatedAt: now }
}

export function restoreRevisionJob(
  value: unknown,
  deckId: string,
  cards: Pick<FlashCard, 'id'>[],
  now = Date.now(),
): RevisionJob | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<RevisionJob>
  if (raw.version !== REVISION_JOB_VERSION || raw.deckId !== deckId) return null
  if (typeof raw.updatedAt !== 'number' || now - raw.updatedAt > REVISION_JOB_RETENTION_MS) return null
  if (typeof raw.feedback !== 'string' || !raw.feedback.trim()) return null
  if (raw.scope !== 'text' && raw.scope !== 'images' && raw.scope !== 'both') return null

  const availableIds = new Set(cards.map((card) => card.id))
  const selectedCardIds = uniqueIds(raw.selectedCardIds ?? []).filter((id) => availableIds.has(id))
  if (selectedCardIds.length === 0) return null

  const processedSet = new Set(uniqueIds(raw.processedCardIds ?? []).filter((id) => selectedCardIds.includes(id)))
  const processedCardIds = selectedCardIds.filter((id) => processedSet.has(id))
  const pendingCardIds = selectedCardIds.filter((id) => !processedSet.has(id))
  const rawPatches = Array.isArray(raw.previewPatches) ? raw.previewPatches : []
  const { validPatches, rejected } = validateRevisionPatches(rawPatches, selectedCardIds, raw.scope)
  const suppliedRejected = Number.isFinite(raw.rejectedOperationCount) ? Number(raw.rejectedOperationCount) : 0
  const sourceCards = Array.isArray(raw.sourceCards)
    ? raw.sourceCards
      .filter((card): card is RevisionSourceCard => (
        !!card
        && typeof card.id === 'string'
        && selectedCardIds.includes(card.id)
        && typeof card.frontText === 'string'
        && typeof card.backText === 'string'
      ))
      .map((card) => {
        const frontImageUrl = safeRemoteImageUrl(card.frontImageUrl)
        const backImageUrl = safeRemoteImageUrl(card.backImageUrl)
        return {
          id: card.id,
          frontText: card.frontText,
          backText: card.backText,
          ...(frontImageUrl ? { frontImageUrl } : {}),
          ...(backImageUrl ? { backImageUrl } : {}),
        }
      })
    : []
  const createdAt = typeof raw.createdAt === 'number' ? raw.createdAt : raw.updatedAt
  const suppliedStatus = raw.status
  const status: RevisionJobStatus = pendingCardIds.length === 0
    ? 'complete'
    : suppliedStatus === 'cancelled' || suppliedStatus === 'failed'
      ? suppliedStatus
      : validPatches.length > 0 || processedCardIds.length > 0
        ? 'partial'
        : 'cancelled'

  return {
    version: REVISION_JOB_VERSION,
    deckId,
    selectedCardIds,
    feedback: raw.feedback.trim(),
    scope: raw.scope,
    processedCardIds,
    pendingCardIds,
    previewPatches: validPatches,
    rejectedOperationCount: Math.max(0, suppliedRejected) + rejected.length,
    sourceCards,
    createdAt,
    updatedAt: raw.updatedAt,
    status,
  }
}

export function loadRevisionJob(
  storage: RevisionStorage,
  deckId: string,
  cards: Pick<FlashCard, 'id'>[],
  now = Date.now(),
): RevisionJob | null {
  try {
    const raw = storage.getItem(revisionJobStorageKey(deckId))
    if (!raw) return null
    const restored = restoreRevisionJob(JSON.parse(raw), deckId, cards, now)
    if (!restored) storage.removeItem(revisionJobStorageKey(deckId))
    return restored
  } catch {
    try { storage.removeItem(revisionJobStorageKey(deckId)) } catch { return null }
    return null
  }
}

export function persistRevisionJob(storage: RevisionStorage, job: RevisionJob): boolean {
  try {
    storage.setItem(revisionJobStorageKey(job.deckId), JSON.stringify(job))
    return true
  } catch {
    return false
  }
}

export function clearRevisionJob(storage: RevisionStorage, deckId: string): boolean {
  try {
    storage.removeItem(revisionJobStorageKey(deckId))
    return true
  } catch {
    return false
  }
}

export function buildRevisionRequestPayload(
  job: RevisionJob,
  cards: FlashCard[],
  batchCardIds: Iterable<string>,
  provider: RevisionProviderConfig,
): RevisionRequestPayload {
  const batch = uniqueIds(batchCardIds)
  const cardsById = new Map(cards.map((card) => [card.id, card]))
  const includeImages = job.scope === 'images' || job.scope === 'both'
  return {
    mode: 'revise',
    instructions: job.feedback,
    revisionScope: job.scope,
    existingCards: batch
      .map((id) => cardsById.get(id))
      .filter((card): card is FlashCard => !!card)
      .map((card) => {
        const frontImageUrl = includeImages
          ? safeRemoteImageUrl(card.frontImage?.originalUrl || card.frontImageUrl)
          : undefined
        const backImageUrl = includeImages
          ? safeRemoteImageUrl(card.backImage?.originalUrl || card.backImageUrl)
          : undefined
        return {
          id: card.id,
          frontText: card.frontText,
          backText: card.backText,
          ...(frontImageUrl ? { frontImageUrl } : {}),
          ...(backImageUrl ? { backImageUrl } : {}),
        }
      }),
    aiApiKey: provider.apiKey.trim(),
    aiBaseUrl: provider.baseUrl.trim(),
    aiModel: provider.model.trim(),
  }
}

export function revalidateRevisionJobForApply(
  job: RevisionJob,
  cards: FlashCard[],
): RevisionJob | null {
  const restored = restoreRevisionJob(job, job.deckId, cards, job.updatedAt)
  if (!restored || restored.sourceCards.length === 0) return restored

  const currentById = new Map(cards.map((card) => [card.id, card]))
  const sourceById = new Map(restored.sourceCards.map((card) => [card.id, card]))
  let conflictCount = 0
  const previewPatches = restored.previewPatches.filter((patch) => {
    const current = currentById.get(patch.cardId)
    const source = sourceById.get(patch.cardId)
    if (!current || !source) {
      conflictCount += 1
      return false
    }
    const unchanged = patch.field === 'frontText'
      ? current.frontText === source.frontText
      : patch.field === 'backText'
        ? current.backText === source.backText
        : patch.field === 'frontImageQuery'
          ? (current.frontImage?.originalUrl || current.frontImageUrl || '') === (source.frontImageUrl || '')
          : (current.backImage?.originalUrl || current.backImageUrl || '') === (source.backImageUrl || '')
    if (!unchanged) conflictCount += 1
    return unchanged
  })

  return {
    ...restored,
    previewPatches,
    rejectedOperationCount: restored.rejectedOperationCount + conflictCount,
  }
}
