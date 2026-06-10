import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Regression: module must import without throwing (catches duplicate `let`)
// ---------------------------------------------------------------------------
describe('module load', () => {
  it('imports flashcard-agent without a SyntaxError', async () => {
    // If the duplicate declaration exists this dynamic import will throw
    await expect(import('../flashcard-agent.js')).resolves.toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Import helpers
// ---------------------------------------------------------------------------
import { extractJson, normalizeGeneratedCard, classifyAiError } from '../flashcard-agent.js'

// ---------------------------------------------------------------------------
// extractJson
// ---------------------------------------------------------------------------
describe('extractJson', () => {
  it('parses clean JSON', () => {
    expect(extractJson('{"cards":[]}')).toEqual({ cards: [] })
  })

  it('strips ```json fences', () => {
    const input = '```json\n{"cards":[{"frontText":"Hello"}]}\n```'
    expect(extractJson(input)).toEqual({ cards: [{ frontText: 'Hello' }] })
  })

  it('strips ``` fences (no language tag)', () => {
    const input = '```\n{"cards":[]}\n```'
    expect(extractJson(input)).toEqual({ cards: [] })
  })

  it('recovers {…} slice from chatty output', () => {
    const input = 'Sure, here you go: {"cards":[]} — enjoy!'
    expect(extractJson(input)).toEqual({ cards: [] })
  })

  it('throws on unparseable input', () => {
    expect(() => extractJson('totally not json')).toThrow('AI response was not valid JSON')
  })

  it('throws on null/empty input', () => {
    expect(() => extractJson('')).toThrow()
    expect(() => extractJson(null)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// normalizeGeneratedCard
// ---------------------------------------------------------------------------
describe('normalizeGeneratedCard', () => {
  it('maps frontText / backText', () => {
    const card = normalizeGeneratedCard({ frontText: 'Hello', backText: 'Hola' }, 0)
    expect(card.frontText).toBe('Hello')
    expect(card.backText).toBe('Hola')
  })

  it('falls back to front/back aliases', () => {
    const card = normalizeGeneratedCard({ front: 'Apple', back: 'Manzana' }, 0)
    expect(card.frontText).toBe('Apple')
    expect(card.backText).toBe('Manzana')
  })

  it('fills frontImageQuery from frontText when query is missing', () => {
    const card = normalizeGeneratedCard({ frontText: 'Cat' }, 0)
    expect(card.frontImageQuery).toBe('Cat')
  })

  it('generates a unique id', () => {
    const a = normalizeGeneratedCard({}, 0)
    const b = normalizeGeneratedCard({}, 1)
    expect(a.id).not.toBe(b.id)
  })
})

// ---------------------------------------------------------------------------
// classifyAiError
// ---------------------------------------------------------------------------
describe('classifyAiError', () => {
  it('maps 401 to auth error', () => {
    expect(classifyAiError(401, '')).toMatch(/authentication/)
  })

  it('maps 403 to access denied', () => {
    expect(classifyAiError(403, '')).toMatch(/403/)
  })

  it('maps 429 to rate limit', () => {
    expect(classifyAiError(429, '')).toMatch(/rate limit/)
  })

  it('maps 400+model detail to model error', () => {
    expect(classifyAiError(400, 'The model does not exist')).toMatch(/model/)
  })

  it('maps 500 to server error', () => {
    expect(classifyAiError(500, '')).toMatch(/server error/)
  })

  it('maps 503 to server error with status code', () => {
    expect(classifyAiError(503, '')).toMatch(/503/)
  })
})

// ---------------------------------------------------------------------------
// handler — integration tests with mocked fetch
// ---------------------------------------------------------------------------
describe('handler', () => {
  let handler

  beforeEach(async () => {
    vi.restoreAllMocks()
    // Re-import to get a fresh module each time (vitest caches by default; this is fine here)
    const mod = await import('../flashcard-agent.js')
    handler = mod.default
  })

  function makeReq(body) {
    const bodyStr = JSON.stringify(body)
    const req = {
      method: 'POST',
      async *[Symbol.asyncIterator]() { yield Buffer.from(bodyStr) },
    }
    return req
  }

  function makeRes() {
    const res = {
      statusCode: 200,
      headers: {},
      body: '',
      setHeader(k, v) { this.headers[k] = v },
      end(data) { this.body = data },
    }
    return res
  }

  it('returns 405 for non-POST', async () => {
    const req = { method: 'GET' }
    const res = makeRes()
    res.setHeader = vi.fn()
    await handler(req, res)
    expect(res.statusCode).toBe(405)
  })

  it('returns 200 with cards on a valid AI response', async () => {
    const aiPayload = {
      choices: [{
        message: {
          content: JSON.stringify({
            cards: [{ frontText: 'Cat', backText: 'Neko', frontImageQuery: 'cute cat', backImageQuery: 'neko' }],
          }),
        },
      }],
    }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(aiPayload),
    })

    const res = makeRes()
    await handler(
      makeReq({ aiApiKey: 'test', aiModel: 'gpt-4o', mode: 'create', title: 'Test', count: 1 }),
      res,
    )
    expect(res.statusCode).toBe(200)
    const data = JSON.parse(res.body)
    expect(data.cards).toHaveLength(1)
    expect(data.cards[0].frontText).toBe('Cat')
  })

  it('returns 401 when AI returns 401', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    })

    const res = makeRes()
    await handler(
      makeReq({ aiApiKey: 'bad-key', aiModel: 'gpt-4o', mode: 'create', title: 'Test', count: 1 }),
      res,
    )
    expect(res.statusCode).toBe(401)
    expect(JSON.parse(res.body).error).toMatch(/401/)
  })

  it('returns 429 when AI returns 429', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve('Too Many Requests'),
    })

    const res = makeRes()
    await handler(
      makeReq({ aiApiKey: 'key', aiModel: 'gpt-4o', mode: 'create', title: 'Test', count: 1 }),
      res,
    )
    expect(res.statusCode).toBe(429)
  })

  it('retries and succeeds when first attempt returns malformed JSON (proves includeJsonFormat flip)', async () => {
    // Attempt 0: returns text that is not valid JSON (triggers the flip of includeJsonFormat = false)
    // Attempt 1: returns valid cards JSON
    let callCount = 0
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ choices: [{ message: { content: 'Here are your cards: (no JSON)' } }] }),
        })
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          choices: [{ message: { content: JSON.stringify({ cards: [{ frontText: 'Dog', backText: 'Inu' }] }) } }],
        }),
      })
    })

    const res = makeRes()
    await handler(
      makeReq({ aiApiKey: 'key', aiModel: 'gpt-4o', mode: 'create', title: 'Test', count: 1 }),
      res,
    )
    expect(res.statusCode).toBe(200)
    const data = JSON.parse(res.body)
    expect(data.cards[0].frontText).toBe('Dog')

    // Verify the second call was made WITHOUT response_format (includeJsonFormat flipped to false)
    const secondCallBody = JSON.parse(global.fetch.mock.calls[1][1].body)
    expect(secondCallBody.response_format).toBeUndefined()
  })

  it('returns 401 when AI key is missing', async () => {
    const res = makeRes()
    await handler(
      makeReq({ aiApiKey: '', aiModel: 'gpt-4o', mode: 'create', title: 'Test', count: 1 }),
      res,
    )
    // "Missing BYOK AI API key" contains "API key" → classified as 401 by the handler
    expect(res.statusCode).toBe(401)
    expect(JSON.parse(res.body).error).toMatch(/API key/)
  })

  it('returns 500 when model is missing', async () => {
    const res = makeRes()
    await handler(
      makeReq({ aiApiKey: 'key', aiModel: '', mode: 'create', title: 'Test', count: 1 }),
      res,
    )
    expect(res.statusCode).toBe(500)
    expect(JSON.parse(res.body).error).toMatch(/model/)
  })
})
