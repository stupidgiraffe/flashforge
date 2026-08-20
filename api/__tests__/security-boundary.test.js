import { describe, expect, it, vi, afterEach } from 'vitest'
import { z } from 'zod'
import { RequestValidationError, readJsonBody } from '../_request.js'
import { assertSafeExternalUrl, isBlockedHostname, isBlockedIp, safeExternalFetch } from '../_network-safety.js'

function requestFrom(value, headers = {}) {
  const body = typeof value === 'string' ? value : JSON.stringify(value)
  return {
    headers: {
      'content-type': 'application/json',
      'content-length': String(Buffer.byteLength(body)),
      ...headers,
    },
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(body)
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('bounded JSON request parsing', () => {
  it('parses and validates a normal JSON request', async () => {
    const schema = z.object({ query: z.string().min(1).max(20) })
    await expect(readJsonBody(requestFrom({ query: 'cat' }), schema, { maxBytes: 100 })).resolves.toEqual({ query: 'cat' })
  })

  it('rejects a declared body larger than the limit before reading it', async () => {
    const req = requestFrom({ query: 'cat' }, { 'content-length': '1000' })
    await expect(readJsonBody(req, null, { maxBytes: 100 })).rejects.toMatchObject({
      status: 413,
      code: 'REQUEST_TOO_LARGE',
    })
  })

  it('rejects a streamed body that grows beyond the limit', async () => {
    const req = {
      headers: { 'content-type': 'application/json' },
      async *[Symbol.asyncIterator]() {
        yield Buffer.from('{"value":"')
        yield Buffer.from('x'.repeat(200))
        yield Buffer.from('"}')
      },
    }
    await expect(readJsonBody(req, null, { maxBytes: 64 })).rejects.toMatchObject({ status: 413 })
  })

  it('rejects non-JSON content types and malformed JSON', async () => {
    await expect(readJsonBody(requestFrom('{}', { 'content-type': 'text/plain' }))).rejects.toMatchObject({ status: 415 })
    await expect(readJsonBody(requestFrom('{bad json'))).rejects.toMatchObject({ status: 400, code: 'INVALID_JSON_BODY' })
  })

  it('returns a bounded validation error rather than echoing submitted values', async () => {
    const schema = z.object({ query: z.string().max(3) })
    const secret = 'sk-test-this-must-not-be-echoed'
    try {
      await readJsonBody(requestFrom({ query: secret }), schema)
      throw new Error('expected validation failure')
    } catch (error) {
      expect(error).toBeInstanceOf(RequestValidationError)
      expect(error.message).not.toContain(secret)
      expect(error.hint).not.toContain(secret)
    }
  })
})

describe('outbound provider URL validation', () => {
  it.each([
    '127.0.0.1',
    '10.0.0.1',
    '100.64.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '192.168.1.1',
    '192.0.2.1',
    '198.51.100.1',
    '203.0.113.1',
    '::1',
    'fd00::1',
    'fe80::1',
    '2001:db8::1',
  ])('blocks private or reserved address %s', (address) => {
    expect(isBlockedIp(address)).toBe(true)
  })

  it('does not classify ordinary public addresses as private', () => {
    expect(isBlockedIp('8.8.8.8')).toBe(false)
    expect(isBlockedIp('2606:4700:4700::1111')).toBe(false)
  })

  it('blocks localhost-style hostnames', () => {
    expect(isBlockedHostname('localhost')).toBe(true)
    expect(isBlockedHostname('service.local')).toBe(true)
    expect(isBlockedHostname('metadata.google.internal')).toBe(true)
  })

  it('allows a public HTTPS host when DNS resolves publicly', async () => {
    const lookup = vi.fn().mockResolvedValue([{ address: '8.8.8.8', family: 4 }])
    const url = await assertSafeExternalUrl('https://provider.example/v1', { lookup })
    expect(url.hostname).toBe('provider.example')
  })

  it('rejects a public-looking hostname that resolves privately', async () => {
    const lookup = vi.fn().mockResolvedValue([{ address: '10.0.0.8', family: 4 }])
    await expect(assertSafeExternalUrl('https://provider.example/v1', { lookup })).rejects.toThrow(/private or reserved/)
  })

  it('allows localhost HTTP only when local development is explicitly enabled', async () => {
    await expect(assertSafeExternalUrl('http://127.0.0.1:11434/v1')).rejects.toThrow(/HTTPS|public internet/)
    await expect(assertSafeExternalUrl('http://127.0.0.1:11434/v1', { allowLocalDevelopment: true })).resolves.toBeInstanceOf(URL)
  })

  it('validates every redirect before following it', async () => {
    const lookup = vi.fn().mockResolvedValue([{ address: '8.8.8.8', family: 4 }])
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, {
      status: 302,
      headers: { location: 'https://127.0.0.1/private' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(safeExternalFetch('https://provider.example/image.jpg', {}, { lookup })).rejects.toThrow(/public internet address/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
