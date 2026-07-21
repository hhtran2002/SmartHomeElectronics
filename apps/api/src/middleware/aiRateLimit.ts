import type { NextFunction, Request, Response } from 'express'

type RateLimitEntry = { count: number; resetAt: number }

const requests = new Map<string, RateLimitEntry>()
const windowMs = 60_000
const maxRequests = 12

export function aiRateLimit(request: Request, response: Response, next: NextFunction) {
  const now = Date.now()
  const key = request.ip || 'unknown'
  const current = requests.get(key)

  if (!current || current.resetAt <= now) {
    requests.set(key, { count: 1, resetAt: now + windowMs })
    next()
    return
  }

  if (current.count >= maxRequests) {
    response.status(429).json({ message: 'Bạn đang gửi quá nhiều yêu cầu AI. Vui lòng thử lại sau một phút.' })
    return
  }

  current.count += 1
  next()
}
