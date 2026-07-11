export type FlashcardAgentModePreference = 'create' | 'enhance'
export type ImageAgentSidePreference = 'front' | 'back' | 'both'
export type ImageSearchStyleId = 'clear-photo' | 'simple-illustration' | 'cute-character' | 'classroom-clipart' | 'plain-background' | 'none' | 'custom'

export interface AgentDraftPreferences {
  instructions: string
  count: string
  mode: FlashcardAgentModePreference
  side: ImageAgentSidePreference
  generateText: boolean
  generateImages: boolean
  overwriteImages: boolean
  embedImages: boolean
  searchStyle: ImageSearchStyleId
  customSearchTemplate: string
}

export interface CredentialBackupPayload {
  version: 1
  createdAt: string
  ai: {
    apiKey: string
    baseUrl: string
    model: string
  }
  image: {
    braveApiKey: string
    pixabayApiKey: string
    pexelsApiKey: string
    googleApiKey: string
    googleCx: string
    provider: string
  }
  preferences: AgentDraftPreferences
}

interface EncryptedCredentialEnvelope {
  format: 'flashforge-encrypted-settings'
  version: 1
  kdf: {
    name: 'PBKDF2'
    hash: 'SHA-256'
    iterations: number
    salt: string
  }
  cipher: {
    name: 'AES-GCM'
    iv: string
    data: string
  }
}

export const IMAGE_RISK_ACK_VERSION = '1'
export const DEFAULT_AGENT_DRAFT: AgentDraftPreferences = {
  instructions: '',
  count: '8',
  mode: 'enhance',
  side: 'both',
  generateText: true,
  generateImages: true,
  overwriteImages: false,
  embedImages: true,
  searchStyle: 'clear-photo',
  customSearchTemplate: '{front}',
}

const IMAGE_RISK_KEY = 'flashforge_image_risk_ack_version'
const REMEMBER_KEY = 'flashforge_remember_byok_key'
const DRAFT_PREFIX = 'flashforge_agent_draft:'
const PBKDF2_ITERATIONS = 250_000
const MAX_BACKUP_BYTES = 128 * 1024

function resolveStorage(storage?: Storage): Storage | null {
  if (storage) return storage
  if (typeof window === 'undefined') return null
  return window.localStorage
}

function safeGet(storage: Storage | null, key: string): string | null {
  if (!storage) return null
  try { return storage.getItem(key) } catch { return null }
}

function safeSet(storage: Storage | null, key: string, value: string): void {
  if (!storage) return
  try { storage.setItem(key, value) } catch { /* storage may be unavailable or full */ }
}

function safeRemove(storage: Storage | null, key: string): void {
  if (!storage) return
  try { storage.removeItem(key) } catch { /* storage may be unavailable */ }
}

function sanitizeDraft(value: unknown): AgentDraftPreferences {
  const draft = value && typeof value === 'object' ? value as Partial<AgentDraftPreferences> : {}
  const mode = draft.mode === 'create' || draft.mode === 'enhance' ? draft.mode : DEFAULT_AGENT_DRAFT.mode
  const side = draft.side === 'front' || draft.side === 'back' || draft.side === 'both' ? draft.side : DEFAULT_AGENT_DRAFT.side
  const searchStyle: ImageSearchStyleId = ['clear-photo', 'simple-illustration', 'cute-character', 'classroom-clipart', 'plain-background', 'none', 'custom'].includes(String(draft.searchStyle))
    ? draft.searchStyle as ImageSearchStyleId
    : DEFAULT_AGENT_DRAFT.searchStyle
  return {
    instructions: typeof draft.instructions === 'string' ? draft.instructions.slice(0, 4_000) : DEFAULT_AGENT_DRAFT.instructions,
    count: /^\d{1,2}$/.test(String(draft.count ?? '')) ? String(draft.count) : DEFAULT_AGENT_DRAFT.count,
    mode,
    side,
    generateText: typeof draft.generateText === 'boolean' ? draft.generateText : DEFAULT_AGENT_DRAFT.generateText,
    generateImages: typeof draft.generateImages === 'boolean' ? draft.generateImages : DEFAULT_AGENT_DRAFT.generateImages,
    overwriteImages: typeof draft.overwriteImages === 'boolean' ? draft.overwriteImages : DEFAULT_AGENT_DRAFT.overwriteImages,
    embedImages: typeof draft.embedImages === 'boolean' ? draft.embedImages : DEFAULT_AGENT_DRAFT.embedImages,
    searchStyle,
    customSearchTemplate: typeof draft.customSearchTemplate === 'string' && draft.customSearchTemplate.trim()
      ? draft.customSearchTemplate.slice(0, 500)
      : DEFAULT_AGENT_DRAFT.customSearchTemplate,
  }
}

export function loadAgentDraft(setId: string, storage?: Storage): AgentDraftPreferences {
  const raw = safeGet(resolveStorage(storage), `${DRAFT_PREFIX}${setId}`)
  if (!raw) return { ...DEFAULT_AGENT_DRAFT }
  try { return sanitizeDraft(JSON.parse(raw)) } catch { return { ...DEFAULT_AGENT_DRAFT } }
}

export function saveAgentDraft(setId: string, draft: AgentDraftPreferences, storage?: Storage): void {
  safeSet(resolveStorage(storage), `${DRAFT_PREFIX}${setId}`, JSON.stringify(sanitizeDraft(draft)))
}

export function clearAgentDraft(setId: string, storage?: Storage): void {
  safeRemove(resolveStorage(storage), `${DRAFT_PREFIX}${setId}`)
}

export function hasAcceptedImageRisk(storage?: Storage): boolean {
  return safeGet(resolveStorage(storage), IMAGE_RISK_KEY) === IMAGE_RISK_ACK_VERSION
}

export function acceptImageRisk(storage?: Storage): void {
  safeSet(resolveStorage(storage), IMAGE_RISK_KEY, IMAGE_RISK_ACK_VERSION)
}

export function shouldRememberAiKey(storage?: Storage): boolean {
  return safeGet(resolveStorage(storage), REMEMBER_KEY) !== 'false'
}

export function setRememberAiKey(remember: boolean, storage?: Storage): void {
  safeSet(resolveStorage(storage), REMEMBER_KEY, String(remember))
  if (!remember) safeRemove(resolveStorage(storage), 'flashforge_byok_key')
}

export function persistAiKey(apiKey: string, remember: boolean, storage?: Storage): void {
  const target = resolveStorage(storage)
  if (remember) safeSet(target, 'flashforge_byok_key', apiKey)
  else safeRemove(target, 'flashforge_byok_key')
}

export function clearStoredCredentials(storage?: Storage): void {
  const target = resolveStorage(storage)
  for (const key of [
    'flashforge_byok_key',
    'flashforge_brave_key',
    'flashforge_pixabay_key',
    'flashforge_pexels_key',
    'flashforge_google_image_key',
    'flashforge_google_cx',
  ]) safeRemove(target, key)
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

async function deriveBackupKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

function requirePassphrase(passphrase: string): string {
  if (passphrase.length < 10) throw new Error('Use a passphrase of at least 10 characters')
  return passphrase
}

function sanitizeShortString(value: unknown, max = 2_000): string {
  return typeof value === 'string' ? value.slice(0, max) : ''
}

function sanitizeBackupPayload(value: unknown): CredentialBackupPayload {
  if (!value || typeof value !== 'object') throw new Error('Backup payload is invalid')
  const raw = value as Partial<CredentialBackupPayload>
  if (raw.version !== 1) throw new Error('Backup version is not supported')
  const ai = raw.ai && typeof raw.ai === 'object' ? raw.ai : {} as CredentialBackupPayload['ai']
  const image = raw.image && typeof raw.image === 'object' ? raw.image : {} as CredentialBackupPayload['image']
  return {
    version: 1,
    createdAt: sanitizeShortString(raw.createdAt, 100) || new Date().toISOString(),
    ai: {
      apiKey: sanitizeShortString(ai.apiKey),
      baseUrl: sanitizeShortString(ai.baseUrl, 500),
      model: sanitizeShortString(ai.model, 500),
    },
    image: {
      braveApiKey: sanitizeShortString(image.braveApiKey),
      pixabayApiKey: sanitizeShortString(image.pixabayApiKey),
      pexelsApiKey: sanitizeShortString(image.pexelsApiKey),
      googleApiKey: sanitizeShortString(image.googleApiKey),
      googleCx: sanitizeShortString(image.googleCx, 500),
      provider: sanitizeShortString(image.provider, 100) || 'auto',
    },
    preferences: sanitizeDraft(raw.preferences),
  }
}

export async function encryptCredentialBackup(payload: CredentialBackupPayload, passphrase: string): Promise<string> {
  requirePassphrase(passphrase)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveBackupKey(passphrase, salt, PBKDF2_ITERATIONS)
  const plaintext = new TextEncoder().encode(JSON.stringify(sanitizeBackupPayload(payload)))
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext))
  const envelope: EncryptedCredentialEnvelope = {
    format: 'flashforge-encrypted-settings',
    version: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: PBKDF2_ITERATIONS, salt: bytesToBase64(salt) },
    cipher: { name: 'AES-GCM', iv: bytesToBase64(iv), data: bytesToBase64(encrypted) },
  }
  return JSON.stringify(envelope, null, 2)
}

export async function decryptCredentialBackup(serialized: string, passphrase: string): Promise<CredentialBackupPayload> {
  requirePassphrase(passphrase)
  if (new TextEncoder().encode(serialized).byteLength > MAX_BACKUP_BYTES) throw new Error('Backup file is too large')
  let envelope: EncryptedCredentialEnvelope
  try { envelope = JSON.parse(serialized) as EncryptedCredentialEnvelope } catch { throw new Error('Backup file is not valid JSON') }
  if (envelope?.format !== 'flashforge-encrypted-settings' || envelope.version !== 1) throw new Error('Backup format is not supported')
  if (envelope.kdf?.name !== 'PBKDF2' || envelope.kdf.hash !== 'SHA-256' || envelope.cipher?.name !== 'AES-GCM') throw new Error('Backup encryption settings are not supported')
  if (!Number.isInteger(envelope.kdf.iterations) || envelope.kdf.iterations < 100_000 || envelope.kdf.iterations > 1_000_000) throw new Error('Backup key-derivation settings are invalid')
  try {
    const salt = base64ToBytes(envelope.kdf.salt)
    const iv = base64ToBytes(envelope.cipher.iv)
    const encrypted = base64ToBytes(envelope.cipher.data)
    if (salt.length !== 16 || iv.length !== 12 || encrypted.length < 16) throw new Error('invalid encrypted payload')
    const key = await deriveBackupKey(passphrase, salt, envelope.kdf.iterations)
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted)
    return sanitizeBackupPayload(JSON.parse(new TextDecoder().decode(plaintext)))
  } catch {
    throw new Error('Could not decrypt backup. Check the passphrase and file.')
  }
}
