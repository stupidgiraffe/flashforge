import { rankImageCandidates } from './image-candidates.js'
import { getAutoProviderChain, IMAGE_PROVIDER_ADAPTERS } from './image-providers.js'

const EMBED_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8',
}

const MAX_EMBED_BYTES = 2_000_000

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
  if (typeof error?.status === 'number') return classifyStatus(provider, query, error.status)
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











/**
 * Search images using the provider registry.
 * @param {object} opts
 * @param {string} opts.query - Search query
 * @param {'auto'|'brave'|'pixabay'|'pexels'|'google'|'openverse'} [opts.provider='auto']
 * @param {number} [opts.limit=10]
 * @param {object} [opts.keys={}] - Merged provider keys (env already resolved via resolveKeys)
 */
export async function searchImages({ query, provider = 'auto', limit = 10, keys = {}, intent }) {
  const trimmed = String(query || '').trim()
  if (!trimmed) return []

  const chain = provider === 'auto' ? getAutoProviderChain(keys) : [provider]
  const candidatePoolSize = Math.min(20, Math.max(12, limit * 3))

  const attempts = []
  for (const current of chain) {
    try {
      const adapter = IMAGE_PROVIDER_ADAPTERS[current]
      if (!adapter) throw providerError(current, trimmed, 'provider_not_supported', `Unsupported image provider: ${current}`)
      if (!adapter.configured(keys)) {
        throw providerError(current, trimmed, 'provider_not_configured', `${providerLabel(current)} image search is not configured`, {
          hint: `Add ${providerLabel(current)} credentials or switch to Auto/Openverse.`,
        })
      }
      const rawResults = await adapter.search({ query: trimmed, keys, limit: candidatePoolSize })
      const results = rankImageCandidates(rawResults, intent || { query: trimmed }, limit)
      if (results.length > 0) return results
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
