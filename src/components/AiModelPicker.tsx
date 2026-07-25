import { useEffect, useState } from 'react'
import { ArrowsClockwise } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AiModelBrowser } from '@/components/AiModelBrowser'
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

  function changeProvider(value: AiProvider) {
    setProvider(value)
    const defaults = AI_PROVIDER_DEFAULTS[value]
    onBaseUrlChange(defaults.baseUrl)
    onModelChange('')
    setModels(readCachedModels(value, defaults.baseUrl)?.models ?? defaults.models)
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
      <div className="flex min-w-0 gap-2">
        <div className="min-w-0 flex-1">
          <AiModelBrowser
            provider={provider}
            models={models}
            model={model}
            disabled={disabled}
            onModelChange={onModelChange}
          />
        </div>
        <Button type="button" variant="outline" onClick={refreshModels} disabled={disabled || loading} title="Load models from provider">
          <ArrowsClockwise className={loading ? 'animate-spin' : ''} />
          <span className="sr-only">Load models from provider</span>
        </Button>
      </div>
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
