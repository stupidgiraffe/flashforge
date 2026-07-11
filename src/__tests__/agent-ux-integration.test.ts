import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8')

describe('BYOK agent UX integration', () => {
  it('uses an empty instruction value with a real placeholder and per-deck autosave', () => {
    expect(app).not.toContain("useState('Create a complete funny")
    expect(app).toContain('Draft instructions are saved automatically for this deck.')
    expect(app).toContain('saveAgentDraft(set.id')
  })

  it('uses a one-time image acknowledgement and permits text-only runs', () => {
    expect(app).toContain('hasAcceptedImageRisk()')
    expect(app).toContain('acceptImageRisk()')
    expect(app).toContain('Search for and attach images')
    expect(app).toContain("if (!imageAgentGenerateImages)")
    expect(app).not.toContain('Please accept the image-use responsibility notice first')
  })

  it('hides raw template syntax behind search styles and integrates encrypted backups', () => {
    expect(app).toContain('Image search style')
    expect(app).toContain('Advanced search template')
    expect(app).toContain('<CredentialBackupPanel')
    expect(app).not.toContain('Search query template')
  })
})
