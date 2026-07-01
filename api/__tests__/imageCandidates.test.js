import { describe, expect, it } from 'vitest'
import { rankImageCandidates } from '../image-candidates.js'
import { mapBraveResults } from '../image-providers.js'

describe('Brave image candidate scoring and filtering', () => {
  it('prefers a relevant, usable image over logos, panoramas, and tiny results', () => {
    const braveResults = mapBraveResults({
      results: [
        {
          title: 'Sunset travel company logo icon',
          description: 'Brand symbol',
          properties: { url: 'https://images.example/logo.png', width: 900, height: 900 },
          thumbnail: { src: 'https://images.example/logo-thumb.png' },
          url: 'https://example.com/logo',
        },
        {
          title: 'Sunset over ocean horizon',
          description: 'Clear orange sun centered above the sea horizon',
          properties: { url: 'https://images.example/sunset.jpg', width: 1600, height: 1067 },
          thumbnail: { src: 'https://images.example/sunset-thumb.jpg' },
          url: 'https://example.com/sunset',
        },
        {
          title: 'Panoramic sunset wallpaper banner',
          properties: { url: 'https://images.example/panorama.jpg', width: 3000, height: 500 },
          thumbnail: { src: 'https://images.example/panorama-thumb.jpg' },
          url: 'https://example.com/panorama',
        },
        {
          title: 'Sunset thumbnail',
          properties: { url: 'https://images.example/tiny.jpg', width: 120, height: 90 },
          thumbnail: { src: 'https://images.example/tiny.jpg' },
          url: 'https://example.com/tiny',
        },
      ],
    })

    const ranked = rankImageCandidates(braveResults, {
      query: 'sunset photo horizon',
      concepts: ['sunset', 'horizon'],
    }, 10)

    expect(ranked[0]).toMatchObject({
      provider: 'brave',
      url: 'https://images.example/sunset.jpg',
      needsReview: false,
    })
    expect(ranked.some((candidate) => candidate.url.endsWith('/tiny.jpg'))).toBe(false)
    expect(ranked.find((candidate) => candidate.url.endsWith('/logo.png')).score).toBeLessThan(ranked[0].score)
  })
})
