const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
}

const MAX_EMBED_BYTES = 2_500_000
const SCRAPER_TIMEOUT_MS = 10_000

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

async function searchGoogle({ query, apiKey, cx, limit }) {
  if (!apiKey || !cx) return []
  const url = new URL('https://www.googleapis.com/customsearch/v1')
  url.searchParams.set('searchType', 'image')
  url.searchParams.set('safe', 'active')
  url.searchParams.set('num', String(Math.min(Math.max(limit, 1), 10)))
  url.searchParams.set('q', query)
  url.searchParams.set('key', apiKey)
  url.searchParams.set('cx', cx)

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(response.status === 429 ? 'Google Image Search rate limit reached' : `Google Image Search failed (${response.status})`)
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
}


function decodeHtml(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

async function searchBing({ query, limit }) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SCRAPER_TIMEOUT_MS)
  try {
    const url = new URL('https://www.bing.com/images/search')
    url.searchParams.set('q', query)
    url.searchParams.set('form', 'HDRSC2')
    url.searchParams.set('first', '1')
    const response = await fetch(url, { signal: controller.signal, headers: DEFAULT_HEADERS })
    if (!response.ok) throw new Error(`Bing image search failed (${response.status})`)
    const html = await response.text()
    const results = []
    const seen = new Set()

    for (const match of html.matchAll(/m=\"([^\"]+)\"/g)) {
      try {
        const meta = JSON.parse(decodeHtml(match[1]))
        const link = meta.murl || meta.imgurl
        if (!link || seen.has(link)) continue
        seen.add(link)
        results.push(normalizeResult({
          title: meta.t || 'Image result',
          link,
          thumbnailLink: meta.turl || link,
          sourcePage: meta.purl,
          provider: 'bing',
        }))
        if (results.length >= limit) break
      } catch {}
    }

    if (results.length < limit) {
      for (const match of html.matchAll(/&quot;murl&quot;:&quot;([^&]+)&quot;.*?&quot;turl&quot;:&quot;([^&]+)&quot;/g)) {
        const link = decodeHtml(match[1])
        if (!link || seen.has(link)) continue
        seen.add(link)
        results.push(normalizeResult({
          title: 'Image result',
          link,
          thumbnailLink: decodeHtml(match[2]) || link,
          provider: 'bing',
        }))
        if (results.length >= limit) break
      }
    }

    return results.filter(Boolean).slice(0, limit)
  } finally {
    clearTimeout(timer)
  }
}

async function searchDuckDuckGo({ query, limit }) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SCRAPER_TIMEOUT_MS)
  try {
    const landing = new URL('https://duckduckgo.com/')
    landing.searchParams.set('q', query)
    landing.searchParams.set('iax', 'images')
    landing.searchParams.set('ia', 'images')
    const landingResponse = await fetch(landing, { signal: controller.signal, headers: DEFAULT_HEADERS })
    if (!landingResponse.ok) throw new Error(`DuckDuckGo landing failed (${landingResponse.status})`)
    const landingText = await landingResponse.text()
    const token = landingText.match(/vqd=['"]([^'"]+)/)?.[1]
      || landingText.match(/vqd=([^&"'\s<>]+)/)?.[1]
      || landingText.match(/"vqd"\s*:\s*"([^"]+)"/)?.[1]
    if (!token) throw new Error('DuckDuckGo image token not found')

    const api = new URL('https://duckduckgo.com/i.js')
    api.searchParams.set('l', 'us-en')
    api.searchParams.set('o', 'json')
    api.searchParams.set('q', query)
    api.searchParams.set('vqd', token)
    api.searchParams.set('p', '1')

    const response = await fetch(api, { signal: controller.signal, headers: { ...DEFAULT_HEADERS, Referer: landing.toString() } })
    if (!response.ok) throw new Error(`DuckDuckGo image search failed (${response.status})`)
    const data = await response.json()
    return (data.results || [])
      .slice(0, limit)
      .map((item) => normalizeResult({
        title: item.title,
        link: item.image,
        thumbnailLink: item.thumbnail,
        sourcePage: item.url,
        provider: 'duckduckgo',
      }))
      .filter(Boolean)
  } finally {
    clearTimeout(timer)
  }
}

async function searchOpenverse({ query, limit }) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SCRAPER_TIMEOUT_MS)
  try {
    const url = new URL('https://api.openverse.org/v1/images/')
    url.searchParams.set('q', query)
    url.searchParams.set('page_size', String(Math.min(limit, 20)))
    url.searchParams.set('license_type', 'all')
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': DEFAULT_HEADERS['User-Agent'], Accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`Openverse image search failed (${response.status})`)
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
  } finally {
    clearTimeout(timer)
  }
}

export async function searchImages({ query, googleApiKey = '', googleCx = '', provider = 'auto', limit = 10 }) {
  const trimmed = String(query || '').trim()
  if (!trimmed) return []
  const errors = []
  const providers = provider === 'google'
    ? ['google']
    : provider === 'duckduckgo'
      ? ['duckduckgo']
      : provider === 'bing'
        ? ['bing']
        : provider === 'openverse'
          ? ['openverse']
          : googleApiKey && googleCx
            ? ['google', 'duckduckgo', 'openverse', 'bing']
            : ['duckduckgo', 'openverse', 'bing', 'google']

  for (const current of providers) {
    try {
      const results = current === 'google'
        ? await searchGoogle({ query: trimmed, apiKey: googleApiKey, cx: googleCx, limit })
        : current === 'bing'
          ? await searchBing({ query: trimmed, limit })
          : current === 'openverse'
            ? await searchOpenverse({ query: trimmed, limit })
            : await searchDuckDuckGo({ query: trimmed, limit })
      if (results.length > 0) return results.slice(0, limit)
    } catch (error) {
      errors.push(`${current}: ${error instanceof Error ? error.message : 'failed'}`)
    }
  }
  if (errors.length) throw new Error(errors.join('; '))
  return []
}

export async function embedImage(imageUrl) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)
  try {
    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: DEFAULT_HEADERS,
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
