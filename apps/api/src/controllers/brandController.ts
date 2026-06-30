import type { NextFunction, Request, Response } from 'express'
import { getActiveBrands } from '../services/brandService.js'

export async function listBrands(_request: Request, response: Response, next: NextFunction) {
  try {
    const brands = await getActiveBrands()
    response.json({ data: brands })
  } catch (error) {
    next(error)
  }
}
