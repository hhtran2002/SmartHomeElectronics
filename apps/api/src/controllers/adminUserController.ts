import type { NextFunction, Response } from 'express'
import type { AuthRequest } from '../auth.js'
import {
  createAdminUser,
  getAdminRoles,
  getAdminUsers,
  reviewAdminEmployee,
  saveAdminEmployeeProfile,
  updateAdminUserRoles,
  updateAdminUserStatus,
  type EmployeeProfileInput,
} from '../services/adminUserService.js'

function text(value: unknown) {
  return String(value ?? '').trim()
}

function readRoleIds(value: unknown) {
  return Array.isArray(value)
    ? [...new Set(value.map(Number).filter((item) => Number.isInteger(item) && item > 0))]
    : []
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function readEmployeeInput(request: AuthRequest): EmployeeProfileInput | null {
  const fullName = text(request.body.fullName)
  const email = text(request.body.email).toLowerCase() || null
  const phone = text(request.body.phone)
  const roleIds = readRoleIds(request.body.roleIds)
  const position = text(request.body.position)
  const department = text(request.body.department)
  const dateOfBirth = text(request.body.dateOfBirth)
  const gender = text(request.body.gender)
  const provinceCode = text(request.body.provinceCode)
  const wardCode = text(request.body.wardCode)
  const streetAddress = text(request.body.streetAddress)
  const hireDate = text(request.body.hireDate)
  const today = new Date().toISOString().slice(0, 10)

  if (
    !fullName || !phone || roleIds.length === 0 || !position || !department
    || !isIsoDate(dateOfBirth) || dateOfBirth >= today
    || !['Male', 'Female', 'Other'].includes(gender)
    || !provinceCode || !wardCode || !streetAddress
    || !isIsoDate(hireDate) || hireDate > today
  ) return null

  return {
    fullName,
    email,
    phone,
    roleIds,
    position,
    department,
    dateOfBirth,
    gender: gender as EmployeeProfileInput['gender'],
    provinceCode,
    wardCode,
    streetAddress,
    hireDate,
  }
}

function sendBadRequest(error: unknown, response: Response, next: NextFunction) {
  if (error instanceof Error) {
    response.status(400).json({ message: error.message })
    return
  }
  next(error)
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
  const employee = readEmployeeInput(request)
  const password = String(request.body.password ?? '')
  if (!employee || password.length < 6) {
    response.status(400).json({
      message: 'Vui lòng nhập đầy đủ hồ sơ nhân viên, số điện thoại, vai trò và mật khẩu từ 6 ký tự.',
    })
    return
  }

  try {
    response.status(201).json({
      data: await createAdminUser({
        ...employee,
        password,
        createdByUserId: request.user!.userId,
      }),
    })
  } catch (error) {
    sendBadRequest(error, response, next)
  }
}

export async function saveEmployeeProfile(request: AuthRequest, response: Response, next: NextFunction) {
  const userId = Number(request.params.userId)
  const employee = readEmployeeInput(request)
  if (!Number.isInteger(userId) || userId < 1 || !employee) {
    response.status(400).json({ message: 'Người dùng hoặc hồ sơ nhân viên không hợp lệ.' })
    return
  }

  try {
    response.json({
      data: await saveAdminEmployeeProfile({
        ...employee,
        currentUserId: request.user!.userId,
        userId,
      }),
    })
  } catch (error) {
    sendBadRequest(error, response, next)
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
    sendBadRequest(error, response, next)
  }
}

export async function reviewEmployee(request: AuthRequest, response: Response, next: NextFunction) {
  const userId = Number(request.params.userId)
  const action = text(request.body.action)
  const rejectionReason = text(request.body.rejectionReason) || null
  if (!Number.isInteger(userId) || userId < 1 || !['Approved', 'Rejected'].includes(action)) {
    response.status(400).json({ message: 'Người dùng hoặc quyết định duyệt không hợp lệ.' })
    return
  }

  try {
    response.json({
      data: await reviewAdminEmployee({
        reviewerUserId: request.user!.userId,
        userId,
        action: action as 'Approved' | 'Rejected',
        rejectionReason,
      }),
    })
  } catch (error) {
    sendBadRequest(error, response, next)
  }
}

export async function changeUserStatus(request: AuthRequest, response: Response, next: NextFunction) {
  const userId = Number(request.params.userId)
  const status = text(request.body.status)
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
    sendBadRequest(error, response, next)
  }
}
