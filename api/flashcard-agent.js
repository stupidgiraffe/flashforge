const MAX_CREATE_CARDS = 50
const MAX_EXISTING_FRONTS = 60
const AI_TIMEOUT_MS = 50_000
const AI_MAX_RETRIES = 2
const VALID_MODES = new Set(['create', 'enhance', 'revise'])

function json(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function agentError(message, code, status = 500, hint, details) {
  const error = new Error(message)
  error.code = code
  error.status = status
  error.hint = hint
  error.details = details
  return error
}

function jsonError(res, error) {
  const status = Number(error?.status) || 500
  return json(res, status, {
    error: error?.message || 'Flashcard Agent failed',
    code: error?.code || 'AI_AGENT_ERROR',
    ...(error?.hint ? { hint: error.hint } : {}),
    ...(error?.details ? { details: error.details } : {}),
  })
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
  } catch {
    throw agentError('Request body must be valid JSON', 'INVALID_JSON_BODY', 400, 'Refresh the app and try again. If this continues, report the malformed request.')
  }
}

function normalizeMode(mode) {
  const value = String(mode || 'create').trim()
  if (!VALID_MODES.has(value)) {
    throw agentError('Unsupported AI agent mode', 'INVALID_MODE', 400, 'Use create, enhance, or revise.')
  }
  return value
}

export function normalizeCreateCount(count) {
  const parsed = Number(count)
  if (!Number.isFinite(parsed)) return 10
  return Math.max(1, Math.min(Math.trunc(parsed), MAX_CREATE_CARDS))
}

function normalizeBaseUrl(aiBaseUrl) {
  const raw = String(aiBaseUrl || 'https://api.openai.com/v1').trim() || 'https://api.openai.com/v1'
  let url
  try {
    url = new URL(raw)
  } catch {
    throw agentError('AI base URL is not valid', 'INVALID_BASE_URL', 400, 'Enter an OpenAI-compatible base URL, usually ending in /v1.')
  }
  if (url.protocol !== 'https:' && url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
    throw agentError('AI base URL must use HTTPS', 'INVALID_BASE_URL', 400, 'Use an HTTPS OpenAI-compatible endpoint, or localhost for local provider testing.')
  }
  return raw.replace(/\/$/, '')
}

function validateCredentials(aiApiKey, aiModel) {
  if (!aiApiKey) {
    throw agentError('Missing BYOK AI API key', 'MISSING_API_KEY', 400, 'Paste a valid API key for your selected AI provider.')
  }
  if (!aiModel) {
    throw agentError('Missing AI model name', 'MISSING_MODEL', 400, 'Enter the exact model id from your selected AI provider.')
  }
}

export function extractJson(text) {
  const cleaned = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  try { return JSON.parse(cleaned) } catch {}
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1))
  throw new Error('AI response was not valid JSON')
}

export function normalizeGeneratedCard(raw, index) {
  return {
    id: `card-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    frontText: String(raw.frontText || raw.front || '').trim(),
    backText: String(raw.backText || raw.back || '').trim(),
    frontImageQuery: String(raw.frontImageQuery || raw.imageQuery || raw.frontText || '').trim(),
    backImageQuery: String(raw.backImageQuery || raw.imageQuery || raw.backText || raw.frontText || '').trim(),
  }
}

function hasOwn(value, key) {
  return value && Object.prototype.hasOwnProperty.call(value, key)
}

function normalizedText(rawValue, fallback) {
  if (typeof rawValue !== 'string') return fallback
  const trimmed = rawValue.trim()
  return trimmed || fallback
}

export function normalizeRevisedCard(raw, originalCard, allowImageRevision = false) {
  const frontText = hasOwn(raw, 'frontText')
    ? normalizedText(raw.frontText, originalCard.frontText || '')
    : originalCard.frontText || ''
  const backText = hasOwn(raw, 'backText')
    ? normalizedText(raw.backText, originalCard.backText || '')
    : originalCard.backText || ''

  return {
    ...originalCard,
    id: originalCard.id,
    frontText,
    backText,
    ...(allowImageRevision && typeof raw?.frontImageQuery === 'string' && raw.frontImageQuery.trim()
      ? { frontImageQuery: raw.frontImageQuery.trim() }
      : {}),
    ...(allowImageRevision && typeof raw?.backImageQuery === 'string' && raw.backImageQuery.trim()
      ? { backImageQuery: raw.backImageQuery.trim() }
      : {}),
  }
}

export function extractProviderErrorDetail(detail) {
  const raw = String(detail || '').trim()
  if (!raw) return ''
  try {
    const parsed = JSON.parse(raw)
    const error = parsed?.error || parsed
    const parts = [
      error?.message,
      error?.type ? `type: ${error.type}` : '',
      error?.code ? `code: ${error.code}` : '',
    ].filter(Boolean)
    if (parts.length > 0) return parts.join(' ')
  } catch {}
  if (raw.startsWith('<')) return ''
  return raw.replace(/\s+/g, ' ').slice(0, 300)
}

export function classifyAiError(status, detail) {
  const providerDetail = extractProviderErrorDetail(detail)
  const lower = providerDetail.toLowerCase()
  if (status === 401) return 'AI authentication failed (401) \u2014 check your API key'
  if (status === 403) return 'AI access denied (403) \u2014 check your API key permissions'
  if (status === 429) return 'AI rate limit reached (429) \u2014 try again in a moment'
  if (status === 404) return `AI endpoint or model not found (404)${providerDetail ? ': ' + providerDetail : ''} \u2014 check your base URL and model name`
  if (status === 400) {
    if (lower.includes('response_format') || lower.includes('json')) return `AI provider rejected JSON mode (400)${providerDetail ? ': ' + providerDetail : ''} \u2014 FlashForge will retry without JSON mode when possible`
    if (lower.includes('model')) return `AI model not found or invalid${providerDetail ? ': ' + providerDetail : ''} \u2014 check your model name`
    return `AI bad request (400)${providerDetail ? ': ' + providerDetail : ''}`
  }
  if (status >= 500) return `AI provider server error (${status}) \u2014 try again shortly`
  return `AI provider failed (${status})${providerDetail ? ': ' + providerDetail : ''}`
}

function shouldRetryWithoutJsonMode(status, detail) {
  if (status !== 400) return false
  const lower = extractProviderErrorDetail(detail).toLowerCase()
  return lower.includes('response_format') || lower.includes('json mode') || lower.includes('json_schema')
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function compactExistingCard(card) {
  return {
    id: String(card?.id || '').trim(),
    frontText: String(card?.frontText || '').trim(),
    backText: String(card?.backText || '').trim(),
    frontImageUrl: typeof card?.frontImageUrl === 'string' ? card.frontImageUrl : undefined,
    backImageUrl: typeof card?.backImageUrl === 'string' ? card.backImageUrl : undefined,
  }
}

function buildMessages({ mode, title, instructions, createCount, fronts, existingCards, allowImageRevision }) {
  if (mode === 'revise') {
    return {
      temperature: 0.25,
      system: 'You are revising existing teacher flashcards. Return JSON only, no markdown fences. Only change what the user explicitly requested. Preserve card ids exactly. Preserve unmentioned fields exactly. Do not add cards. Do not remove cards. Schema: {"cards":[{"id":"existing card id","frontText":"revised or unchanged front text","backText":"revised or unchanged back text","frontImageQuery":"optional replacement image search query","backImageQuery":"optional replacement image search query"}]}. The app cannot edit image pixels. Supported image changes are replacement search queries or later manual crop/reframe controls.',
      user: [
        `Set title: ${title}`,
        `Revision instructions: ${instructions}`,
        `Image query changes allowed: ${allowImageRevision ? 'yes' : 'no'}`,
        'Selected cards to revise:',
        JSON.stringify(existingCards, null, 2),
      ].join('\n'),
    }
  }

  if (mode === 'enhance') {
    return {
      temperature: 0.3,
      system: 'You are an ESL flashcard editor. Return JSON only, no markdown fences. Improve or complete existing classroom flashcards while preserving ids exactly. Fill missing front/back text when useful, keep natural English, keep cards printable, and provide specific image search queries. Schema: {"cards":[{"id":"existing card id","frontText":"short front text","backText":"short answer or translation","frontImageQuery":"specific web image search query for front","backImageQuery":"specific web image search query for back"}]}.',
      user: [
        `Improve/complete these flashcards for "${title}".`,
        `Instructions: ${instructions}`,
        'Existing cards:',
        JSON.stringify(existingCards, null, 2),
      ].join('\n'),
    }
  }

  return {
    temperature: 0.6,
    system: 'You are an ESL flashcard creator. Return JSON only, no markdown fences. Schema: {"cards":[{"frontText":"short front text","backText":"short answer or translation","frontImageQuery":"specific web image search query for front","backImageQuery":"specific web image search query for back"}]}. Create short, printable, classroom-safe cards. Prefer concrete vocabulary or questions, natural English, useful answers, and no duplicates.',
    user: `Create ${createCount} classroom flashcards for the set "${title}". Instructions: ${instructions}${fronts.length ? '\nAvoid duplicating these fronts:\n' + fronts.join('\n') : ''}`,
  }
}

async function completeCards({ aiApiKey, aiBaseUrl, aiModel, mode, title, instructions, count, existingFronts, existingCards, allowImageRevision }) {
  const base = normalizeBaseUrl(aiBaseUrl)
  const model = String(aiModel || '').trim()
  validateCredentials(aiApiKey, model)

  const createCount = normalizeCreateCount(count)
  const fronts = Array.isArray(existingFronts)
    ? existingFronts.filter(Boolean).slice(0, MAX_EXISTING_FRONTS)
    : []
  const cardsForRevision = Array.isArray(existingCards)
    ? existingCards.map(compactExistingCard).filter((card) => card.id)
    : []
  if ((mode === 'enhance' || mode === 'revise') && cardsForRevision.length === 0) {
    throw agentError('No existing cards were provided for AI revision', 'NO_EXISTING_CARDS', 400, 'Select cards before revising, or add cards before enhancing.')
  }

  const prompt = buildMessages({
    mode,
    title,
    instructions,
    createCount,
    fronts,
    existingCards: cardsForRevision,
    allowImageRevision,
  })

  let lastError
  let includeJsonFormat = true
  for (let attempt = 0; attempt < AI_MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(1500 * attempt)
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)
    // Build a fresh request body each attempt (avoid cross-attempt mutation)
    const attemptBody = {
      model,
      temperature: prompt.temperature,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      ...(includeJsonFormat ? { response_format: { type: 'json_object' } } : {}),
    }
    try {
      const response = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + aiApiKey,
        },
        body: JSON.stringify(attemptBody),
      })

      if (!response.ok) {
        const detail = await response.text().catch(() => '')
        if (includeJsonFormat && shouldRetryWithoutJsonMode(response.status, detail) && attempt < AI_MAX_RETRIES - 1) {
          lastError = agentError(classifyAiError(response.status, detail), 'AI_JSON_MODE_UNSUPPORTED', 400, 'FlashForge is retrying without JSON mode.', extractProviderErrorDetail(detail))
          includeJsonFormat = false
          continue
        }
        const msg = classifyAiError(response.status, detail)
        if ((response.status === 429 || response.status >= 500) && attempt < AI_MAX_RETRIES - 1) {
          lastError = agentError(msg, response.status === 429 ? 'AI_RATE_LIMIT' : 'AI_PROVIDER_SERVER_ERROR', response.status, 'Try again in a moment.', extractProviderErrorDetail(detail))
          continue
        }
        const code = response.status === 401 ? 'AI_AUTH_FAILED'
          : response.status === 403 ? 'AI_ACCESS_DENIED'
            : response.status === 404 ? 'AI_ENDPOINT_OR_MODEL_NOT_FOUND'
              : response.status === 429 ? 'AI_RATE_LIMIT'
                : response.status === 400 ? 'AI_BAD_REQUEST'
                  : 'AI_PROVIDER_ERROR'
        throw agentError(msg, code, response.status, 'Check your AI key, model, base URL, and provider account.', extractProviderErrorDetail(detail))
      }

      let data
      try {
        data = await response.json()
      } catch {
        throw agentError('AI provider returned a non-JSON response', 'AI_PROVIDER_NON_JSON', 502, 'Check that the base URL points to an OpenAI-compatible chat completions API.')
      }
      const content = data.choices?.[0]?.message?.content
      if (!content) {
        throw agentError('AI provider returned no message content', 'AI_EMPTY_RESPONSE', 502, 'Try a different model or check whether the provider supports chat completions.')
      }

      let parsed
      try {
        parsed = extractJson(content)
      } catch {
        if (attempt < AI_MAX_RETRIES - 1) {
          lastError = agentError('AI response was not valid JSON', 'AI_INVALID_JSON', 502, 'FlashForge is retrying without JSON mode.')
          includeJsonFormat = false  // retry without response_format for non-supporting models
          continue
        }
        throw agentError('AI response was not valid JSON', 'AI_INVALID_JSON', 502, 'Use a chat model with JSON support, or try a more capable OpenAI-compatible model.')
      }

      const rawCards = Array.isArray(parsed) ? parsed : Array.isArray(parsed.cards) ? parsed.cards : []
      if (rawCards.length === 0) {
        throw agentError('AI returned no cards', 'AI_NO_CARDS', 502, 'Try clearer instructions or a different model.')
      }

      if (mode === 'revise' || mode === 'enhance') {
        const originalsById = new Map(cardsForRevision.map((card) => [card.id, card]))
        const rawById = new Map()
        for (const raw of rawCards) {
          const id = String(raw?.id || '').trim()
          if (originalsById.has(id) && !rawById.has(id)) rawById.set(id, raw)
        }
        if (rawById.size === 0) throw agentError('AI returned no matching revised cards', 'AI_NO_MATCHING_REVISED_CARDS', 502, 'Try rerunning revision with clearer instructions.')
        return cardsForRevision.map((original) => normalizeRevisedCard(rawById.get(original.id) || {}, original, allowImageRevision))
      }

      const normalizedCards = rawCards
        .slice(0, createCount)
        .map((card, index) => normalizeGeneratedCard(card, index))
        .filter((card) => card.frontText || card.backText)
      if (normalizedCards.length === 0) {
        throw agentError('AI returned no usable cards', 'AI_NO_USABLE_CARDS', 502, 'Try clearer instructions or a different model.')
      }
      return normalizedCards
    } catch (error) {
      if (error.name === 'AbortError') {
        lastError = agentError(`AI request timed out after ${Math.round(AI_TIMEOUT_MS / 1000)}s`, 'AI_TIMEOUT', 504, 'Try a smaller batch, shorter instructions, or a faster model.')
        if (attempt < AI_MAX_RETRIES - 1) continue
      } else if (error?.code) {
        throw error
      } else if (error instanceof TypeError || String(error?.message || '').includes('fetch failed')) {
        throw agentError('AI provider network request failed', 'AI_NETWORK_ERROR', 502, 'Check the base URL, provider status, and network connection.', error?.message)
      } else {
        throw error
      }
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastError || new Error('AI request failed after retries')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Method not allowed' })
  }

  try {
    const body = await readBody(req)

    // Support both compact fronts list (new) and full existingCards (legacy compatibility)
    let existingFronts = []
    if (Array.isArray(body.existingFronts)) {
      existingFronts = body.existingFronts.filter(Boolean).slice(0, MAX_EXISTING_FRONTS)
    } else if (Array.isArray(body.existingCards)) {
      existingFronts = body.existingCards
        .map((c) => String(c?.frontText || '').trim())
        .filter(Boolean)
        .slice(0, MAX_EXISTING_FRONTS)
    }

    const mode = normalizeMode(body.mode)

    const cards = await completeCards({
      aiApiKey: String(body.aiApiKey || '').trim(),
      aiBaseUrl: String(body.aiBaseUrl || '').trim(),
      aiModel: String(body.aiModel || '').trim(),
      mode,
      title: String(body.title || 'Flashcards'),
      instructions: String(body.instructions || '').slice(0, 2000),
      count: Number(body.count || 10),
      existingFronts,
      existingCards: Array.isArray(body.existingCards) ? body.existingCards : [],
      allowImageRevision: body.allowImageRevision === true,
    })

    return json(res, 200, { cards })
  } catch (error) {
    if (error?.code) return jsonError(res, error)
    const msg = error instanceof Error ? error.message : 'Flashcard Agent failed'
    return jsonError(res, agentError(msg, 'AI_AGENT_ERROR', 500, 'Try again or check the AI settings.'))
  }
}
