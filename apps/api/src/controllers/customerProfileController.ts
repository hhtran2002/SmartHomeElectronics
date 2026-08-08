import type { NextFunction, Response } from 'express'
import type { AuthRequest } from '../auth.js'
import {
  changeCustomerPassword,
  createCustomerAddress,
  createReturnRequest,
  createReviewByOrderDetail,
  deleteCustomerAddress,
  getCustomerAddresses,
  getCustomerOrderDetail,
  getCustomerOrders,
  getCustomerProfile,
  getCustomerReturnRequests,
  getMyReviewedOrderDetails,
  updateCustomerAddress,
  updateCustomerProfile,
} from '../services/customerProfileService.js'

function text(value: unknown) {
  return String(value ?? '').trim()
}

function readAddressBody(request: AuthRequest) {
  return {
    receiverName: text(request.body.receiverName),
    receiverPhone: text(request.body.receiverPhone),
    provinceCode: text(request.body.provinceCode),
    wardCode: text(request.body.wardCode),
    streetAddress: text(request.body.streetAddress),
    isDefault: Boolean(request.body.isDefault),
  }
}

function isValidAddressPayload(payload: ReturnType<typeof readAddressBody>) {
  return payload.receiverName && payload.receiverPhone && payload.provinceCode && payload.wardCode && payload.streetAddress
}

export async function listCustomerOrders(request: AuthRequest, response: Response, next: NextFunction) {
  try {
    response.json({ data: await getCustomerOrders(request.user!.userId) })
  } catch (error) {
    next(error)
  }
}

export async function getCustomerOrder(request: AuthRequest, response: Response, next: NextFunction) {
  const orderId = Number(request.params.orderId)
  if (!Number.isInteger(orderId) || orderId < 1) {
    response.status(400).json({ message: 'Đơn hàng không hợp lệ.' })
    return
  }

  try {
    const detail = await getCustomerOrderDetail(request.user!.userId, orderId)
    if (!detail) {
      response.status(404).json({ message: 'Không tìm thấy đơn hàng của bạn.' })
      return
    }
    response.json({ data: detail })
  } catch (error) {
    next(error)
  }
}

export async function getProfile(request: AuthRequest, response: Response, next: NextFunction) {
  try {
    response.json({ data: await getCustomerProfile(request.user!.userId) })
  } catch (error) {
    next(error)
  }
}

export async function updateProfile(request: AuthRequest, response: Response, next: NextFunction) {
  const fullName = text(request.body.fullName)
  const email = text(request.body.email).toLowerCase() || null
  const dateOfBirth = text(request.body.dateOfBirth) || null
  const gender = text(request.body.gender) || null

  if (!fullName) {
    response.status(400).json({ message: 'Tên hiển thị không được để trống.' })
    return
  }

  try {
    const result = await updateCustomerProfile({
      userId: request.user!.userId,
      fullName,
      email,
      dateOfBirth,
      gender,
    })
    response.json({ data: result })
  } catch (error) {
    if (error instanceof Error) {
      response.status(400).json({ message: error.message })
      return
    }
    next(error)
  }
}

export async function updatePassword(request: AuthRequest, response: Response, next: NextFunction) {
  const currentPassword = String(request.body.currentPassword ?? '')
  const newPassword = String(request.body.newPassword ?? '')

  if (!currentPassword || newPassword.length < 6) {
    response.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' })
    return
  }

  try {
    response.json({ data: await changeCustomerPassword(request.user!.userId, currentPassword, newPassword) })
  } catch (error) {
    if (error instanceof Error) {
      response.status(400).json({ message: error.message })
      return
    }
    next(error)
  }
}

export async function listAddresses(request: AuthRequest, response: Response, next: NextFunction) {
  try {
    response.json({ data: await getCustomerAddresses(request.user!.userId) })
  } catch (error) {
    next(error)
  }
}

export async function createAddress(request: AuthRequest, response: Response, next: NextFunction) {
  const payload = readAddressBody(request)
  if (!isValidAddressPayload(payload)) {
    response.status(400).json({ message: 'Vui lòng nhập đủ thông tin địa chỉ nhận hàng.' })
    return
  }

  try {
    const result = await createCustomerAddress({ userId: request.user!.userId, ...payload })
    response.status(201).json({ data: result })
  } catch (error) {
    if (error instanceof Error) {
      response.status(400).json({ message: error.message })
      return
    }
    next(error)
  }
}

export async function updateAddress(request: AuthRequest, response: Response, next: NextFunction) {
  const addressId = Number(request.params.addressId)
  const payload = readAddressBody(request)
  if (!Number.isInteger(addressId) || addressId < 1 || !isValidAddressPayload(payload)) {
    response.status(400).json({ message: 'Địa chỉ không hợp lệ.' })
    return
  }

  try {
    response.json({ data: await updateCustomerAddress({ userId: request.user!.userId, addressId, ...payload }) })
  } catch (error) {
    if (error instanceof Error) {
      response.status(400).json({ message: error.message })
      return
    }
    next(error)
  }
}

export async function deleteAddress(request: AuthRequest, response: Response, next: NextFunction) {
  const addressId = Number(request.params.addressId)
  if (!Number.isInteger(addressId) || addressId < 1) {
    response.status(400).json({ message: 'Địa chỉ không hợp lệ.' })
    return
  }

  try {
    response.json({ data: await deleteCustomerAddress(request.user!.userId, addressId) })
  } catch (error) {
    if (error instanceof Error) {
      response.status(400).json({ message: error.message })
      return
    }
    next(error)
  }
}

export async function submitReview(request: AuthRequest, response: Response, next: NextFunction) {
  const orderDetailId = Number(request.body.orderDetailId)
  const rating = Number(request.body.rating)
  const comment = String(request.body.comment ?? '').trim()

  if (!Number.isInteger(orderDetailId) || orderDetailId < 1) {
    response.status(400).json({ message: 'orderDetailId không hợp lệ.' })
    return
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    response.status(400).json({ message: 'Rating phải từ 1 đến 5.' })
    return
  }
  if (!comment) {
    response.status(400).json({ message: 'Vui lòng nhập nội dung đánh giá.' })
    return
  }

  try {
    const result = await createReviewByOrderDetail(request.user!.userId, orderDetailId, rating, comment)
    response.status(201).json({ data: result })
  } catch (error) {
    if (error instanceof Error) {
      response.status(400).json({ message: error.message })
      return
    }
    next(error)
  }
}

export async function listMyReviews(request: AuthRequest, response: Response, next: NextFunction) {
  try {
    const reviewedIds = await getMyReviewedOrderDetails(request.user!.userId)
    response.json({ data: reviewedIds })
  } catch (error) {
    next(error)
  }
}

export async function submitReturnRequest(request: AuthRequest, response: Response, next: NextFunction) {
  const orderId = Number(request.body.orderId)
  const reason = String(request.body.reason ?? '').trim()
  const note = String(request.body.note ?? '').trim()
  const evidenceUrl = String(request.body.evidenceUrl ?? request.body.imageUrl ?? '').trim()
  const bankName = String(request.body.bankName ?? '').trim()
  const bankAccountNumber = String(request.body.bankAccountNumber ?? '').trim()
  const bankAccountName = String(request.body.bankAccountName ?? '').trim()

  if (!Number.isInteger(orderId) || orderId < 1) {
    response.status(400).json({ message: 'OrderId không hợp lệ.' })
    return
  }
  if (!reason) {
    response.status(400).json({ message: 'Vui lòng chọn lý do hoàn hàng.' })
    return
  }
  if (!evidenceUrl) {
    response.status(400).json({ message: 'Bạn bắt buộc phải cung cấp link ảnh hoặc video minh chứng sản phẩm bị lỗi.' })
    return
  }
  if (!bankName || !bankAccountNumber || !bankAccountName) {
    response.status(400).json({ message: 'Vui lòng điền đầy đủ Tên ngân hàng, Số tài khoản và Tên chủ tài khoản để nhận tiền hoàn qua chuyển khoản.' })
    return
  }

  try {
    const result = await createReturnRequest({
      userId: request.user!.userId,
      orderId,
      reason,
      note,
      evidenceUrl,
      refundMethod: 'BankTransfer',
      bankName,
      bankAccountNumber,
      bankAccountName,
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

export async function listMyReturnRequests(request: AuthRequest, response: Response, next: NextFunction) {
  try {
    const requests = await getCustomerReturnRequests(request.user!.userId)
    response.json({ data: requests })
  } catch (error) {
    next(error)
  }
}

