import { useEffect, useMemo, useState } from 'react'
import { ArrowsClockwise, MagnifyingGlass } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AI_PROVIDER_DEFAULTS, formatModelPrice, inferAiProvider, readCachedModels, writeCachedModels } from '@/lib/ai-models'
import type { AiModelOption, AiProvider } from '@/lib/ai-models'

interface AiModelPickerProps {
  apiKey: string
  baseUrl: string
  model: string
  disabled?: boolean
  onBaseUrlChange: (value: string) => void
  onModelChange: (value: string) => void
}

export function AiModelPicker({ apiKey, baseUrl, model, disabled, onBaseUrlChange, onModelChange }: AiModelPickerProps) {
  const inferredProvider = inferAiProvider(baseUrl)
  const [provider, setProvider] = useState<AiProvider>(inferredProvider)
  const [models, setModels] = useState<AiModelOption[]>(() => readCachedModels(inferredProvider, baseUrl)?.models ?? AI_PROVIDER_DEFAULTS[inferredProvider].models)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const nextProvider = inferAiProvider(baseUrl)
    if (nextProvider === provider) return
    setProvider(nextProvider)
    setModels(readCachedModels(nextProvider, baseUrl)?.models ?? AI_PROVIDER_DEFAULTS[nextProvider].models)
    setMessage(null)
  }, [baseUrl, provider])

  const selected = models.find((item) => item.id === model)
  const providerDefinition = AI_PROVIDER_DEFAULTS[provider]
  const visibleModels = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (needle ? models.filter((item) => `${item.name} ${item.id}`.toLowerCase().includes(needle)) : models).slice(0, 80)
  }, [models, query])

  function changeProvider(value: AiProvider) {
    setProvider(value)
    const defaults = AI_PROVIDER_DEFAULTS[value]
    onBaseUrlChange(defaults.baseUrl)
    onModelChange('')
    setModels(readCachedModels(value, defaults.baseUrl)?.models ?? defaults.models)
    setQuery('')
    setMessage(null)
  }

  async function refreshModels() {
    if (!apiKey.trim()) {
      setMessage('Enter the provider API key to load models. Manual entry remains available.')
      return
    }
    if (!baseUrl.trim()) {
      setMessage('Enter an OpenAI-compatible base URL first.')
      return
    }
    try {
      setLoading(true)
      setMessage(null)
      const response = await fetch('/api/ai-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey: apiKey.trim(), baseUrl: baseUrl.trim() }),
      })
      const data = await response.json() as { models?: AiModelOption[]; error?: string; hint?: string; fetchedAt?: number }
      if (!response.ok) throw new Error([data.error, data.hint].filter(Boolean).join('. '))
      const next = data.models ?? []
      setModels(next)
      writeCachedModels(provider, baseUrl, next, data.fetchedAt)
      setMessage(next.length ? `${next.length} models loaded and cached locally.` : 'Provider returned no models. Enter the model id manually.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load models. Enter the model id manually.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 rounded-md border p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>AI provider</Label>
          <Select value={provider} onValueChange={(value: AiProvider) => changeProvider(value)} disabled={disabled}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(AI_PROVIDER_DEFAULTS) as AiProvider[]).map((value) => <SelectItem key={value} value={value}>{AI_PROVIDER_DEFAULTS[value].label}</SelectItem>)}
            </SelectContent>
          </Select>
          {providerDefinition.keyHelpUrl && (
            <a href={providerDefinition.keyHelpUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline-offset-4 hover:underline">
              Open provider key page
            </a>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="ai-base-url">OpenAI-compatible base URL</Label>
          <Input id="ai-base-url" value={baseUrl} onChange={(event) => onBaseUrlChange(event.target.value)} placeholder="https://provider.example/v1" disabled={disabled} />
          <p className="text-xs text-muted-foreground">Filled automatically for known providers. Custom endpoints remain editable.</p>
        </div>
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <MagnifyingGlass className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input aria-label="Filter discovered models" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter discovered models" className="pl-9" disabled={disabled} />
        </div>
        <Button type="button" variant="outline" onClick={refreshModels} disabled={disabled || loading} title="Load models from provider">
          <ArrowsClockwise className={loading ? 'animate-spin' : ''} />
          <span className="sr-only">Load models from provider</span>
        </Button>
      </div>
      {visibleModels.length > 0 && (
        <Select value={models.some((item) => item.id === model) ? model : undefined} onValueChange={onModelChange} disabled={disabled}>
          <SelectTrigger><SelectValue placeholder="Choose a discovered or recommended model" /></SelectTrigger>
          <SelectContent>{visibleModels.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} ({item.id})</SelectItem>)}</SelectContent>
        </Select>
      )}
      <div className="space-y-2">
        <Label htmlFor="ai-model-id">Model id</Label>
        <Input id="ai-model-id" value={model} onChange={(event) => onModelChange(event.target.value)} placeholder="Exact provider model id" disabled={disabled} />
        <p className="text-xs text-muted-foreground">Use the refresh button to load models, or type the exact model id manually.</p>
      </div>
      {selected && (
        <p className="text-xs text-muted-foreground">
          {[selected.contextLength ? `${selected.contextLength.toLocaleString()} context` : null, formatModelPrice(selected.inputPrice), selected.structuredOutput ? 'structured output' : null].filter(Boolean).join(' · ')}
        </p>
      )}
      {message && <p role="status" className="text-xs text-muted-foreground">{message}</p>}
    </div>
  )
}
