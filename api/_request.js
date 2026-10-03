import { randomUUID } from 'node:crypto'

export const DEFAULT_MAX_JSON_BYTES = 256 * 1024

export class RequestValidationError extends Error {
  constructor(message, { status = 400, code = 'INVALID_REQUEST', hint } = {}) {
    super(message)
    this.name = 'RequestValidationError'
    this.status = status
    this.code = code
    this.hint = hint
  }
}

function header(req, name) {
  const headers = req?.headers || {}
  const value = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()]
  return Array.isArray(value) ? value[0] : value
}

export async function readJsonBody(req, schema, { maxBytes = DEFAULT_MAX_JSON_BYTES } = {}) {
  const contentType = String(header(req, 'content-type') || 'application/json').toLowerCase()
  if (!contentType.startsWith('application/json')) {
    throw new RequestValidationError('Request body must use application/json', {
      status: 415,
      code: 'UNSUPPORTED_MEDIA_TYPE',
      hint: 'Send the request as JSON.',
    })
  }

  const declaredLength = Number(header(req, 'content-length') || 0)
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new RequestValidationError('Request body is too large', {
      status: 413,
      code: 'REQUEST_TOO_LARGE',
      hint: `Keep the JSON request below ${maxBytes} bytes.`,
    })
  }

  const chunks = []
  let totalBytes = 0
  for await (const chunk of req) {
    const bytes = typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk)
    totalBytes += bytes.byteLength
    if (totalBytes > maxBytes) {
      throw new RequestValidationError('Request body is too large', {
        status: 413,
        code: 'REQUEST_TOO_LARGE',
        hint: `Keep the JSON request below ${maxBytes} bytes.`,
      })
    }
    chunks.push(bytes)
  }

  let parsed
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
  } catch {
    throw new RequestValidationError('Request body must be valid JSON', {
      status: 400,
      code: 'INVALID_JSON_BODY',
      hint: 'Refresh the app and try again.',
    })
  }

  if (!schema) return parsed
  const result = schema.safeParse(parsed)
  if (result.success) return result.data

  const firstIssue = result.error.issues[0]
  const location = firstIssue?.path?.length ? ` (${firstIssue.path.join('.')})` : ''
  throw new RequestValidationError(`Request validation failed${location}`, {
    status: 400,
    code: 'INVALID_REQUEST',
    hint: firstIssue?.message || 'Check the request fields and try again.',
  })
}

export function writeRequestError(res, error, requestId = randomUUID()) {
  const status = Number(error?.status) || 400
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('X-Request-ID', requestId)
  res.end(JSON.stringify({
    error: error?.message || 'Invalid request',
    code: error?.code || 'INVALID_REQUEST',
    ...(error?.hint ? { hint: error.hint } : {}),
    requestId,
  }))
}

export function createSanitizedJsonResponse(res, requestId = randomUUID()) {
  res.setHeader('X-Request-ID', requestId)
  const originalEnd = res.end.bind(res)

  res.end = (body, ...args) => {
    if (res.statusCode >= 400 && body != null) {
      try {
        const parsed = JSON.parse(Buffer.isBuffer(body) ? body.toString('utf8') : String(body))
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          delete parsed.details
          delete parsed.stack
          parsed.requestId = requestId
          return originalEnd(JSON.stringify(parsed), ...args)
        }
      } catch {
        return originalEnd(JSON.stringify({ error: 'Request failed', code: 'REQUEST_FAILED', requestId }), ...args)
      }
    }
    return originalEnd(body, ...args)
  }

  return { res, requestId }
}
