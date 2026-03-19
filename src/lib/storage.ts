import type { FlashCardSet } from './types'

const STORAGE_KEY = 'flashforge_sets'
const VERSION = '1.0'

export interface StorageData {
  version: string
  sets: FlashCardSet[]
  lastModified: number
}

export function loadSets(): FlashCardSet[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return []
    
    const parsed: StorageData = JSON.parse(data)
    
    if (parsed.version !== VERSION) {
      console.warn('Storage version mismatch, migrating...')
    }
    
    return parsed.sets || []
  } catch (error) {
    console.error('Failed to load sets:', error)
    return []
  }
}

export function saveSets(sets: FlashCardSet[]): void {
  try {
    const data: StorageData = {
      version: VERSION,
      sets,
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
  const index = sets.findIndex(s => s.id === set.id)
  
  if (index >= 0) {
    sets[index] = { ...set, updatedAt: Date.now() }
  } else {
    sets.push(set)
  }
  
  saveSets(sets)
}

export function deleteSet(id: string): void {
  const sets = loadSets().filter(s => s.id !== id)
  saveSets(sets)
}

export function exportSetToJSON(set: FlashCardSet): string {
  return JSON.stringify(set, null, 2)
}

export function importSetFromJSON(json: string): FlashCardSet {
  const set = JSON.parse(json) as FlashCardSet
  set.id = `set-${Date.now()}`
  set.createdAt = Date.now()
  set.updatedAt = Date.now()
  return set
}

export function generateUniqueId(): string {
  return `set-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

export function compressImage(dataUrl: string, maxWidth = 1200, quality = 0.8): Promise<string> {
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

      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = dataUrl
  })
}
