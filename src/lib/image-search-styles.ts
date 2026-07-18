import type { ImageSearchStyleId } from './agent-preferences'

export interface ImageSearchStyle {
  id: ImageSearchStyleId
  label: string
  description: string
  suffix: string
}

export const IMAGE_SEARCH_STYLES: ImageSearchStyle[] = [
  { id: 'clear-photo', label: 'Clear photo', description: 'A clear real-world subject with minimal clutter', suffix: 'clear photo isolated subject' },
  { id: 'simple-illustration', label: 'Simple illustration', description: 'Clean, easy-to-recognize artwork', suffix: 'simple illustration clean background' },
  { id: 'cute-character', label: 'Cute character', description: 'Friendly character art for younger learners', suffix: 'cute character illustration classroom safe' },
  { id: 'classroom-clipart', label: 'Classroom clipart', description: 'Printable vocabulary-style clipart', suffix: 'classroom clipart printable' },
  { id: 'plain-background', label: 'Plain background', description: 'A centered subject on a simple background', suffix: 'centered subject plain background' },
  { id: 'none', label: 'No extra search words', description: 'Search only with the card text', suffix: '' },
  { id: 'custom', label: 'Custom advanced template', description: 'Use your own template and variables', suffix: '' },
]

export function getImageSearchTemplate(style: ImageSearchStyleId, customTemplate: string): string {
  if (style === 'custom') return customTemplate.trim() || '{front}'
  const preset = IMAGE_SEARCH_STYLES.find((item) => item.id === style) ?? IMAGE_SEARCH_STYLES[0]
  return ['{text}', preset.suffix].filter(Boolean).join(' ')
}

export function applyImageSearchStyle(text: string, style: ImageSearchStyleId): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  if (style === 'custom') return normalized
  const preset = IMAGE_SEARCH_STYLES.find((item) => item.id === style) ?? IMAGE_SEARCH_STYLES[0]
  return [normalized, preset.suffix].filter(Boolean).join(' ')
}

export function previewImageSearch(style: ImageSearchStyleId, customTemplate: string, sample = 'brush my teeth'): string {
  const template = getImageSearchTemplate(style, customTemplate)
  return template
    .split('{front}').join(sample)
    .split('{back}').join('daily routine')
    .split('{text}').join(sample)
    .split('{title}').join('Daily routines')
    .split('{side}').join('front')
    .replace(/\s+/g, ' ')
    .trim()
}
