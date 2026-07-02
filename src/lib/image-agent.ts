import type { FlashCard, ImageCandidate } from './types'

export interface NormalizeImageQueryInput {
  side: 'front' | 'back'
  frontText: string
  backText: string
  aiQuery?: string
}

export interface ImageSearchIntent {
  query: string
  concepts: string[]
  style: 'illustration' | 'photo' | 'neutral'
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

function conciseConcept(value: string): boolean {
  const words = value.split(/\s+/).filter(Boolean)
  return value.length <= 40 && words.length > 0 && words.length <= 4 && !/[.!?]/.test(value)
}

function visualConcept(input: NormalizeImageQueryInput): string {
  const front = cleanQuery(input.frontText)
  const back = cleanQuery(input.backText)
  const translationParts = front.split(/\s*[/|]\s*/).filter(Boolean)
  const slashTranslation = translationParts[translationParts.length - 1]
  if (slashTranslation && slashTranslation !== front && conciseConcept(slashTranslation)) return slashTranslation
  const looksForeign = /[^\x00-\x7F]/.test(front) || /^(el|la|los|las|un|una|le|les|der|die|das|il|lo|gli)\s+/i.test(front)
  if (looksForeign && conciseConcept(back)) return back
  return front || (conciseConcept(back) ? back : '') || 'classroom vocabulary'
}

function fallbackQuery(input: NormalizeImageQueryInput): string {
  return cleanQuery(`${visualConcept(input)} clear simple illustration`) || 'classroom vocabulary clear simple illustration'
}

export function normalizeImageQuery(input: NormalizeImageQueryInput): string {
  const candidate = cleanQuery(input.aiQuery || '')
  if (candidate && !looksLikeBadImageQuery(candidate)) return candidate
  return fallbackQuery(input)
}

export function buildImageSearchIntent(input: NormalizeImageQueryInput): ImageSearchIntent {
  const concept = visualConcept(input)
  const query = normalizeImageQuery(input)
  const lowerQuery = query.toLowerCase()
  return {
    query,
    concepts: [...new Set([concept, cleanQuery(input.frontText), cleanQuery(input.backText)].filter(conciseConcept))],
    style: lowerQuery.includes('photo') ? 'photo' : lowerQuery.includes('illustration') || lowerQuery.includes('cartoon') ? 'illustration' : 'neutral',
  }
}

export function getImageAgentOutcome(total: number, applied: number): ImageAgentOutcome {
  if (total <= 0) return 'none'
  if (applied <= 0) return 'failed'
  if (applied < total) return 'partial'
  return 'success'
}

export function getImageReviewCandidateUpdates(
  side: 'front' | 'back',
  candidates: ImageCandidate[],
): Partial<FlashCard> {
  return side === 'front'
    ? { frontImageCandidates: candidates }
    : { backImageCandidates: candidates }
}

export function getStoredImageCandidates(card: FlashCard, side: 'front' | 'back'): ImageCandidate[] {
  return side === 'front'
    ? card.frontImageCandidates ?? card.frontImage?.candidates ?? []
    : card.backImageCandidates ?? card.backImage?.candidates ?? []
}
