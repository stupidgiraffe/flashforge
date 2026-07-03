export type AiProvider = 'openai' | 'openrouter' | 'custom'

export interface AiModelOption {
  id: string
  name: string
  provider: AiProvider
  description?: string
  contextLength?: number
  inputPrice?: number
  outputPrice?: number
  structuredOutput?: boolean
}

interface CachedModels {
  fetchedAt: number
  models: AiModelOption[]
}

export const AI_PROVIDER_DEFAULTS: Record<AiProvider, { label: string; baseUrl: string; models: AiModelOption[] }> = {
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini', provider: 'openai', structuredOutput: true },
      { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'openai', structuredOutput: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o mini', provider: 'openai', structuredOutput: true },
    ],
  },
  openrouter: {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [
      { id: 'openai/gpt-4.1-mini', name: 'OpenAI: GPT-4.1 mini', provider: 'openrouter', structuredOutput: true },
      { id: 'google/gemini-2.5-flash', name: 'Google: Gemini 2.5 Flash', provider: 'openrouter', structuredOutput: true },
      { id: 'anthropic/claude-3.7-sonnet', name: 'Anthropic: Claude 3.7 Sonnet', provider: 'openrouter' },
    ],
  },
  custom: {
    label: 'Custom OpenAI-compatible',
    baseUrl: '',
    models: [],
  },
}

const CACHE_MAX_AGE_MS = 60 * 60 * 1000

function cacheKey(provider: AiProvider, baseUrl: string): string {
  let host = 'custom'
  try { host = new URL(baseUrl).host } catch { host = baseUrl.trim().slice(0, 80) || 'custom' }
  return `flashforge_ai_models:${provider}:${host}`
}

export function readCachedModels(provider: AiProvider, baseUrl: string, now = Date.now()): CachedModels | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(cacheKey(provider, baseUrl)) || 'null') as CachedModels | null
    if (!parsed || !Array.isArray(parsed.models) || now - parsed.fetchedAt > CACHE_MAX_AGE_MS) return null
    return parsed
  } catch {
    return null
  }
}

export function writeCachedModels(provider: AiProvider, baseUrl: string, models: AiModelOption[], fetchedAt = Date.now()): void {
  localStorage.setItem(cacheKey(provider, baseUrl), JSON.stringify({ fetchedAt, models }))
}

export function inferAiProvider(baseUrl: string): AiProvider {
  const value = baseUrl.toLowerCase()
  if (value.includes('openrouter.ai')) return 'openrouter'
  if (value.includes('api.openai.com')) return 'openai'
  return 'custom'
}

export function formatModelPrice(value?: number): string | null {
  if (!Number.isFinite(value)) return null
  return `$${Number(value).toFixed(Number(value) < 0.01 ? 4 : 2)}/1M tokens`
}
