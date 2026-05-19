import { embedImage, searchImages } from './_imageSearch.js'

const MAX_CREATE_CARDS = 40
const MAX_EXISTING_CARDS = 80

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

function extractJson(text) {
  const cleaned = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  try { return JSON.parse(cleaned) } catch {}
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1))
  throw new Error('AI response was not valid JSON')
}

function normalizeGeneratedCard(raw, index, sourceId) {
  return {
    id: sourceId || `card-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    frontText: String(raw.frontText || raw.front || '').trim(),
    backText: String(raw.backText || raw.back || '').trim(),
    frontImageQuery: String(raw.frontImageQuery || raw.imageQuery || raw.frontText || '').trim(),
    backImageQuery: String(raw.backImageQuery || raw.imageQuery || raw.backText || raw.frontText || '').trim(),
  }
}

async function completeCards({ aiApiKey, aiBaseUrl, aiModel, mode, title, instructions, count, existingCards }) {
  const base = String(aiBaseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')
  const model = String(aiModel || '').trim()
  if (!aiApiKey) throw new Error('Missing BYOK AI API key')
  if (!model) throw new Error('Missing AI model name')

  const createCount = Math.max(1, Math.min(Number(count || 10), MAX_CREATE_CARDS))
  const existing = Array.isArray(existingCards) ? existingCards.slice(0, MAX_EXISTING_CARDS) : []
  const prompt = mode === 'create'
    ? `Create ${createCount} classroom flashcards for the set "${title}". User instructions: ${instructions}`
    : `Improve or complete these existing flashcards for the set "${title}". Keep the same ids. Fill missing or weak front/back text and create image search queries. User instructions: ${instructions}\nExisting cards:\n${JSON.stringify(existing.map((card) => ({ id: card.id, frontText: card.frontText, backText: card.backText })), null, 2)}`

  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${aiApiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: 'You create ESL teacher flashcards. Return JSON only. Schema: {"cards":[{"id":"optional existing id","frontText":"short front text","backText":"short back text or answer/translation","frontImageQuery":"web image search query for front","backImageQuery":"web image search query for back"}]}. Make age-appropriate, concrete, printable cards. Prefer specific real-world or character/image search queries when requested. Do not include markdown.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`AI provider failed (${response.status})${detail ? `: ${detail.slice(0, 240)}` : ''}`)
  }
  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  const parsed = extractJson(content)
  const rawCards = Array.isArray(parsed.cards) ? parsed.cards : []
  if (rawCards.length === 0) throw new Error('AI returned no cards')

  return rawCards.slice(0, mode === 'create' ? createCount : MAX_EXISTING_CARDS).map((card, index) => {
    const existingId = mode === 'enhance' ? String(card.id || existing[index]?.id || '') : undefined
    return normalizeGeneratedCard(card, index, existingId)
  }).filter((card) => card.frontText || card.backText)
}

async function attachImages({ cards, side, googleApiKey, googleCx, provider, embedImages }) {
  const output = []
  for (const card of cards) {
    const next = {
      ...card,
      imagePosition: 'front',
      frontImageScale: 1,
      backImageScale: 1,
      frontImageOffsetX: 0,
      frontImageOffsetY: 0,
      backImageOffsetX: 0,
      backImageOffsetY: 0,
      imageScale: 1,
      imageSources: [],
    }

    for (const target of ['front', 'back']) {
      if (side !== 'both' && side !== target) continue
      const query = target === 'front' ? card.frontImageQuery : card.backImageQuery
      if (!query) continue
      try {
        const [found] = await searchImages({ query, googleApiKey, googleCx, provider, limit: 1 })
        if (!found) continue
        let imageUrl = found.link
        let embedded = false
        if (embedImages) {
          try {
            imageUrl = await embedImage(found.link)
            embedded = true
          } catch {}
        }
        if (target === 'front') next.frontImageUrl = imageUrl
        else next.backImageUrl = imageUrl
        next.imageSources.push({ side: target, query, title: found.title, url: found.link, sourcePage: found.sourcePage, provider: found.provider, embedded })
      } catch (error) {
        next.imageSources.push({ side: target, query, error: error instanceof Error ? error.message : 'image search failed' })
      }
    }
    output.push(next)
  }
  return output
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Method not allowed' })
  }

  try {
    const body = await readBody(req)
    const generated = await completeCards({
      aiApiKey: String(body.aiApiKey || '').trim(),
      aiBaseUrl: String(body.aiBaseUrl || '').trim(),
      aiModel: String(body.aiModel || '').trim(),
      mode: body.mode === 'enhance' ? 'enhance' : 'create',
      title: String(body.title || 'Flashcards'),
      instructions: String(body.instructions || ''),
      count: Number(body.count || 10),
      existingCards: body.existingCards,
    })

    const cards = body.includeImages === false ? generated : await attachImages({
      cards: generated,
      side: body.imageSide === 'front' || body.imageSide === 'back' ? body.imageSide : 'both',
      googleApiKey: String(body.googleApiKey || '').trim(),
      googleCx: String(body.googleCx || '').trim(),
      provider: body.imageProvider || 'auto',
      embedImages: Boolean(body.embedImages),
    })

    return json(res, 200, { cards })
  } catch (error) {
    return json(res, 500, { error: error instanceof Error ? error.message : 'Flashcard Agent failed' })
  }
}
