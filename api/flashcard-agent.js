const MAX_CREATE_CARDS = 50
const MAX_EXISTING_FRONTS = 60
const AI_TIMEOUT_MS = 50_000
const AI_MAX_RETRIES = 2

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

export function classifyAiError(status, detail) {
  if (status === 401) return 'AI authentication failed (401) \u2014 check your API key'
  if (status === 403) return 'AI access denied (403) \u2014 check your API key permissions'
  if (status === 429) return 'AI rate limit reached (429) \u2014 try again in a moment'
  if (status === 400) {
    if (detail && detail.toLowerCase().includes('model')) return 'AI model not found or invalid \u2014 check your model name'
    return `AI bad request (400)${detail ? ': ' + detail.slice(0, 200) : ''}`
  }
  if (status >= 500) return `AI provider server error (${status}) \u2014 try again shortly`
  return `AI provider failed (${status})${detail ? ': ' + detail.slice(0, 200) : ''}`
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function completeCards({ aiApiKey, aiBaseUrl, aiModel, mode, title, instructions, count, existingFronts }) {
  const base = String(aiBaseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')
  const model = String(aiModel || '').trim()
  if (!aiApiKey) throw new Error('Missing BYOK AI API key')
  if (!model) throw new Error('Missing AI model name')

  const createCount = Math.max(1, Math.min(Number(count || 10), MAX_CREATE_CARDS))
  const fronts = Array.isArray(existingFronts)
    ? existingFronts.filter(Boolean).slice(0, MAX_EXISTING_FRONTS)
    : []

  const prompt = mode === 'create'
    ? `Create ${createCount} classroom flashcards for the set "${title}". Instructions: ${instructions}${fronts.length ? '\nAvoid duplicating these fronts:\n' + fronts.join('\n') : ''}`
    : `Improve/complete these flashcards for "${title}". Keep same ids. Fill missing text and add image search queries. Instructions: ${instructions}\nExisting fronts:\n${fronts.join('\n')}`

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
      temperature: 0.7,
      max_tokens: 4096,
      messages: [
        {
          role: 'system',
          content: 'You are an ESL flashcard creator. Return JSON only \u2014 no markdown fences. Schema: {"cards":[{"frontText":"short front text","backText":"short back text or answer/translation","frontImageQuery":"specific web image search query for front","backImageQuery":"specific web image search query for back"}]}. Make age-appropriate, concrete, printable cards.',
        },
        { role: 'user', content: prompt },
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
        const msg = classifyAiError(response.status, detail)
        if ((response.status === 429 || response.status >= 500) && attempt < AI_MAX_RETRIES - 1) {
          lastError = new Error(msg)
          continue
        }
        throw new Error(msg)
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content

      let parsed
      try {
        parsed = extractJson(content)
      } catch {
        if (attempt < AI_MAX_RETRIES - 1) {
          lastError = new Error('AI response was not valid JSON')
          includeJsonFormat = false  // retry without response_format for non-supporting models
          continue
        }
        throw new Error('AI response was not valid JSON \u2014 ensure your model supports JSON mode or try again')
      }

      const rawCards = Array.isArray(parsed.cards) ? parsed.cards : []
      if (rawCards.length === 0) throw new Error('AI returned no cards \u2014 check your instructions and model')

      return rawCards.slice(0, createCount).map((card, index) => normalizeGeneratedCard(card, index)).filter((card) => card.frontText || card.backText)
    } catch (error) {
      if (error.name === 'AbortError') {
        lastError = new Error(`AI request timed out after ${Math.round(AI_TIMEOUT_MS / 1000)}s \u2014 try a smaller batch or a faster model`)
        if (attempt < AI_MAX_RETRIES - 1) continue
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

    const cards = await completeCards({
      aiApiKey: String(body.aiApiKey || '').trim(),
      aiBaseUrl: String(body.aiBaseUrl || '').trim(),
      aiModel: String(body.aiModel || '').trim(),
      mode: body.mode === 'enhance' ? 'enhance' : 'create',
      title: String(body.title || 'Flashcards'),
      instructions: String(body.instructions || '').slice(0, 2000),
      count: Number(body.count || 10),
      existingFronts,
    })

    return json(res, 200, { cards })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Flashcard Agent failed'
    const status = (msg.includes('401') || msg.includes('authentication') || msg.includes('API key')) ? 401
      : (msg.includes('429') || msg.includes('rate limit')) ? 429
        : 500
    return json(res, status, { error: msg })
  }
}
