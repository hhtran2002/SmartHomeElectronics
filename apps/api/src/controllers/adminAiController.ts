import type { NextFunction, Request, Response } from 'express'
import { getRagStatus, indexProductCatalog } from '../services/ragIndexService.js'

export async function getCatalogIndexStatus(_request: Request, response: Response, next: NextFunction) {
  try {
    response.json({ data: await getRagStatus() })
  } catch (error) {
    next(error)
  }
}

export async function reindexCatalog(_request: Request, response: Response, next: NextFunction) {
  try {
    response.json({ data: await indexProductCatalog() })
  } catch (error) {
    next(error)
  }
}
