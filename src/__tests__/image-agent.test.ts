import { describe, expect, it } from 'vitest'
import { buildImageSearchIntent, getImageAgentOutcome, getImageReviewCandidateUpdates, getStoredImageCandidates, normalizeImageQuery } from '../lib/image-agent'
import type { FlashCard, ImageCandidate } from '../lib/types'

describe('normalizeImageQuery', () => {
  it('keeps concise literal image queries', () => {
    expect(normalizeImageQuery({
      side: 'front',
      frontText: 'grape',
      backText: 'A tiny purple fruit',
      aiQuery: 'purple grapes fruit photo',
    })).toBe('purple grapes fruit photo')
  })

  it('turns a common front word into a concrete image query', () => {
    expect(normalizeImageQuery({
      side: 'front',
      frontText: 'giraffe',
      backText: 'long-necked animal',
      aiQuery: '',
    })).toBe('giraffe clear simple illustration')
  })

  it('does not use sentence-like back text as a raw search query', () => {
    expect(normalizeImageQuery({
      side: 'back',
      frontText: 'giraffe',
      backText: "I'm a long-necked vegetarian who wears a tie.",
      aiQuery: "I'm a long-necked vegetarian who wears a tie.",
    })).toBe('giraffe clear simple illustration')
  })

  it('rejects riddle-like first-person image queries', () => {
    expect(normalizeImageQuery({
      side: 'back',
      frontText: 'guitar',
      backText: 'I have strings but no puppets. I make music, not noise!',
      aiQuery: 'I have strings but no puppets',
    })).toBe('guitar clear simple illustration')
  })

  it('prefers a simple translated concept for language cards', () => {
    expect(buildImageSearchIntent({
      side: 'front',
      frontText: 'el atardecer',
      backText: 'sunset',
    })).toMatchObject({
      query: 'sunset clear simple illustration',
      concepts: expect.arrayContaining(['sunset']),
    })
  })
})

describe('getImageAgentOutcome', () => {
  it('treats 0 images found as failure when images were requested', () => {
    expect(getImageAgentOutcome(18, 0)).toBe('failed')
  })

  it('distinguishes partial and complete image application', () => {
    expect(getImageAgentOutcome(18, 3)).toBe('partial')
    expect(getImageAgentOutcome(18, 18)).toBe('success')
  })
})

describe('low-confidence image review candidates', () => {
  const candidate: ImageCandidate = {
    id: 'brave:apple',
    url: 'https://images.example/apple.png',
    thumbnailUrl: 'https://images.example/apple-thumb.png',
    originalUrl: 'https://images.example/apple.png',
    title: 'Apple option',
    provider: 'brave',
    score: 40,
    confidence: 'low',
    needsReview: true,
  }

  it('stores candidates on the requested card side without applying an image', () => {
    expect(getImageReviewCandidateUpdates('front', [candidate])).toEqual({
      frontImageCandidates: [candidate],
    })
  })

  it('prefers saved review candidates when reopening image search', () => {
    const card: FlashCard = {
      id: 'card-1',
      frontText: 'apple',
      backText: 'manzana',
      frontImageCandidates: [candidate],
      frontImage: {
        url: 'https://images.example/current.png',
        originalUrl: 'https://images.example/current.png',
        candidates: [],
      },
    }

    expect(getStoredImageCandidates(card, 'front')).toEqual([candidate])
  })
})
