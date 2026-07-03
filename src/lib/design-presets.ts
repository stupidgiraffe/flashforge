import type { CardTheme, PrintSettings } from './types'

export interface DesignPreset {
  id: string
  name: string
  description: string
  updates: Pick<PrintSettings, 'theme' | 'fontFamily' | 'fontSize' | 'mainColor' | 'accentColor' | 'colorMode' | 'imageFit' | 'captionPlacement' | 'borderThickness' | 'cornerRadius' | 'textAlignment' | 'imageHeightRatio'>
}

function preset(id: string, name: string, description: string, theme: CardTheme, updates: Partial<DesignPreset['updates']>): DesignPreset {
  return {
    id,
    name,
    description,
    updates: {
      theme,
      fontFamily: 'Inter',
      fontSize: 16,
      mainColor: '#1e293b',
      accentColor: '#0ea5e9',
      colorMode: 'color',
      imageFit: 'contain',
      captionPlacement: 'bottom',
      borderThickness: 1,
      cornerRadius: 8,
      textAlignment: 'center',
      imageHeightRatio: 0.6,
      ...updates,
    },
  }
}

export const DESIGN_PRESETS: DesignPreset[] = [
  preset('clean-classroom', 'Clean Classroom', 'Simple, readable everyday cards', 'minimal', { accentColor: '#2563eb', cornerRadius: 4 }),
  preset('cute-young-learners', 'Cute Young Learners', 'Warm color and larger type', 'classroom-cute', { fontSize: 18, mainColor: '#7c2d12', accentColor: '#0d9488', cornerRadius: 8 }),
  preset('picture-vocabulary', 'Picture Vocabulary', 'Large whole-image vocabulary cards', 'picture-focus', { imageHeightRatio: 0.72, fontSize: 18 }),
  preset('bold-review', 'Bold Review', 'High contrast for rapid review', 'bold-vocabulary', { fontSize: 20, mainColor: '#111827', accentColor: '#dc2626', borderThickness: 2 }),
  preset('ink-saver', 'Ink Saver', 'Low-ink monochrome printing', 'ink-saver', { colorMode: 'ink-saver', mainColor: '#111111', accentColor: '#555555', cornerRadius: 0 }),
  preset('teacher-pro', 'Teacher Pro', 'Balanced classroom handout styling', 'teacher-pro', { mainColor: '#1e293b', accentColor: '#0284c7', borderThickness: 2 }),
]
