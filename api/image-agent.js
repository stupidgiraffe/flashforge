import { embedImage, imageSearchErrorBody, searchImages, resolveKeys } from './_imageSearch.js'

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
    const keys = resolveKeys({
      braveApiKey: body.braveApiKey,
      pixabayApiKey: body.pixabayApiKey,
      pexelsApiKey: body.pexelsApiKey,
      googleApiKey: body.googleApiKey || body.apiKey,
      googleCx: body.googleCx || body.cx,
    })
    const provider = body.provider || 'auto'
    const embedImages = Boolean(body.embedImages)
    const cards = Array.isArray(body.cards) ? body.cards.slice(0, MAX_CARDS) : []
    if (cards.length === 0) return json(res, 400, { error: 'No cards supplied' })

    const results = []
    for (const card of cards) {
      const cardId = String(card.id || '')
      const query = String(card.query || '').trim()
      if (!cardId || !query) {
        results.push({ cardId, query, error: 'Missing card id or query', code: 'provider_bad_request' })
        continue
      }
      try {
        const [found] = await searchImages({ query, provider, limit: 1, keys })
        const result = { cardId, query, title: found.title, imageUrl: found.link, thumbnailLink: found.thumbnailLink, sourcePage: found.sourcePage, provider: found.provider, embedded: false }
        if (embedImages) {
          try {
            result.dataUrl = await embedImage(found.link)
            result.embedded = true
          } catch (error) {
            result.warning = {
              error: error instanceof Error ? error.message : 'Image download failed',
              code: 'image_embed_failed',
              provider: found.provider,
              query,
              hint: 'Found an image result, but downloading it for embedding failed. The remote URL is being used instead.',
            }
          }
        }
        results.push(result)
      } catch (error) {
        results.push({ cardId, query, ...imageSearchErrorBody(error, 'Search failed') })
      }
    }
    return json(res, 200, { results })
  } catch (error) {
    return json(res, 500, { error: error instanceof Error ? error.message : 'Image Agent failed' })
  }
}
