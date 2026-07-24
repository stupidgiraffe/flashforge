import { describe, expect, it } from 'vitest'
import type { FlashCard } from '@/lib/types'
import {
  REVISION_JOB_RETENTION_MS,
  buildRevisionRequestPayload,
  clearRevisionJob,
  createRevisionJob,
  getNextRevisionBatch,
  loadRevisionJob,
  markRevisionJob,
  mergeRevisionBatch,
  persistRevisionJob,
  planRevisionJobApply,
  preserveRevisionConflicts,
  refreshRevisionSourceSnapshots,
  revalidateRevisionJobForApply,
  revisionJobStorageKey,
  type RevisionStorage,
} from '@/lib/revision-job'

function cards(count: number): FlashCard[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `c${index + 1}`,
    frontText: `Front ${index + 1}`,
    backText: `Back ${index + 1}`,
    frontImageUrl: 'data:image/png;base64,private',
    frontImageCandidates: [{
      id: 'candidate',
      url: 'data:image/png;base64,private',
      thumbnailUrl: 'thumb',
      originalUrl: 'original',
      title: 'Private candidate',
      provider: 'test',
      score: 1,
      confidence: 'high',
      needsReview: false,
    }],
  }))
}

function memoryStorage(): RevisionStorage & { values: Map<string, string> } {
  const values = new Map<string, string>()
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
    removeItem: (key) => { values.delete(key) },
  }
}

describe('revision jobs', () => {
  it('batches selected cards in original order', () => {
    const job = createRevisionJob('deck', ['c3', 'c1', 'c2', 'c4', 'c5', 'c6'], 'Simplify', 'text', 10)
    expect(getNextRevisionBatch(job, 4)).toEqual(['c3', 'c1', 'c2', 'c4'])
  })

  it('persists the first successful batch and preserves it after a later failure', () => {
    const storage = memoryStorage()
    const created = createRevisionJob('deck', ['c1', 'c2', 'c3'], 'Simplify', 'text', 10)
    const first = mergeRevisionBatch(created, ['c1', 'c2'], [
      { cardId: 'c1', field: 'frontText', value: 'Short' },
    ], 1, 20)
    expect(persistRevisionJob(storage, first)).toBe(true)

    const failed = markRevisionJob(first, 'failed', 30)
    persistRevisionJob(storage, failed)
    const restored = loadRevisionJob(storage, 'deck', cards(3), 40)

    expect(restored?.processedCardIds).toEqual(['c1', 'c2'])
    expect(restored?.pendingCardIds).toEqual(['c3'])
    expect(restored?.previewPatches).toEqual([{ cardId: 'c1', field: 'frontText', value: 'Short' }])
    expect(restored?.rejectedOperationCount).toBe(1)
  })

  it('cancellation preserves completed batches and resume returns only pending cards', () => {
    const first = mergeRevisionBatch(
      createRevisionJob('deck', ['c1', 'c2', 'c3'], 'Simplify', 'both', 10),
      ['c1', 'c2'],
      [{ cardId: 'c2', field: 'backText', value: 'Changed' }],
      0,
      20,
    )
    const cancelled = markRevisionJob(first, 'cancelled', 30)
    expect(cancelled.previewPatches).toHaveLength(1)
    expect(getNextRevisionBatch(cancelled)).toEqual(['c3'])
  })

  it('revalidates restored patches and prevents removed cards from receiving patches', () => {
    const raw = {
      ...createRevisionJob('deck', ['c1', 'c2'], 'Revise', 'text', 10, cards(2)),
      processedCardIds: ['c1', 'c2'],
      pendingCardIds: [],
      previewPatches: [
        { cardId: 'c1', field: 'frontText', value: 'Valid' },
        { cardId: 'c2', field: 'backText', value: 'Removed card' },
        { cardId: 'c1', field: 'frontImageQuery', value: 'Wrong scope' },
      ],
      status: 'complete',
      updatedAt: 20,
    }

    const restored = revalidateRevisionJobForApply(raw as ReturnType<typeof createRevisionJob>, cards(1))
    expect(restored?.selectedCardIds).toEqual(['c1'])
    expect(restored?.previewPatches).toEqual([{ cardId: 'c1', field: 'frontText', value: 'Valid' }])
    const plan = planRevisionJobApply(raw as ReturnType<typeof createRevisionJob>, cards(1))
    expect(plan.conflicts).toEqual([{
      patch: { cardId: 'c2', field: 'backText', value: 'Removed card' },
      reason: 'card-missing',
    }])
  })

  it('does not apply a restored patch over a field edited after preview generation', () => {
    const originalCards = cards(1)
    const created = createRevisionJob('deck', ['c1'], 'Revise', 'text', 10, originalCards)
    const complete = mergeRevisionBatch(created, ['c1'], [
      { cardId: 'c1', field: 'frontText', value: 'AI suggestion' },
      { cardId: 'c1', field: 'backText', value: 'Safe suggestion' },
    ], 0, 20)
    const currentCards = [{ ...originalCards[0], frontText: 'Teacher edit' }]

    const plan = planRevisionJobApply(complete, currentCards)
    expect(plan.applicableJob?.previewPatches).toEqual([
      { cardId: 'c1', field: 'backText', value: 'Safe suggestion' },
    ])
    expect(plan.conflicts).toEqual([{
      patch: { cardId: 'c1', field: 'frontText', value: 'AI suggestion' },
      reason: 'source-changed',
    }])
  })

  it('allows image replacement when an uploaded data image is unchanged', () => {
    const originalCards = cards(1)
    const complete = mergeRevisionBatch(
      createRevisionJob('deck', ['c1'], 'Replace image', 'images', 10, originalCards),
      ['c1'],
      [{ cardId: 'c1', field: 'frontImageQuery', value: 'clear classroom object' }],
      0,
      20,
    )

    const plan = planRevisionJobApply(complete, originalCards)
    expect(plan.conflicts).toEqual([])
    expect(plan.applicableJob?.previewPatches).toHaveLength(1)
    expect(JSON.stringify(complete.sourceCards)).not.toContain('data:image')
    expect(complete.sourceCards[0].frontImageState).toMatch(/^local:\d+:[0-9a-f]+$/)
  })

  it('detects replaced or removed uploaded data images as conflicts', () => {
    const originalCards = cards(1)
    const complete = mergeRevisionBatch(
      createRevisionJob('deck', ['c1'], 'Replace image', 'images', 10, originalCards),
      ['c1'],
      [{ cardId: 'c1', field: 'frontImageQuery', value: 'clear classroom object' }],
      0,
      20,
    )

    const replaced = planRevisionJobApply(complete, [{
      ...originalCards[0],
      frontImageUrl: 'data:image/png;base64,different',
      frontImage: {
        ...originalCards[0].frontImage!,
        url: 'data:image/png;base64,different',
        originalUrl: 'data:image/png;base64,different',
      },
    }])
    const removed = planRevisionJobApply(complete, [{
      ...originalCards[0],
      frontImageUrl: undefined,
      frontImage: undefined,
    }])

    expect(replaced.conflicts[0]?.reason).toBe('source-changed')
    expect(removed.conflicts[0]?.reason).toBe('source-changed')
  })

  it('distinguishes unchanged and changed remote image sources', () => {
    const originalCards = [{
      ...cards(1)[0],
      frontImageUrl: 'https://images.example/classroom.png',
      frontImage: undefined,
    }]
    const complete = mergeRevisionBatch(
      createRevisionJob('deck', ['c1'], 'Replace image', 'images', 10, originalCards),
      ['c1'],
      [{ cardId: 'c1', field: 'frontImageQuery', value: 'clear classroom object' }],
      0,
      20,
    )

    expect(planRevisionJobApply(complete, originalCards).conflicts).toEqual([])
    expect(planRevisionJobApply(complete, [{
      ...originalCards[0],
      frontImageUrl: 'https://images.example/replacement.png',
    }]).conflicts[0]?.reason).toBe('source-changed')
    expect(complete.sourceCards[0].frontImageState).toBe('remote:https://images.example/classroom.png')
  })

  it('refreshes only pending source snapshots before a resumed batch', () => {
    const originalCards = cards(2)
    const partial = mergeRevisionBatch(
      createRevisionJob('deck', ['c1', 'c2'], 'Simplify', 'text', 10, originalCards),
      ['c1'],
      [{ cardId: 'c1', field: 'frontText', value: 'First result' }],
      0,
      20,
    )
    const editedCards = originalCards.map((card) => card.id === 'c2'
      ? { ...card, frontText: 'Teacher edited pending card' }
      : { ...card, frontText: 'Teacher edited processed card' })

    const refreshed = refreshRevisionSourceSnapshots(partial, editedCards, ['c1', 'c2'], 30)
    const resumedPayload = buildRevisionRequestPayload(refreshed, originalCards, ['c2'], {
      apiKey: 'api-key',
      baseUrl: 'https://provider.example/v1',
      model: 'model-1',
    })
    const complete = mergeRevisionBatch(refreshed, ['c2'], [
      { cardId: 'c2', field: 'frontText', value: 'Resumed result' },
    ], 0, 40)
    const plan = planRevisionJobApply(complete, editedCards)

    expect(refreshed.sourceCards.find((card) => card.id === 'c1')?.frontText).toBe('Front 1')
    expect(refreshed.sourceCards.find((card) => card.id === 'c2')?.frontText).toBe('Teacher edited pending card')
    expect(resumedPayload.existingCards[0].frontText).toBe('Teacher edited pending card')
    expect(plan.applicableJob?.previewPatches).toContainEqual({
      cardId: 'c2',
      field: 'frontText',
      value: 'Resumed result',
    })
    expect(plan.conflicts).toEqual([{
      patch: { cardId: 'c1', field: 'frontText', value: 'First result' },
      reason: 'source-changed',
    }])
  })

  it('preserves conflicting preview patches until explicit discard', () => {
    const storage = memoryStorage()
    const originalCards = cards(1)
    const complete = mergeRevisionBatch(
      createRevisionJob('deck', ['c1'], 'Revise', 'text', 10, originalCards),
      ['c1'],
      [
        { cardId: 'c1', field: 'frontText', value: 'Conflicting suggestion' },
        { cardId: 'c1', field: 'backText', value: 'Safe suggestion' },
      ],
      0,
      20,
    )
    const currentCards = [{ ...originalCards[0], frontText: 'Teacher edit' }]
    const plan = planRevisionJobApply(complete, currentCards)
    const unresolved = preserveRevisionConflicts(complete, plan.conflicts, 30)

    persistRevisionJob(storage, unresolved)
    expect(plan.applicableJob?.previewPatches).toEqual([
      { cardId: 'c1', field: 'backText', value: 'Safe suggestion' },
    ])
    expect(unresolved.previewPatches).toEqual([
      { cardId: 'c1', field: 'frontText', value: 'Conflicting suggestion' },
    ])
    expect(loadRevisionJob(storage, 'deck', currentCards, 40)?.unresolvedConflicts).toHaveLength(1)
    expect(storage.values.has(revisionJobStorageKey('deck'))).toBe(true)

    clearRevisionJob(storage, 'deck')
    expect(storage.values.has(revisionJobStorageKey('deck'))).toBe(false)
  })

  it('keeps removed-card conflicts recoverable after reload', () => {
    const storage = memoryStorage()
    const originalCards = cards(2)
    const complete = mergeRevisionBatch(
      createRevisionJob('deck', ['c1', 'c2'], 'Revise', 'text', 10, originalCards),
      ['c1', 'c2'],
      [
        { cardId: 'c1', field: 'frontText', value: 'Safe suggestion' },
        { cardId: 'c2', field: 'backText', value: 'Removed-card suggestion' },
      ],
      0,
      20,
    )
    const currentCards = originalCards.slice(0, 1)
    const plan = planRevisionJobApply(complete, currentCards)
    const unresolved = preserveRevisionConflicts(complete, plan.conflicts, 30)
    persistRevisionJob(storage, unresolved)

    const restored = loadRevisionJob(storage, 'deck', currentCards, 40)
    expect(restored?.selectedCardIds).toEqual(['c1'])
    expect(restored?.previewPatches).toEqual([])
    expect(restored?.unresolvedConflicts).toEqual([{
      patch: { cardId: 'c2', field: 'backText', value: 'Removed-card suggestion' },
      reason: 'card-missing',
    }])
  })

  it('clears state only after the caller explicitly reports successful application', () => {
    const storage = memoryStorage()
    const job = createRevisionJob('deck', ['c1'], 'Revise', 'text')
    persistRevisionJob(storage, job)
    expect(storage.values.has(revisionJobStorageKey('deck'))).toBe(true)
    expect(clearRevisionJob(storage, 'deck')).toBe(true)
    expect(storage.values.has(revisionJobStorageKey('deck'))).toBe(false)
  })

  it('never stores API keys and builds a minimal batch request', () => {
    const storage = memoryStorage()
    const job = createRevisionJob('deck', ['c1'], 'Revise', 'text')
    persistRevisionJob(storage, job)
    const stored = storage.values.get(revisionJobStorageKey('deck')) ?? ''
    expect(stored).not.toContain('api-key')
    expect(stored).not.toContain('data:image')

    const payload = buildRevisionRequestPayload(job, cards(2), ['c1'], {
      apiKey: 'api-key',
      baseUrl: 'https://provider.example/v1',
      model: 'model-1',
    })
    expect(payload.existingCards).toEqual([{ id: 'c1', frontText: 'Front 1', backText: 'Back 1' }])
    expect(JSON.stringify(payload)).not.toContain('data:image')
    expect(JSON.stringify(payload)).not.toContain('frontImageCandidates')
    expect(payload).not.toHaveProperty('title')
  })

  it('falls back safely for corrupt, expired, and wrong-version storage', () => {
    const storage = memoryStorage()
    storage.values.set(revisionJobStorageKey('deck'), '{bad json')
    expect(loadRevisionJob(storage, 'deck', cards(1))).toBeNull()

    const expired = createRevisionJob('deck', ['c1'], 'Revise', 'text', 1)
    storage.values.set(revisionJobStorageKey('deck'), JSON.stringify(expired))
    expect(loadRevisionJob(storage, 'deck', cards(1), REVISION_JOB_RETENTION_MS + 2)).toBeNull()

    storage.values.set(revisionJobStorageKey('deck'), JSON.stringify({ ...expired, version: 999 }))
    expect(loadRevisionJob(storage, 'deck', cards(1), 2)).toBeNull()
  })
})
