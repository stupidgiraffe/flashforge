const LOW_VALUE_TERMS = new Set([
  'a', 'an', 'and', 'clear', 'for', 'image', 'illustration', 'of', 'photo', 'simple', 'the', 'to', 'with',
])

const TEXT_HEAVY_PATTERN = /\b(quote|typography|word art|worksheet|poster|infographic|meme|text)\b/i
const LOGO_PATTERN = /\b(logo|icon|symbol|emoji|watermark|brand)\b/i
const AWKWARD_PATTERN = /\b(panorama|panoramic|banner|wallpaper|extreme close[- ]?up|macro)\b/i

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function positiveNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : undefined
}

function tokens(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .map((token) => token.replace(/^-+|-+$/g, ''))
    .filter((token) => token.length > 1 && !LOW_VALUE_TERMS.has(token))
}

function validRemoteUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export function normalizeImageCandidate(raw, provider, index = 0) {
  const url = String(raw?.url || raw?.link || '').trim()
  if (!url || !validRemoteUrl(url)) return null
  const thumbnailUrl = String(raw?.thumbnailUrl || raw?.thumbnailLink || url).trim()
  const width = positiveNumber(raw?.width)
  const height = positiveNumber(raw?.height)
  return {
    id: String(raw?.id || `${provider}:${index}:${url}`),
    url,
    link: url,
    thumbnailUrl: validRemoteUrl(thumbnailUrl) ? thumbnailUrl : url,
    thumbnailLink: validRemoteUrl(thumbnailUrl) ? thumbnailUrl : url,
    originalUrl: String(raw?.originalUrl || url),
    title: String(raw?.title || 'Image result').trim(),
    description: typeof raw?.description === 'string' ? raw.description.trim() : undefined,
    provider,
    sourcePage: typeof raw?.sourcePage === 'string' ? raw.sourcePage : undefined,
    width,
    height,
  }
}

export function scoreImageCandidate(candidate, intent) {
  const query = typeof intent === 'string' ? intent : intent?.query || ''
  const concepts = typeof intent === 'object' && Array.isArray(intent?.concepts) ? intent.concepts : []
  const queryTokens = [...new Set([...tokens(query), ...concepts.flatMap(tokens)])]
  const searchable = `${candidate.title || ''} ${candidate.description || ''}`.toLowerCase()
  const searchableTokens = new Set(tokens(searchable))
  const matches = queryTokens.filter((token) => searchableTokens.has(token) || searchable.includes(token))
  const relevance = queryTokens.length > 0 ? matches.length / queryTokens.length : 0
  const reasons = []
  let score = 32 + relevance * 38

  if (query && searchable.includes(String(query).toLowerCase())) {
    score += 10
    reasons.push('exact query match')
  } else if (matches.length > 0) {
    reasons.push(`${matches.length} concept match${matches.length === 1 ? '' : 'es'}`)
  } else {
    score -= 18
    reasons.push('weak title match')
  }

  const width = positiveNumber(candidate.width)
  const height = positiveNumber(candidate.height)
  if (width && height) {
    const shortestSide = Math.min(width, height)
    const aspectRatio = width / height
    if (shortestSide < 240 || width * height < 120_000) {
      score -= 45
      reasons.push('too small')
    } else if (shortestSide >= 720) {
      score += 10
      reasons.push('high resolution')
    } else if (shortestSide >= 480) {
      score += 6
    }

    if (aspectRatio >= 0.65 && aspectRatio <= 1.75) {
      score += 10
      reasons.push('usable framing')
    } else if (aspectRatio < 0.4 || aspectRatio > 2.5) {
      score -= 35
      reasons.push('extreme aspect ratio')
    } else {
      score -= 6
      reasons.push('wide or tall framing')
    }
  } else {
    score += 2
    reasons.push('resolution unknown')
  }

  if (LOGO_PATTERN.test(searchable)) {
    score -= 30
    reasons.push('likely logo or icon')
  }
  if (TEXT_HEAVY_PATTERN.test(searchable)) {
    score -= 24
    reasons.push('likely text-heavy')
  }
  if (AWKWARD_PATTERN.test(searchable)) {
    score -= 18
    reasons.push('awkward framing signal')
  }
  if (/\.(svg|gif)(?:\?|$)/i.test(candidate.url)) {
    score -= 20
    reasons.push('less suitable format')
  }

  score = Math.round(clamp(score, 0, 100))
  const confidence = score >= 70 ? 'high' : score >= 52 ? 'medium' : 'low'
  return {
    ...candidate,
    score,
    confidence,
    needsReview: confidence === 'low',
    reasons,
  }
}

export function rankImageCandidates(rawCandidates, intent, limit = 10) {
  const normalized = rawCandidates
    .map((candidate, index) => normalizeImageCandidate(candidate, candidate?.provider || 'unknown', index))
    .filter(Boolean)
    .map((candidate) => scoreImageCandidate(candidate, intent))
    .sort((left, right) => right.score - left.score)

  const usable = normalized.filter((candidate) => {
    if (!candidate.width || !candidate.height) return true
    const ratio = candidate.width / candidate.height
    return Math.min(candidate.width, candidate.height) >= 240 && ratio >= 0.35 && ratio <= 3
  })

  return (usable.length > 0 ? usable : normalized).slice(0, Math.max(1, limit))
}
