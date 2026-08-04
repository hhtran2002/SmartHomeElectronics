import type { NextFunction, Request, Response } from 'express'
import type { AuthRequest } from '../auth.js'
import { detectSupportedImageMime, searchCatalogByImage } from '../services/imageSearchService.js'
import { answerCatalogQuestion, findCatalogCandidates } from '../services/ragIndexService.js'
import { AiDailyQuotaExceededError, consumeAiDailyMessage, refundAiDailyMessage } from '../services/aiUsageService.js'
import { AiServiceUnavailableError } from '../services/geminiResilience.js'

const maxQueryLength = 400

function isClearlyOutOfScope(query: string) {
  return /ignore previous|system prompt|viết code|console\.log|function\s*\(|giải phương trình|tính đạo hàm|làm bài toán/i.test(query)
}

async function refundFailedAiRequest(request: AuthRequest) {
  try {
    await refundAiDailyMessage(request.user!.userId, request.user!.roles)
  } catch (error) {
    console.error('Could not refund failed AI request quota.', error)
  }
}

function handleAiError(error: unknown, response: Response, next: NextFunction) {
  if (error instanceof AiDailyQuotaExceededError) {
    response.status(429).json({ message: error.message })
    return
  }
  if (error instanceof AiServiceUnavailableError) {
    response.status(503).json({ message: error.message })
    return
  }
  next(error)
}

export async function chatAboutProducts(request: AuthRequest, response: Response, next: NextFunction) {
  const query = String(request.body?.query ?? '').trim()
  if (!query) return void response.status(400).json({ message: 'Vui lòng nhập câu hỏi về sản phẩm.' })
  if (query.length > maxQueryLength) return void response.status(413).json({ message: `Câu hỏi chỉ được dài tối đa ${maxQueryLength} ký tự.` })
  try {
    const quota = await consumeAiDailyMessage(request.user!.userId, request.user!.roles)
    if (isClearlyOutOfScope(query)) {
      response.json({
        data: {
          decision: 'out_of_scope',
          answer: 'Trợ lý chỉ hỗ trợ tìm kiếm, so sánh và tư vấn sản phẩm trong cửa hàng.',
          productIds: [],
          products: [],
          quota,
        },
      })
      return
    }
    const history = Array.isArray(request.body?.history)
      ? request.body.history.slice(-4).map((item: unknown) => {
        const message = item as { role?: unknown; content?: unknown }
        return {
          role: message.role === 'assistant' ? 'assistant' : 'user',
          content: String(message.content ?? '').slice(0, 500),
        }
      }).filter((item: { content: string }) => item.content.trim())
      : []
    const contextProductIds = Array.isArray(request.body?.contextProductIds)
      ? request.body.contextProductIds.map(Number).filter((id: number) => Number.isInteger(id) && id > 0).slice(0, 5)
      : []
    try {
      response.json({ data: { ...await answerCatalogQuestion(query, history, contextProductIds), quota } })
    } catch (error) {
      await refundFailedAiRequest(request)
      throw error
    }
  } catch (error) {
    handleAiError(error, response, next)
  }
}

export async function findProductsByMeaning(request: Request, response: Response, next: NextFunction) {
  const query = String(request.body?.query ?? '').trim()

  if (!query) {
    response.status(400).json({ message: 'Vui lòng nhập nhu cầu tìm sản phẩm.' })
    return
  }

  if (query.length > maxQueryLength) {
    response.status(413).json({ message: `Nhu cầu tìm kiếm chỉ được dài tối đa ${maxQueryLength} ký tự.` })
    return
  }

  try {
    const candidates = await findCatalogCandidates(query, Number(request.body?.limit ?? 5))
    response.json({ data: candidates, total: candidates.length })
  } catch (error) {
    handleAiError(error, response, next)
  }
}

function readContextProductIds(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return []

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(Number)
      .filter((id) => Number.isInteger(id) && id > 0)
      .slice(0, 5)
  } catch {
    return []
  }
}

export async function findProductsByImage(request: AuthRequest, response: Response, next: NextFunction) {
  if (!request.file?.buffer?.length) {
    response.status(400).json({ message: 'Vui lòng chọn một ảnh JPEG hoặc PNG.' })
    return
  }

  const mimeType = detectSupportedImageMime(request.file.buffer)
  if (!mimeType) {
    response.status(415).json({ message: 'Ảnh tải lên không phải file JPEG hoặc PNG hợp lệ.' })
    return
  }

  const clarification = String(request.body?.clarification ?? '').trim()
  if (clarification.length > 300) {
    response.status(413).json({ message: 'Câu trả lời bổ sung chỉ được dài tối đa 300 ký tự.' })
    return
  }

  try {
    const quota = await consumeAiDailyMessage(request.user!.userId, request.user!.roles)
    try {
      const data = await searchCatalogByImage({
        buffer: request.file.buffer,
        mimeType,
        clarification,
        contextProductIds: readContextProductIds(request.body?.contextProductIds),
      })
      response.json({ data: { ...data, quota } })
    } catch (error) {
      await refundFailedAiRequest(request)
      throw error
    }
  } catch (error) {
    handleAiError(error, response, next)
  }
}
