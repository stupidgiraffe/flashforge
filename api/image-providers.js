const PROVIDER_TIMEOUT_MS = 12_000
const USER_AGENT = 'FlashForge/1.0 image search'

async function fetchProviderJson(url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    if (!response.ok) {
      const error = new Error(`Provider returned HTTP ${response.status}`)
      error.status = response.status
      throw error
    }
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}

export function mapBraveResults(data) {
  return (data?.results || []).map((item) => ({
    title: item.title,
    description: item.description,
    url: item.properties?.url || item.url,
    thumbnailUrl: item.thumbnail?.src,
    sourcePage: item.url,
    width: item.properties?.width,
    height: item.properties?.height,
    provider: 'brave',
  }))
}

function mapPixabayResults(data) {
  return (data?.hits || []).map((item) => ({
    id: item.id,
    title: item.tags || 'Image result',
    description: item.tags,
    url: item.largeImageURL || item.webformatURL,
    thumbnailUrl: item.previewURL || item.webformatURL,
    sourcePage: item.pageURL,
    width: item.imageWidth,
    height: item.imageHeight,
    provider: 'pixabay',
  }))
}

function mapPexelsResults(data) {
  return (data?.photos || []).map((item) => ({
    id: item.id,
    title: item.alt || item.photographer || 'Image result',
    description: item.alt,
    url: item.src?.large || item.src?.medium || item.src?.original,
    thumbnailUrl: item.src?.small || item.src?.medium,
    sourcePage: item.url,
    width: item.width,
    height: item.height,
    provider: 'pexels',
  }))
}

function mapGoogleResults(data) {
  return (data?.items || []).map((item) => ({
    title: item.title,
    description: item.snippet,
    url: item.link,
    thumbnailUrl: item.image?.thumbnailLink,
    sourcePage: item.image?.contextLink,
    width: item.image?.width,
    height: item.image?.height,
    provider: 'google',
  }))
}

function mapOpenverseResults(data) {
  return (data?.results || []).map((item) => ({
    id: item.id,
    title: item.title || 'Image result',
    description: item.tags?.map?.((tag) => tag.name).filter(Boolean).join(', '),
    url: item.url,
    thumbnailUrl: item.thumbnail || item.url,
    sourcePage: item.foreign_landing_url,
    width: item.width,
    height: item.height,
    provider: 'openverse',
  }))
}

export const IMAGE_PROVIDER_ADAPTERS = {
  brave: {
    configured: (keys) => Boolean(keys.braveApiKey),
    async search({ query, keys, limit }) {
      const url = new URL('https://api.search.brave.com/res/v1/images/search')
      url.searchParams.set('q', query)
      url.searchParams.set('safesearch', 'strict')
      url.searchParams.set('count', String(Math.min(limit, 20)))
      const data = await fetchProviderJson(url, {
        headers: {
          'X-Subscription-Token': keys.braveApiKey,
          Accept: 'application/json',
          'Accept-Encoding': 'gzip',
        },
      })
      return mapBraveResults(data)
    },
  },
  pixabay: {
    configured: (keys) => Boolean(keys.pixabayApiKey),
    async search({ query, keys, limit }) {
      const url = new URL('https://pixabay.com/api/')
      url.searchParams.set('key', keys.pixabayApiKey)
      url.searchParams.set('q', query)
      url.searchParams.set('safesearch', 'true')
      url.searchParams.set('image_type', 'photo')
      url.searchParams.set('per_page', String(Math.min(Math.max(limit, 3), 20)))
      return mapPixabayResults(await fetchProviderJson(url))
    },
  },
  pexels: {
    configured: (keys) => Boolean(keys.pexelsApiKey),
    async search({ query, keys, limit }) {
      const url = new URL('https://api.pexels.com/v1/search')
      url.searchParams.set('query', query)
      url.searchParams.set('per_page', String(Math.min(limit, 20)))
      return mapPexelsResults(await fetchProviderJson(url, { headers: { Authorization: keys.pexelsApiKey } }))
    },
  },
  google: {
    configured: (keys) => Boolean(keys.googleApiKey && keys.googleCx),
    async search({ query, keys, limit }) {
      const url = new URL('https://www.googleapis.com/customsearch/v1')
      url.searchParams.set('searchType', 'image')
      url.searchParams.set('safe', 'active')
      url.searchParams.set('num', String(Math.min(Math.max(limit, 1), 10)))
      url.searchParams.set('q', query)
      url.searchParams.set('key', keys.googleApiKey)
      url.searchParams.set('cx', keys.googleCx)
      return mapGoogleResults(await fetchProviderJson(url))
    },
  },
  openverse: {
    configured: () => true,
    async search({ query, limit }) {
      const url = new URL('https://api.openverse.org/v1/images/')
      url.searchParams.set('q', query)
      url.searchParams.set('page_size', String(Math.min(limit, 20)))
      url.searchParams.set('license_type', 'all')
      return mapOpenverseResults(await fetchProviderJson(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      }))
    },
  },
}

export function getAutoProviderChain(keys) {
  return ['google', 'brave', 'pixabay', 'pexels', 'openverse']
    .filter((provider) => IMAGE_PROVIDER_ADAPTERS[provider].configured(keys))
}
