import { embedImage, searchImages } from './_imageSearch.js'

const MAX_CARDS = 50

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Method not allowed' })
  }

  try {
    const body = await readBody(req)
    const googleApiKey = String(body.apiKey || body.googleApiKey || '').trim()
    const googleCx = String(body.cx || body.googleCx || '').trim()
    const provider = body.provider || 'auto'
    const embedImages = Boolean(body.embedImages)
    const cards = Array.isArray(body.cards) ? body.cards.slice(0, MAX_CARDS) : []
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
        const [found] = await searchImages({ query, googleApiKey, googleCx, provider, limit: 1 })
        if (!found) {
          results.push({ cardId, query, error: 'No image found' })
          continue
        }
        const result = { cardId, query, title: found.title, imageUrl: found.link, thumbnailLink: found.thumbnailLink, sourcePage: found.sourcePage, provider: found.provider, embedded: false }
        if (embedImages) {
          try {
            result.dataUrl = await embedImage(found.link)
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
