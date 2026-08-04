const retryableStatuses = new Set([429, 500, 502, 503, 504])
const retryableCodes = new Set(['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENETUNREACH'])
const defaultChatModel = 'gemini-3.5-flash-lite'
const defaultFallbackModel = 'gemini-3.6-flash'
const maxAttempts = 3

export class AiServiceUnavailableError extends Error {
  constructor() {
    super('Dịch vụ AI đang quá tải hoặc tạm thời gián đoạn. Vui lòng thử lại sau ít phút.')
    this.name = 'AiServiceUnavailableError'
  }
}

function errorNumber(error: unknown, key: 'status' | 'code') {
  if (!error || typeof error !== 'object' || !(key in error)) return undefined
  const value = (error as Record<string, unknown>)[key]
  return typeof value === 'number' ? value : undefined
}

function errorCode(error: unknown) {
  if (!error || typeof error !== 'object' || !('code' in error)) return ''
  return String((error as Record<string, unknown>).code ?? '')
}

function isRetryable(error: unknown) {
  const status = errorNumber(error, 'status') ?? errorNumber(error, 'code')
  return (status !== undefined && retryableStatuses.has(status)) || retryableCodes.has(errorCode(error))
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function retryTransient<T>(operation: () => Promise<T>) {
  let lastError: unknown

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (!isRetryable(error) || attempt === maxAttempts - 1) throw error
      await delay(500 * (2 ** attempt))
    }
  }

  throw lastError
}

export async function retryGeminiOperation<T>(operation: () => Promise<T>) {
  try {
    return await retryTransient(operation)
  } catch (error) {
    if (isRetryable(error)) throw new AiServiceUnavailableError()
    throw error
  }
}

export async function runWithChatModelFallback<T>(operation: (model: string) => Promise<T>) {
  const models = [
    process.env.GEMINI_CHAT_MODEL?.trim() || defaultChatModel,
    process.env.GEMINI_FALLBACK_MODEL?.trim() || defaultFallbackModel,
  ].filter((model, index, items) => model && items.indexOf(model) === index)

  let lastError: unknown
  for (const model of models) {
    try {
      return await retryTransient(() => operation(model))
    } catch (error) {
      lastError = error
      if (!isRetryable(error)) throw error
      console.warn(`Gemini model ${model} is temporarily unavailable; trying fallback if configured.`)
    }
  }

  if (isRetryable(lastError)) throw new AiServiceUnavailableError()
  throw lastError
}
