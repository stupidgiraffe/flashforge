import { searchImages } from './_imageSearch.js'

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
    const results = await searchImages({
      query: body.query,
      googleApiKey: String(body.googleApiKey || '').trim(),
      googleCx: String(body.googleCx || '').trim(),
      provider: body.provider || 'auto',
      limit: Number(body.limit || 10),
    })
    return json(res, 200, { results })
  } catch (error) {
    return json(res, 500, { error: error instanceof Error ? error.message : 'Image search failed' })
  }
}
