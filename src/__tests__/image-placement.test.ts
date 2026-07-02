import { describe, expect, it } from 'vitest'
import { getImagePlacementGeometry, normalizeImagePlacement } from '../lib/image-placement'

describe('getImagePlacementGeometry', () => {
  it('fits the whole image and centers intentional letterboxing', () => {
    const geometry = getImagePlacementGeometry({
      imageWidth: 1600,
      imageHeight: 900,
      frameWidth: 400,
      frameHeight: 400,
      placement: { mode: 'fit', zoom: 1, x: 0, y: 0 },
    })

    expect(geometry.width).toBe(400)
    expect(geometry.height).toBe(225)
    expect(geometry.left).toBe(0)
    expect(geometry.top).toBe(87.5)
  })

  it('uses true cover scale in fill mode without whitespace', () => {
    const geometry = getImagePlacementGeometry({
      imageWidth: 1600,
      imageHeight: 900,
      frameWidth: 400,
      frameHeight: 400,
      placement: { mode: 'fill', zoom: 1, x: 0, y: 0 },
    })

    expect(geometry.width).toBeCloseTo(711.11, 1)
    expect(geometry.height).toBe(400)
    expect(geometry.left).toBeLessThan(0)
    expect(geometry.top).toBe(0)
  })

  it('moves only across real overflow and never exposes a fill-mode gap', () => {
    const left = getImagePlacementGeometry({
      imageWidth: 1600,
      imageHeight: 900,
      frameWidth: 400,
      frameHeight: 400,
      placement: { mode: 'fill', zoom: 1, x: -1, y: 0 },
    })
    const right = getImagePlacementGeometry({
      imageWidth: 1600,
      imageHeight: 900,
      frameWidth: 400,
      frameHeight: 400,
      placement: { mode: 'fill', zoom: 1, x: 1, y: 0 },
    })

    expect(left.left).toBe(0)
    expect(right.left + right.width).toBeCloseTo(400)
  })
})

describe('normalizeImagePlacement', () => {
  it('clamps persisted placement values to stable bounds', () => {
    expect(normalizeImagePlacement({ mode: 'fill', zoom: 0.2, x: 4, y: -4 })).toEqual({
      mode: 'fill',
      zoom: 1,
      x: 1,
      y: -1,
    })
  })
})
