import type { NextFunction, Request, Response } from 'express'
import type { AuthRequest } from '../auth.js'
import { answerCatalogQuestion, findCatalogCandidates } from '../services/ragIndexService.js'
import { AiDailyQuotaExceededError, consumeAiDailyMessage } from '../services/aiUsageService.js'

const maxQueryLength = 400

function isClearlyOutOfScope(query: string) {
  return /ignore previous|system prompt|viết code|console\.log|function\s*\(|giải phương trình|tính đạo hàm|làm bài toán/i.test(query)
}

export async function chatAboutProducts(request: AuthRequest, response: Response, next: NextFunction) {
  const query = String(request.body?.query ?? '').trim()
  if (!query) return void response.status(400).json({ message: 'Vui lòng nhập câu hỏi về sản phẩm.' })
  if (query.length > maxQueryLength) return void response.status(413).json({ message: `Câu hỏi chỉ được dài tối đa ${maxQueryLength} ký tự.` })
  if (isClearlyOutOfScope(query)) {
    response.json({ data: { decision: 'out_of_scope', answer: 'Trợ lý chỉ hỗ trợ tìm kiếm, so sánh và tư vấn sản phẩm trong cửa hàng.', productIds: [], products: [] } })
    return
  }
  try {
    const quota = await consumeAiDailyMessage(request.user!.userId)
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
    response.json({ data: { ...await answerCatalogQuestion(query, history, contextProductIds), quota } })
  } catch (error) {
    if (error instanceof AiDailyQuotaExceededError) {
      response.status(429).json({ message: error.message })
      return
    }
    next(error)
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
    next(error)
  }
}
