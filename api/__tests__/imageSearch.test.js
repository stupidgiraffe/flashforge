import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ImageSearchError, resolveKeys, getServerProviderConfig, searchImages, embedImage, imageSearchErrorBody } from '../_imageSearch.js'

// ---------------------------------------------------------------------------
// resolveKeys
// ---------------------------------------------------------------------------
describe('resolveKeys', () => {
  const origEnv = { ...process.env }

  afterEach(() => {
    // Restore env
    Object.keys(process.env).forEach((k) => {
      if (!(k in origEnv)) delete process.env[k]
    })
    Object.assign(process.env, origEnv)
  })

  it('returns empty strings when no keys are present', () => {
    delete process.env.BRAVE_API_KEY
    delete process.env.PIXABAY_API_KEY
    delete process.env.PEXELS_API_KEY
    delete process.env.GOOGLE_API_KEY
    delete process.env.GOOGLE_CX
    const keys = resolveKeys()
    expect(keys.braveApiKey).toBe('')
    expect(keys.pixabayApiKey).toBe('')
    expect(keys.pexelsApiKey).toBe('')
    expect(keys.googleApiKey).toBe('')
    expect(keys.googleCx).toBe('')
  })

  it('uses env vars as defaults', () => {
    process.env.BRAVE_API_KEY = 'env-brave'
    process.env.PIXABAY_API_KEY = 'env-pixabay'
    process.env.PEXELS_API_KEY = 'env-pexels'
    process.env.GOOGLE_API_KEY = 'env-google'
    process.env.GOOGLE_CX = 'env-cx'
    const keys = resolveKeys()
    expect(keys.braveApiKey).toBe('env-brave')
    expect(keys.pixabayApiKey).toBe('env-pixabay')
    expect(keys.pexelsApiKey).toBe('env-pexels')
    expect(keys.googleApiKey).toBe('env-google')
    expect(keys.googleCx).toBe('env-cx')
  })

  it('request-body keys override env vars', () => {
    process.env.BRAVE_API_KEY = 'env-brave'
    process.env.PIXABAY_API_KEY = 'env-pixabay'
    const keys = resolveKeys({ braveApiKey: 'body-brave', pixabayApiKey: 'body-pixabay' })
    expect(keys.braveApiKey).toBe('body-brave')
    expect(keys.pixabayApiKey).toBe('body-pixabay')
  })
})

// ---------------------------------------------------------------------------
// getServerProviderConfig
// ---------------------------------------------------------------------------
describe('getServerProviderConfig', () => {
  const origEnv = { ...process.env }

  afterEach(() => {
    Object.keys(process.env).forEach((k) => {
      if (!(k in origEnv)) delete process.env[k]
    })
    Object.assign(process.env, origEnv)
  })

  it('returns false for missing keys', () => {
    delete process.env.BRAVE_API_KEY
    delete process.env.PIXABAY_API_KEY
    delete process.env.PEXELS_API_KEY
    delete process.env.GOOGLE_API_KEY
    delete process.env.GOOGLE_CX
    const cfg = getServerProviderConfig()
    expect(cfg.brave).toBe(false)
    expect(cfg.pixabay).toBe(false)
    expect(cfg.pexels).toBe(false)
    expect(cfg.google).toBe(false)
  })

  it('openverse is always true', () => {
    const cfg = getServerProviderConfig()
    expect(cfg.openverse).toBe(true)
  })

  it('returns true when env vars are set', () => {
    process.env.BRAVE_API_KEY = 'x'
    process.env.PIXABAY_API_KEY = 'x'
    process.env.PEXELS_API_KEY = 'x'
    process.env.GOOGLE_API_KEY = 'x'
    process.env.GOOGLE_CX = 'x'
    const cfg = getServerProviderConfig()
    expect(cfg.brave).toBe(true)
    expect(cfg.pixabay).toBe(true)
    expect(cfg.pexels).toBe(true)
    expect(cfg.google).toBe(true)
  })

  it('google requires BOTH GOOGLE_API_KEY and GOOGLE_CX', () => {
    process.env.GOOGLE_API_KEY = 'x'
    delete process.env.GOOGLE_CX
    expect(getServerProviderConfig().google).toBe(false)
    delete process.env.GOOGLE_API_KEY
    process.env.GOOGLE_CX = 'y'
    expect(getServerProviderConfig().google).toBe(false)
  })

  it('never returns key values', () => {
    process.env.BRAVE_API_KEY = 'super-secret'
    const cfg = getServerProviderConfig()
    expect(JSON.stringify(cfg)).not.toContain('super-secret')
  })
})

// ---------------------------------------------------------------------------
// helpers: provider fetch mocks
// ---------------------------------------------------------------------------

function makeFetchWith(body, { status = 200, contentType = 'application/json' } = {}) {
  return vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    headers: { get: (h) => (h === 'content-type' ? contentType : h === 'content-length' ? String(body?.length ?? 0) : null) },
    json: () => Promise.resolve(typeof body === 'string' ? JSON.parse(body) : body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
    arrayBuffer: () => Promise.resolve(typeof body === 'string' ? Buffer.from(body) : Buffer.from(JSON.stringify(body))),
  })
}

// ---------------------------------------------------------------------------
// searchImages — provider normalization
// ---------------------------------------------------------------------------
describe('searchImages provider normalization', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('query "giraffe" through a mocked successful provider returns a usable result', async () => {
    global.fetch = makeFetchWith({
      results: [{
        title: 'Giraffe',
        url: 'https://example.com/giraffe.jpg',
        thumbnail: 'https://example.com/giraffe-thumb.jpg',
        foreign_landing_url: 'https://example.com/giraffe',
      }],
    })
    const results = await searchImages({ query: 'giraffe', provider: 'openverse', keys: {} })
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      provider: 'openverse',
      title: 'Giraffe',
      link: 'https://example.com/giraffe.jpg',
    })
  })

  it('normalizes Brave results', async () => {
    global.fetch = makeFetchWith({
      results: [{
        title: 'A brave result',
        properties: { url: 'https://img.example.com/brave.jpg' },
        thumbnail: { src: 'https://img.example.com/thumb.jpg' },
        url: 'https://example.com/page',
      }],
    })
    const results = await searchImages({ query: 'cat', provider: 'brave', keys: { braveApiKey: 'test-key' } })
    expect(results).toHaveLength(1)
    expect(results[0].provider).toBe('brave')
    expect(results[0].title).toBe('A brave result')
    expect(results[0].link).toBe('https://img.example.com/brave.jpg')
    expect(results[0].thumbnailLink).toBe('https://img.example.com/thumb.jpg')
  })

  it('normalizes Pixabay results', async () => {
    global.fetch = makeFetchWith({
      hits: [{
        tags: 'cat, animal',
        webformatURL: 'https://pixabay.com/img.jpg',
        previewURL: 'https://pixabay.com/preview.jpg',
        pageURL: 'https://pixabay.com/photo/cat',
      }],
    })
    const results = await searchImages({ query: 'cat', provider: 'pixabay', keys: { pixabayApiKey: 'test-key' } })
    expect(results[0].provider).toBe('pixabay')
    expect(results[0].title).toBe('cat, animal')
    expect(results[0].link).toBe('https://pixabay.com/img.jpg')
    expect(results[0].sourcePage).toBe('https://pixabay.com/photo/cat')
  })

  it('normalizes Pexels results', async () => {
    global.fetch = makeFetchWith({
      photos: [{
        alt: 'Cute cat',
        src: { large: 'https://pexels.com/large.jpg', small: 'https://pexels.com/small.jpg' },
        url: 'https://pexels.com/photo/cute-cat',
        photographer: 'John Doe',
      }],
    })
    const results = await searchImages({ query: 'cat', provider: 'pexels', keys: { pexelsApiKey: 'test-key' } })
    expect(results[0].provider).toBe('pexels')
    expect(results[0].title).toBe('Cute cat')
    expect(results[0].link).toBe('https://pexels.com/large.jpg')
    expect(results[0].thumbnailLink).toBe('https://pexels.com/small.jpg')
  })

  it('normalizes Google results', async () => {
    global.fetch = makeFetchWith({
      items: [{
        title: 'Google image',
        link: 'https://example.com/image.jpg',
        image: { thumbnailLink: 'https://example.com/thumb.jpg', contextLink: 'https://example.com/page' },
      }],
    })
    const results = await searchImages({ query: 'cat', provider: 'google', keys: { googleApiKey: 'test-key', googleCx: 'cx123' } })
    expect(results[0].provider).toBe('google')
    expect(results[0].link).toBe('https://example.com/image.jpg')
    expect(results[0].thumbnailLink).toBe('https://example.com/thumb.jpg')
    expect(results[0].sourcePage).toBe('https://example.com/page')
  })

  it('normalizes Openverse results', async () => {
    global.fetch = makeFetchWith({
      results: [{
        title: 'Open cat',
        url: 'https://openverse.org/img.jpg',
        thumbnail: 'https://openverse.org/thumb.jpg',
        foreign_landing_url: 'https://openverse.org/photo/open-cat',
      }],
    })
    const results = await searchImages({ query: 'cat', provider: 'openverse', keys: {} })
    expect(results[0].provider).toBe('openverse')
    expect(results[0].title).toBe('Open cat')
    expect(results[0].link).toBe('https://openverse.org/img.jpg')
  })
})

// ---------------------------------------------------------------------------
// searchImages — auto fallback chain
// ---------------------------------------------------------------------------
describe('searchImages auto fallback chain', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('returns brave results first when brave key is present', async () => {
    global.fetch = makeFetchWith({ results: [{ title: 'Clear dog photo', properties: { url: 'https://b.com/img.jpg', width: 1200, height: 900 }, thumbnail: { src: 'https://b.com/t.jpg' }, url: 'https://b.com' }] })
    const results = await searchImages({
      query: 'dog',
      provider: 'auto',
      keys: { braveApiKey: 'brave-key', pixabayApiKey: 'pix-key' },
    })
    expect(results[0].provider).toBe('brave')
    expect(global.fetch).toHaveBeenCalledOnce()
  })

  it('falls through to pixabay when brave returns empty', async () => {
    let callCount = 0
    global.fetch = vi.fn().mockImplementation((url) => {
      callCount++
      const urlStr = String(url)
      if (urlStr.includes('api.search.brave.com')) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ results: [] }) })
      }
      // pixabay
      return Promise.resolve({
        ok: true, status: 200,
        json: () => Promise.resolve({ hits: [{ tags: 'dog', webformatURL: 'https://pix.com/img.jpg', previewURL: 'https://pix.com/p.jpg', pageURL: 'https://pix.com/photo/dog' }] }),
      })
    })
    const results = await searchImages({
      query: 'dog',
      provider: 'auto',
      keys: { braveApiKey: 'brave-key', pixabayApiKey: 'pix-key' },
    })
    expect(results[0].provider).toBe('pixabay')
  })

  it('specific provider does not fall through', async () => {
    global.fetch = makeFetchWith({ hits: [] })
    await expect(searchImages({
      query: 'dog',
      provider: 'pixabay',
      keys: { pixabayApiKey: 'pix-key' },
    })).rejects.toMatchObject({
      code: 'provider_zero_results',
      provider: 'pixabay',
    })
    expect(global.fetch).toHaveBeenCalledOnce()
  })

  it('returns empty array for empty query', async () => {
    global.fetch = vi.fn()
    const results = await searchImages({ query: '', provider: 'auto', keys: {} })
    expect(results).toHaveLength(0)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// searchImages — error handling
// ---------------------------------------------------------------------------
describe('searchImages error handling', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('throws classified error for 401 from brave', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401, text: () => Promise.resolve('unauthorized') })
    await expect(searchImages({ query: 'cat', provider: 'brave', keys: { braveApiKey: 'bad' } }))
      .rejects.toMatchObject({ code: 'provider_auth_failed', provider: 'brave', status: 401 })
  })

  it('throws classified error for 429 from brave', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 429, text: () => Promise.resolve('rate limit') })
    await expect(searchImages({ query: 'cat', provider: 'brave', keys: { braveApiKey: 'key' } }))
      .rejects.toMatchObject({ code: 'provider_rate_limited', provider: 'brave', status: 429 })
  })

  it('throws classified error for 5xx from pixabay', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503, text: () => Promise.resolve('service down') })
    await expect(searchImages({ query: 'cat', provider: 'pixabay', keys: { pixabayApiKey: 'key' } }))
      .rejects.toMatchObject({ code: 'provider_network_error', provider: 'pixabay', status: 503 })
  })

  it('throws aggregated error when all providers fail', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network failure'))
    await expect(searchImages({ query: 'cat', provider: 'auto', keys: { braveApiKey: 'key' } }))
      .rejects.toMatchObject({ code: 'all_providers_failed', provider: 'auto' })
  })

  it('handles AbortError (timeout) gracefully', async () => {
    const abortErr = new Error('The operation was aborted')
    abortErr.name = 'AbortError'
    global.fetch = vi.fn().mockRejectedValue(abortErr)
    await expect(searchImages({ query: 'cat', provider: 'brave', keys: { braveApiKey: 'key' } }))
      .rejects.toThrow()
  })

  it('throws provider_not_configured when a selected provider has no key', async () => {
    global.fetch = vi.fn()
    await expect(searchImages({ query: 'cat', provider: 'brave', keys: { braveApiKey: '' } }))
      .rejects.toMatchObject({ code: 'provider_not_configured', provider: 'brave' })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('serializes structured image errors without key values', () => {
    const error = new ImageSearchError('Brave auth failed', {
      code: 'provider_auth_failed',
      provider: 'brave',
      query: 'giraffe',
      hint: 'Check the Brave API key.',
      details: 'safe detail',
    })
    expect(imageSearchErrorBody(error)).toEqual({
      error: 'Brave auth failed',
      code: 'provider_auth_failed',
      provider: 'brave',
      query: 'giraffe',
      status: undefined,
      hint: 'Check the Brave API key.',
      details: 'safe detail',
    })
  })
})

// ---------------------------------------------------------------------------
// embedImage
// ---------------------------------------------------------------------------
describe('embedImage', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('returns data URL for a valid small image', async () => {
    const imageBytes = Buffer.from('fakepng')
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (h) => {
          if (h === 'content-type') return 'image/png'
          if (h === 'content-length') return String(imageBytes.length)
          return null
        },
      },
      arrayBuffer: () => Promise.resolve(imageBytes.buffer),
    })
    const result = await embedImage('https://example.com/img.png')
    expect(result).toMatch(/^data:image\/png;base64,/)
  })

  it('rejects non-image content-type', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (h) => {
          if (h === 'content-type') return 'text/html'
          if (h === 'content-length') return '100'
          return null
        },
      },
      arrayBuffer: () => Promise.resolve(Buffer.from('<html>').buffer),
    })
    await expect(embedImage('https://example.com/page')).rejects.toThrow('not an image')
  })

  it('rejects images exceeding byte cap', async () => {
    const bigSize = 3_000_000
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (h) => {
          if (h === 'content-type') return 'image/jpeg'
          if (h === 'content-length') return String(bigSize)
          return null
        },
      },
      arrayBuffer: () => Promise.resolve(Buffer.alloc(bigSize).buffer),
    })
    await expect(embedImage('https://example.com/huge.jpg')).rejects.toThrow('too large')
  })

  it('rejects on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: { get: () => null },
    })
    await expect(embedImage('https://example.com/missing.jpg')).rejects.toThrow('download failed')
  })
})
