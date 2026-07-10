#!/usr/bin/env node
/**
 * scripts/smoke.mjs
 *
 * Manual end-to-end smoke test — verifies that your real credentials and
 * AI provider actually work, without running any code in CI.
 *
 * Usage:
 *   npm run smoke
 *
 * Set environment variables before running:
 *   BRAVE_API_KEY, PIXABAY_API_KEY, PEXELS_API_KEY,
 *   GOOGLE_API_KEY + GOOGLE_CX,
 *   FLASHFORGE_AI_BASE_URL (default https://api.openai.com/v1),
 *   FLASHFORGE_AI_MODEL, FLASHFORGE_AI_API_KEY
 *
 * Any provider whose env vars are absent is skipped — the script never fails
 * for missing optional keys. Key values are never printed.
 */

const TIMEOUT_MS = 15_000

// ── helpers ────────────────────────────────────────────────────────────────

function timedFetch(url, init) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer))
}

function row(name, status, detail = '') {
  const icon = status === 'PASS' ? '✅' : status === 'SKIP' ? '⏭ ' : '❌'
  console.log(`  ${icon}  ${name.padEnd(22)} ${status.padEnd(6)}  ${detail}`)
}

// ── image providers ─────────────────────────────────────────────────────────

async function smokeBrave() {
  const key = process.env.BRAVE_API_KEY
  if (!key) return row('Brave', 'SKIP', 'BRAVE_API_KEY not set')
  try {
    const url = new URL('https://api.search.brave.com/res/v1/images/search')
    url.searchParams.set('q', 'cat')
    url.searchParams.set('count', '1')
    const res = await timedFetch(url, {
      headers: { 'X-Subscription-Token': key, Accept: 'application/json', 'Accept-Encoding': 'gzip' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const count = data.results?.length ?? 0
    row('Brave', 'PASS', `${count} result(s)`)
  } catch (e) {
    row('Brave', 'FAIL', e.message)
  }
}

async function smokePixabay() {
  const key = process.env.PIXABAY_API_KEY
  if (!key) return row('Pixabay', 'SKIP', 'PIXABAY_API_KEY not set')
  try {
    const url = new URL('https://pixabay.com/api/')
    url.searchParams.set('key', key)
    url.searchParams.set('q', 'cat')
    url.searchParams.set('per_page', '3')
    const res = await timedFetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    row('Pixabay', 'PASS', `${data.hits?.length ?? 0} result(s)`)
  } catch (e) {
    row('Pixabay', 'FAIL', e.message)
  }
}

async function smokePexels() {
  const key = process.env.PEXELS_API_KEY
  if (!key) return row('Pexels', 'SKIP', 'PEXELS_API_KEY not set')
  try {
    const url = new URL('https://api.pexels.com/v1/search')
    url.searchParams.set('query', 'cat')
    url.searchParams.set('per_page', '3')
    const res = await timedFetch(url, { headers: { Authorization: key } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    row('Pexels', 'PASS', `${data.photos?.length ?? 0} result(s)`)
  } catch (e) {
    row('Pexels', 'FAIL', e.message)
  }
}

async function smokeGoogle() {
  const key = process.env.GOOGLE_API_KEY
  const cx = process.env.GOOGLE_CX
  if (!key || !cx) return row('Google', 'SKIP', 'GOOGLE_API_KEY or GOOGLE_CX not set')
  try {
    const url = new URL('https://www.googleapis.com/customsearch/v1')
    url.searchParams.set('searchType', 'image')
    url.searchParams.set('q', 'cat')
    url.searchParams.set('num', '1')
    url.searchParams.set('key', key)
    url.searchParams.set('cx', cx)
    const res = await timedFetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    row('Google', 'PASS', `${data.items?.length ?? 0} result(s)`)
  } catch (e) {
    row('Google', 'FAIL', e.message)
  }
}

async function smokeOpenverse() {
  try {
    const url = new URL('https://api.openverse.org/v1/images/')
    url.searchParams.set('q', 'cat')
    url.searchParams.set('page_size', '3')
    const res = await timedFetch(url, {
      headers: { 'User-Agent': 'FlashForge-Smoke/1.0', Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    row('Openverse', 'PASS', `${data.results?.length ?? 0} result(s) — no key needed`)
  } catch (e) {
    row('Openverse', 'FAIL', e.message)
  }
}

// ── AI provider (via the real agent endpoint) ──────────────────────────────

async function smokeAi() {
  const baseUrl = (process.env.FLASHFORGE_AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
  const model = process.env.FLASHFORGE_AI_MODEL
  const apiKey = process.env.FLASHFORGE_AI_API_KEY
  if (!apiKey || !model) return row('AI (BYOK)', 'SKIP', 'FLASHFORGE_AI_API_KEY or FLASHFORGE_AI_MODEL not set')

  const endpoint = `${baseUrl}/api/flashcard-agent`
  const fixture = { id: 'smoke-card-1', frontText: 'sunset', backText: 'the sun going down' }
  let failures = 0

  // Scenario A: create 1 card
  {
    const label = 'AI create 1 card'
    try {
      const res = await timedFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'create',
          title: 'Smoke test',
          instructions: 'Return exactly one simple classroom-safe flashcard.',
          count: 1,
          aiApiKey: apiKey,
          aiBaseUrl: baseUrl,
          aiModel: model,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(`${data.error || 'failed'} (${res.status})`)
      const cards = Array.isArray(data.cards) ? data.cards : []
      if (cards.length === 0 || (!cards[0].frontText && !cards[0].backText)) {
        throw new Error('no usable assistant text in cards')
      }
      row(label, 'PASS', `front="${(cards[0].frontText || '').slice(0, 40)}"`)
    } catch (e) {
      row(label, 'FAIL', e.message)
      failures++
    }
  }

  // Scenario B: create small batch (3 cards)
  {
    const label = 'AI create batch (3 cards)'
    try {
      const res = await timedFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'create',
          title: 'Smoke test batch',
          instructions: 'Return three simple classroom-safe flashcards on colors.',
          count: 3,
          aiApiKey: apiKey,
          aiBaseUrl: baseUrl,
          aiModel: model,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(`${data.error || 'failed'} (${res.status})`)
      const cards = Array.isArray(data.cards) ? data.cards : []
      if (cards.length === 0 || cards.every((c) => !c.frontText && !c.backText)) {
        throw new Error('no usable assistant text in batch')
      }
      row(label, 'PASS', `${cards.length} card(s) returned`)
    } catch (e) {
      row(label, 'FAIL', e.message)
      failures++
    }
  }

  // Scenario C: enhance 1 card
  {
    const label = 'AI enhance 1 card'
    try {
      const res = await timedFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'enhance',
          title: 'Smoke test enhance',
          instructions: 'Improve the card and keep it classroom-safe.',
          existingCards: [fixture],
          aiApiKey: apiKey,
          aiBaseUrl: baseUrl,
          aiModel: model,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(`${data.error || 'failed'} (${res.status})`)
      const cards = Array.isArray(data.cards) ? data.cards : []
      if (cards.length === 0 || (!cards[0].frontText && !cards[0].backText)) {
        throw new Error('no usable assistant text in enhanced card')
      }
      row(label, 'PASS', `front="${(cards[0].frontText || '').slice(0, 40)}"`)
    } catch (e) {
      row(label, 'FAIL', e.message)
      failures++
    }
  }

  // Scenario D: revise 1 card
  {
    const label = 'AI revise 1 card'
    try {
      const res = await timedFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'revise',
          title: 'Smoke test revise',
          instructions: 'Change the back text to "sunset".',
          revisionScope: 'text',
          existingCards: [fixture],
          aiApiKey: apiKey,
          aiBaseUrl: baseUrl,
          aiModel: model,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(`${data.error || 'failed'} (${res.status})`)
      const patches = Array.isArray(data.patches) ? data.patches : []
      row(label, 'PASS', `${patches.length} patch(es)`)
    } catch (e) {
      row(label, 'FAIL', e.message)
      failures++
    }
  }

  // Safe response-shape diagnostics (secrets never printed)
  console.log('\n  Provider response-shape diagnostics:')
  try {
    const res = await timedFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'create',
        title: 'Shape probe',
        instructions: 'Return one card.',
        count: 1,
        aiApiKey: apiKey,
        aiBaseUrl: baseUrl,
        aiModel: model,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data && typeof data === 'object') {
      const choices = Array.isArray(data.choices) ? data.choices : null
      const first = choices?.[0]
      const content = first?.message?.content ?? first?.text ?? null
      const contentParts = Array.isArray(content) ? content : null
      const textFromParts = contentParts ? contentParts.map((p) => p?.text ?? p?.content ?? '').filter(Boolean).join('') : null
      const hasAssistantText = typeof content === 'string' && content.trim().length > 0
        || (typeof textFromParts === 'string' && textFromParts.trim().length > 0)
        || (Array.isArray(data.cards) && data.cards.length > 0)
      const contentShape = contentParts ? `array(${contentParts.length})` : typeof content
      console.log(`    choices=${choices?.length ?? 0} content-shape=${contentShape} has-assistant-text=${hasAssistantText}`)
    } else {
      const code = data?.code || res.status
      const err = data?.error || 'unknown error'
      console.log(`    parse ok: false  code=${code} error="${String(err).slice(0, 80)}"`)
    }
  } catch (e) {
    console.log(`    diagnostics fetch failed: ${e.message}`)
  }

  if (failures > 0) {
    throw new Error('One or more AI scenarios failed — see FAIL rows above.')
  }
}

// ── main ─────────────────────────────────────────────────────────────────────

console.log('\nFlashForge Smoke Test\n')
console.log('  Running one real request per configured provider…')
console.log('  (Skipped providers have no credentials in env)\n')

await Promise.all([
  smokeBrave(),
  smokePixabay(),
  smokePexels(),
  smokeGoogle(),
  smokeOpenverse(),
  smokeAi(),
])

console.log('\nDone. Review any FAIL rows above for misconfigured credentials.\n')
