import { describe, expect, it } from 'vitest'
import { explainAiAgentError, formatAiAgentError } from '../lib/ai-agent-errors'

describe('explainAiAgentError', () => {
  it('explains local API route failures separately from provider failures', () => {
    const explanation = explainAiAgentError('Local AI API route is not running at /api/flashcard-agent.')

    expect(explanation.title).toBe('AI route is not available')
    expect(explanation.action).toMatch(/Restart the dev server/)
  })

  it('explains model errors with model/base URL guidance', () => {
    const explanation = explainAiAgentError('AI endpoint or model not found (404): model does not exist')

    expect(explanation.title).toBe('Model not available')
    expect(explanation.action).toMatch(/model id/)
  })

  it('formats a one-line explanation for logs', () => {
    expect(formatAiAgentError('AI authentication failed (401)')).toMatch(/AI key rejected/)
  })

  it('prefers backend error codes for missing settings', () => {
    expect(explainAiAgentError('Missing BYOK AI API key', 'MISSING_API_KEY').title).toBe('Missing AI API key')
    expect(explainAiAgentError('Missing AI model name', 'MISSING_MODEL').title).toBe('Missing AI model')
  })

  it('maps provider and network codes to useful actions', () => {
    expect(explainAiAgentError('AI provider network request failed', 'AI_NETWORK_ERROR').title).toBe('Network request failed')
    expect(explainAiAgentError('AI request timed out', 'AI_TIMEOUT').action).toMatch(/fewer cards/)
    expect(explainAiAgentError('AI provider rejected JSON mode', 'AI_JSON_MODE_UNSUPPORTED').title).toBe('AI JSON mode unsupported')
    expect(explainAiAgentError('AI returned no usable cards', 'AI_NO_USABLE_CARDS').title).toBe('AI returned no usable cards')
  })
})
