import type { NextFunction, Request, Response } from 'express'
import { getImageIndexStatus, indexProductImageCatalog } from '../services/imageSearchService.js'
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

export async function getCatalogImageIndexStatus(_request: Request, response: Response, next: NextFunction) {
  try {
    response.json({ data: await getImageIndexStatus() })
  } catch (error) {
    next(error)
  }
}

export async function reindexCatalogImages(_request: Request, response: Response, next: NextFunction) {
  try {
    response.json({ data: await indexProductImageCatalog() })
  } catch (error) {
    next(error)
  }
}

let cachedEvaluationReport: any = null

export async function getAiEvaluationReport(_request: Request, response: Response, next: NextFunction) {
  try {
    const { runAiEvaluation } = await import('../services/aiEvaluationService.js')
    if (!cachedEvaluationReport) {
      cachedEvaluationReport = await runAiEvaluation()
    }
    response.json({ data: cachedEvaluationReport })
  } catch (error) {
    next(error)
  }
}

export async function runAiEvaluationBenchmark(_request: Request, response: Response, next: NextFunction) {
  try {
    const { runAiEvaluation } = await import('../services/aiEvaluationService.js')
    cachedEvaluationReport = await runAiEvaluation()
    response.json({ data: cachedEvaluationReport })
  } catch (error) {
    next(error)
  }
}

