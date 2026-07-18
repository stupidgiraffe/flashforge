export type AiProvider = 'openai' | 'openrouter' | 'gemini' | 'groq' | 'mistral' | 'together' | 'xai' | 'deepseek' | 'cerebras' | 'custom'

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

interface AiProviderDefinition {
  label: string
  baseUrl: string
  models: AiModelOption[]
  keyHelpUrl?: string
  supportsModelDiscovery: boolean
}

function model(id: string, name: string, provider: AiProvider, structuredOutput = false): AiModelOption {
  return { id, name, provider, ...(structuredOutput ? { structuredOutput: true } : {}) }
}

export const AI_PROVIDER_DEFAULTS: Record<AiProvider, AiProviderDefinition> = {
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      model('gpt-4.1-mini', 'GPT-4.1 mini', 'openai', true),
      model('gpt-4.1', 'GPT-4.1', 'openai', true),
      model('gpt-4o-mini', 'GPT-4o mini', 'openai', true),
    ],
    keyHelpUrl: 'https://platform.openai.com/api-keys',
    supportsModelDiscovery: true,
  },
  openrouter: {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [
      model('openai/gpt-4.1-mini', 'OpenAI: GPT-4.1 mini', 'openrouter', true),
      model('google/gemini-2.5-flash', 'Google: Gemini 2.5 Flash', 'openrouter', true),
    ],
    keyHelpUrl: 'https://openrouter.ai/settings/keys',
    supportsModelDiscovery: true,
  },
  gemini: {
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    models: [],
    keyHelpUrl: 'https://aistudio.google.com/apikey',
    supportsModelDiscovery: true,
  },
  groq: {
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    models: [],
    keyHelpUrl: 'https://console.groq.com/keys',
    supportsModelDiscovery: true,
  },
  mistral: {
    label: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    models: [],
    keyHelpUrl: 'https://console.mistral.ai/api-keys',
    supportsModelDiscovery: true,
  },
  together: {
    label: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    models: [],
    keyHelpUrl: 'https://api.together.ai/settings/api-keys',
    supportsModelDiscovery: true,
  },
  xai: {
    label: 'xAI',
    baseUrl: 'https://api.x.ai/v1',
    models: [],
    keyHelpUrl: 'https://console.x.ai/',
    supportsModelDiscovery: true,
  },
  deepseek: {
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: [],
    keyHelpUrl: 'https://platform.deepseek.com/api_keys',
    supportsModelDiscovery: true,
  },
  cerebras: {
    label: 'Cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    models: [],
    keyHelpUrl: 'https://cloud.cerebras.ai/',
    supportsModelDiscovery: true,
  },
  custom: {
    label: 'Custom OpenAI-compatible',
    baseUrl: '',
    models: [],
    supportsModelDiscovery: true,
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
  if (value.includes('generativelanguage.googleapis.com')) return 'gemini'
  if (value.includes('api.groq.com')) return 'groq'
  if (value.includes('api.mistral.ai')) return 'mistral'
  if (value.includes('api.together.xyz')) return 'together'
  if (value.includes('api.x.ai')) return 'xai'
  if (value.includes('api.deepseek.com')) return 'deepseek'
  if (value.includes('api.cerebras.ai')) return 'cerebras'
  if (value.includes('api.openai.com')) return 'openai'
  return 'custom'
}

export function formatModelPrice(value?: number): string | null {
  if (!Number.isFinite(value)) return null
  return `$${Number(value).toFixed(Number(value) < 0.01 ? 4 : 2)}/1M tokens`
}
