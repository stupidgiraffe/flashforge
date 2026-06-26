const EMBED_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8',
}

const MAX_EMBED_BYTES = 2_000_000
const PROVIDER_TIMEOUT_MS = 12_000

export class ImageSearchError extends Error {
  constructor(message, { code, provider, query, status, hint, details } = {}) {
    super(message)
    this.name = 'ImageSearchError'
    this.code = code || 'provider_network_error'
    this.provider = provider
    this.query = query
    this.status = status
    this.hint = hint
    this.details = details
  }
}

function providerLabel(provider) {
  return provider ? provider[0].toUpperCase() + provider.slice(1) : 'Image provider'
}

function providerError(provider, query, code, message, extras = {}) {
  return new ImageSearchError(message, { provider, query, code, ...extras })
}

function classifyStatus(provider, query, status) {
  if (status === 401 || status === 403) {
    return providerError(provider, query, 'provider_auth_failed', `${providerLabel(provider)} auth failed`, {
      status,
      hint: `Check the ${providerLabel(provider)} API key and account access.`,
    })
  }
  if (status === 429) {
    return providerError(provider, query, 'provider_rate_limited', `${providerLabel(provider)} rate limit reached`, {
      status,
      hint: `Wait and try again, or switch providers in Auto mode.`,
    })
  }
  if (status >= 400 && status < 500) {
    return providerError(provider, query, 'provider_bad_request', `${providerLabel(provider)} rejected the image search request`, {
      status,
      hint: `Check the query and provider configuration.`,
    })
  }
  return providerError(provider, query, 'provider_network_error', `${providerLabel(provider)} image search failed`, {
    status,
    hint: `Check provider status or try Auto fallback.`,
  })
}

function classifyThrown(provider, query, error) {
  if (error instanceof ImageSearchError) return error
  if (error && error.name === 'AbortError') {
    return providerError(provider, query, 'provider_timeout', `${providerLabel(provider)} image search timed out`, {
      hint: `Try again or switch providers.`,
    })
  }
  return providerError(provider, query, 'provider_network_error', `${providerLabel(provider)} image search network error`, {
    details: error instanceof Error ? error.message : String(error || 'unknown error'),
    hint: `Check the network connection or try another provider.`,
  })
}

export function imageSearchErrorBody(error, fallback = 'Image search failed') {
  if (error instanceof ImageSearchError) {
    return {
      error: error.message || fallback,
      code: error.code,
      provider: error.provider,
      query: error.query,
      status: error.status,
      hint: error.hint,
      details: error.details,
    }
  }
  return {
    error: error instanceof Error ? error.message : fallback,
    code: 'provider_network_error',
    hint: 'Check the image provider settings and try again.',
  }
}

function normalizeResult(result) {
  const link = result.link || result.image || result.imageUrl || result.thumbnail || result.thumbnailLink
  if (!link) return null
  return {
    title: result.title || result.name || 'Image result',
    link,
    thumbnailLink: result.thumbnailLink || result.thumbnail || result.image || link,
    sourcePage: result.sourcePage || result.url || result.contextLink,
    provider: result.provider,
  }
}

/**
 * Resolve merged keys: env vars as secure defaults, per-request keys override/supplement.
 * Never logs or echoes key values.
 */
export function resolveKeys(passedKeys = {}) {
  return {
    braveApiKey: String(passedKeys.braveApiKey || process.env.BRAVE_API_KEY || '').trim(),
    pixabayApiKey: String(passedKeys.pixabayApiKey || process.env.PIXABAY_API_KEY || '').trim(),
    pexelsApiKey: String(passedKeys.pexelsApiKey || process.env.PEXELS_API_KEY || '').trim(),
    googleApiKey: String(passedKeys.googleApiKey || process.env.GOOGLE_API_KEY || '').trim(),
    googleCx: String(passedKeys.googleCx || process.env.GOOGLE_CX || '').trim(),
  }
}

/**
 * Returns booleans indicating which providers are configured via server env vars only.
 * Never exposes actual key values.
 */
export function getServerProviderConfig() {
  return {
    brave: Boolean(process.env.BRAVE_API_KEY),
    pixabay: Boolean(process.env.PIXABAY_API_KEY),
    pexels: Boolean(process.env.PEXELS_API_KEY),
    google: Boolean(process.env.GOOGLE_API_KEY && process.env.GOOGLE_CX),
    openverse: true,
  }
}

async function searchBrave({ query, apiKey, limit }) {
  if (!apiKey) throw providerError('brave', query, 'provider_not_configured', 'Brave image search is not configured', {
    hint: 'Add a Brave Search API token or switch to Auto/Openverse.',
  })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS)
  try {
    const url = new URL('https://api.search.brave.com/res/v1/images/search')
    url.searchParams.set('q', query)
    url.searchParams.set('safesearch', 'strict')
    url.searchParams.set('count', String(Math.min(limit, 20)))
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'X-Subscription-Token': apiKey,
        Accept: 'application/json',
        'Accept-Encoding': 'gzip',
      },
    })
    if (!response.ok) {
      throw classifyStatus('brave', query, response.status)
    }
    const data = await response.json()
    return (data.results || []).slice(0, limit).map((item) => normalizeResult({
      title: item.title,
      link: item.properties?.url || item.url,
      thumbnailLink: item.thumbnail?.src,
      sourcePage: item.url,
      provider: 'brave',
    })).filter(Boolean)
  } catch (error) {
    throw classifyThrown('brave', query, error)
  } finally {
    clearTimeout(timer)
  }
}

async function searchPixabay({ query, apiKey, limit }) {
  if (!apiKey) throw providerError('pixabay', query, 'provider_not_configured', 'Pixabay image search is not configured', {
    hint: 'Add a Pixabay API key or switch to Auto/Openverse.',
  })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS)
  try {
    const url = new URL('https://pixabay.com/api/')
    url.searchParams.set('key', apiKey)
    url.searchParams.set('q', query)
    url.searchParams.set('safesearch', 'true')
    url.searchParams.set('image_type', 'photo')
    url.searchParams.set('per_page', String(Math.min(Math.max(limit, 3), 20)))
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      throw classifyStatus('pixabay', query, response.status)
    }
    const data = await response.json()
    return (data.hits || []).slice(0, limit).map((item) => normalizeResult({
      title: item.tags || 'Image result',
      link: item.webformatURL || item.largeImageURL,
      thumbnailLink: item.previewURL || item.webformatURL,
      sourcePage: item.pageURL,
      provider: 'pixabay',
    })).filter(Boolean)
  } catch (error) {
    throw classifyThrown('pixabay', query, error)
  } finally {
    clearTimeout(timer)
  }
}

async function searchPexels({ query, apiKey, limit }) {
  if (!apiKey) throw providerError('pexels', query, 'provider_not_configured', 'Pexels image search is not configured', {
    hint: 'Add a Pexels API key or switch to Auto/Openverse.',
  })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS)
  try {
    const url = new URL('https://api.pexels.com/v1/search')
    url.searchParams.set('query', query)
    url.searchParams.set('per_page', String(Math.min(limit, 20)))
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Authorization: apiKey },
    })
    if (!response.ok) {
      throw classifyStatus('pexels', query, response.status)
    }
    const data = await response.json()
    return (data.photos || []).slice(0, limit).map((item) => normalizeResult({
      title: item.alt || item.photographer || 'Image result',
      link: item.src?.large || item.src?.medium || item.src?.original,
      thumbnailLink: item.src?.small || item.src?.medium,
      sourcePage: item.url,
      provider: 'pexels',
    })).filter(Boolean)
  } catch (error) {
    throw classifyThrown('pexels', query, error)
  } finally {
    clearTimeout(timer)
  }
}

async function searchGoogle({ query, apiKey, cx, limit }) {
  if (!apiKey || !cx) throw providerError('google', query, 'provider_not_configured', 'Google image search is not configured', {
    hint: 'Add both a Google API key and Custom Search cx, or switch to Auto/Openverse.',
  })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS)
  try {
    const url = new URL('https://www.googleapis.com/customsearch/v1')
    url.searchParams.set('searchType', 'image')
    url.searchParams.set('safe', 'active')
    url.searchParams.set('num', String(Math.min(Math.max(limit, 1), 10)))
    url.searchParams.set('q', query)
    url.searchParams.set('key', apiKey)
    url.searchParams.set('cx', cx)
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      throw classifyStatus('google', query, response.status)
    }
    const data = await response.json()
    return (data.items || [])
      .map((item) => normalizeResult({
        title: item.title,
        link: item.link,
        thumbnailLink: item.image && item.image.thumbnailLink,
        sourcePage: item.image && item.image.contextLink,
        provider: 'google',
      }))
      .filter(Boolean)
  } catch (error) {
    throw classifyThrown('google', query, error)
  } finally {
    clearTimeout(timer)
  }
}

async function searchOpenverse({ query, limit }) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS)
  try {
    const url = new URL('https://api.openverse.org/v1/images/')
    url.searchParams.set('q', query)
    url.searchParams.set('page_size', String(Math.min(limit, 20)))
    url.searchParams.set('license_type', 'all')
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': EMBED_HEADERS['User-Agent'], Accept: 'application/json' },
    })
    if (!response.ok) throw classifyStatus('openverse', query, response.status)
    const data = await response.json()
    return (data.results || [])
      .slice(0, limit)
      .map((item) => normalizeResult({
        title: item.title || 'Image result',
        link: item.url,
        thumbnailLink: item.thumbnail || item.url,
        sourcePage: item.foreign_landing_url,
        provider: 'openverse',
      }))
      .filter(Boolean)
  } catch (error) {
    throw classifyThrown('openverse', query, error)
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Search images using the provider registry.
 * @param {object} opts
 * @param {string} opts.query - Search query
 * @param {'auto'|'brave'|'pixabay'|'pexels'|'google'|'openverse'} [opts.provider='auto']
 * @param {number} [opts.limit=10]
 * @param {object} [opts.keys={}] - Merged provider keys (env already resolved via resolveKeys)
 */
export async function searchImages({ query, provider = 'auto', limit = 10, keys = {} }) {
  const trimmed = String(query || '').trim()
  if (!trimmed) return []

  const { braveApiKey, pixabayApiKey, pexelsApiKey, googleApiKey, googleCx } = keys

  let chain
  if (provider === 'auto') {
    // Build chain dynamically from available credentials; openverse is always last-resort
    chain = []
    if (googleApiKey && googleCx) chain.push('google')
    if (braveApiKey) chain.push('brave')
    if (pixabayApiKey) chain.push('pixabay')
    if (pexelsApiKey) chain.push('pexels')
    chain.push('openverse')
  } else {
    chain = [provider]
  }

  const attempts = []
  for (const current of chain) {
    try {
      let results = []
      if (current === 'brave') results = await searchBrave({ query: trimmed, apiKey: braveApiKey, limit })
      else if (current === 'pixabay') results = await searchPixabay({ query: trimmed, apiKey: pixabayApiKey, limit })
      else if (current === 'pexels') results = await searchPexels({ query: trimmed, apiKey: pexelsApiKey, limit })
      else if (current === 'google') results = await searchGoogle({ query: trimmed, apiKey: googleApiKey, cx: googleCx, limit })
      else if (current === 'openverse') results = await searchOpenverse({ query: trimmed, limit })
      if (results.length > 0) return results.slice(0, limit)
      attempts.push({ provider: current, code: 'provider_zero_results', query: trimmed })
      if (provider !== 'auto') {
        throw providerError(current, trimmed, 'provider_zero_results', `No image found from ${providerLabel(current)}`, {
          hint: `${providerLabel(current)} returned 0 image results for this query.`,
        })
      }
    } catch (error) {
      const classified = classifyThrown(current, trimmed, error)
      attempts.push(imageSearchErrorBody(classified))
      if (provider !== 'auto') throw classified
    }
  }
  throw providerError('auto', trimmed, 'all_providers_failed', 'All configured image providers failed', {
    details: attempts,
    hint: 'Check configured provider keys or try a simpler query.',
  })
}

export async function embedImage(imageUrl) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: EMBED_HEADERS,
      redirect: 'follow',
    })
    if (!response.ok) throw new Error(`download failed (${response.status})`)
    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    if (!contentType.startsWith('image/')) throw new Error('result was not an image')
    const length = Number(response.headers.get('content-length') || '0')
    if (length > MAX_EMBED_BYTES) throw new Error('image too large to embed')
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.byteLength > MAX_EMBED_BYTES) throw new Error('image too large to embed')
    return `data:${contentType.split(';')[0]};base64,${bytes.toString('base64')}`
  } finally {
    clearTimeout(timer)
  }
}
