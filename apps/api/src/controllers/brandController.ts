import type { NextFunction, Request, Response } from 'express'
import { getActiveBrands, createBrandService } from '../services/brandService.js'

export async function listBrands(_request: Request, response: Response, next: NextFunction) {
  try {
    const brands = await getActiveBrands()
    response.json({ data: brands })
  } catch (error) {
    next(error)
  }
}

export async function createBrand(request: Request, response: Response, next: NextFunction) {
  const { name, country } = request.body
  if (!name || typeof name !== 'string' || !name.trim()) {
    response.status(400).json({ message: 'Tên thương hiệu không hợp lệ.' })
    return
  }
  try {
    const brandId = await createBrandService(name.trim(), country ? String(country).trim() : null)
    response.status(201).json({ data: { id: brandId, name: name.trim(), country } })
  } catch (error) {
    next(error)
  }
}
