import type { NextFunction, Request, Response } from 'express'
import { randomBytes } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { getPool, sql } from './config/database.js'

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

const configuredJwtSecret = process.env.JWT_SECRET?.trim()
const jwtSecret = configuredJwtSecret || randomBytes(48).toString('base64url')

if (!configuredJwtSecret) {
  console.warn('JWT_SECRET is not configured. A temporary secret was generated; users must sign in again after an API restart.')
}

async function loadCurrentAuthUser(userId: number): Promise<AuthUser | null> {
  if (!Number.isInteger(userId) || userId < 1) return null

  const pool = await getPool()
  const result = await pool.request()
    .input('userId', sql.BigInt, userId)
    .query(`
      SELECT
        account.UserId AS userId,
        account.FullName AS fullName,
        account.Email AS email,
        account.Phone AS phone,
        role.RoleCode AS roleCode
      FROM dbo.UserAccount account
      LEFT JOIN dbo.UserRole userRole ON userRole.UserId = account.UserId
      LEFT JOIN dbo.Role role ON role.RoleId = userRole.RoleId
      WHERE account.UserId = @userId AND account.Status = 'Active'
    `)

  if (!result.recordset.length) return null
  const account = result.recordset[0]
  return {
    userId: Number(account.userId),
    fullName: String(account.fullName),
    email: account.email ?? null,
    phone: account.phone ?? null,
    roles: result.recordset.map((row) => String(row.roleCode ?? '')).filter(Boolean),
  }
}

export function signAuthToken(user: AuthUser) {
  return jwt.sign(user, jwtSecret, { expiresIn: '7d' })
}

export async function requireAuth(request: AuthRequest, response: Response, next: NextFunction) {
  const header = request.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : ''

  if (!token) {
    response.status(401).json({ message: 'Bạn cần đăng nhập.' })
    return
  }

  try {
    const payload = jwt.verify(token, jwtSecret) as Partial<AuthUser>
    const user = await loadCurrentAuthUser(Number(payload.userId))
    if (!user) {
      response.status(401).json({ message: 'Phiên đăng nhập đã hết hiệu lực hoặc tài khoản đã bị khóa.' })
      return
    }
    request.user = user
    next()
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      response.status(401).json({ message: 'Phiên đăng nhập không hợp lệ.' })
      return
    }
    next(error)
  }
}

export async function optionalAuth(request: AuthRequest, _response: Response, next: NextFunction) {
  const header = request.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : ''

  if (!token) {
    next()
    return
  }

  try {
    const payload = jwt.verify(token, jwtSecret) as Partial<AuthUser>
    request.user = await loadCurrentAuthUser(Number(payload.userId)) ?? undefined
  } catch (error) {
    if (!(error instanceof jwt.JsonWebTokenError)) {
      next(error)
      return
    }
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
