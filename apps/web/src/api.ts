import type {
  Brand,
  Category,
  AuthResponse,
  AdminDashboard,
  AdminInventoryItem,
  AdminStockableSku,
  AdminOrder,
  AdminOrderDetail,
  AdminProduct,
  AdminProductImage,
  AdminProductPayload,
  AdminPromotion,
  AdminPromotionPayload,
  AdminPromotionSkuOption,
  AdminReports,
  AdminReturnRequest,
  AdminReview,
  AdminStockMovement,
  AdminRole,
  AdminUser,
  AdminWarehouse,
  WarehouseReadyOrder,
  CustomerAddress,
  CustomerAddressPayload,
  CustomerProfile,
  CustomerOrder,
  CustomerOrderDetail,
  OrderReturnRequest,
  AdministrativeProvince,
  AdministrativeWard,
  CheckoutPayload,
  OrderResponse,
  PaymentMethod,
  Product,
  ProductFilters,
  ProductListResponse,
  AiChatResponse,
  AiImageSearchResponse,
  DeliveryStaffOption,
  DeliveryVehicle,
  AdminCodOverview,
  CodRemittanceMethod,
  ShipperCodAccount,
  ShipperShipment,
  ShipperReturnPickup,
  WarehouseReturnShipment,
} from './types'

const pageSize = 12

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }
  return response.json() as Promise<T>
}

async function getJsonWithToken<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.message ?? `Request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.message ?? `Request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

async function patchJsonWithToken<T>(url: string, token: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.message ?? `Request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

async function putJsonWithToken<T>(url: string, token: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.message ?? `Request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

async function postJsonWithToken<T>(url: string, token: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.message ?? `Request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

export function getProducts(filters: ProductFilters) {
  const params = new URLSearchParams()
  params.set('page', String(filters.page))
  params.set('pageSize', String(pageSize))

  if (filters.search.trim()) params.set('search', filters.search.trim())
  if (filters.category) params.set('category', filters.category)
  if (filters.brand) params.set('brand', filters.brand)
  if (filters.minPrice) params.set('minPrice', filters.minPrice)
  if (filters.maxPrice) params.set('maxPrice', filters.maxPrice)

  return getJson<ProductListResponse>(`/api/products?${params.toString()}`)
}

export function getProduct(slug: string) {
  return getJson<{ data: Product }>(`/api/products/${encodeURIComponent(slug)}`)
}

export function askAiAboutProducts(query: string, history: Array<{ role: 'user' | 'assistant'; content: string }>, contextProductIds: number[], token: string) {
  return postJsonWithToken<AiChatResponse>('/api/ai/chat', token, { query, history, contextProductIds })
}

export async function searchProductsByImage(
  image: File,
  clarification: string,
  contextProductIds: number[],
  token: string,
) {
  const formData = new FormData()
  formData.append('image', image)
  if (clarification.trim()) formData.append('clarification', clarification.trim())
  formData.append('contextProductIds', JSON.stringify(contextProductIds))

  const response = await fetch('/api/ai/image-search', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.message ?? `Request failed: ${response.status}`)
  }

  return response.json() as Promise<AiImageSearchResponse>
}

export function submitProductReview(slug: string, token: string, payload: {
  rating: number
  comment: string
  parentReviewId?: number | null
}) {
  return postJsonWithToken<{ data: { reviewId: number; status: string } }>(
    `/api/products/${encodeURIComponent(slug)}/reviews`,
    token,
    payload,
  )
}

export function getCategories() {
  return getJson<{ data: Category[] }>('/api/categories')
}

export function getBrands() {
  return getJson<{ data: Brand[] }>('/api/brands')
}

export function createCategory(name: string, token: string) {
  return postJsonWithToken<{ data: Category }>('/api/categories', token, { name })
}

export function createBrand(name: string, country: string | null, token: string) {
  return postJsonWithToken<{ data: Brand }>('/api/brands', token, { name, country })
}

export function createOrder(payload: CheckoutPayload, token?: string) {
  if (token) return postJsonWithToken<OrderResponse>('/api/orders', token, payload)
  return postJson<OrderResponse>('/api/orders', payload)
}

export function getPaymentMethods() {
  return getJson<{ data: PaymentMethod[] }>('/api/payment-methods')
}

export function register(payload: {
  fullName: string
  email: string
  phone: string
  password: string
}) {
  return postJson<AuthResponse>('/api/auth/register', payload)
}

export function login(payload: {
  identifier: string
  password: string
}) {
  return postJson<AuthResponse>('/api/auth/login', payload)
}

export function getAdminOrders(token: string) {
  return getJsonWithToken<{ data: AdminOrder[] }>('/api/admin/orders', token)
}

export function getAdminDashboard(token: string) {
  return getJsonWithToken<{ data: AdminDashboard }>('/api/admin/dashboard', token)
}

export function getAdminReports(token: string, filters: { fromDate: string; toDate: string }) {
  const params = new URLSearchParams()
  if (filters.fromDate) params.set('fromDate', filters.fromDate)
  if (filters.toDate) params.set('toDate', filters.toDate)
  return getJsonWithToken<{ data: AdminReports }>(`/api/admin/reports?${params.toString()}`, token)
}

export function getAdminReviews(token: string) {
  return getJsonWithToken<{ data: AdminReview[] }>('/api/admin/reviews', token)
}

export function updateAdminReviewStatus(reviewId: number, status: string, token: string) {
  return patchJsonWithToken<{ data: { reviewId: number; status: string } }>(
    `/api/admin/reviews/${reviewId}/status`,
    token,
    { status },
  )
}

export function getAdminOrder(orderId: number, token: string) {
  return getJsonWithToken<{ data: AdminOrderDetail }>(`/api/admin/orders/${orderId}`, token)
}

export function updateAdminOrderStatus(orderId: number, orderStatusId: number, token: string) {
  return patchJsonWithToken<{ data: { orderId: number; orderStatusId: number } }>(
    `/api/admin/orders/${orderId}/status`,
    token,
    { orderStatusId },
  )
}

export function getAdminProducts(token: string) {
  return getJsonWithToken<{ data: AdminProduct[] }>('/api/admin/products', token)
}

export function createAdminProduct(payload: AdminProductPayload, token: string) {
  return postJsonWithToken<{ data: { productId: number } }>('/api/admin/products', token, payload)
}

export function updateAdminProduct(productId: number, payload: AdminProductPayload, token: string) {
  return putJsonWithToken<{ data: { productId: number } }>(`/api/admin/products/${productId}`, token, payload)
}

export function updateAdminProductStatus(productId: number, status: string, token: string) {
  return patchJsonWithToken<{ data: { productId: number; status: string } }>(
    `/api/admin/products/${productId}/status`,
    token,
    { status },
  )
}

export function getAdminProductImages(productId: number, token: string) {
  return getJsonWithToken<{ data: AdminProductImage[] }>(`/api/admin/products/${productId}/images`, token)
}

export function addAdminProductImage(productId: number, imageUrl: string, token: string) {
  return postJsonWithToken<{ data: { imageId: number } }>(
    `/api/admin/products/${productId}/images`,
    token,
    { imageUrl },
  )
}

export function setAdminProductPrimaryImage(productId: number, imageId: number, token: string) {
  return patchJsonWithToken<{ data: { productId: number; imageId: number } }>(
    `/api/admin/products/${productId}/images/${imageId}/primary`,
    token,
    {},
  )
}

export function deleteAdminProductImage(productId: number, imageId: number, token: string) {
  return fetch(`/api/admin/products/${productId}/images/${imageId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  }).then(async (response) => {
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      throw new Error(payload?.message ?? `Request failed: ${response.status}`)
    }
    return response.json() as Promise<{ data: { productId: number; imageId: number } }>
  })
}

export function getAdminPromotions(token: string) {
  return getJsonWithToken<{ data: AdminPromotion[] }>('/api/admin/promotions', token)
}

export function getAdminPromotionSkuOptions(token: string) {
  return getJsonWithToken<{ data: AdminPromotionSkuOption[] }>('/api/admin/promotions/sku-options', token)
}

export function createAdminPromotion(payload: AdminPromotionPayload, token: string) {
  return postJsonWithToken<{ data: { promotionId: number } }>('/api/admin/promotions', token, payload)
}

export function updateAdminPromotion(promotionId: number, payload: AdminPromotionPayload, token: string) {
  return putJsonWithToken<{ data: { promotionId: number } }>(`/api/admin/promotions/${promotionId}`, token, payload)
}

export function updateAdminPromotionStatus(promotionId: number, status: string, token: string) {
  return patchJsonWithToken<{ data: { promotionId: number; status: string } }>(
    `/api/admin/promotions/${promotionId}/status`,
    token,
    { status },
  )
}

export function getAdminWarehouses(token: string) {
  return getJsonWithToken<{ data: AdminWarehouse[] }>('/api/admin/inventory/warehouses', token)
}

export function getAdminInventory(token: string) {
  return getJsonWithToken<{ data: AdminInventoryItem[] }>('/api/admin/inventory', token)
}

export function getAdminStockableSkus(token: string) {
  return getJsonWithToken<{ data: AdminStockableSku[] }>('/api/admin/inventory/skus', token)
}

export function getAdminStockMovements(token: string) {
  return getJsonWithToken<{ data: AdminStockMovement[] }>('/api/admin/inventory/movements', token)
}

export function createAdminStockIn(payload: {
  warehouseId: number
  skuId: number
  quantity: number
  unitCost: number
  note?: string
}, token: string) {
  return postJsonWithToken<{ data: { stockInReceiptId: number; receiptCode: string } }>(
    '/api/admin/inventory/stock-in',
    token,
    payload,
  )
}

export function createAdminStockOut(payload: {
  warehouseId: number
  skuId: number
  quantity: number
  reason: string
  note?: string
}, token: string) {
  return postJsonWithToken<{ data: { stockOutReceiptId: number; receiptCode: string } }>(
    '/api/admin/inventory/stock-out',
    token,
    payload,
  )
}

export function getWarehouseReadyOrders(token: string) {
  return getJsonWithToken<{ data: WarehouseReadyOrder[] }>('/api/admin/inventory/ready-orders', token)
}

export function confirmWarehouseOrderExport(orderId: number, token: string) {
  return postJsonWithToken<{
    data: { orderId: number; orderCode: string; receiptIds: number[] }
  }>(`/api/admin/inventory/ready-orders/${orderId}/confirm-export`, token, {})
}

export function getWarehouseDeliveryOptions(token: string) {
  return getJsonWithToken<{
    data: { deliveryStaff: DeliveryStaffOption[]; vehicles: DeliveryVehicle[] }
  }>('/api/warehouse/deliveries/options', token)
}

export function createDeliveryVehicle(payload: {
  vehicleCode: string
  licensePlate: string
  vehicleType: string
  note: string
}, token: string) {
  return postJsonWithToken<{ data: { vehicleId: number } }>('/api/warehouse/deliveries/vehicles', token, payload)
}

export function updateDeliveryVehicleStatus(vehicleId: number, status: DeliveryVehicle['status'], token: string) {
  return patchJsonWithToken<{ data: { vehicleId: number; status: string } }>(
    `/api/warehouse/deliveries/vehicles/${vehicleId}/status`, token, { status },
  )
}

export function assignWarehouseDelivery(orderId: number, payload: {
  deliveryStaffId: number
  vehicleId: number
  estimatedDeliveryAt: string
  note: string
}, token: string) {
  return postJsonWithToken<{ data: { shipmentId: number; orderId: number; orderCode: string } }>(
    `/api/warehouse/deliveries/orders/${orderId}/assign`, token, payload,
  )
}

export function handOverWarehouseDelivery(orderId: number, token: string) {
  return postJsonWithToken<{
    data: { orderId: number; orderCode: string; shipmentId: number; deliveryStaffName: string; vehicleCode: string }
  }>(`/api/warehouse/deliveries/orders/${orderId}/handover`, token, {})
}

export function getWarehousePendingReturns(token: string) {
  return getJsonWithToken<{ data: WarehouseReturnShipment[] }>('/api/warehouse/deliveries/returns', token)
}

export function confirmWarehouseShipmentReturn(shipmentId: number, token: string) {
  return postJsonWithToken<{ data: { shipmentId: number; orderId: number; orderCode: string; receiptCode: string } }>(
    `/api/warehouse/deliveries/shipments/${shipmentId}/confirm-return`, token, {},
  )
}

export function getShipperShipments(token: string) {
  return getJsonWithToken<{ data: ShipperShipment[] }>('/api/shipper/shipments', token)
}

export function completeShipperDelivery(shipmentId: number, token: string) {
  return postJsonWithToken<{ data: { shipmentId: number; orderId: number; orderCode: string; paymentCollected: boolean } }>(
    `/api/shipper/shipments/${shipmentId}/delivered`, token, {},
  )
}

export function failShipperDelivery(shipmentId: number, reason: string, token: string) {
  return postJsonWithToken<{ data: { shipmentId: number; shippingStatus: string } }>(
    `/api/shipper/shipments/${shipmentId}/failed`, token, { reason },
  )
}

export function rescheduleShipperDelivery(shipmentId: number, payload: {
  estimatedDeliveryAt: string
  note: string
}, token: string) {
  return postJsonWithToken<{ data: { shipmentId: number; shippingStatus: string } }>(
    `/api/shipper/shipments/${shipmentId}/reschedule`, token, payload,
  )
}

export function retryShipperDelivery(shipmentId: number, token: string) {
  return postJsonWithToken<{ data: { shipmentId: number; shippingStatus: string } }>(
    `/api/shipper/shipments/${shipmentId}/retry`, token, {},
  )
}

export function requestShipperReturn(shipmentId: number, reason: string, token: string) {
  return postJsonWithToken<{ data: { shipmentId: number; shippingStatus: string } }>(
    `/api/shipper/shipments/${shipmentId}/request-return`, token, { reason },
  )
}

export function getShipperCodAccount(token: string) {
  return getJsonWithToken<{ data: ShipperCodAccount }>('/api/shipper/cod', token)
}

export function createShipperCodRemittance(payload: {
  collectionIds: number[]
  method: CodRemittanceMethod
  referenceCode: string
  note: string
}, token: string) {
  return postJsonWithToken<{
    data: { codRemittanceId: number; remittanceCode: string; declaredAmount: number; status: string }
  }>('/api/shipper/cod/remittances', token, payload)
}

export function cancelShipperCodRemittance(codRemittanceId: number, token: string) {
  return postJsonWithToken<{ data: { codRemittanceId: number; status: string } }>(
    `/api/shipper/cod/remittances/${codRemittanceId}/cancel`, token, {},
  )
}

export function getAdminCodOverview(token: string, filters: {
  deliveryStaffId: string
  status: string
  fromDate: string
  toDate: string
}) {
  const params = new URLSearchParams()
  if (filters.deliveryStaffId) params.set('deliveryStaffId', filters.deliveryStaffId)
  if (filters.status) params.set('status', filters.status)
  if (filters.fromDate) params.set('from', filters.fromDate)
  if (filters.toDate) params.set('to', filters.toDate)
  return getJsonWithToken<{ data: AdminCodOverview }>(
    `/api/admin/cod-remittances?${params.toString()}`, token,
  )
}

export function confirmAdminCodRemittance(codRemittanceId: number, reviewNote: string, token: string) {
  return postJsonWithToken<{ data: { codRemittanceId: number; status: string } }>(
    `/api/admin/cod-remittances/${codRemittanceId}/confirm`, token, { reviewNote },
  )
}

export function rejectAdminCodRemittance(codRemittanceId: number, reviewNote: string, token: string) {
  return postJsonWithToken<{ data: { codRemittanceId: number; status: string } }>(
    `/api/admin/cod-remittances/${codRemittanceId}/reject`, token, { reviewNote },
  )
}

export function getAdminUsers(token: string) {
  return getJsonWithToken<{ data: AdminUser[] }>('/api/admin/users', token)
}

export function getAdminRoles(token: string) {
  return getJsonWithToken<{ data: AdminRole[] }>('/api/admin/users/roles', token)
}

export function createAdminUser(payload: {
  fullName: string
  email: string
  phone: string
  password: string
  roleIds: number[]
  position: string
  department: string
  dateOfBirth: string
  gender: string
  provinceCode: string
  wardCode: string
  streetAddress: string
  hireDate: string
}, token: string) {
  return postJsonWithToken<{ data: { userId: number; employeeCode: string; status: string; approvalStatus: string } }>(
    '/api/admin/users', token, payload,
  )
}

export function saveAdminEmployeeProfile(userId: number, payload: {
  fullName: string
  email: string
  phone: string
  roleIds: number[]
  position: string
  department: string
  dateOfBirth: string
  gender: string
  provinceCode: string
  wardCode: string
  streetAddress: string
  hireDate: string
}, token: string) {
  return putJsonWithToken<{ data: { userId: number; employeeCode: string } }>(
    `/api/admin/users/${userId}/employee-profile`, token, payload,
  )
}

export function reviewAdminEmployee(
  userId: number,
  payload: { action: 'Approved' | 'Rejected'; rejectionReason?: string },
  token: string,
) {
  return patchJsonWithToken<{ data: { userId: number; approvalStatus: string } }>(
    `/api/admin/users/${userId}/approval`, token, payload,
  )
}

export function updateAdminUserRoles(userId: number, roleIds: number[], token: string) {
  return putJsonWithToken<{ data: { userId: number; roleIds: number[] } }>(
    `/api/admin/users/${userId}/roles`,
    token,
    { roleIds },
  )
}

export function updateAdminUserStatus(userId: number, status: string, token: string) {
  return patchJsonWithToken<{ data: { userId: number; status: string } }>(
    `/api/admin/users/${userId}/status`,
    token,
    { status },
  )
}

export function getCustomerProfile(token: string) {
  return getJsonWithToken<{ data: CustomerProfile }>('/api/profile', token)
}

export function updateCustomerProfile(payload: {
  fullName: string
  email: string
  dateOfBirth: string
  gender: string
}, token: string) {
  return putJsonWithToken<{ data: { userId: number; fullName: string; email: string | null } }>(
    '/api/profile', token, payload,
  )
}

export function changeCustomerPassword(payload: {
  currentPassword: string
  newPassword: string
}, token: string) {
  return putJsonWithToken<{ data: { changed: boolean } }>('/api/profile/password', token, payload)
}

export function getCustomerAddresses(token: string) {
  return getJsonWithToken<{ data: CustomerAddress[] }>('/api/profile/addresses', token)
}

export function createCustomerAddress(payload: CustomerAddressPayload, token: string) {
  return postJsonWithToken<{ data: { addressId: number } }>('/api/profile/addresses', token, payload)
}

export function updateCustomerAddress(addressId: number, payload: CustomerAddressPayload, token: string) {
  return putJsonWithToken<{ data: { addressId: number } }>(`/api/profile/addresses/${addressId}`, token, payload)
}

export function deleteCustomerAddress(addressId: number, token: string) {
  return fetch(`/api/profile/addresses/${addressId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  }).then(async (response) => {
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      throw new Error(payload?.message ?? `Request failed: ${response.status}`)
    }
    return response.json() as Promise<{ data: { addressId: number } }>
  })
}

export function getCustomerOrders(token: string) {
  return getJsonWithToken<{ data: CustomerOrder[] }>('/api/profile/orders', token)
}

export function getCustomerOrder(orderId: number, token: string) {
  return getJsonWithToken<{ data: CustomerOrderDetail }>(`/api/profile/orders/${orderId}`, token)
}

export function submitCustomerReview(payload: { orderDetailId: number; rating: number; comment: string }, token: string) {
  return fetch('/api/profile/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  }).then(async (response) => {
    if (!response.ok) {
      const data = await response.json().catch(() => null)
      throw new Error((data as { message?: string } | null)?.message ?? `Request failed: ${response.status}`)
    }
    return response.json() as Promise<{ data: { reviewId: number; status: string } }>
  })
}

export function getMyReviewedItems(token: string) {
  return getJsonWithToken<{ data: number[] }>('/api/profile/reviews/my', token)
}

export function submitCustomerReturnRequest(
  payload: {
    orderId: number
    reason: string
    note?: string
    evidenceUrl: string
    bankName: string
    bankAccountNumber: string
    bankAccountName: string
  },
  token: string
) {
  return postJsonWithToken<{ data: { returnRequestId: number; status: string } }>(
    '/api/profile/returns',
    token,
    payload
  )
}

export function getMyReturnRequests(token: string) {
  return getJsonWithToken<{ data: OrderReturnRequest[] }>('/api/profile/returns', token)
}

export function getAdminReturnRequests(token: string) {
  return getJsonWithToken<{ data: AdminReturnRequest[] }>('/api/admin/returns', token)
}

export function updateAdminReturnRequestStatus(
  returnRequestId: number,
  payload: {
    status: string
    refundStatus?: string
    refundAmount?: number | null
    deliveryStaffId?: number | null
    adminNote?: string
  },
  token: string
) {
  return patchJsonWithToken<{ data: { returnRequestId: number; status: string; adminNote: string } }>(
    `/api/admin/returns/${returnRequestId}/status`,
    token,
    payload
  )
}

export function confirmWarehouseReturnStockIn(returnRequestId: number, token: string) {
  return patchJsonWithToken<{ data: { returnRequestId: number; warehouseConfirmedAt: string } }>(
    `/api/admin/returns/${returnRequestId}/warehouse-confirm`,
    token,
    {}
  )
}

export function getShipperReturnPickups(token: string) {
  return getJsonWithToken<{ data: ShipperReturnPickup[] }>('/api/shipper/returns', token)
}

export function confirmShipperReturnPickup(returnRequestId: number, token: string) {
  return postJsonWithToken<{ data: { returnRequestId: number } }>(
    `/api/shipper/returns/${returnRequestId}/confirm`,
    token,
    {}
  )
}

export function getProvinces() {
  return getJson<{ data: AdministrativeProvince[] }>('/api/locations/provinces')
}

export function getWards(provinceCode: string) {
  return getJson<{ data: AdministrativeWard[] }>(`/api/locations/wards?provinceCode=${encodeURIComponent(provinceCode)}`)
}

