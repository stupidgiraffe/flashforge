import dns from 'node:dns/promises'
import net from 'node:net'

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.google',
  'instance-data',
])

function stripIpv6Brackets(value) {
  return value.startsWith('[') && value.endsWith(']') ? value.slice(1, -1) : value
}

function ipv4Parts(address) {
  const parts = address.split('.').map(Number)
  return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) ? parts : null
}

function mappedIpv4FromIpv6(address) {
  const dotted = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (dotted) return dotted[1]

  const hex = address.match(/^(?:::ffff:|0:0:0:0:0:ffff:)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (!hex) return null
  const high = Number.parseInt(hex[1], 16)
  const low = Number.parseInt(hex[2], 16)
  return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`
}

export function isBlockedIp(address) {
  const normalized = stripIpv6Brackets(String(address || '').trim().toLowerCase())
  const family = net.isIP(normalized)
  if (!family) return false

  if (family === 4) {
    const parts = ipv4Parts(normalized)
    if (!parts) return true
    const [a, b, c] = parts
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && (c === 0 || c === 2)) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
    )
  }

  const mapped = mappedIpv4FromIpv6(normalized)
  if (mapped) return isBlockedIp(mapped)
  if (normalized === '::' || normalized === '::1') return true
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true
  if (/^fe[89ab]/.test(normalized)) return true
  if (/^fe[cdef]/.test(normalized)) return true
  if (normalized.startsWith('ff')) return true
  if (normalized === '2001:db8' || normalized.startsWith('2001:db8:')) return true

  return false
}

export function isBlockedHostname(hostname) {
  const normalized = stripIpv6Brackets(String(hostname || '').trim().toLowerCase().replace(/\.$/, ''))
  return BLOCKED_HOSTNAMES.has(normalized)
    || normalized.endsWith('.localhost')
    || normalized.endsWith('.local')
    || normalized.endsWith('.internal')
    || normalized === 'home.arpa'
    || normalized.endsWith('.home.arpa')
}

export async function assertSafeExternalUrl(rawUrl, {
  allowLocalDevelopment = false,
  lookup = dns.lookup,
} = {}) {
  let url
  try {
    url = new URL(String(rawUrl || '').trim())
  } catch {
    throw new Error('Provider URL is not valid')
  }

  const hostname = stripIpv6Brackets(url.hostname)
  const localHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  if (url.protocol !== 'https:' && !(allowLocalDevelopment && localHost && url.protocol === 'http:')) {
    throw new Error('Provider URL must use HTTPS')
  }
  if (url.username || url.password) throw new Error('Provider URL must not contain embedded credentials')
  if (url.search || url.hash) throw new Error('Provider base URL must not contain a query string or fragment')
  if (isBlockedHostname(hostname) && !(allowLocalDevelopment && localHost)) throw new Error('Provider URL must use a public internet host')
  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname) && !(allowLocalDevelopment && localHost)) throw new Error('Provider URL must use a public internet address')
    return url
  }

  let addresses
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true })
  } catch {
    throw new Error('Provider hostname could not be resolved')
  }
  if (!Array.isArray(addresses) || addresses.length === 0) throw new Error('Provider hostname could not be resolved')
  if (addresses.some(({ address }) => isBlockedIp(address))) throw new Error('Provider hostname resolves to a private or reserved address')

  return url
}

export async function safeExternalFetch(rawUrl, init = {}, {
  allowLocalDevelopment = false,
  lookup = dns.lookup,
  maxRedirects = 4,
} = {}) {
  let current = String(rawUrl || '')
  const method = String(init.method || 'GET').toUpperCase()

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const url = await assertSafeExternalUrl(current, { allowLocalDevelopment, lookup })
    const response = await fetch(url, { ...init, redirect: 'manual' })
    const isRedirect = response.status >= 300 && response.status < 400
    const location = response.headers.get('location')
    if (!isRedirect || !location) return response
    if (method !== 'GET' && method !== 'HEAD') throw new Error('Provider redirects are not allowed for this request')
    if (redirectCount === maxRedirects) throw new Error('Too many redirects')
    current = new URL(location, url).toString()
  }

  throw new Error('Too many redirects')
}

export function allowLocalProviderDevelopment() {
  return process.env.NODE_ENV !== 'production' && !process.env.VERCEL_ENV
}
