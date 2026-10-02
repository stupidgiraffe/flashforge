import type { CardTheme, PrintSettings } from './types'

export type CardThemeFamily = 'classic' | 'designer'

export interface CardThemeDefinition {
  id: CardTheme
  name: string
  description: string
  family: CardThemeFamily
  mainColor: string
  accentColor: string
  previewLabel: string
}

export const CLASSIC_CARD_THEMES: CardThemeDefinition[] = [
  { id: 'teacher-pro', name: 'Teacher Pro', description: 'Clean blue editorial styling', family: 'classic', mainColor: '#183153', accentColor: '#0891b2', previewLabel: 'ABC' },
  { id: 'minimal', name: 'Minimal', description: 'Quiet modern neutral', family: 'classic', mainColor: '#1e293b', accentColor: '#64748b', previewLabel: 'Aa' },
  { id: 'classroom-cute', name: 'Classroom Cute', description: 'Warm and friendly', family: 'classic', mainColor: '#7c2d12', accentColor: '#0f766e', previewLabel: 'Hi!' },
  { id: 'bold-vocabulary', name: 'Bold Vocabulary', description: 'High-energy contrast', family: 'classic', mainColor: '#111827', accentColor: '#dc2626', previewLabel: 'WORD' },
  { id: 'picture-focus', name: 'Picture Focus', description: 'Let visuals lead', family: 'classic', mainColor: '#111827', accentColor: '#38bdf8', previewLabel: 'Photo' },
  { id: 'quiz-card', name: 'Quiz Card', description: 'Structured assessment look', family: 'classic', mainColor: '#172554', accentColor: '#ca8a04', previewLabel: 'Q?' },
  { id: 'playful-pop', name: 'Playful Pop', description: 'Bright kid-friendly palette', family: 'classic', mainColor: '#7c3aed', accentColor: '#ec4899', previewLabel: 'POP' },
  { id: 'calm-study', name: 'Calm Study', description: 'Soft green focus mode', family: 'classic', mainColor: '#14532d', accentColor: '#0d9488', previewLabel: 'Study' },
  { id: 'ink-saver', name: 'Ink Saver', description: 'Economical for classroom printing', family: 'classic', mainColor: '#111111', accentColor: '#555555', previewLabel: 'Aa' },
]

export const DESIGNER_CARD_THEMES: CardThemeDefinition[] = [
  {
    id: 'dreamy-classroom',
    name: 'Dreamy Classroom',
    description: 'Ornamental gold frame, lavender accents, clouds, sparkles, and ribbon details',
    family: 'designer',
    mainColor: '#342a4f',
    accentColor: '#8b6bbd',
    previewLabel: 'DREAM',
  },
  {
    id: 'storybook',
    name: 'Storybook',
    description: 'Soft illustrated framing with warm paper, scallops, stars, and gentle curves',
    family: 'designer',
    mainColor: '#4d3d43',
    accentColor: '#d98273',
    previewLabel: 'Story',
  },
  {
    id: 'notebook-doodle',
    name: 'Notebook Doodle',
    description: 'Ruled-paper energy with tape, hand-drawn stars, arrows, and classroom doodles',
    family: 'designer',
    mainColor: '#1f3b5b',
    accentColor: '#e76f51',
    previewLabel: 'NOTE',
  },
  {
    id: 'retro-schoolhouse',
    name: 'Retro Schoolhouse',
    description: 'Warm vintage textbook styling with cream stock, burgundy, mustard, and badges',
    family: 'designer',
    mainColor: '#6b2737',
    accentColor: '#d89b31',
    previewLabel: 'LESSON',
  },
  {
    id: 'botanical-study',
    name: 'Botanical Study',
    description: 'Elegant sage paper with fine botanical corners and calm study-room typography',
    family: 'designer',
    mainColor: '#29483a',
    accentColor: '#7b9b79',
    previewLabel: 'Study',
  },
  {
    id: 'candy-pop',
    name: 'Candy Pop',
    description: 'Polished pastel bubbles, stickers, and playful shapes without looking chaotic',
    family: 'designer',
    mainColor: '#5b3a7a',
    accentColor: '#ef6fa8',
    previewLabel: 'YAY!',
  },
  {
    id: 'space-explorer',
    name: 'Space Explorer',
    description: 'Deep indigo card stock with constellations, planets, and bright classroom-safe contrast',
    family: 'designer',
    mainColor: '#eef2ff',
    accentColor: '#67e8f9',
    previewLabel: 'SPACE',
  },
  {
    id: 'modern-editorial',
    name: 'Modern Editorial',
    description: 'Strong typography, offset geometry, and premium magazine-style composition',
    family: 'designer',
    mainColor: '#1f2937',
    accentColor: '#e85d3f',
    previewLabel: 'TYPE',
  },
]

export const CARD_THEMES: CardThemeDefinition[] = [...DESIGNER_CARD_THEMES, ...CLASSIC_CARD_THEMES]

const THEME_BY_ID = new Map<CardTheme, CardThemeDefinition>(CARD_THEMES.map((theme) => [theme.id, theme]))

export function getCardThemeDefinition(theme: CardTheme): CardThemeDefinition {
  return THEME_BY_ID.get(theme) ?? CLASSIC_CARD_THEMES[0]
}

export function getThemeRecommendedUpdates(theme: CardTheme): Pick<PrintSettings, 'theme' | 'mainColor' | 'accentColor'> {
  const definition = getCardThemeDefinition(theme)
  return {
    theme,
    mainColor: definition.mainColor,
    accentColor: definition.accentColor,
  }
}

export function isDesignerCardTheme(theme: CardTheme): boolean {
  return getCardThemeDefinition(theme).family === 'designer'
}
