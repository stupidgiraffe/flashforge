import type { FlashCard, FlashCardSet, PrintSettings, TestSettings } from './types'
import { DEFAULT_PRINT_SETTINGS, DEFAULT_TEST_SETTINGS } from './types'

const STORAGE_KEY = 'flashforge_sets'
const VERSION = '1.1'
const MIN_IMAGE_HEIGHT_RATIO = 0.2
const MAX_IMAGE_HEIGHT_RATIO = 0.8

export interface StorageData {
  version: string
  sets: FlashCardSet[]
  lastModified: number
}

function normalizeCard(card: Partial<FlashCard>, index = 0): FlashCard {
  return {
    id: card.id || `card-${Date.now()}-${index}`,
    frontText: typeof card.frontText === 'string' ? card.frontText : '',
    backText: typeof card.backText === 'string' ? card.backText : '',
    frontSecondary: typeof card.frontSecondary === 'string' ? card.frontSecondary : undefined,
    backSecondary: typeof card.backSecondary === 'string' ? card.backSecondary : undefined,
    frontImageUrl: typeof card.frontImageUrl === 'string' ? card.frontImageUrl : undefined,
    backImageUrl: typeof card.backImageUrl === 'string' ? card.backImageUrl : undefined,
    imageUrl: typeof card.imageUrl === 'string' ? card.imageUrl : undefined,
    imagePosition: card.imagePosition === 'back' || card.imagePosition === 'both' ? card.imagePosition : 'front',
    frontImageScale: typeof card.frontImageScale === 'number' ? card.frontImageScale : 1,
    backImageScale: typeof card.backImageScale === 'number' ? card.backImageScale : 1,
    imageScale: typeof card.imageScale === 'number' ? card.imageScale : 1,
    tags: Array.isArray(card.tags) ? card.tags.filter((tag): tag is string => typeof tag === 'string') : undefined,
    category: typeof card.category === 'string' ? card.category : undefined,
  }
}

function normalizePrintSettings(settings?: Partial<PrintSettings>): PrintSettings {
  const imageHeightRatio = settings?.imageHeightRatio

  return {
    ...DEFAULT_PRINT_SETTINGS,
    ...settings,
    horizontalOffset: typeof settings?.horizontalOffset === 'number' ? settings.horizontalOffset : 0,
    verticalOffset: typeof settings?.verticalOffset === 'number' ? settings.verticalOffset : 0,
    imageHeightRatio:
      typeof imageHeightRatio === 'number' && Number.isFinite(imageHeightRatio)
        ? Math.min(MAX_IMAGE_HEIGHT_RATIO, Math.max(MIN_IMAGE_HEIGHT_RATIO, imageHeightRatio))
        : DEFAULT_PRINT_SETTINGS.imageHeightRatio,
    footerText: typeof settings?.footerText === 'string' ? settings.footerText : undefined,
  }
}

function normalizeTestSettings(settings?: Partial<TestSettings>): TestSettings {
  return {
    ...DEFAULT_TEST_SETTINGS,
    ...settings,
    questionTypes: Array.isArray(settings?.questionTypes) && settings!.questionTypes.length > 0
      ? settings!.questionTypes
      : DEFAULT_TEST_SETTINGS.questionTypes,
  }
}

export function normalizeSet(raw: Partial<FlashCardSet>, index = 0): FlashCardSet {
  const now = Date.now()
  return {
    id: raw.id || generateUniqueId(),
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title : `Imported Set ${index + 1}`,
    subtitle: typeof raw.subtitle === 'string' ? raw.subtitle : undefined,
    className: typeof raw.className === 'string' ? raw.className : undefined,
    notes: typeof raw.notes === 'string' ? raw.notes : undefined,
    cards: Array.isArray(raw.cards) ? raw.cards.map((card, cardIndex) => normalizeCard(card, cardIndex)) : [],
    cardType: raw.cardType === 'double-sided' ? 'double-sided' : 'single-sided',
    printSettings: normalizePrintSettings(raw.printSettings),
    testSettings: normalizeTestSettings(raw.testSettings),
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : now,
  }
}

export function loadSets(): FlashCardSet[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return []

    const parsed = JSON.parse(data) as Partial<StorageData> | FlashCardSet[]
    const rawSets = Array.isArray(parsed) ? parsed : parsed.sets
    if (!Array.isArray(rawSets)) return []

    return rawSets.map((set, index) => normalizeSet(set, index))
  } catch (error) {
    console.error('Failed to load sets:', error)
    return []
  }
}

export function saveSets(sets: FlashCardSet[]): void {
  try {
    const data: StorageData = {
      version: VERSION,
      sets: sets.map((set, index) => normalizeSet(set, index)),
      lastModified: Date.now(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (error) {
    console.error('Failed to save sets:', error)
    throw new Error('Failed to save data. Storage may be full.')
  }
}

export function saveSet(set: FlashCardSet): void {
  const sets = loadSets()
  const normalized = normalizeSet(set)
  const index = sets.findIndex((current) => current.id === normalized.id)

  if (index >= 0) {
    sets[index] = { ...normalized, updatedAt: Date.now() }
  } else {
    sets.push(normalized)
  }

  saveSets(sets)
}

export function deleteSet(id: string): void {
  const sets = loadSets().filter((set) => set.id !== id)
  saveSets(sets)
}

export function exportSetToJSON(set: FlashCardSet): string {
  return JSON.stringify(normalizeSet(set), null, 2)
}

export function importSetFromJSON(json: string): FlashCardSet {
  const parsed = JSON.parse(json) as Partial<FlashCardSet>
  return normalizeSet({
    ...parsed,
    id: generateUniqueId(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
}

export function exportAllSetsToJSON(sets: FlashCardSet[]): string {
  const data: StorageData = {
    version: VERSION,
    sets: sets.map((set, index) => normalizeSet(set, index)),
    lastModified: Date.now(),
  }
  return JSON.stringify(data, null, 2)
}

export function importAllSetsFromJSON(json: string): FlashCardSet[] {
  const parsed = JSON.parse(json) as Partial<StorageData> | Partial<FlashCardSet>[]
  const rawSets = Array.isArray(parsed) ? parsed : parsed.sets ?? []
  return rawSets.map((set, index) =>
    normalizeSet({
      ...set,
      id: generateUniqueId(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }, index),
  )
}

export function generateUniqueId(): string {
  return `set-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

export function compressImage(dataUrl: string, maxWidth = 1600, quality = 0.86): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let width = img.width
      let height = img.height

      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }

      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = dataUrl
  })
}
