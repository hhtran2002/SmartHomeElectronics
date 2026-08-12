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

function vietnamDate() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

type EmployeeInputResult =
  | { data: EmployeeProfileInput; error: null }
  | { data: null; error: string }

function readEmployeeInput(request: AuthRequest): EmployeeInputResult {
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
  const today = vietnamDate()

  if (!fullName) return { data: null, error: 'Vui lòng nhập họ tên nhân viên.' }
  if (!phone) return { data: null, error: 'Vui lòng nhập số điện thoại nhân viên.' }
  if (!isIsoDate(dateOfBirth) || dateOfBirth >= today) {
    return { data: null, error: 'Ngày sinh phải là một ngày hợp lệ trước hôm nay.' }
  }
  if (!['Male', 'Female', 'Other'].includes(gender)) {
    return { data: null, error: 'Vui lòng chọn giới tính nhân viên.' }
  }
  if (!position) return { data: null, error: 'Vui lòng nhập chức danh nhân viên.' }
  if (!department) return { data: null, error: 'Vui lòng nhập phòng ban nhân viên.' }
  if (!isIsoDate(hireDate) || hireDate > today) {
    return { data: null, error: 'Ngày vào làm không được lớn hơn ngày hiện tại.' }
  }
  if (!provinceCode) return { data: null, error: 'Vui lòng chọn tỉnh/thành.' }
  if (!wardCode) return { data: null, error: 'Vui lòng chọn xã/phường.' }
  if (!streetAddress) return { data: null, error: 'Vui lòng nhập địa chỉ nhà.' }
  if (roleIds.length === 0) return { data: null, error: 'Vui lòng chọn ít nhất một vai trò nhân viên.' }

  return { data: {
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
  }, error: null }
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
  if (employee.data === null) {
    response.status(400).json({ message: employee.error })
    return
  }
  if (password.length < 6) {
    response.status(400).json({ message: 'Mật khẩu ban đầu phải có ít nhất 6 ký tự.' })
    return
  }

  try {
    response.status(201).json({
      data: await createAdminUser({
        ...employee.data,
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
  if (!Number.isInteger(userId) || userId < 1) {
    response.status(400).json({ message: 'Người dùng không hợp lệ.' })
    return
  }
  if (employee.data === null) {
    response.status(400).json({ message: employee.error })
    return
  }

  try {
    response.json({
      data: await saveAdminEmployeeProfile({
        ...employee.data,
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
