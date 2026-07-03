export function combineAbortSignals(signals: AbortSignal[]): AbortSignal {
  const active = signals.filter(Boolean)
  if (typeof AbortSignal.any === 'function') return AbortSignal.any(active)
  const controller = new AbortController()
  const abort = () => controller.abort()
  for (const signal of active) {
    if (signal.aborted) {
      controller.abort()
      break
    }
    signal.addEventListener('abort', abort, { once: true })
  }
  return controller.signal
}
