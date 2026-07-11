const PROVIDER_BASE_URLS = {
  openai: 'https://api.openai.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
  groq: 'https://api.groq.com/openai/v1',
  mistral: 'https://api.mistral.ai/v1',
  together: 'https://api.together.xyz/v1',
  xai: 'https://api.x.ai/v1',
  deepseek: 'https://api.deepseek.com/v1',
  cerebras: 'https://api.cerebras.ai/v1',
  custom: '',
}

const PROVIDERS = new Set(Object.keys(PROVIDER_BASE_URLS))

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

export function normalizeModelResults(rawModels, provider) {
  return (Array.isArray(rawModels) ? rawModels : [])
    .map((raw) => {
      const id = String(raw?.id || raw?.name || '').trim()
      if (!id) return null
      const supported = Array.isArray(raw?.supported_parameters) ? raw.supported_parameters : []
      const promptPrice = Number(raw?.pricing?.prompt)
      const completionPrice = Number(raw?.pricing?.completion)
      return {
        id,
        name: String(raw?.display_name || raw?.name || id).trim(),
        provider,
        ...(raw?.description ? { description: String(raw.description).slice(0, 300) } : {}),
        ...(Number.isFinite(Number(raw?.context_length)) ? { contextLength: Number(raw.context_length) } : {}),
        ...(Number.isFinite(promptPrice) ? { inputPrice: promptPrice * 1_000_000 } : {}),
        ...(Number.isFinite(completionPrice) ? { outputPrice: completionPrice * 1_000_000 } : {}),
        ...(supported.length ? { structuredOutput: supported.includes('response_format') || supported.includes('structured_outputs') } : {}),
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name))
}

function normalizeBaseUrl(provider, rawBaseUrl) {
  const fallback = PROVIDER_BASE_URLS[provider] || ''
  const raw = String(rawBaseUrl || fallback).trim().replace(/\/$/, '')
  if (!raw) throw new Error('Model discovery base URL is required')
  const url = new URL(raw)
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Model discovery base URL must use HTTPS')
  return raw
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' })
  }
  try {
    const body = await readBody(req)
    const provider = PROVIDERS.has(body.provider) ? body.provider : 'custom'
    const apiKey = String(body.apiKey || '').trim()
    if (!apiKey) return json(res, 400, { error: 'API key required for model discovery', code: 'MISSING_API_KEY', hint: 'Enter your provider key, or type a model id manually.' })
    const baseUrl = normalizeBaseUrl(provider, body.baseUrl)
    const response = await fetch(`${baseUrl}/models`, { headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' } })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      return json(res, response.status, {
        error: response.status === 401 ? 'Model discovery authentication failed' : `Model discovery failed (${response.status})`,
        code: response.status === 401 ? 'AI_AUTH_FAILED' : 'MODEL_DISCOVERY_FAILED',
        hint: 'Check the provider, API key, and base URL. Manual model entry remains available.',
        details: detail.startsWith('<') ? undefined : detail.slice(0, 300),
      })
    }
    const data = await response.json()
    const rawModels = data?.data || data?.models || data?.items
    return json(res, 200, { provider, fetchedAt: Date.now(), models: normalizeModelResults(rawModels, provider) })
  } catch (error) {
    return json(res, 400, { error: error instanceof Error ? error.message : 'Model discovery failed', code: 'MODEL_DISCOVERY_FAILED', hint: 'Check the base URL, or enter a model id manually.' })
  }
}
