import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Readable } from 'node:stream'

vi.mock('../_imageSearch.js', () => ({
  ImageSearchError: class ImageSearchError extends Error {},
  imageSearchErrorBody: vi.fn(() => ({ error: 'Search failed' })),
  searchImages: vi.fn(),
  embedImage: vi.fn(),
  resolveKeys: vi.fn(() => ({})),
}))

import handler from '../image-search.js'
import { searchImages, embedImage } from '../_imageSearch.js'

const images = [
  { id: 'one', url: 'https://images.example/one.jpg', thumbnailUrl: 'https://images.example/one-thumb.jpg', provider: 'openverse' },
  { id: 'two', url: 'https://images.example/two.jpg', thumbnailUrl: 'https://images.example/two-thumb.jpg', provider: 'openverse' },
]

async function post(body) {
  const req = Readable.from([JSON.stringify(body)])
  req.method = 'POST'
  const res = {
    statusCode: 200,
    setHeader: vi.fn(),
    end: vi.fn(),
  }
  await handler(req, res)
  return { status: res.statusCode, body: JSON.parse(res.end.mock.calls[0][0]) }
}

describe('manual image selection', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    searchImages.mockResolvedValue(images)
    embedImage.mockResolvedValue('data:image/jpeg;base64,YWJj')
  })

  it('embeds the image actually clicked, not the first search result', async () => {
    const response = await post({ query: 'apple', provider: 'openverse', limit: 20, embedSelectedUrl: images[1].url })
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ embedded: true, candidate: images[1] })
    expect(embedImage).toHaveBeenCalledExactlyOnceWith(images[1].url)
    expect(searchImages).toHaveBeenCalledWith(expect.objectContaining({ query: 'apple', provider: 'openverse' }))
  })

  it('rejects an unverified URL without downloading it (SSRF guard)', async () => {
    const response = await post({ query: 'apple', provider: 'openverse', embedSelectedUrl: 'http://127.0.0.1/private' })
    expect(response.status).toBe(409)
    expect(response.body.code).toBe('image_selection_expired')
    expect(embedImage).not.toHaveBeenCalled()
  })

  it('can embed the provider thumbnail if the original is blocked', async () => {
    embedImage.mockRejectedValueOnce(new Error('403')).mockResolvedValueOnce('data:image/jpeg;base64,YWJj')
    const response = await post({ query: 'apple', provider: 'openverse', embedSelectedUrl: images[0].url })
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ embedded: true, thumbnailFallback: true })
    expect(embedImage).toHaveBeenNthCalledWith(2, images[0].thumbnailUrl)
  })

  it('reports download failures instead of pretending insertion succeeded', async () => {
    embedImage.mockRejectedValue(new Error('403'))
    const response = await post({ query: 'apple', provider: 'openverse', embedSelectedUrl: images[0].url })
    expect(response.status).toBe(422)
    expect(response.body.code).toBe('image_download_failed')
    expect(response.body).not.toHaveProperty('dataUrl')
  })

  it('preserves ordinary image search requests', async () => {
    const response = await post({ query: 'apple', provider: 'openverse' })
    expect(response.status).toBe(200)
    expect(response.body.results).toEqual(images)
    expect(embedImage).not.toHaveBeenCalled()
  })
})
