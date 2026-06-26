export interface NormalizeImageQueryInput {
  side: 'front' | 'back'
  frontText: string
  backText: string
  aiQuery?: string
}

export type ImageAgentOutcome = 'success' | 'partial' | 'failed' | 'none'

function cleanQuery(value: string): string {
  return value
    .replace(/[“”"']/g, '')
    .replace(/[!?;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function looksLikeBadImageQuery(value: string): boolean {
  const query = cleanQuery(value)
  if (!query) return true
  if (query.length > 70) return true
  if (query.split(/\s+/).length > 9) return true
  if (/[.!?]/.test(value)) return true
  if (/\b(i am|i'm|i have|i love|i wear|i help|don't|please|who|that|with no|but i)\b/i.test(query)) return true
  return false
}

function fallbackQuery(input: NormalizeImageQueryInput): string {
  const front = cleanQuery(input.frontText)
  const back = cleanQuery(input.backText)
  const base = input.side === 'front' ? front || back : front || back
  return cleanQuery(`${base} cartoon`) || 'classroom vocabulary image'
}

export function normalizeImageQuery(input: NormalizeImageQueryInput): string {
  const candidate = cleanQuery(input.aiQuery || '')
  if (candidate && !looksLikeBadImageQuery(candidate)) return candidate
  return fallbackQuery(input)
}

export function getImageAgentOutcome(total: number, applied: number): ImageAgentOutcome {
  if (total <= 0) return 'none'
  if (applied <= 0) return 'failed'
  if (applied < total) return 'partial'
  return 'success'
}
