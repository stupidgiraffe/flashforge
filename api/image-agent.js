const MAX_CARDS = 50
const MAX_EMBED_BYTES = 2_500_000

function json(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

async function searchImage({ apiKey, cx, query }) {
  const url = new URL('https://www.googleapis.com/customsearch/v1')
  url.searchParams.set('searchType', 'image')
  url.searchParams.set('safe', 'active')
  url.searchParams.set('num', '3')
  url.searchParams.set('q', query)
  url.searchParams.set('key', apiKey)
  url.searchParams.set('cx', cx)

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(response.status === 429 ? 'Google Image Search rate limit reached' : `Google Image Search failed (${response.status})`)
  }
  const data = await response.json()
  const item = Array.isArray(data.items) ? data.items.find((entry) => entry && entry.link) : null
  if (!item) return null
  return {
    title: item.title || 'Image result',
    imageUrl: item.link,
    thumbnailLink: item.image && item.image.thumbnailLink,
    sourcePage: item.image && item.image.contextLink,
  }
}

async function embedImage(imageUrl) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)
  try {
    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'FlashForge Image Agent/1.0 (+BYOK classroom flashcard tool)',
        Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5',
      },
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Method not allowed' })
  }

  try {
    const body = await readBody(req)
    const apiKey = String(body.apiKey || '').trim()
    const cx = String(body.cx || '').trim()
    const embedImages = Boolean(body.embedImages)
    const cards = Array.isArray(body.cards) ? body.cards.slice(0, MAX_CARDS) : []

    if (!apiKey || !cx) return json(res, 400, { error: 'Missing Google API key or Search Engine ID' })
    if (cards.length === 0) return json(res, 400, { error: 'No cards supplied' })

    const results = []
    for (const card of cards) {
      const cardId = String(card.id || '')
      const query = String(card.query || '').trim()
      if (!cardId || !query) {
        results.push({ cardId, query, error: 'Missing card id or query' })
        continue
      }

      try {
        const found = await searchImage({ apiKey, cx, query })
        if (!found) {
          results.push({ cardId, query, error: 'No image found' })
          continue
        }

        const result = { cardId, query, ...found, embedded: false }
        if (embedImages) {
          try {
            result.dataUrl = await embedImage(found.imageUrl)
            result.embedded = true
          } catch (error) {
            result.error = `Found image link, but could not embed: ${error instanceof Error ? error.message : 'download failed'}`
          }
        }
        results.push(result)
      } catch (error) {
        results.push({ cardId, query, error: error instanceof Error ? error.message : 'Search failed' })
      }
    }

    return json(res, 200, { results })
  } catch (error) {
    return json(res, 500, { error: error instanceof Error ? error.message : 'Image Agent failed' })
  }
}
