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
 *   AI_API_KEY, AI_BASE_URL (default https://api.openai.com/v1), AI_MODEL
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

// ── AI provider ─────────────────────────────────────────────────────────────

async function smokeAi() {
  const key = process.env.AI_API_KEY
  const base = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
  const model = process.env.AI_MODEL
  if (!key || !model) return row('AI (BYOK)', 'SKIP', 'AI_API_KEY or AI_MODEL not set')
  try {
    const res = await timedFetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({
        model,
        max_tokens: 60,
        messages: [
          { role: 'system', content: 'Reply with valid JSON only. Schema: {"ok":true}' },
          { role: 'user', content: 'Say ok' },
        ],
      }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`)
    }
    const data = await res.json()
    const content = data.choices?.[0]?.message?.content ?? ''
    row('AI (BYOK)', 'PASS', `model=${model} configured → ${content.slice(0, 60)}`)
  } catch (e) {
    row('AI (BYOK)', 'FAIL', e.message)
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
