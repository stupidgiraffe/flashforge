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
 *   FLASHFORGE_APP_URL (default http://127.0.0.1:5173),
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

function safeHost(value) {
  try { return new URL(value).host }
  catch { return 'invalid-url' }
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

// ── AI provider (through the FlashForge agent route) ────────────────────────

async function smokeAi() {
  const appBaseUrl = (process.env.FLASHFORGE_APP_URL || 'http://127.0.0.1:5173').replace(/\/$/, '')
  const aiBaseUrl = (process.env.FLASHFORGE_AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
  const model = process.env.FLASHFORGE_AI_MODEL
  const apiKey = process.env.FLASHFORGE_AI_API_KEY
  if (!apiKey || !model) return row('AI (BYOK)', 'SKIP', 'FLASHFORGE_AI_API_KEY or FLASHFORGE_AI_MODEL not set')

  const endpoint = `${appBaseUrl}/api/flashcard-agent`
  const fixture = { id: 'smoke-card-1', frontText: 'sunset', backText: 'the sun going down' }
  let failures = 0

  console.log(`  AI route host: ${safeHost(appBaseUrl)} · provider host: ${safeHost(aiBaseUrl)} · model configured`)

  async function callAgent(label, payload, validate) {
    try {
      const res = await timedFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          aiApiKey: apiKey,
          aiBaseUrl,
          aiModel: model,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const code = data.code ? ` ${data.code}` : ''
        throw new Error(`${data.error || 'failed'} (${res.status}${code})`)
      }
      const detail = validate(data)
      row(label, 'PASS', detail)
    } catch (e) {
      row(label, 'FAIL', e.message)
      failures++
    }
  }

  await callAgent('AI create 1 card', {
    mode: 'create',
    title: 'Smoke test',
    instructions: 'Return exactly one simple classroom-safe flashcard.',
    count: 1,
  }, (data) => {
    const cards = Array.isArray(data.cards) ? data.cards : []
    if (cards.length === 0 || (!cards[0].frontText && !cards[0].backText)) throw new Error('no usable card returned')
    return `1 normalized card; front="${(cards[0].frontText || '').slice(0, 40)}"`
  })

  await callAgent('AI create batch', {
    mode: 'create',
    title: 'Smoke test batch',
    instructions: 'Return three simple classroom-safe flashcards on colors.',
    count: 3,
  }, (data) => {
    const cards = Array.isArray(data.cards) ? data.cards : []
    if (cards.length === 0 || cards.every((card) => !card.frontText && !card.backText)) throw new Error('no usable cards returned')
    return `${cards.length} normalized card(s)`
  })

  await callAgent('AI enhance 1 card', {
    mode: 'enhance',
    title: 'Smoke test enhance',
    instructions: 'Improve the card and keep it classroom-safe.',
    existingCards: [fixture],
  }, (data) => {
    const cards = Array.isArray(data.cards) ? data.cards : []
    if (cards.length === 0 || (!cards[0].frontText && !cards[0].backText)) throw new Error('no usable enhanced card returned')
    return `${cards.length} normalized card(s)`
  })

  await callAgent('AI revise 1 card', {
    mode: 'revise',
    title: 'Smoke test revise',
    instructions: 'Change the back text to "sunset".',
    revisionScope: 'text',
    existingCards: [fixture],
  }, (data) => {
    if (!Array.isArray(data.patches)) throw new Error('normalized patch array missing')
    return `${data.patches.length} normalized patch(es)`
  })

  if (failures > 0) throw new Error('One or more AI scenarios failed — see FAIL rows above.')
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
