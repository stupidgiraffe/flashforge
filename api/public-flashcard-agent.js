import { Readable } from 'node:stream'
import { z } from 'zod'
import agentHandler from './flashcard-agent.js'
import { assertSafeExternalUrl, allowLocalProviderDevelopment } from './_network-safety.js'
import { RequestValidationError, createSanitizedJsonResponse, readJsonBody, writeRequestError } from './_request.js'

const optionalRemoteUrl = z.string().max(4096).optional().transform((value) => {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined
  } catch {
    return undefined
  }
})

const existingCardSchema = z.object({
  id: z.string().trim().min(1).max(200),
  frontText: z.string().max(4000).optional().default(''),
  backText: z.string().max(4000).optional().default(''),
  frontImageUrl: optionalRemoteUrl,
  backImageUrl: optionalRemoteUrl,
})

const requestSchema = z.object({
  aiApiKey: z.string().trim().min(1).max(8192),
  aiBaseUrl: z.string().trim().max(2048).optional().default('https://api.openai.com/v1'),
  aiModel: z.string().trim().min(1).max(500),
  mode: z.enum(['create', 'enhance', 'revise']).optional().default('create'),
  title: z.string().max(300).optional().default('Flashcards'),
  instructions: z.string().max(2000).optional().default(''),
  count: z.coerce.number().int().min(1).max(60).optional().default(10),
  existingFronts: z.array(z.string().max(1000)).max(60).optional(),
  existingCards: z.array(existingCardSchema).max(60).optional(),
  revisionScope: z.enum(['text', 'images', 'both']).optional().default('both'),
})

function syntheticJsonRequest(req, body) {
  const serialized = JSON.stringify(body)
  const next = Readable.from([Buffer.from(serialized)])
  next.method = req.method
  next.url = req.url
  next.headers = {
    ...(req.headers || {}),
    'content-type': 'application/json',
    'content-length': String(Buffer.byteLength(serialized)),
  }
  return next
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return agentHandler(req, res)

  const { requestId } = createSanitizedJsonResponse(res)
  try {
    const body = await readJsonBody(req, requestSchema)
    await assertSafeExternalUrl(body.aiBaseUrl, {
      allowLocalDevelopment: allowLocalProviderDevelopment(),
    })
    return agentHandler(syntheticJsonRequest(req, body), res)
  } catch (error) {
    if (error instanceof RequestValidationError) return writeRequestError(res, error, requestId)
    return writeRequestError(res, new RequestValidationError(
      error instanceof Error ? error.message : 'AI provider URL is not allowed',
      {
        status: 400,
        code: 'UNSAFE_PROVIDER_URL',
        hint: 'Use a public HTTPS OpenAI-compatible endpoint. Local and private-network endpoints are allowed only during local development.',
      },
    ), requestId)
  }
}
