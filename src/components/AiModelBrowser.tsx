import { useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { Check, MagnifyingGlass } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  AI_PROVIDER_DEFAULTS,
  MODEL_BROWSER_PAGE_SIZE,
  filterModelOptions,
  formatModelPrice,
  getVisibleModelOptions,
  isIntentionalModelTap,
  readRecentModels,
  rememberRecentModel,
  type AiModelOption,
  type AiProvider,
} from '@/lib/ai-models'

interface AiModelBrowserProps {
  provider: AiProvider
  models: AiModelOption[]
  model: string
  disabled?: boolean
  onModelChange: (value: string) => void
}

function modelMetadata(item: AiModelOption): string {
  return [
    item.contextLength ? `${item.contextLength.toLocaleString()} context` : null,
    formatModelPrice(item.inputPrice),
    item.structuredOutput ? 'Structured output' : null,
  ].filter(Boolean).join(' · ')
}

export function AiModelBrowser({ provider, models, model, disabled, onModelChange }: AiModelBrowserProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(MODEL_BROWSER_PAGE_SIZE)
  const [recentModels, setRecentModels] = useState(() => readRecentModels(provider))
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const pointerMovedRef = useRef(false)
  const providerDefinition = AI_PROVIDER_DEFAULTS[provider]

  useEffect(() => {
    setRecentModels(readRecentModels(provider))
    setQuery('')
    setVisibleCount(MODEL_BROWSER_PAGE_SIZE)
  }, [provider])

  useEffect(() => {
    setVisibleCount(MODEL_BROWSER_PAGE_SIZE)
  }, [query])

  const recommendedModels = useMemo(() => {
    const modelsById = new Map(models.map((item) => [item.id, item]))
    return providerDefinition.models.map((item) => modelsById.get(item.id) ?? item)
  }, [models, providerDefinition.models])

  const filteredModels = useMemo(() => filterModelOptions(models, query), [models, query])
  const visibleModels = useMemo(
    () => getVisibleModelOptions(models, query, visibleCount),
    [models, query, visibleCount],
  )
  const recommendedIds = new Set(recommendedModels.map((item) => item.id))
  const displayedRecentModels = recentModels.filter((item) => !recommendedIds.has(item.id))
  const reservedIds = new Set([
    ...recommendedIds,
    ...displayedRecentModels.map((item) => item.id),
  ])
  const allModels = query.trim()
    ? visibleModels
    : visibleModels.filter((item) => !reservedIds.has(item.id))
  const selected = models.find((item) => item.id === model)
    ?? recommendedModels.find((item) => item.id === model)
    ?? recentModels.find((item) => item.id === model)

  function chooseModel(event: MouseEvent<HTMLButtonElement>, item: AiModelOption) {
    if (pointerMovedRef.current && event.detail !== 0) return
    setRecentModels(rememberRecentModel(item))
    onModelChange(item.id)
    setOpen(false)
  }

  function modelRows(items: AiModelOption[]) {
    return items.map((item) => {
      const metadata = modelMetadata(item)
      return (
        <button
          key={item.id}
          type="button"
          className="flex min-h-14 w-full min-w-0 touch-pan-y items-start gap-3 border-b border-border px-3 py-3 text-left last:border-b-0 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-pressed={item.id === model}
          onPointerDown={(event) => {
            pointerStartRef.current = { x: event.clientX, y: event.clientY }
            pointerMovedRef.current = false
          }}
          onPointerMove={(event) => {
            if (!pointerStartRef.current) return
            if (!isIntentionalModelTap(pointerStartRef.current, { x: event.clientX, y: event.clientY })) {
              pointerMovedRef.current = true
            }
          }}
          onPointerCancel={() => {
            pointerStartRef.current = null
            pointerMovedRef.current = true
          }}
          onClick={(event) => chooseModel(event, item)}
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{item.name}</span>
            <span className="block truncate font-mono text-xs text-muted-foreground">{item.id}</span>
            {metadata && <span className="mt-1 block truncate text-xs text-muted-foreground">{metadata}</span>}
          </span>
          {item.id === model && <Check className="mt-1 size-4 shrink-0 text-primary" aria-label="Current model" weight="bold" />}
        </button>
      )
    })
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="min-h-14 w-full min-w-0 justify-between gap-3 px-3"
        onClick={() => setOpen(true)}
        disabled={disabled || models.length === 0}
      >
        <span className="min-w-0 text-left">
          <span className="block truncate text-sm font-medium">{selected?.name ?? (model || 'Choose a model')}</span>
          <span className="block truncate text-xs text-muted-foreground">{providerDefinition.label} · Browse discovered models</span>
        </span>
        <MagnifyingGlass className="size-4 shrink-0" aria-hidden="true" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="grid h-[min(48rem,calc(100dvh-1rem))] max-h-[calc(100dvh-1rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="sticky top-0 z-10 space-y-3 border-b bg-background px-4 py-4 pr-12 text-left sm:px-6">
            <div>
              <DialogTitle>Choose AI model</DialogTitle>
              <DialogDescription>{providerDefinition.label} · Current: {model || 'No model selected'}</DialogDescription>
            </div>
            <div className="relative">
              <MagnifyingGlass className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" aria-hidden="true" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search discovered models"
                placeholder="Search model name or exact id"
                className="pl-9"
                autoFocus
              />
            </div>
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto overscroll-contain touch-pan-y px-4 py-4 sm:px-6">
            {!query.trim() && recommendedModels.length > 0 && (
              <section className="mb-5" aria-labelledby="recommended-models-heading">
                <h3 id="recommended-models-heading" className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Recommended</h3>
                <div className="overflow-hidden rounded-md border">{modelRows(recommendedModels)}</div>
              </section>
            )}

            {!query.trim() && displayedRecentModels.length > 0 && (
              <section className="mb-5" aria-labelledby="recent-models-heading">
                <h3 id="recent-models-heading" className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Recently selected</h3>
                <div className="overflow-hidden rounded-md border">{modelRows(displayedRecentModels)}</div>
              </section>
            )}

            <section aria-labelledby="all-models-heading">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 id="all-models-heading" className="text-xs font-semibold uppercase text-muted-foreground">
                  {query.trim() ? 'Filtered models' : 'All models'}
                </h3>
                <span className="text-xs text-muted-foreground">{filteredModels.length.toLocaleString()} found</span>
              </div>
              {allModels.length > 0 ? (
                <div className="overflow-hidden rounded-md border">{modelRows(allModels)}</div>
              ) : (
                <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">No matching models.</p>
              )}
              {visibleCount < filteredModels.length && (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 w-full"
                  onClick={() => setVisibleCount((count) => count + MODEL_BROWSER_PAGE_SIZE)}
                >
                  Load more
                </Button>
              )}
            </section>
          </div>

          <div className="sticky bottom-0 flex justify-end border-t bg-background px-4 py-3 sm:px-6">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
