import type { NextFunction, Response } from 'express'
import type { AuthRequest } from '../auth.js'
import { listAdminReviews, updateReviewStatus } from '../services/reviewService.js'
import { getReviewModerationRequired, setReviewModerationRequired } from '../services/reviewSettingsService.js'

export async function listReviews(request: AuthRequest, response: Response, next: NextFunction) {
  try {
    const reviews = await listAdminReviews()
    response.json({ data: reviews })
  } catch (error) {
    next(error)
  }
}

export async function moderateReview(request: AuthRequest, response: Response, next: NextFunction) {
  const reviewId = Number(request.params.reviewId)
  const status = String(request.body.status ?? '').trim()

  if (!Number.isInteger(reviewId) || reviewId <= 0) {
    response.status(400).json({ message: 'Review không hợp lệ.' })
    return
  }

  try {
    const result = await updateReviewStatus(reviewId, status, request.user!.userId)
    response.json({ data: result })
  } catch (error) {
    if (error instanceof Error) {
      response.status(400).json({ message: error.message })
      return
    }
    next(error)
  }
}

export async function getReviewSettings(_request: AuthRequest, response: Response, next: NextFunction) {
  try {
    response.json({ data: { moderationRequired: await getReviewModerationRequired() } })
  } catch (error) {
    next(error)
  }
}

export async function updateReviewSettings(request: AuthRequest, response: Response, next: NextFunction) {
  if (typeof request.body.moderationRequired !== 'boolean') {
    response.status(400).json({ message: 'moderationRequired phải là boolean.' })
    return
  }

  try {
    const result = await setReviewModerationRequired(
      request.body.moderationRequired,
      request.user!.userId,
    )
    response.json({ data: result })
  } catch (error) {
    next(error)
  }
}
