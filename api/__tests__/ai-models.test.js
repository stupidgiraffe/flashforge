import { describe, expect, it } from 'vitest'
import { normalizeModelResults } from '../ai-models.js'

describe('normalizeModelResults', () => {
  it('normalizes OpenRouter metadata into provider-neutral model options', () => {
    const models = normalizeModelResults([{
      id: 'vendor/model',
      name: 'Useful Model',
      context_length: 128000,
      pricing: { prompt: '0.000001', completion: '0.000002' },
      supported_parameters: ['response_format'],
    }], 'openrouter')
    expect(models[0]).toMatchObject({
      id: 'vendor/model',
      provider: 'openrouter',
      contextLength: 128000,
      inputPrice: 1,
      outputPrice: 2,
      structuredOutput: true,
    })
  })

  it('drops entries without model ids', () => {
    expect(normalizeModelResults([{ name: 'broken' }], 'custom')).toEqual([])
  })
})
