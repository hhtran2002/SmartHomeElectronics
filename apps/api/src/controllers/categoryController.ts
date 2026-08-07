import type { NextFunction, Request, Response } from 'express'
import { getActiveCategories, createCategoryService } from '../services/categoryService.js'

export async function listCategories(_request: Request, response: Response, next: NextFunction) {
  try {
    const categories = await getActiveCategories()
    response.json({ data: categories })
  } catch (error) {
    next(error)
  }
}

export async function createCategory(request: Request, response: Response, next: NextFunction) {
  const { name } = request.body
  if (!name || typeof name !== 'string' || !name.trim()) {
    response.status(400).json({ message: 'Tên danh mục không hợp lệ.' })
    return
  }
  try {
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
    const categoryId = await createCategoryService(name.trim(), slug)
    response.status(201).json({ data: { id: categoryId, name: name.trim(), slug } })
  } catch (error) {
    next(error)
  }
}
