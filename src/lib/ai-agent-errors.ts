export interface AiAgentErrorExplanation {
  title: string
  detail: string
  action: string
}

export function explainAiAgentError(message: string, code?: string, hint?: string): AiAgentErrorExplanation {
  const raw = String(message || '').trim()
  const lower = raw.toLowerCase()
  const normalizedCode = String(code || '').toUpperCase()

  if (normalizedCode === 'MISSING_API_KEY') {
    return {
      title: 'Missing AI API key',
      detail: raw || 'FlashForge cannot call your AI provider without a BYOK key.',
      action: hint || 'Paste a valid key for your selected provider.',
    }
  }

  if (normalizedCode === 'MISSING_MODEL') {
    return {
      title: 'Missing AI model',
      detail: raw || 'The provider request needs an exact model name.',
      action: hint || 'Enter the exact model id from your provider.',
    }
  }

  if (normalizedCode === 'INVALID_BASE_URL' || normalizedCode === 'AI_ENDPOINT_OR_MODEL_NOT_FOUND') {
    return {
      title: normalizedCode === 'INVALID_BASE_URL' ? 'Invalid AI base URL' : 'AI endpoint or model not found',
      detail: raw || 'The provider endpoint could not be used.',
      action: hint || 'Check that the base URL is OpenAI-compatible and that the model id is available to your key.',
    }
  }

  if (normalizedCode === 'INVALID_MODE') {
    return {
      title: 'Invalid AI mode',
      detail: raw || 'The app tried to run an unsupported AI mode.',
      action: hint || 'Refresh the app and try again.',
    }
  }

  if (normalizedCode === 'AI_AUTH_FAILED') {
    return {
      title: 'AI key rejected',
      detail: raw || 'The provider rejected the API key.',
      action: hint || 'Check that the key belongs to the selected provider and has not expired or been revoked.',
    }
  }

  if (normalizedCode === 'AI_ACCESS_DENIED') {
    return {
      title: 'AI access denied',
      detail: raw || 'The provider refused this request.',
      action: hint || 'Check model permissions, billing, organization/project settings, or provider access rules.',
    }
  }

  if (normalizedCode === 'AI_RATE_LIMIT') {
    return {
      title: 'AI limit reached',
      detail: raw || 'The provider rejected the request because of rate limits or quota.',
      action: hint || 'Wait, reduce the card count, or check billing/quota with the provider.',
    }
  }

  if (normalizedCode === 'AI_TIMEOUT' || normalizedCode === 'AI_ABORTED') {
    return {
      title: normalizedCode === 'AI_TIMEOUT' ? 'AI request timed out' : 'AI request was cancelled',
      detail: raw || (normalizedCode === 'AI_TIMEOUT'
        ? 'The provider did not respond before FlashForge gave up waiting.'
        : 'The request was cancelled before the provider responded.'),
      action: hint || (normalizedCode === 'AI_TIMEOUT'
        ? 'Try fewer cards, shorter instructions, or a faster model.'
        : 'You can retry. If you did not cancel, the network or provider may have dropped the connection.'),
    }
  }

  if (normalizedCode === 'AI_EMPTY_RESPONSE') {
    return {
      title: 'AI returned an empty message',
      detail: raw || 'The provider returned an empty assistant message with no usable content.',
      action: hint || 'Try a different model or check whether the provider supports chat completions.',
    }
  }

  if (normalizedCode === 'AI_NO_CHOICES') {
    return {
      title: 'AI returned no choices',
      detail: raw || 'The endpoint accepted the request but returned no usable chat-completions content.',
      action: hint || 'Try a different model or a simpler provider endpoint.',
    }
  }

  if (normalizedCode === 'AI_REFUSAL_OR_FILTERED') {
    return {
      title: 'AI request was refused or filtered',
      detail: raw || 'The model refused the request or the content was filtered by the provider.',
      action: hint || 'Try rewording your instructions or use a different model.',
    }
  }

  if (normalizedCode === 'AI_TOOL_CALL_ONLY') {
    return {
      title: 'AI returned only tool calls',
      detail: raw || 'The model returned tool-call instructions instead of text. This provider or model does not support the chat-completions output FlashForge expects.',
      action: hint || 'Use a standard chat model that returns plain text or JSON.',
    }
  }

  if (normalizedCode === 'AI_JSON_MODE_UNSUPPORTED' || normalizedCode === 'AI_INVALID_JSON' || normalizedCode === 'AI_PROVIDER_NON_JSON') {
    return {
      title: normalizedCode === 'AI_JSON_MODE_UNSUPPORTED' ? 'AI JSON mode unsupported' : 'AI returned the wrong format',
      detail: raw || 'FlashForge expected JSON cards but the provider returned something else.',
      action: hint || 'Use a chat model with JSON support, or try another OpenAI-compatible model.',
    }
  }

  if (normalizedCode === 'AI_NETWORK_ERROR') {
    return {
      title: 'Network request failed',
      detail: raw || 'The server could not reach the provider endpoint.',
      action: hint || 'Check the base URL, provider status, and network connection.',
    }
  }

  if (normalizedCode === 'AI_NO_USABLE_CARDS') {
    return {
      title: 'AI returned no usable cards',
      detail: raw || 'The model response parsed but contained no usable flashcards.',
      action: hint || 'Try clearer instructions or a different model.',
    }
  }

  if (normalizedCode === 'AI_NO_CARDS') {
    return {
      title: 'AI returned no cards',
      detail: raw || 'The provider returned a valid JSON response but it contained no cards.',
      action: hint || 'Try clearer instructions or a different model.',
    }
  }

  // ── Fallback heuristics (message text) ──────────────────────────────────

  if (lower.includes('local ai api route is not running')) {
    return {
      title: 'AI route is not available',
      detail: raw || 'The browser could not reach FlashForge\'s local AI endpoint.',
      action: 'Restart the dev server so the local /api/flashcard-agent bridge is loaded.',
    }
  }

  if (lower.includes('missing byok ai api key') || lower.includes('api key is missing')) {
    return {
      title: 'Missing AI API key',
      detail: 'FlashForge cannot call your AI provider without a BYOK key.',
      action: 'Paste a valid key for your selected provider.',
    }
  }

  if (lower.includes('missing ai model name')) {
    return {
      title: 'Missing AI model',
      detail: 'The provider request needs an exact model name.',
      action: 'Enter the exact model id from your provider.',
    }
  }

  if (lower.includes('authentication') || lower.includes('unauthorized') || lower.includes('401') || lower.includes('invalid api key')) {
    return {
      title: 'AI key rejected',
      detail: raw || 'The provider rejected the API key.',
      action: 'Check that the key belongs to the selected provider and has not expired or been revoked.',
    }
  }

  if (lower.includes('access denied') || lower.includes('forbidden') || lower.includes('403')) {
    return {
      title: 'AI access denied',
      detail: raw || 'The provider refused this request.',
      action: 'Check model permissions, billing, organization/project settings, or provider access rules.',
    }
  }

  if (lower.includes('model') && (lower.includes('not found') || lower.includes('invalid') || lower.includes('does not exist') || lower.includes('not exist'))) {
    return {
      title: 'Model not available',
      detail: raw || 'The provider rejected the configured model.',
      action: 'Check the model id, base URL, and whether your key has access to that model.',
    }
  }

  if (lower.includes('404')) {
    return {
      title: 'AI endpoint not found',
      detail: raw || 'The provider endpoint was not found.',
      action: 'Check that the base URL is OpenAI-compatible and includes the correct /v1 path when your provider requires it.',
    }
  }

  if (lower.includes('rate limit') || lower.includes('quota') || lower.includes('insufficient_quota') || lower.includes('429')) {
    return {
      title: 'AI limit reached',
      detail: raw || 'The provider rejected the request because of rate limits or quota.',
      action: 'Wait, reduce the card count, or check billing/quota with the provider.',
    }
  }

  if (lower.includes('timed out') || lower.includes('timeout')) {
    return {
      title: 'AI request timed out',
      detail: raw || 'The provider did not answer before FlashForge gave up.',
      action: 'Try fewer cards, shorter instructions, or a faster model.',
    }
  }

  if (lower.includes('not valid json') || lower.includes('json mode') || lower.includes('response_format')) {
    return {
      title: 'AI returned the wrong format',
      detail: raw || 'FlashForge expected JSON cards but the model returned something else.',
      action: 'Use a chat model with JSON support, or try another OpenAI-compatible model.',
    }
  }

  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('network')) {
    return {
      title: 'Network request failed',
      detail: raw || 'The browser or server could not reach the provider endpoint.',
      action: 'Check the base URL, provider status, and network connection.',
    }
  }

  return {
    title: 'AI request failed',
    detail: raw || 'The provider did not return usable flashcards.',
    action: 'Check the BYOK key, model, base URL, and instructions, then try again.',
  }
}

export function formatAiAgentError(message: string, code?: string, hint?: string): string {
  const explanation = explainAiAgentError(message, code, hint)
  return `${explanation.title}: ${explanation.detail} ${explanation.action}`
}
