export type ProductSku = {
  id: number
  skuId: number
  skuCode: string
  variantName: string
  price: number
  originalPrice?: number
  costPrice: number | null
  finalPrice?: number
  availableQuantity: number
  promotionId?: number | null
  promotionName?: string | null
  promotionDiscountType?: string | null
  promotionDiscountValue?: number | null
}

export type Product = {
  id: number
  name: string
  slug: string
  description: string | null
  highlights?: string | null
  basePrice: number
  categoryName: string
  categorySlug: string
  brandName: string
  imageUrl: string | null
  skuId: number | null
  skuCode: string | null
  price: number | null
  originalPrice?: number | null
  finalPrice?: number | null
  promotionId?: number | null
  promotionName?: string | null
  promotionDiscountType?: string | null
  promotionDiscountValue?: number | null
  warrantyMonths: number
  installRequired: boolean
  availableQuantity: number
  images?: ProductImage[]
  attributes?: ProductAttribute[]
  reviewSummary?: ProductReviewSummary
  reviews?: ProductReview[]
  skus?: ProductSku[]
  
  aiScore?: number
  keywordScore?: number | null
  semanticScore?: number | null
  imageScore?: number | null
  aiReason?: string
}

export type ProductImage = {
  imageId: number
  imageUrl: string
  altText: string | null
  isPrimary: boolean
  sortOrder: number
}

export type ProductAttribute = {
  attributeId: number
  name: string
  dataType: string
  unit: string | null
  value: string | null
}

export type ProductReviewSummary = {
  reviewCount: number
  averageRating: number
}

export type ProductReview = {
  reviewId: number
  parentReviewId: number | null
  rating: number
  comment: string | null
  createdAt: string
  reviewerName: string
  replies?: ProductReview[]
}

export type AdminReview = {
  reviewId: number
  parentReviewId: number | null
  productId: number
  productName: string
  productSlug: string
  reviewerName: string
  rating: number
  comment: string | null
  status: 'Pending' | 'Approved' | 'Hidden' | 'Rejected'
  createdAt: string
}

export type Category = {
  id: number
  name: string
  slug: string
  productCount: number
}

export type Brand = {
  id: number
  name: string
  country: string | null
  productCount: number
}

export type ProductFilters = {
  search: string
  category: string
  brand: string
  minPrice: string
  maxPrice: string
  page: number
}

export type ProductListResponse = {
  data: Product[]
  total: number
  page: number
  pageSize: number
}

export type AiChatResponse = {
  data: {
    decision: 'recommend' | 'need_clarification' | 'no_match' | 'out_of_scope'
    answer: string
    productIds: number[]
    products: Array<{ slug: string }>
    quota: AiQuota
  }
}

export type AiImageSearchResponse = {
  data: {
    decision: 'exact_match' | 'similar_matches' | 'need_clarification' | 'no_match'
    observed: {
      category: string
      brand: string
      modelText: string
      color: string
      visibleFeatures: string[]
    }
    answer: string
    clarifyingQuestion: string
    uncertaintyReasons: string[]
    productIds: number[]
    products: Array<{ productId: number; slug: string }>
    quota: AiQuota
  }
}

export type AiQuota = {
  limit: number | null
  remaining: number | null
  unlimited: boolean
}

export type CartItem = {
  skuId: number
  skuCode: string
  productSlug: string
  productName: string
  brandName: string
  categoryName: string
  imageUrl: string | null
  price: number
  originalPrice?: number | null
  promotionName?: string | null
  availableQuantity: number
  quantity: number
}

export type CheckoutPayload = {
  customerName: string
  phone: string
  email?: string
  province: string
  district: string
  ward: string
  streetAddress: string
  note?: string
  couponCode?: string
  paymentMethodId: number
  items: Array<{
    skuId: number
    quantity: number
  }>
}

export type OrderResponse = {
  data: {
    orderId: number
    orderCode: string
    totalAmount: number
    paymentMethodCode: string
    paymentMethodName: string
    paymentStatusCode: string
    orderStatusCode: string
    paymentInstruction: string
  }
}

export type PaymentMethod = {
  paymentMethodId: number
  methodCode: string
  methodName: string
  status: string
}

export type AuthUser = {
  userId: number
  fullName: string
  email: string | null
  phone: string | null
  roles: string[]
}

export type AuthResponse = {
  data: {
    user: AuthUser
    token: string
  }
}

export type AdminOrder = {
  orderId: number
  orderCode: string
  receiverName: string
  receiverPhone: string
  totalAmount: number
  createdAt: string
  orderStatusId: number
  orderStatusCode: string
  orderStatusName: string
  paymentStatusId: number
  paymentStatusCode: string
  paymentStatusName: string
}

export type AdminOrderDetail = {
  order: AdminOrder & {
    shippingAddress: string
    subtotalAmount: number
    discountAmount: number
    shippingFee: number
    note: string | null
    paymentMethodName: string | null
    paymentMethodCode: string | null
  }
  availableTransitions: OrderStatusOption[]
  items: Array<{
    orderDetailId: number
    skuId: number
    productName: string
    skuCode: string
    unitPrice: number
    quantity: number
    discountAmount: number
    lineTotal: number
    warrantyMonths: number
  }>
}

export type OrderStatusOption = {
  id: number
  code: string
  name: string
}

export type AdminDashboard = {
  summary: {
    totalOrders: number
    pendingOrders: number
    todayRevenue: number
    todayCostOfGoodsSold: number
    todayGrossProfit: number
    monthRevenue: number
    monthCostOfGoodsSold: number
    monthGrossProfit: number
    lowStockCount: number
  }
  recentOrders: Array<{
    orderId: number
    orderCode: string
    receiverName: string
    totalAmount: number
    createdAt: string
    orderStatusName: string
  }>
  salesByDay: Array<{
    reportDate: string
    revenue: number
    grossProfit: number
    orderCount: number
  }>
  topProducts: Array<{
    productName: string
    quantitySold: number
    revenue: number
  }>
}

export type AdminReports = {
  range: {
    fromDate: string
    toDate: string
  }
  summary: {
    totalOrders: number
    grossRevenue: number
    paidRevenue: number
    shippingFee: number
    averageOrderValue: number
    cancelledOrders: number
    fulfilledRevenue: number
    costOfGoodsSold: number
    grossProfit: number
    grossMarginPercentage: number
  }
  salesByDay: Array<{
    reportDate: string
    orderCount: number
    revenue: number
    fulfilledRevenue: number
    costOfGoodsSold: number
    grossProfit: number
  }>
  topProducts: Array<{
    skuId: number
    skuCode: string
    productName: string
    quantitySold: number
    revenue: number
  }>
  topCustomers: Array<{
    customerId: number
    customerName: string
    phone: string | null
    email: string | null
    orderCount: number
    totalSpent: number
  }>
  orderStatuses: Array<{
    statusCode: string
    statusName: string
    orderCount: number
  }>
  lowStock: Array<{
    inventoryId: number
    skuId: number
    skuCode: string
    productName: string
    quantityOnHand: number
    quantityReserved: number
    availableQuantity: number
    reorderLevel: number
  }>
}

export type AdminProduct = {
  productId: number
  productName: string
  slug: string
  description: string | null
  highlights: string | null
  basePrice: number
  warrantyMonths: number
  installRequired: boolean
  status: string
  categoryId: number
  categoryName: string
  brandId: number
  brandName: string
  skuId: number | null
  skuCode: string | null
  price: number | null
  costPrice: number | null
  skuStatus: string | null
  imageUrl: string | null
  availableQuantity: number
}

export type AdminVariantPayload = {
  skuId?: number | null
  skuCode: string
  variantName: string
  price: number
  costPrice: number | null
}

export type AdminProductPayload = {
  productName: string
  categoryId: number
  brandId: number
  description: string
  highlights: string
  basePrice: number
  warrantyMonths: number
  installRequired: boolean
  skuId?: number | null
  skuCode: string
  price: number
  costPrice?: number | null
  imageUrl?: string
  variants?: AdminVariantPayload[]
}

export type AdminProductImage = ProductImage

export type AdminPromotion = {
  promotionId: number
  promotionName: string
  discountType: 'Percent' | 'FixedAmount' | 'FixedPrice'
  discountValue: number
  startAt: string
  endAt: string
  status: 'Active' | 'Inactive' | 'Expired'
  skuCount: number
  skuIds: string | null
  skuCodes: string | null
}

export type AdminPromotionPayload = {
  promotionName: string
  discountType: 'Percent' | 'FixedAmount' | 'FixedPrice'
  discountValue: number
  startAt: string
  endAt: string
  status: 'Active' | 'Inactive' | 'Expired'
  skuIds: number[]
}

export type AdminPromotionSkuOption = {
  skuId: number
  skuCode: string
  price: number
  productName: string
  categoryName: string
  brandName: string
}

export type AdminWarehouse = {
  warehouseId: number
  warehouseName: string
  address: string | null
  status: string
}

export type AdminInventoryItem = {
  inventoryId: number
  warehouseId: number
  warehouseName: string
  skuId: number
  skuCode: string
  productName: string
  categoryName: string
  brandName: string
  quantityOnHand: number
  quantityReserved: number
  availableQuantity: number
  reorderLevel: number
  averageUnitCost: number
  updatedAt: string
}

export type AdminStockableSku = {
  skuId: number
  skuCode: string
  productName: string
}

export type AdminStockMovement = {
  stockMovementId: number
  warehouseId: number
  warehouseName: string
  skuId: number
  skuCode: string
  productName: string
  movementType: string
  quantityChange: number
  unitCost: number | null
  sourceType: string
  adjustmentNote: string | null
  createdAt: string
  createdBy: string
}

export type AdminUser = {
  userId: number
  fullName: string
  email: string | null
  phone: string | null
  status: 'Pending' | 'Active' | 'Locked' | 'Disabled'
  createdAt: string
  updatedAt: string | null
  roles: string[]
  employeeProfile: AdminEmployeeProfile | null
}

export type EmployeeGender = 'Male' | 'Female' | 'Other'

export type EmployeeApprovalStatus = 'Pending' | 'Approved' | 'Rejected'

export type AdminEmployeeProfile = {
  employeeId: number
  employeeCode: string
  position: string
  department: string
  dateOfBirth: string
  gender: EmployeeGender
  provinceCode: string
  provinceName: string
  wardCode: string
  wardName: string
  streetAddress: string
  hireDate: string
  approvalStatus: EmployeeApprovalStatus
  createdByUserId: number | null
  createdByName: string | null
  approvedByUserId: number | null
  approvedByName: string | null
  approvedAt: string | null
  rejectionReason: string | null
  createdAt: string
  updatedAt: string | null
}

export type AdminEmployeePayload = {
  fullName: string
  email: string
  phone: string
  roleIds: number[]
  position: string
  department: string
  dateOfBirth: string
  gender: EmployeeGender | ''
  provinceCode: string
  wardCode: string
  streetAddress: string
  hireDate: string
}

export type AdminRole = {
  roleId: number
  roleCode: string
  roleName: string
  description: string | null
  permissions: string | null
}

export type WarehouseReadyOrder = {
  orderId: number
  orderCode: string
  receiverName: string
  receiverPhone: string
  shippingAddress: string
  readyAt: string
  shipmentId: number | null
  shipmentStatus: string | null
  deliveryStaffId: number | null
  deliveryStaffName: string | null
  vehicleId: number | null
  vehicleCode: string | null
  licensePlate: string | null
  estimatedDeliveryAt: string | null
  items: Array<{
    orderDetailId: number
    skuId: number
    skuCode: string
    productName: string
    quantity: number
    warehouseId: number
    warehouseName: string
    quantityWaiting: number
  }>
}

export type DeliveryStaffOption = {
  userId: number
  fullName: string
  phone: string | null
}

export type DeliveryVehicle = {
  vehicleId: number
  vehicleCode: string
  licensePlate: string | null
  vehicleType: string
  status: 'Active' | 'Maintenance' | 'Inactive'
  note: string | null
  createdAt: string
  updatedAt: string | null
}

export type WarehouseReturnShipment = {
  shipmentId: number
  trackingCode: string
  requestedAt: string
  returnReason: string | null
  orderId: number
  orderCode: string
  receiverName: string
  deliveryStaffName: string | null
  vehicleCode: string | null
  licensePlate: string | null
  warehouseName: string
  items: Array<{
    orderDetailId: number
    productName: string
    skuCode: string
    quantity: number
  }>
}

export type ShipperShipmentStatus =
  | 'Pending'
  | 'Picking'
  | 'Shipping'
  | 'Delivered'
  | 'Failed'
  | 'Rescheduled'
  | 'ReturnPending'
  | 'Cancelled'

export type ShipperShipment = {
  shipmentId: number
  trackingCode: string
  shippingStatus: ShipperShipmentStatus
  estimatedDeliveryAt: string | null
  assignedAt: string | null
  handedOverAt: string | null
  deliveredAt: string | null
  note: string | null
  deliveryStaffId: number | null
  deliveryStaffName: string | null
  vehicleId: number | null
  vehicleCode: string | null
  licensePlate: string | null
  vehicleType: string | null
  warehouseName: string
  warehouseAddress: string | null
  orderId: number
  orderCode: string
  receiverName: string
  receiverPhone: string
  shippingAddress: string
  totalAmount: number
  orderStatusCode: string
  paymentMethodCode: string
  paymentMethodName: string
  paymentStatusCode: string
  codAmount: number
  items: Array<{
    orderDetailId: number
    productName: string
    skuCode: string
    quantity: number
  }>
}

export type CodCollectionStatus =
  | 'Outstanding'
  | 'AwaitingConfirmation'
  | 'PartiallyRemitted'
  | 'Settled'

export type CodRemittanceStatus = 'Submitted' | 'Confirmed' | 'Rejected' | 'Cancelled'
export type CodRemittanceMethod = 'Cash' | 'BankTransfer'

export type CodCollection = {
  codCollectionId: number
  paymentId: number
  shipmentId: number
  orderId: number
  deliveryStaffId: number
  deliveryStaffName: string
  orderCode: string
  collectedAmount: number
  collectedAt: string
  storedStatus: 'Outstanding' | 'PartiallyRemitted' | 'Settled'
  remittedAmount: number
  pendingAmount: number
  outstandingAmount: number
  availableToSubmit: number
  status: CodCollectionStatus
}

export type CodRemittance = {
  codRemittanceId: number
  remittanceCode: string
  deliveryStaffId: number
  deliveryStaffName?: string
  declaredAmount: number
  method: CodRemittanceMethod
  status: CodRemittanceStatus
  submittedAt: string
  reviewedAt: string | null
  referenceCode: string | null
  note: string | null
  reviewNote: string | null
  reviewedByName: string | null
  itemCount: number
  orderCodes: string | null
}

export type ShipperCodAccount = {
  summary: {
    totalCollected: number
    collectedToday: number
    totalRemitted: number
    pendingConfirmation: number
    outstandingAmount: number
    availableToSubmit: number
  }
  collections: CodCollection[]
  remittances: CodRemittance[]
}

export type AdminCodOverview = {
  summary: {
    totalCollected: number
    totalRemitted: number
    pendingConfirmation: number
    outstandingAmount: number
  }
  shipperBalances: Array<{
    deliveryStaffId: number
    deliveryStaffName: string
    phone: string | null
    collectionCount: number
    collectedAmount: number
    remittedAmount: number
    pendingAmount: number
    outstandingAmount: number
  }>
  collections: CodCollection[]
  remittances: CodRemittance[]
  deliveryStaff: Array<{ userId: number; fullName: string }>
}

export type CustomerProfile = {
  userId: number
  fullName: string
  email: string | null
  phone: string | null
  createdAt: string
  dateOfBirth: string | null
  gender: string | null
  loyaltyPoint: number
}

export type CustomerAddress = {
  addressId: number
  receiverName: string
  receiverPhone: string
  province: string
  provinceCode?: string | null
  district: string
  ward: string
  wardCode?: string | null
  streetAddress: string
  isDefault: boolean
  createdAt: string
}

export type CustomerAddressPayload = Omit<CustomerAddress, 'addressId' | 'createdAt'>

export type AdministrativeProvince = {
  provinceCode: string
  provinceName: string
}

export type AdministrativeWard = {
  wardCode: string
  provinceCode: string
  wardName: string
}

export type CustomerOrder = {
  orderId: number
  orderCode: string
  totalAmount: number
  createdAt: string
  receiverName: string
  shippingAddress: string
  orderStatusCode: string
  orderStatusName: string
  paymentStatusName: string
  itemCount: number
  totalQuantity: number
}

export type CustomerOrderDetail = {
  order: CustomerOrder & {
    subtotalAmount: number
    discountAmount: number
    shippingFee: number
    receiverPhone: string
    note: string | null
  }
  items: Array<{
    orderDetailId: number
    skuId: number
    productName: string
    skuCode: string
    unitPrice: number
    quantity: number
    discountAmount: number
    lineTotal: number
    imageUrl: string | null
    productSlug: string
    hasReview: boolean
  }>
}
