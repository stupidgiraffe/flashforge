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

  it('maps AI_TIMEOUT to a timeout-specific message', () => {
    const explanation = explainAiAgentError('AI request timed out after 50s', 'AI_TIMEOUT')
    expect(explanation.title).toBe('AI request timed out')
    expect(explanation.action).toMatch(/fewer cards|shorter instructions|faster model/)
  })

  it('maps AI_CONTEXT_LIMIT separately from model-not-found errors', () => {
    const explanation = explainAiAgentError(
      'AI request exceeds the model context window',
      'AI_CONTEXT_LIMIT',
    )
    expect(explanation.title).toBe('Request exceeds model context')
    expect(explanation.action).toMatch(/small batches|shorten|larger context/)
    expect(explanation.title).not.toMatch(/model not available/i)
  })

  it('recognizes provider context-limit wording before fallback model heuristics', () => {
    const explanation = explainAiAgentError(
      'The prompt has too many tokens for this model maximum context length',
    )
    expect(explanation.title).toBe('Request exceeds model context')
  })

  it('maps AI_ABORTED to a cancel-specific message', () => {
    const explanation = explainAiAgentError('The request was cancelled', 'AI_ABORTED')
    expect(explanation.title).toBe('AI request was cancelled')
    expect(explanation.action).toMatch(/retry|did not cancel|network/)
  })

  it('maps AI_EMPTY_RESPONSE to an empty-message message', () => {
    const explanation = explainAiAgentError('The AI provider returned an empty assistant message', 'AI_EMPTY_RESPONSE')
    expect(explanation.title).toBe('AI returned an empty message')
    expect(explanation.action).toMatch(/different model|chat completions/)
  })

  it('maps AI_NO_CHOICES to a no-choices message', () => {
    const explanation = explainAiAgentError('AI provider returned no choices in the response', 'AI_NO_CHOICES')
    expect(explanation.title).toBe('AI returned no choices')
    expect(explanation.action).toMatch(/different model|simpler provider/)
  })

  it('maps AI_REFUSAL_OR_FILTERED to a refusal message', () => {
    const explanation = explainAiAgentError('The AI model refused the request or content was filtered', 'AI_REFUSAL_OR_FILTERED')
    expect(explanation.title).toBe('AI request was refused or filtered')
    expect(explanation.action).toMatch(/rewording|different model/)
  })

  it('maps AI_TOOL_CALL_ONLY to a tool-calls message', () => {
    const explanation = explainAiAgentError('The AI model returned tool calls instead of text', 'AI_TOOL_CALL_ONLY')
    expect(explanation.title).toBe('AI returned only tool calls')
    expect(explanation.action).toMatch(/standard chat model|plain text or JSON/)
  })

  it('maps AI_NO_CARDS and AI_NO_USABLE_CARDS to distinct messages', () => {
    expect(explainAiAgentError('AI returned no cards', 'AI_NO_CARDS').title).toBe('AI returned no cards')
    expect(explainAiAgentError('AI returned no usable cards', 'AI_NO_USABLE_CARDS').title).toBe('AI returned no usable cards')
    expect(explainAiAgentError('AI returned no cards', 'AI_NO_CARDS').title).not.toBe(
      explainAiAgentError('AI returned no usable cards', 'AI_NO_USABLE_CARDS').title,
    )
  })

  it('returns a generic explanation for unknown codes', () => {
    const explanation = explainAiAgentError('Something went unexpectedly wrong', 'BRAND_NEW_CODE')
    expect(explanation.title).toBe('AI request failed')
    expect(explanation.detail).toBe('Something went unexpectedly wrong')
  })
})
