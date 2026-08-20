import { z } from 'zod'
import { ImageSearchError, searchImages, resolveKeys } from './_imageSearch.js'
import { safeExternalFetch } from './_network-safety.js'
import { RequestValidationError, createSanitizedJsonResponse, readJsonBody, writeRequestError } from './_request.js'

const MAX_EMBED_BYTES = 2_000_000
const EMBED_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; FlashForge/0.1; +https://github.com/stupidgiraffe/flashforge)',
  Accept: 'image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8',
}

const requestSchema = z.object({
  query: z.string().trim().min(1).max(500),
  provider: z.enum(['auto', 'brave', 'pixabay', 'pexels', 'google', 'openverse']).optional().default('auto'),
  limit: z.coerce.number().int().min(1).max(20).optional().default(10),
  braveApiKey: z.string().max(8192).optional().default(''),
  pixabayApiKey: z.string().max(8192).optional().default(''),
  pexelsApiKey: z.string().max(8192).optional().default(''),
  googleApiKey: z.string().max(8192).optional().default(''),
  googleCx: z.string().max(1000).optional().default(''),
  embedImage: z.boolean().optional().default(false),
  intent: z.object({
    query: z.string().max(500).optional(),
    concepts: z.array(z.string().max(200)).max(8).optional(),
    style: z.string().max(100).optional(),
  }).optional(),
})

function json(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

async function embedRemoteImage(imageUrl) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await safeExternalFetch(imageUrl, {
      signal: controller.signal,
      headers: EMBED_HEADERS,
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

function imageErrorStatus(error) {
  if (!(error instanceof ImageSearchError)) return 502
  if (error.code === 'provider_not_configured') return 400
  if (error.code === 'provider_auth_failed') return 401
  if (error.code === 'provider_rate_limited') return 429
  if (error.code === 'provider_zero_results') return 404
  if (error.code === 'provider_bad_request') return 400
  if (error.code === 'provider_timeout') return 504
  return 502
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Method not allowed' })
  }

  const { requestId } = createSanitizedJsonResponse(res)
  try {
    const body = await readJsonBody(req, requestSchema)
    const keys = resolveKeys({
      braveApiKey: body.braveApiKey,
      pixabayApiKey: body.pixabayApiKey,
      pexelsApiKey: body.pexelsApiKey,
      googleApiKey: body.googleApiKey,
      googleCx: body.googleCx,
    })
    const results = await searchImages({
      query: body.query,
      provider: body.provider,
      limit: body.limit,
      keys,
      intent: body.intent
        ? {
            query: body.query,
            concepts: body.intent.concepts ?? [],
            style: body.intent.style || 'neutral',
          }
        : { query: body.query },
    })

    if (body.embedImage && results.length > 0) {
      if (results[0].needsReview) {
        return json(res, 200, {
          results,
          embedded: false,
          warning: {
            error: 'Top image candidate has low relevance confidence',
            code: 'low_confidence_image',
            provider: results[0].provider,
            query: body.query,
            hint: 'Review the backup candidates or try a more specific visual concept.',
          },
        })
      }
      try {
        const dataUrl = await embedRemoteImage(results[0].link)
        return json(res, 200, { results, dataUrl, embedded: true })
      } catch {
        return json(res, 200, {
          results,
          embedded: false,
          warning: {
            error: 'The selected image could not be safely embedded',
            code: 'image_embed_failed',
            provider: results[0].provider,
            query: body.query,
            hint: 'The remote image URL is being used instead. Review the source before printing or redistributing it.',
          },
        })
      }
    }

    return json(res, 200, { results })
  } catch (error) {
    if (error instanceof RequestValidationError) return writeRequestError(res, error, requestId)
    const status = imageErrorStatus(error)
    return writeRequestError(res, new RequestValidationError(
      error instanceof ImageSearchError ? error.message : 'Image search failed',
      {
        status,
        code: error instanceof ImageSearchError ? error.code : 'IMAGE_SEARCH_FAILED',
        hint: error instanceof ImageSearchError ? error.hint : 'Check the image provider settings and try again.',
      },
    ), requestId)
  }
}
