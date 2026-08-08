import type { NextFunction, Response } from 'express'
import type { AuthRequest } from '../auth.js'
import { createProductReview } from '../services/reviewService.js'

function readText(value: unknown) {
  return String(value ?? '').trim()
}

export async function submitProductReview(request: AuthRequest, response: Response, next: NextFunction) {
  const slug = readText(request.params.slug)
  const comment = readText(request.body.comment)
  const rating = Number(request.body.rating)
  const parentReviewId = request.body.parentReviewId ? Number(request.body.parentReviewId) : null

  if (!request.user) {
    response.status(401).json({ message: 'Bạn cần đăng nhập để đánh giá.' })
    return
  }

  if (!comment || comment.length < 3) {
    response.status(400).json({ message: 'Nội dung đánh giá/bình luận quá ngắn.' })
    return
  }

  if (!parentReviewId && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    response.status(400).json({ message: 'Rating phải từ 1 đến 5 sao.' })
    return
  }

  try {
    const result = await createProductReview({
      userId: request.user.userId,
      roles: request.user.roles ?? [],
      slug,
      rating,
      comment,
      parentReviewId,
    })
    response.status(201).json({ data: result })
  } catch (error) {
    if (error instanceof Error) {
      response.status(400).json({ message: error.message })
      return
    }
    next(error)
  }
}
