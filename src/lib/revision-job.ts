import type { FlashCard } from './types'
import {
  validateRevisionPatches,
  type RevisionPatchOperation,
  type RevisionScope,
} from './flashcard-revision'

export const REVISION_JOB_VERSION = 2
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
  unresolvedConflicts: RevisionPatchConflict[]
  rejectedOperationCount: number
  sourceCards: RevisionSourceCard[]
  createdAt: number
  updatedAt: number
  status: RevisionJobStatus
}

export type RevisionSourceCard = Pick<FlashCard, 'id' | 'frontText' | 'backText'> & {
  frontImageState: RevisionImageSourceState
  backImageState: RevisionImageSourceState
  frontImageUrl?: string
  backImageUrl?: string
}

export type RevisionImageSourceState = 'none' | `remote:${string}` | `local:${string}`
export type RevisionPatchConflictReason = 'card-missing' | 'source-missing' | 'source-changed'

export interface RevisionPatchConflict {
  patch: RevisionPatchOperation
  reason: RevisionPatchConflictReason
}

export interface RevisionApplyPlan {
  applicableJob: RevisionJob | null
  conflicts: RevisionPatchConflict[]
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

function stableLocalImageFingerprint(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `${value.length}:${(hash >>> 0).toString(16)}`
}

function imageSourceValue(card: FlashCard, side: 'front' | 'back'): string {
  const directUrl = side === 'front' ? card.frontImageUrl : card.backImageUrl
  const asset = side === 'front' ? card.frontImage : card.backImage
  return directUrl || asset?.url || asset?.originalUrl || ''
}

function imageSourceState(card: FlashCard, side: 'front' | 'back'): RevisionImageSourceState {
  const value = imageSourceValue(card, side)
  if (!value) return 'none'
  const remoteUrl = safeRemoteImageUrl(value)
  return remoteUrl
    ? `remote:${remoteUrl}`
    : `local:${stableLocalImageFingerprint(value)}`
}

function remoteImageUrl(card: FlashCard, side: 'front' | 'back'): string | undefined {
  const asset = side === 'front' ? card.frontImage : card.backImage
  const directUrl = side === 'front' ? card.frontImageUrl : card.backImageUrl
  return safeRemoteImageUrl(asset?.originalUrl)
    ?? safeRemoteImageUrl(directUrl)
    ?? safeRemoteImageUrl(asset?.url)
}

function snapshotRevisionCard(card: FlashCard): RevisionSourceCard {
  const frontImageUrl = remoteImageUrl(card, 'front')
  const backImageUrl = remoteImageUrl(card, 'back')
  return {
    id: card.id,
    frontText: card.frontText,
    backText: card.backText,
    frontImageState: imageSourceState(card, 'front'),
    backImageState: imageSourceState(card, 'back'),
    ...(frontImageUrl ? { frontImageUrl } : {}),
    ...(backImageUrl ? { backImageUrl } : {}),
  }
}

function isRevisionImageSourceState(value: unknown): value is RevisionImageSourceState {
  return value === 'none'
    || (typeof value === 'string' && (value.startsWith('remote:http://') || value.startsWith('remote:https://') || /^local:\d+:[0-9a-f]+$/.test(value)))
}

function patchKey(patch: Pick<RevisionPatchOperation, 'cardId' | 'field'>): string {
  return `${patch.cardId}:${patch.field}`
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
    unresolvedConflicts: [],
    rejectedOperationCount: 0,
    sourceCards: cards
      .filter((card) => selectedSet.has(card.id))
      .map(snapshotRevisionCard),
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
    unresolvedConflicts: job.unresolvedConflicts.filter((conflict) => !batch.includes(conflict.patch.cardId)),
    rejectedOperationCount: job.rejectedOperationCount
      + rejected.length
      + duplicateCount
      + Math.max(0, providerRejectedCount),
    updatedAt: now,
    status: pendingCardIds.length === 0 ? 'complete' : 'partial',
  }
}

export function refreshRevisionSourceSnapshots(
  job: RevisionJob,
  cards: FlashCard[],
  batchCardIds: Iterable<string>,
  now = Date.now(),
): RevisionJob {
  const pendingIds = new Set(uniqueIds(batchCardIds).filter((id) => job.pendingCardIds.includes(id)))
  if (pendingIds.size === 0) return job

  const currentById = new Map(cards.map((card) => [card.id, card]))
  const refreshedById = new Map(job.sourceCards.map((card) => [card.id, card]))
  for (const cardId of pendingIds) {
    const current = currentById.get(cardId)
    if (current) refreshedById.set(cardId, snapshotRevisionCard(current))
    else refreshedById.delete(cardId)
  }

  return {
    ...job,
    sourceCards: job.selectedCardIds
      .map((cardId) => refreshedById.get(cardId))
      .filter((card): card is RevisionSourceCard => !!card),
    updatedAt: now,
    status: 'running',
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
  const requestedCardIds = uniqueIds(raw.selectedCardIds ?? [])
  const selectedCardIds = requestedCardIds.filter((id) => availableIds.has(id))

  const processedSet = new Set(uniqueIds(raw.processedCardIds ?? []).filter((id) => selectedCardIds.includes(id)))
  const processedCardIds = selectedCardIds.filter((id) => processedSet.has(id))
  const pendingCardIds = selectedCardIds.filter((id) => !processedSet.has(id))
  const rawPatches = Array.isArray(raw.previewPatches) ? raw.previewPatches : []
  const { validPatches, rejected } = validateRevisionPatches(rawPatches, selectedCardIds, raw.scope)
  const rawConflictPatches = Array.isArray(raw.unresolvedConflicts)
    ? raw.unresolvedConflicts.map((conflict) => conflict?.patch)
    : []
  const { validPatches: validConflictPatches } = validateRevisionPatches(
    rawConflictPatches,
    requestedCardIds,
    raw.scope,
  )
  const validConflictPatchKeys = new Set(validConflictPatches.map(patchKey))
  const unresolvedConflicts = Array.isArray(raw.unresolvedConflicts)
    ? raw.unresolvedConflicts.filter((conflict): conflict is RevisionPatchConflict => (
      !!conflict
      && typeof conflict === 'object'
      && !!conflict.patch
      && validConflictPatchKeys.has(patchKey(conflict.patch))
      && (conflict.reason === 'card-missing' || conflict.reason === 'source-missing' || conflict.reason === 'source-changed')
    ))
    : []
  if (selectedCardIds.length === 0 && unresolvedConflicts.length === 0) return null
  const suppliedRejected = Number.isFinite(raw.rejectedOperationCount) ? Number(raw.rejectedOperationCount) : 0
  const sourceCards = Array.isArray(raw.sourceCards)
    ? raw.sourceCards
      .filter((card): card is RevisionSourceCard => (
        !!card
        && typeof card.id === 'string'
        && selectedCardIds.includes(card.id)
        && typeof card.frontText === 'string'
        && typeof card.backText === 'string'
        && isRevisionImageSourceState(card.frontImageState)
        && isRevisionImageSourceState(card.backImageState)
      ))
      .map((card) => {
        const frontImageUrl = safeRemoteImageUrl(card.frontImageUrl)
        const backImageUrl = safeRemoteImageUrl(card.backImageUrl)
        return {
          id: card.id,
          frontText: card.frontText,
          backText: card.backText,
          frontImageState: card.frontImageState,
          backImageState: card.backImageState,
          ...(frontImageUrl ? { frontImageUrl } : {}),
          ...(backImageUrl ? { backImageUrl } : {}),
        }
      })
    : []
  const createdAt = typeof raw.createdAt === 'number' ? raw.createdAt : raw.updatedAt
  const suppliedStatus = raw.status
  const status: RevisionJobStatus = unresolvedConflicts.length > 0
    ? 'partial'
    : pendingCardIds.length === 0
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
    unresolvedConflicts,
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
  const sourceById = new Map(job.sourceCards.map((card) => [card.id, card]))
  const includeImages = job.scope === 'images' || job.scope === 'both'
  return {
    mode: 'revise',
    instructions: job.feedback,
    revisionScope: job.scope,
    existingCards: batch
      .map((id) => {
        const source = sourceById.get(id)
        const current = cardsById.get(id)
        if (!source && !current) return null
        const frontImageUrl = includeImages
          ? source?.frontImageUrl ?? (current ? remoteImageUrl(current, 'front') : undefined)
          : undefined
        const backImageUrl = includeImages
          ? source?.backImageUrl ?? (current ? remoteImageUrl(current, 'back') : undefined)
          : undefined
        return {
          id,
          frontText: source?.frontText ?? current!.frontText,
          backText: source?.backText ?? current!.backText,
          ...(frontImageUrl ? { frontImageUrl } : {}),
          ...(backImageUrl ? { backImageUrl } : {}),
        }
      })
      .filter((card): card is RevisionRequestPayload['existingCards'][number] => !!card),
    aiApiKey: provider.apiKey.trim(),
    aiBaseUrl: provider.baseUrl.trim(),
    aiModel: provider.model.trim(),
  }
}

export function revalidateRevisionJobForApply(
  job: RevisionJob,
  cards: FlashCard[],
): RevisionJob | null {
  return planRevisionJobApply(job, cards).applicableJob
}

export function planRevisionJobApply(
  job: RevisionJob,
  cards: FlashCard[],
): RevisionApplyPlan {
  const restored = restoreRevisionJob(job, job.deckId, cards, job.updatedAt)
  const currentById = new Map(cards.map((card) => [card.id, card]))
  const sourceById = new Map(job.sourceCards.map((card) => [card.id, card]))
  const { validPatches } = validateRevisionPatches(
    job.previewPatches,
    job.selectedCardIds,
    job.scope,
  )
  const conflicts: RevisionPatchConflict[] = []
  const previewPatches = validPatches.filter((patch) => {
    const current = currentById.get(patch.cardId)
    const source = sourceById.get(patch.cardId)
    if (!current) {
      conflicts.push({ patch, reason: 'card-missing' })
      return false
    }
    if (!source) {
      conflicts.push({ patch, reason: 'source-missing' })
      return false
    }
    const unchanged = patch.field === 'frontText'
      ? current.frontText === source.frontText
      : patch.field === 'backText'
        ? current.backText === source.backText
        : patch.field === 'frontImageQuery'
          ? imageSourceState(current, 'front') === source.frontImageState
          : imageSourceState(current, 'back') === source.backImageState
    if (!unchanged) conflicts.push({ patch, reason: 'source-changed' })
    return unchanged
  })

  return {
    applicableJob: restored ? {
      ...restored,
      previewPatches,
    } : null,
    conflicts,
  }
}

export function preserveRevisionConflicts(
  job: RevisionJob,
  conflicts: RevisionPatchConflict[],
  now = Date.now(),
): RevisionJob {
  const conflictKeys = new Set(conflicts.map((conflict) => patchKey(conflict.patch)))
  return {
    ...job,
    previewPatches: job.previewPatches.filter((patch) => conflictKeys.has(patchKey(patch))),
    unresolvedConflicts: conflicts,
    updatedAt: now,
    status: 'partial',
  }
}
