import { ImageSearchError, imageSearchErrorBody, searchImages, embedImage, resolveKeys } from './_imageSearch.js'

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
      intent: body.intent && typeof body.intent === 'object'
        ? {
            query,
            concepts: Array.isArray(body.intent.concepts) ? body.intent.concepts.slice(0, 8).map(String) : [],
            style: String(body.intent.style || 'neutral'),
          }
        : { query },
    })

    // Optional single-image embed (used by the agent Phase 2)
    if (body.embedImage && results.length > 0) {
      if (results[0].needsReview) {
        return json(res, 200, {
          results,
          embedded: false,
          warning: {
            error: 'Top image candidate has low relevance confidence',
            code: 'low_confidence_image',
            provider: results[0].provider,
            query,
            hint: 'Review the backup candidates or try a more specific visual concept.',
          },
        })
      }
      try {
        const dataUrl = await embedImage(results[0].link)
        return json(res, 200, { results, dataUrl, embedded: true })
      } catch (error) {
        // Embed failed; keep the usable remote URL and report the fallback.
        return json(res, 200, {
          results,
          embedded: false,
          warning: {
            error: error instanceof Error ? error.message : 'Image download failed',
            code: 'image_embed_failed',
            provider: results[0].provider,
            query,
            hint: 'Found an image result, but downloading it for embedding failed. The remote URL is being used instead.',
          },
        })
      }
    }

    return json(res, 200, { results })
  } catch (error) {
    const body = imageSearchErrorBody(error, 'Image search failed')
    const status = error instanceof ImageSearchError && error.code === 'provider_not_configured' ? 400
      : error instanceof ImageSearchError && error.code === 'provider_auth_failed' ? 401
        : error instanceof ImageSearchError && error.code === 'provider_rate_limited' ? 429
          : error instanceof ImageSearchError && error.code === 'provider_zero_results' ? 404
            : error instanceof ImageSearchError && error.code === 'provider_bad_request' ? 400
              : error instanceof ImageSearchError && error.code === 'provider_timeout' ? 504
                : 502
    return json(res, status, body)
  }
}
