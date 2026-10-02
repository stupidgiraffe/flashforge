import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  CARD_THEMES,
  CLASSIC_CARD_THEMES,
  DESIGNER_CARD_THEMES,
  getCardThemeDefinition,
  getThemeRecommendedUpdates,
  isDesignerCardTheme,
} from '@/lib/card-themes'

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')

describe('card themes', () => {
  it('keeps the existing classic themes and adds eight designer themes', () => {
    expect(CLASSIC_CARD_THEMES.map((theme) => theme.id)).toEqual([
      'teacher-pro',
      'minimal',
      'classroom-cute',
      'bold-vocabulary',
      'picture-focus',
      'quiz-card',
      'playful-pop',
      'calm-study',
      'ink-saver',
    ])

    expect(DESIGNER_CARD_THEMES.map((theme) => theme.id)).toEqual([
      'dreamy-classroom',
      'storybook',
      'notebook-doodle',
      'retro-schoolhouse',
      'botanical-study',
      'candy-pop',
      'space-explorer',
      'modern-editorial',
    ])
  })

  it('has unique ids and valid starting palettes', () => {
    expect(new Set(CARD_THEMES.map((theme) => theme.id)).size).toBe(CARD_THEMES.length)

    for (const theme of CARD_THEMES) {
      expect(theme.name.length).toBeGreaterThan(0)
      expect(theme.description.length).toBeGreaterThan(10)
      expect(theme.mainColor).toMatch(/^#[0-9a-f]{6}$/i)
      expect(theme.accentColor).toMatch(/^#[0-9a-f]{6}$/i)
      expect(getCardThemeDefinition(theme.id)).toEqual(theme)
    }
  })

  it('marks only the designer collection as designer themes', () => {
    for (const theme of DESIGNER_CARD_THEMES) {
      expect(isDesignerCardTheme(theme.id)).toBe(true)
    }
    for (const theme of CLASSIC_CARD_THEMES) {
      expect(isDesignerCardTheme(theme.id)).toBe(false)
    }
  })

  it('theme application only changes theme and its starting palette', () => {
    const updates = getThemeRecommendedUpdates('dreamy-classroom')
    expect(Object.keys(updates).sort()).toEqual(['accentColor', 'mainColor', 'theme'])
    expect(updates).toEqual({
      theme: 'dreamy-classroom',
      mainColor: '#342a4f',
      accentColor: '#8b6bbd',
    })
  })

  it('ships print-safe CSS surfaces for every designer theme', () => {
    for (const theme of DESIGNER_CARD_THEMES) {
      expect(css).toContain(`[data-card-theme='${theme.id}']`)
    }
  })
})
