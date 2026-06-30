import type { NextFunction, Request, Response } from 'express'
import { getActiveCategories } from '../services/categoryService.js'

export async function listCategories(_request: Request, response: Response, next: NextFunction) {
  try {
    const categories = await getActiveCategories()
    response.json({ data: categories })
  } catch (error) {
    next(error)
  }
}
