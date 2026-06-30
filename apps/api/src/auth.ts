import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'

export type AuthUser = {
  userId: number
  fullName: string
  email: string | null
  phone: string | null
  roles: string[]
}

export type AuthRequest = Request & {
  user?: AuthUser
}

const jwtSecret = process.env.JWT_SECRET ?? 'dev-secret-change-me'

export function signAuthToken(user: AuthUser) {
  return jwt.sign(user, jwtSecret, { expiresIn: '7d' })
}

export function requireAuth(request: AuthRequest, response: Response, next: NextFunction) {
  const header = request.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : ''

  if (!token) {
    response.status(401).json({ message: 'Bạn cần đăng nhập.' })
    return
  }

  try {
    request.user = jwt.verify(token, jwtSecret) as AuthUser
    next()
  } catch {
    response.status(401).json({ message: 'Phiên đăng nhập không hợp lệ.' })
  }
}

export function optionalAuth(request: AuthRequest, _response: Response, next: NextFunction) {
  const header = request.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : ''

  if (!token) {
    next()
    return
  }

  try {
    request.user = jwt.verify(token, jwtSecret) as AuthUser
  } catch {
    request.user = undefined
  }

  next()
}

export function requireRoles(roles: string[]) {
  return (request: AuthRequest, response: Response, next: NextFunction) => {
    const userRoles = request.user?.roles ?? []
    const allowed = roles.some((role) => userRoles.includes(role))

    if (!allowed) {
      response.status(403).json({ message: 'Bạn không có quyền thực hiện thao tác này.' })
      return
    }

    next()
  }
}
