import { AsyncLocalStorage } from 'node:async_hooks'
import { assertSafeExternalUrl } from './_network-safety.js'

const policyStorage = new AsyncLocalStorage()
const originalFetch = globalThis.fetch.bind(globalThis)
let installed = false

function inputUrl(input) {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  if (input && typeof input.url === 'string') return input.url
  throw new Error('Outbound request URL is invalid')
}

function ensureSafeFetchInstalled() {
  if (installed) return
  installed = true

  globalThis.fetch = async (input, init = {}) => {
    const policy = policyStorage.getStore()
    if (!policy) return originalFetch(input, init)

    const rawUrl = inputUrl(input)
    const url = await assertSafeExternalUrl(rawUrl, policy)
    const method = String(init?.method || (input && typeof input === 'object' && input.method) || 'GET').toUpperCase()
    const response = await originalFetch(url, { ...init, redirect: 'manual' })

    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
      if (method !== 'GET' && method !== 'HEAD') {
        throw new Error('Provider redirects are not allowed for authenticated requests')
      }
      throw new Error('Provider redirects are not allowed in the protected AI route')
    }

    return response
  }
}

export function withSafeOutboundFetch(callback, policy = {}) {
  ensureSafeFetchInstalled()
  return policyStorage.run(policy, callback)
}
