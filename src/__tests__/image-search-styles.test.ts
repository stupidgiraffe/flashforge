import { describe, expect, it } from 'vitest'
import { applyImageSearchStyle, getImageSearchTemplate, previewImageSearch } from '@/lib/image-search-styles'

describe('image search styles', () => {
  it('builds readable preset queries without exposing template syntax', () => {
    expect(applyImageSearchStyle('brush my teeth', 'simple-illustration')).toBe('brush my teeth simple illustration clean background')
    expect(previewImageSearch('clear-photo', '{front}')).toContain('brush my teeth')
    expect(previewImageSearch('clear-photo', '{front}')).not.toContain('{')
  })

  it('preserves custom templates and falls back safely when blank', () => {
    expect(getImageSearchTemplate('custom', '{front} Japanese classroom')).toBe('{front} Japanese classroom')
    expect(getImageSearchTemplate('custom', '   ')).toBe('{front}')
  })

  it('supports searching with only the card text', () => {
    expect(applyImageSearchStyle('apple', 'none')).toBe('apple')
    expect(getImageSearchTemplate('none', 'ignored')).toBe('{text}')
  })
})
