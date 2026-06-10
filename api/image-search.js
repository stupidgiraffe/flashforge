import { searchImages, embedImage, resolveKeys } from './_imageSearch.js'

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
      googleApiKey: body.googleApiKey,
      googleCx: body.googleCx,
    })
    const query = String(body.query || '').trim()
    if (!query) return json(res, 400, { error: 'query is required' })

    const results = await searchImages({
      query,
      provider: body.provider || 'auto',
      limit: Math.min(Number(body.limit || 10), 20),
      keys,
    })

    // Optional single-image embed (used by the agent Phase 2)
    if (body.embedImage && results.length > 0) {
      try {
        const dataUrl = await embedImage(results[0].link)
        return json(res, 200, { results, dataUrl, embedded: true })
      } catch {
        // Embed failed; return link-only result
      }
    }

    return json(res, 200, { results })
  } catch (error) {
    return json(res, 500, { error: error instanceof Error ? error.message : 'Image search failed' })
  }
}
