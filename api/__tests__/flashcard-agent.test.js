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
import { extractJson, normalizeGeneratedCard, normalizeRevisedCard, normalizeCreateCount, normalizeRevisionPatches, normalizeRevisionPatchResult, extractProviderErrorDetail, classifyAiError, extractAssistantText } from '../flashcard-agent.js'

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
// extractAssistantText — provider response shape variants
// ---------------------------------------------------------------------------
describe('extractAssistantText', () => {
  it('returns ok:true for string assistant content', () => {
    const data = { choices: [{ message: { content: '{"cards":[]}' }, finish_reason: 'stop' }], model: 'gpt-4o' }
    const result = extractAssistantText(data)
    expect(result).toEqual({ ok: true, text: '{"cards":[]}', finishReason: 'stop', providerModel: 'gpt-4o' })
  })

  it('returns ok:true for array content parts shaped {type,text}', () => {
    const data = {
      choices: [{
        message: { content: [{ type: 'text', text: '{"cards":[]}' }] },
        finish_reason: 'stop',
      }],
      model: 'claude-3',
    }
    const result = extractAssistantText(data)
    expect(result.ok).toBe(true)
    expect(result.text).toBe('{"cards":[]}')
  })

  it('returns ok:true for array content parts shaped {text}', () => {
    const data = {
      choices: [{
        message: { content: [{ text: '{"cards":[]}' }] },
        finish_reason: 'stop',
      }],
      model: 'provider-x',
    }
    const result = extractAssistantText(data)
    expect(result.ok).toBe(true)
    expect(result.text).toBe('{"cards":[]}')
  })

  it('concatenates multiple text parts', () => {
    const data = {
      choices: [{
        message: { content: [{ type: 'text', text: '{"cards":[' }, { type: 'text', text: ']}' }] },
        finish_reason: 'stop',
      }],
    }
    const result = extractAssistantText(data)
    expect(result.ok).toBe(true)
    expect(result.text).toBe('{"cards":[]}')
  })

  it('returns ok:true for choices[0].text fallback', () => {
    const data = { choices: [{ text: '{"cards":[]}', finish_reason: 'stop' }], model: 'legacy' }
    const result = extractAssistantText(data)
    expect(result.ok).toBe(true)
    expect(result.text).toBe('{"cards":[]}')
  })

  it('detects refusal finish_reason', () => {
    const data = { choices: [{ message: { content: 'I refuse.' }, finish_reason: 'refusal' }] }
    const result = extractAssistantText(data)
    expect(result.ok).toBe(false)
    expect(result.code).toBe('AI_REFUSAL_OR_FILTERED')
    expect(result.safeDiagnostics).toMatchObject({ reason: 'refusal' })
  })

  it('detects content_filter finish_reason', () => {
    const data = { choices: [{ message: { content: 'blocked' }, finish_reason: 'content_filter' }] }
    const result = extractAssistantText(data)
    expect(result.ok).toBe(false)
    expect(result.code).toBe('AI_REFUSAL_OR_FILTERED')
  })

  it('detects tool-call-only responses', () => {
    const data = {
      choices: [{
        message: { content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'x', arguments: '{}' } }] },
        finish_reason: 'tool_calls',
      }],
    }
    const result = extractAssistantText(data)
    expect(result.ok).toBe(false)
    expect(result.code).toBe('AI_TOOL_CALL_ONLY')
    expect(result.safeDiagnostics).toMatchObject({ toolCallsCount: 1 })
  })

  it('returns AI_EMPTY_RESPONSE for empty string content', () => {
    const data = { choices: [{ message: { content: '   ' }, finish_reason: 'stop' }] }
    const result = extractAssistantText(data)
    expect(result.ok).toBe(false)
    expect(result.code).toBe('AI_EMPTY_RESPONSE')
  })

  it('returns AI_EMPTY_RESPONSE for null content', () => {
    const data = { choices: [{ message: { content: null }, finish_reason: 'stop' }] }
    const result = extractAssistantText(data)
    expect(result.ok).toBe(false)
    expect(result.code).toBe('AI_EMPTY_RESPONSE')
  })

  it('returns AI_EMPTY_RESPONSE when content only has empty parts', () => {
    const data = {
      choices: [{
        message: { content: [{ type: 'image', image_url: 'x' }, { type: '', text: '' }] },
        finish_reason: 'stop',
      }],
    }
    const result = extractAssistantText(data)
    expect(result.ok).toBe(false)
    expect(result.code).toBe('AI_EMPTY_RESPONSE')
  })

  it('returns AI_NO_CHOICES for empty choices array', () => {
    const data = { choices: [], model: 'gpt-4o' }
    const result = extractAssistantText(data)
    expect(result.ok).toBe(false)
    expect(result.code).toBe('AI_NO_CHOICES')
  })

  it('returns AI_NO_CHOICES for missing choices', () => {
    const data = { model: 'gpt-4o' }
    const result = extractAssistantText(data)
    expect(result.ok).toBe(false)
    expect(result.code).toBe('AI_NO_CHOICES')
  })

  it('returns AI_NO_CHOICES for malformed response', () => {
    expect(extractAssistantText(null).code).toBe('AI_NO_CHOICES')
    expect(extractAssistantText(undefined).code).toBe('AI_NO_CHOICES')
    expect(extractAssistantText('garbage').code).toBe('AI_NO_CHOICES')
    expect(extractAssistantText([]).code).toBe('AI_NO_CHOICES')
  })

  it('never leaks secrets in safeDiagnostics', () => {
    const data = { choices: [{ message: { content: null }, finish_reason: 'stop' }], model: 'secret-model' }
    const result = extractAssistantText(data)
    expect(result.safeDiagnostics).not.toHaveProperty('apiKey')
    expect(result.safeDiagnostics).not.toHaveProperty('token')
    expect(JSON.stringify(result)).not.toContain('Bearer')
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

describe('normalizeCreateCount', () => {
  it('clamps create count to the supported range', () => {
    expect(normalizeCreateCount(0)).toBe(1)
    expect(normalizeCreateCount(-10)).toBe(1)
    expect(normalizeCreateCount(500)).toBe(50)
    expect(normalizeCreateCount('abc')).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// normalizeRevisedCard
// ---------------------------------------------------------------------------
describe('normalizeRevisedCard', () => {
  it('preserves the original id and unmentioned fields', () => {
    const original = {
      id: 'card-1',
      frontText: 'Old front',
      backText: 'Old back',
      frontImageUrl: 'https://example.com/front.jpg',
    }
    const card = normalizeRevisedCard({ frontText: 'New front' }, original)
    expect(card.id).toBe('card-1')
    expect(card.frontText).toBe('New front')
    expect(card.backText).toBe('Old back')
    expect(card.frontImageUrl).toBe('https://example.com/front.jpg')
  })

  it('does not blank existing text when AI returns empty strings', () => {
    const original = { id: 'card-1', frontText: 'Keep front', backText: 'Keep back' }
    const card = normalizeRevisedCard({ frontText: '   ', backText: '' }, original)
    expect(card.frontText).toBe('Keep front')
    expect(card.backText).toBe('Keep back')
  })

  it('only includes image query suggestions when image revision is allowed', () => {
    const original = { id: 'card-1', frontText: 'Cat', backText: 'ねこ' }
    const blocked = normalizeRevisedCard({ frontImageQuery: 'cute classroom cat' }, original, false)
    const allowed = normalizeRevisedCard({ frontImageQuery: 'cute classroom cat' }, original, true)
    expect(blocked.frontImageQuery).toBeUndefined()
    expect(allowed.frontImageQuery).toBe('cute classroom cat')
  })
})

describe('normalizeRevisionPatches', () => {
  const cards = [{ id: 'card-1', frontText: 'Old front', backText: 'Old back' }]

  it('rejects unknown ids, duplicate fields, and operations outside scope', () => {
    const patches = normalizeRevisionPatches([
      { cardId: 'card-1', field: 'frontText', value: 'New front' },
      { cardId: 'card-1', field: 'frontText', value: 'Duplicate' },
      { cardId: 'card-1', field: 'frontImageQuery', value: 'apple photo' },
      { cardId: 'unknown', field: 'backText', value: 'Nope' },
    ], cards, 'text')

    expect(patches).toEqual([{ cardId: 'card-1', field: 'frontText', value: 'New front' }])
  })

  it('repairs id aliases, whitespace, case, and common field aliases', () => {
    const result = normalizeRevisionPatchResult([
      { id: ' CARD-1 ', field: 'front_text', value: 'New front' },
      { cardId: 'card-1', field: 'back', value: 'New back' },
    ], cards, 'text')
    expect(result.patches).toEqual([
      { cardId: 'card-1', field: 'frontText', value: 'New front' },
      { cardId: 'card-1', field: 'backText', value: 'New back' },
    ])
  })

  it('keeps valid text patches and reports invalid image operations', () => {
    const result = normalizeRevisionPatchResult([
      { cardId: 'card-1', field: 'frontText', value: 'New front' },
      { cardId: 'card-1', field: 'frontImageQuery', value: 'sunset photo' },
      { cardId: 'missing', field: 'backText', value: 'Nope' },
    ], cards, 'text')
    expect(result.patches).toEqual([{ cardId: 'card-1', field: 'frontText', value: 'New front' }])
    expect(result.rejected).toHaveLength(2)
  })

  it('treats unchanged text as a friendly no-op', () => {
    const result = normalizeRevisionPatchResult([
      { cardId: 'card-1', field: 'frontText', value: ' old FRONT ' },
    ], cards, 'text')
    expect(result).toMatchObject({ patches: [], rejected: [], noChanges: true })
  })
})

// ---------------------------------------------------------------------------
// classifyAiError
// ---------------------------------------------------------------------------
describe('classifyAiError', () => {
  it('extracts provider JSON error details', () => {
    const detail = extractProviderErrorDetail(JSON.stringify({
      error: {
        message: 'The model `bad-model` does not exist',
        type: 'invalid_request_error',
        code: 'model_not_found',
      },
    }))

    expect(detail).toMatch(/bad-model/)
    expect(detail).toMatch(/model_not_found/)
  })

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
    expect(classifyAiError(400, '{"error":{"message":"The model does not exist"}}')).toMatch(/model/)
  })

  it('maps provider 404 to base URL/model guidance', () => {
    expect(classifyAiError(404, '{"error":{"message":"Not Found"}}')).toMatch(/base URL/)
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

  it('accepts array content parts ({type,text})', async () => {
    const aiPayload = {
      choices: [{
        message: {
          content: [{ type: 'text', text: JSON.stringify({ cards: [{ frontText: 'Red', backText: 'A color' }] }) }],
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
    expect(JSON.parse(res.body).cards).toHaveLength(1)
  })

  it('accepts a JSON array as a provider card response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        choices: [{ message: { content: JSON.stringify([{ frontText: 'Red', backText: 'A color' }]) } }],
      }),
    })

    const res = makeRes()
    await handler(
      makeReq({ aiApiKey: 'test', aiModel: 'gpt-4o', mode: 'create', title: 'Test', count: 1 }),
      res,
    )

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).cards[0].frontText).toBe('Red')
  })

  it('returns structured error when provider returns no message content', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ choices: [{ message: {} }] }),
    })

    const res = makeRes()
    await handler(
      makeReq({ aiApiKey: 'test', aiModel: 'gpt-4o', mode: 'create', title: 'Test', count: 1 }),
      res,
    )

    expect(res.statusCode).toBe(502)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'AI_EMPTY_RESPONSE' })
  })

  it('returns AI_NO_CHOICES when provider returns empty choices', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ choices: [] }),
    })

    const res = makeRes()
    await handler(
      makeReq({ aiApiKey: 'test', aiModel: 'gpt-4o', mode: 'create', title: 'Test', count: 1 }),
      res,
    )

    expect(res.statusCode).toBe(502)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'AI_NO_CHOICES' })
  })

  it('returns AI_TOOL_CALL_ONLY for tool-call-only responses', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        choices: [{
          message: { content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'gen', arguments: '{}' } }] },
          finish_reason: 'tool_calls',
        }],
      }),
    })

    const res = makeRes()
    await handler(
      makeReq({ aiApiKey: 'test', aiModel: 'gpt-4o', mode: 'create', title: 'Test', count: 1 }),
      res,
    )

    expect(res.statusCode).toBe(502)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'AI_TOOL_CALL_ONLY' })
  })

  it('returns AI_REFUSAL_OR_FILTERED for refusal finish_reason', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        choices: [{ message: { content: 'I cannot.' }, finish_reason: 'refusal' }],
      }),
    })

    const res = makeRes()
    await handler(
      makeReq({ aiApiKey: 'test', aiModel: 'gpt-4o', mode: 'create', title: 'Test', count: 1 }),
      res,
    )

    expect(res.statusCode).toBe(502)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'AI_REFUSAL_OR_FILTERED' })
  })

  it('returns structured error when provider returns no usable cards', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        choices: [{ message: { content: JSON.stringify({ cards: [{ frontText: ' ', backText: '' }] }) } }],
      }),
    })

    const res = makeRes()
    await handler(
      makeReq({ aiApiKey: 'test', aiModel: 'gpt-4o', mode: 'create', title: 'Test', count: 1 }),
      res,
    )

    expect(res.statusCode).toBe(502)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'AI_NO_USABLE_CARDS' })
  })

  it('clamps huge create counts before prompting the provider', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        choices: [{ message: { content: JSON.stringify({ cards: [{ frontText: 'One', backText: '1' }] }) } }],
      }),
    })

    const res = makeRes()
    await handler(
      makeReq({ aiApiKey: 'test', aiModel: 'gpt-4o', mode: 'create', title: 'Test', count: 5000 }),
      res,
    )

    const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(requestBody.messages[1].content).toMatch(/Create 50 classroom flashcards/)
  })

  it('revises selected cards without inventing ids or touching unknown ids', async () => {
    const aiPayload = {
      choices: [{
        message: {
          content: JSON.stringify({ patches: [
            { cardId: 'card-1', field: 'frontText', value: 'Better front' },
            { cardId: 'card-1', field: 'backText', value: 'Better back' },
            { cardId: 'unknown-card', field: 'frontText', value: 'Ignore me' },
          ] }),
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
      makeReq({
        aiApiKey: 'test',
        aiModel: 'gpt-4o',
        mode: 'revise',
        title: 'Test',
        instructions: 'Make it easier',
        revisionScope: 'text',
        existingCards: [
          { id: 'card-1', frontText: 'Old front', backText: 'Old back' },
          { id: 'card-2', frontText: 'Keep front', backText: 'Keep back' },
        ],
      }),
      res,
    )

    expect(res.statusCode).toBe(200)
    const data = JSON.parse(res.body)
    expect(data.patches).toEqual([
      { cardId: 'card-1', field: 'frontText', value: 'Better front' },
      { cardId: 'card-1', field: 'backText', value: 'Better back' },
    ])

    const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(requestBody.temperature).toBe(0.25)
    expect(requestBody.messages[0].content).toMatch(/Preserve card ids exactly/)
    expect(requestBody.messages[1].content).toMatch(/card-1/)
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
    expect(JSON.parse(res.body)).toMatchObject({ code: 'AI_AUTH_FAILED' })
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
    expect(JSON.parse(res.body)).toMatchObject({ code: 'AI_RATE_LIMIT' })
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

  it('retries without response_format when provider rejects JSON mode', async () => {
    let callCount = 0
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return Promise.resolve({
          ok: false,
          status: 400,
          text: () => Promise.resolve(JSON.stringify({ error: { message: 'response_format is not supported' } })),
        })
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          choices: [{ message: { content: JSON.stringify({ cards: [{ frontText: 'Bird', backText: 'Tori' }] }) } }],
        }),
      })
    })

    const res = makeRes()
    await handler(
      makeReq({ aiApiKey: 'key', aiModel: 'some-openai-compatible-model', mode: 'create', title: 'Test', count: 1 }),
      res,
    )

    expect(res.statusCode).toBe(200)
    const secondCallBody = JSON.parse(global.fetch.mock.calls[1][1].body)
    expect(secondCallBody.response_format).toBeUndefined()
  })

  it('returns 400 when AI key is missing', async () => {
    const res = makeRes()
    await handler(
      makeReq({ aiApiKey: '', aiModel: 'gpt-4o', mode: 'create', title: 'Test', count: 1 }),
      res,
    )
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'MISSING_API_KEY' })
  })

  it('returns 400 when model is missing', async () => {
    const res = makeRes()
    await handler(
      makeReq({ aiApiKey: 'key', aiModel: '', mode: 'create', title: 'Test', count: 1 }),
      res,
    )
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'MISSING_MODEL' })
  })

  it('returns 400 for unsupported mode', async () => {
    const res = makeRes()
    await handler(
      makeReq({ aiApiKey: 'key', aiModel: 'gpt-4o', mode: 'bogus', title: 'Test', count: 1 }),
      res,
    )
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'INVALID_MODE' })
  })

  it('returns 400 for invalid base URL', async () => {
    const res = makeRes()
    await handler(
      makeReq({ aiApiKey: 'key', aiModel: 'gpt-4o', aiBaseUrl: 'not a url', mode: 'create', title: 'Test', count: 1 }),
      res,
    )
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'INVALID_BASE_URL' })
  })

  it('returns AI_TIMEOUT mapped from AbortError (never raw abort message)', async () => {
    global.fetch = vi.fn().mockImplementation(() => {
      return new Promise((_, reject) => {
        // Simulate AbortController.abort() — a DOMException named AbortError
        const err = new Error('The operation was aborted')
        err.name = 'AbortError'
        reject(err)
      })
    })

    const res = makeRes()
    await handler(
      makeReq({ aiApiKey: 'key', aiModel: 'gpt-4o', mode: 'create', title: 'Test', count: 1 }),
      res,
    )
    const body = JSON.parse(res.body)
    expect(body.code).toBe('AI_TIMEOUT')
    expect(body.error).not.toMatch(/signal is aborted without reason/)
  })
})
