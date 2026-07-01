import { describe, expect, it } from 'vitest'
import { getImageAgentOutcome, normalizeImageQuery } from '../lib/image-agent'

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
    })).toBe('giraffe cartoon')
  })

  it('does not use sentence-like back text as a raw search query', () => {
    expect(normalizeImageQuery({
      side: 'back',
      frontText: 'giraffe',
      backText: "I'm a long-necked vegetarian who wears a tie.",
      aiQuery: "I'm a long-necked vegetarian who wears a tie.",
    })).toBe('giraffe cartoon')
  })

  it('rejects riddle-like first-person image queries', () => {
    expect(normalizeImageQuery({
      side: 'back',
      frontText: 'guitar',
      backText: 'I have strings but no puppets. I make music, not noise!',
      aiQuery: 'I have strings but no puppets',
    })).toBe('guitar cartoon')
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
