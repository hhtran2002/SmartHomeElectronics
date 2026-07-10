import type { NextFunction, Request, Response } from 'express'
import { imageAiSearch, semanticAiSearch } from '../services/aiSearchService.js'

function readPositiveNumber(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function readFilters(request: Request) {
  const minPrice = request.query.minPrice === undefined ? null : Number(request.query.minPrice)
  const maxPrice = request.query.maxPrice === undefined ? null : Number(request.query.maxPrice)

  return {
    category: String(request.query.category ?? '').trim(),
    brand: String(request.query.brand ?? '').trim(),
    minPrice: Number.isFinite(minPrice) ? minPrice : null,
    maxPrice: Number.isFinite(maxPrice) ? maxPrice : null,
    limit: Math.min(48, Math.max(1, readPositiveNumber(request.query.limit, 12))),
  }
}

export async function semanticSearch(request: Request, response: Response, next: NextFunction) {
  try {
    const query = String(request.query.q ?? '').trim()

    if (!query) {
      response.json({ data: [], total: 0 })
      return
    }

    const data = await semanticAiSearch(query, readFilters(request))

    response.json({
      data,
      total: data.length,
    })
  } catch (error) {
    next(error)
  }
}

export async function imageSearch(request: Request, response: Response, next: NextFunction) {
  try {
    const imageBase64 = String(request.body?.imageBase64 ?? '')

    if (!imageBase64) {
      response.status(400).json({
        message: 'Vui lòng gửi ảnh cần tìm kiếm.',
      })
      return
    }

    const filters = {
      category: String(request.body?.category ?? '').trim(),
      brand: String(request.body?.brand ?? '').trim(),
      minPrice: Number.isFinite(Number(request.body?.minPrice)) ? Number(request.body.minPrice) : null,
      maxPrice: Number.isFinite(Number(request.body?.maxPrice)) ? Number(request.body.maxPrice) : null,
      limit: Math.min(48, Math.max(1, readPositiveNumber(request.body?.limit, 12))),
    }

    const data = await imageAiSearch(imageBase64, filters)

    response.json({
      data,
      total: data.length,
    })
  } catch (error) {
    next(error)
  }
}