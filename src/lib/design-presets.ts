import type { CardTheme, PrintSettings } from './types'

export interface DesignPreset {
  id: string
  name: string
  description: string
  updates: Pick<PrintSettings, typeof STYLE_FIELDS[number]>
}

export const STYLE_FIELDS = [
  'theme',
  'fontFamily',
  'fontSize',
  'mainColor',
  'accentColor',
  'colorMode',
  'imageFit',
  'captionPlacement',
  'showBorder',
  'borderThickness',
  'showRoundedCorners',
  'cornerRadius',
  'textAlignment',
  'imageHeightRatio',
] as const

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
      showBorder: true,
      borderThickness: 1,
      showRoundedCorners: true,
      cornerRadius: 8,
      textAlignment: 'center',
      imageHeightRatio: 0.6,
      ...updates,
    },
  }
}

export const DESIGN_PRESETS: DesignPreset[] = [
  preset('everyday-classroom', 'Everyday Classroom', 'Balanced cards for daily vocabulary and mixed classroom activities', 'teacher-pro', {
    fontFamily: 'Inter',
    fontSize: 17,
    mainColor: '#183153',
    accentColor: '#0891b2',
    borderThickness: 2,
    cornerRadius: 6,
    imageHeightRatio: 0.55,
  }),
  preset('young-learner-illustrated', 'Young Learner Illustrated', 'Large friendly type and generous illustrations for early learners', 'classroom-cute', {
    fontFamily: 'Arial',
    fontSize: 20,
    mainColor: '#7c2d12',
    accentColor: '#0f766e',
    borderThickness: 3,
    cornerRadius: 16,
    imageHeightRatio: 0.64,
  }),
  preset('photo-vocabulary', 'Photo Vocabulary', 'Full-card photography with a strong caption for concrete vocabulary', 'picture-focus', {
    fontSize: 19,
    mainColor: '#111827',
    accentColor: '#38bdf8',
    imageFit: 'background',
    captionPlacement: 'overlay',
    borderThickness: 1,
    cornerRadius: 2,
    imageHeightRatio: 0.82,
  }),
  preset('question-answer', 'Question & Answer', 'Structured left-aligned prompts for drills, discussion, and assessment', 'quiz-card', {
    fontFamily: 'Georgia',
    fontSize: 17,
    mainColor: '#172554',
    accentColor: '#ca8a04',
    captionPlacement: 'none',
    borderThickness: 2,
    showRoundedCorners: false,
    cornerRadius: 0,
    textAlignment: 'left',
    imageHeightRatio: 0.3,
  }),
  preset('fast-review', 'Fast Review', 'Large high-contrast words for quick whole-class recall', 'bold-vocabulary', {
    fontFamily: 'Space Grotesk',
    fontSize: 22,
    mainColor: '#111827',
    accentColor: '#dc2626',
    borderThickness: 4,
    cornerRadius: 4,
    imageHeightRatio: 0.38,
  }),
  preset('low-ink-print', 'Low-Ink Print', 'Plain monochrome cards for high-volume photocopying', 'ink-saver', {
    fontFamily: 'Arial',
    fontSize: 16,
    mainColor: '#111111',
    accentColor: '#555555',
    colorMode: 'ink-saver',
    borderThickness: 1,
    showRoundedCorners: false,
    cornerRadius: 0,
    textAlignment: 'left',
    imageHeightRatio: 0.48,
  }),
]

export function getActiveDesignPreset(settings: PrintSettings): DesignPreset | null {
  return DESIGN_PRESETS.find((item) => (
    STYLE_FIELDS.every((field) => settings[field] === item.updates[field])
  )) ?? null
}

export function applyDesignPreset(settings: PrintSettings, item: DesignPreset): PrintSettings {
  return { ...settings, ...item.updates }
}
