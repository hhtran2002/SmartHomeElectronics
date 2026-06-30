import type { NextFunction, Request, Response } from 'express'
import { getProductBySlug, getProductList } from '../services/productService.js'

function readPositiveNumber(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export async function listProducts(request: Request, response: Response, next: NextFunction) {
  try {
    const search = String(request.query.search ?? '').trim()
    const category = String(request.query.category ?? '').trim()
    const brand = String(request.query.brand ?? '').trim()
    const minPrice = request.query.minPrice === undefined ? null : Number(request.query.minPrice)
    const maxPrice = request.query.maxPrice === undefined ? null : Number(request.query.maxPrice)
    const page = Math.max(1, readPositiveNumber(request.query.page, 1))
    const pageSize = Math.min(48, Math.max(6, readPositiveNumber(request.query.pageSize, 12)))

    const payload = await getProductList({
      search,
      category,
      brand,
      minPrice: Number.isFinite(minPrice) ? minPrice : null,
      maxPrice: Number.isFinite(maxPrice) ? maxPrice : null,
      page,
      pageSize,
    })

    response.json(payload)
  } catch (error) {
    next(error)
  }
}

export async function getProductDetail(request: Request, response: Response, next: NextFunction) {
  try {
    const slug = String(request.params.slug ?? '')
    const product = await getProductBySlug(slug)

    if (!product) {
      response.status(404).json({ message: 'Không tìm thấy sản phẩm.' })
      return
    }

    response.json({ data: product })
  } catch (error) {
    next(error)
  }
}
