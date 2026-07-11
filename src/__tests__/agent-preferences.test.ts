import { describe, expect, it } from 'vitest'
import {
  DEFAULT_AGENT_DRAFT,
  acceptImageRisk,
  clearStoredCredentials,
  decryptCredentialBackup,
  encryptCredentialBackup,
  hasAcceptedImageRisk,
  loadAgentDraft,
  persistAiKey,
  saveAgentDraft,
  setRememberAiKey,
  shouldRememberAiKey,
} from '@/lib/agent-preferences'
import type { CredentialBackupPayload } from '@/lib/agent-preferences'

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key) },
    setItem: (key, value) => { values.set(key, String(value)) },
  }
}

function backupPayload(): CredentialBackupPayload {
  return {
    version: 1,
    createdAt: '2026-07-11T00:00:00.000Z',
    ai: { apiKey: 'secret-ai', baseUrl: 'https://example.com/v1', model: 'model-1' },
    image: {
      braveApiKey: 'brave', pixabayApiKey: 'pixabay', pexelsApiKey: 'pexels',
      googleApiKey: 'google', googleCx: 'cx', provider: 'auto',
    },
    preferences: { ...DEFAULT_AGENT_DRAFT, instructions: 'Create routine cards' },
  }
}

describe('agent draft persistence', () => {
  it('returns safe defaults when no draft exists', () => {
    expect(loadAgentDraft('set-1', memoryStorage())).toEqual(DEFAULT_AGENT_DRAFT)
  })

  it('round-trips per-set preferences and sanitizes unsupported values', () => {
    const storage = memoryStorage()
    saveAgentDraft('set-1', { ...DEFAULT_AGENT_DRAFT, instructions: 'Daily routines', count: '12', searchStyle: 'simple-illustration' }, storage)
    expect(loadAgentDraft('set-1', storage)).toMatchObject({ instructions: 'Daily routines', count: '12', searchStyle: 'simple-illustration' })
    storage.setItem('flashforge_agent_draft:set-2', JSON.stringify({ count: '9999', mode: 'broken', side: 'elsewhere' }))
    expect(loadAgentDraft('set-2', storage)).toMatchObject({ count: '8', mode: 'enhance', side: 'both' })
  })

  it('rejects zero, negative, fractional, and over-limit card counts', () => {
    const storage = memoryStorage()
    for (const count of ['0', '-1', '1.5', '61', '9999']) {
      storage.setItem('flashforge_agent_draft:set', JSON.stringify({ ...DEFAULT_AGENT_DRAFT, count }))
      expect(loadAgentDraft('set', storage).count).toBe('8')
    }
  })
})

describe('local acknowledgement and credential retention', () => {
  it('stores the versioned image acknowledgement once', () => {
    const storage = memoryStorage()
    expect(hasAcceptedImageRisk(storage)).toBe(false)
    acceptImageRisk(storage)
    expect(hasAcceptedImageRisk(storage)).toBe(true)
  })

  it('removes the AI key when remember-on-device is disabled', () => {
    const storage = memoryStorage()
    persistAiKey('secret', true, storage)
    expect(storage.getItem('flashforge_byok_key')).toBe('secret')
    setRememberAiKey(false, storage)
    expect(shouldRememberAiKey(storage)).toBe(false)
    expect(storage.getItem('flashforge_byok_key')).toBeNull()
  })

  it('clears all saved credential keys without removing unrelated data', () => {
    const storage = memoryStorage()
    storage.setItem('flashforge_byok_key', 'a')
    storage.setItem('flashforge_brave_key', 'b')
    storage.setItem('unrelated', 'keep')
    clearStoredCredentials(storage)
    expect(storage.getItem('flashforge_byok_key')).toBeNull()
    expect(storage.getItem('flashforge_brave_key')).toBeNull()
    expect(storage.getItem('unrelated')).toBe('keep')
  })
})

describe('encrypted credential backup', () => {
  it('encrypts and decrypts the complete settings payload', async () => {
    const encrypted = await encryptCredentialBackup(backupPayload(), 'correct horse battery staple')
    expect(encrypted).not.toContain('secret-ai')
    expect(encrypted).not.toContain('Create routine cards')
    await expect(decryptCredentialBackup(encrypted, 'correct horse battery staple')).resolves.toEqual(backupPayload())
  })

  it('rejects a wrong passphrase and weak passphrases', async () => {
    const encrypted = await encryptCredentialBackup(backupPayload(), 'correct horse battery staple')
    await expect(decryptCredentialBackup(encrypted, 'incorrect passphrase')).rejects.toThrow(/Could not decrypt/)
    await expect(encryptCredentialBackup(backupPayload(), 'short')).rejects.toThrow(/at least 10/)
  })

  it('sanitizes an unsupported imported image provider', async () => {
    const payload = backupPayload()
    payload.image.provider = 'malicious-provider'
    const encrypted = await encryptCredentialBackup(payload, 'correct horse battery staple')
    const restored = await decryptCredentialBackup(encrypted, 'correct horse battery staple')
    expect(restored.image.provider).toBe('auto')
  })

  it('rejects oversized and unsupported backup envelopes', async () => {
    await expect(decryptCredentialBackup('x'.repeat(128 * 1024 + 1), 'correct horse battery staple')).rejects.toThrow(/too large/)
    await expect(decryptCredentialBackup(JSON.stringify({ format: 'other', version: 1 }), 'correct horse battery staple')).rejects.toThrow(/not supported/)
  })
})
