import type { NextFunction, Response } from 'express'
import type { AuthRequest } from '../auth.js'
import {
  createAdminUser,
  getAdminRoles,
  getAdminUsers,
  updateAdminUserRoles,
  updateAdminUserStatus,
} from '../services/adminUserService.js'

function readRoleIds(value: unknown) {
  return Array.isArray(value)
    ? [...new Set(value.map(Number).filter(Number.isInteger))]
    : []
}

export async function listAdminRoles(_request: AuthRequest, response: Response, next: NextFunction) {
  try {
    response.json({ data: await getAdminRoles() })
  } catch (error) {
    next(error)
  }
}

export async function listAdminUsers(_request: AuthRequest, response: Response, next: NextFunction) {
  try {
    response.json({ data: await getAdminUsers() })
  } catch (error) {
    next(error)
  }
}

export async function createUser(request: AuthRequest, response: Response, next: NextFunction) {
  const fullName = String(request.body.fullName ?? '').trim()
  const email = String(request.body.email ?? '').trim().toLowerCase() || null
  const phone = String(request.body.phone ?? '').trim() || null
  const password = String(request.body.password ?? '')
  const roleIds = readRoleIds(request.body.roleIds)

  if (!fullName || (!email && !phone) || password.length < 6 || roleIds.length === 0) {
    response.status(400).json({ message: 'Thông tin nhân viên, mật khẩu hoặc vai trò không hợp lệ.' })
    return
  }

  try {
    response.status(201).json({ data: await createAdminUser({ fullName, email, phone, password, roleIds }) })
  } catch (error) {
    if (error instanceof Error) {
      response.status(400).json({ message: error.message })
      return
    }
    next(error)
  }
}

export async function changeUserRoles(request: AuthRequest, response: Response, next: NextFunction) {
  const userId = Number(request.params.userId)
  const roleIds = readRoleIds(request.body.roleIds)

  if (!Number.isInteger(userId) || userId < 1 || roleIds.length === 0) {
    response.status(400).json({ message: 'Người dùng hoặc danh sách vai trò không hợp lệ.' })
    return
  }

  try {
    response.json({
      data: await updateAdminUserRoles({
        currentUserId: request.user!.userId,
        userId,
        roleIds,
      }),
    })
  } catch (error) {
    if (error instanceof Error) {
      response.status(400).json({ message: error.message })
      return
    }
    next(error)
  }
}

export async function changeUserStatus(request: AuthRequest, response: Response, next: NextFunction) {
  const userId = Number(request.params.userId)
  const status = String(request.body.status ?? '')
  const allowedStatuses = new Set(['Active', 'Locked', 'Disabled'])

  if (!Number.isInteger(userId) || userId < 1 || !allowedStatuses.has(status)) {
    response.status(400).json({ message: 'Người dùng hoặc trạng thái không hợp lệ.' })
    return
  }

  try {
    response.json({
      data: await updateAdminUserStatus({
        currentUserId: request.user!.userId,
        userId,
        status,
      }),
    })
  } catch (error) {
    if (error instanceof Error) {
      response.status(400).json({ message: error.message })
      return
    }
    next(error)
  }
}
