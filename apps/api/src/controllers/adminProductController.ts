import type { NextFunction, Request, Response } from 'express'
import {
  addAdminProductImage,
  createAdminProduct,
  deleteAdminProductImage,
  getAdminProductImages,
  getAdminProducts,
  setAdminProductPrimaryImage,
  updateAdminProduct,
  updateAdminProductStatus,
  type AdminProductInput,
} from '../services/adminProductService.js'
import {
  indexProductImages,
  removeProductImagesFromIndex,
} from '../services/imageSearchService.js'
import { indexProduct, removeProductFromIndex } from '../services/ragIndexService.js'

async function syncProductIndex(productId: number, isActive = true) {
  try {
    if (isActive) await indexProduct(productId)
    else await removeProductFromIndex(productId)
    return true
  } catch (error) {
    console.error(`Could not synchronize product ${productId} to the RAG index.`, error)
    return false
  }
}

async function syncProductImageIndex(productId: number, isActive = true) {
  try {
    if (isActive) await indexProductImages(productId)
    else await removeProductImagesFromIndex(productId)
    return true
  } catch (error) {
    console.error(`Could not synchronize product ${productId} to the image index.`, error)
    return false
  }
}

function readText(value: unknown) {
  return String(value ?? '').trim()
}

function readProductInput(request: Request): AdminProductInput {
  const costPrice = request.body.costPrice === '' || request.body.costPrice === undefined
    ? null
    : Number(request.body.costPrice)

  return {
    productName: readText(request.body.productName),
    categoryId: Number(request.body.categoryId),
    brandId: Number(request.body.brandId),
    description: readText(request.body.description),
    highlights: readText(request.body.highlights),
    basePrice: Number(request.body.basePrice),
    warrantyMonths: Number(request.body.warrantyMonths ?? 12),
    installRequired: Boolean(request.body.installRequired),
    skuId: Number(request.body.skuId) || undefined,
    skuCode: readText(request.body.skuCode),
    price: Number(request.body.price),
    costPrice,
    imageUrl: readText(request.body.imageUrl),
  }
}

function isValidProductInput(input: AdminProductInput) {
  return Boolean(
    input.productName
      && input.categoryId > 0
      && input.brandId > 0
      && input.basePrice > 0
      && input.skuCode
      && input.price > 0,
  )
}

export async function listAdminProducts(_request: Request, response: Response, next: NextFunction) {
  try {
    response.json({ data: await getAdminProducts() })
  } catch (error) {
    next(error)
  }
}

export async function createProduct(request: Request, response: Response, next: NextFunction) {
  const input = readProductInput(request)
  if (!isValidProductInput(input)) {
    response.status(400).json({ message: 'Vui lòng nhập đủ tên, danh mục, thương hiệu, giá và mã SKU.' })
    return
  }

  try {
    const data = await createAdminProduct(input)
    const [ragIndexed, imageRagIndexed] = await Promise.all([
      syncProductIndex(data.productId),
      syncProductImageIndex(data.productId),
    ])
    response.status(201).json({ data: { ...data, ragIndexed, imageRagIndexed } })
  } catch (error) {
    next(error)
  }
}

export async function updateProduct(request: Request, response: Response, next: NextFunction) {
  const productId = Number(request.params.productId)
  const input = readProductInput(request)

  if (!productId || !isValidProductInput(input)) {
    response.status(400).json({ message: 'Dữ liệu sản phẩm không hợp lệ.' })
    return
  }

  try {
    const data = await updateAdminProduct(productId, input)
    const [ragIndexed, imageRagIndexed] = await Promise.all([
      syncProductIndex(productId),
      syncProductImageIndex(productId),
    ])
    response.json({ data: { ...data, ragIndexed, imageRagIndexed } })
  } catch (error) {
    next(error)
  }
}

export async function listProductImages(request: Request, response: Response, next: NextFunction) {
  try {
    response.json({ data: await getAdminProductImages(Number(request.params.productId)) })
  } catch (error) {
    next(error)
  }
}

export async function addProductImage(request: Request, response: Response, next: NextFunction) {
  const productId = Number(request.params.productId)
  const imageUrl = readText(request.body.imageUrl)
  const altText = readText(request.body.altText)

  if (!productId || !imageUrl) {
    response.status(400).json({ message: 'Vui lòng nhập URL ảnh.' })
    return
  }

  try {
    const data = await addAdminProductImage(productId, imageUrl, altText)
    const imageRagIndexed = await syncProductImageIndex(productId)
    response.status(201).json({ data: { ...data, imageRagIndexed } })
  } catch (error) {
    next(error)
  }
}

export async function setPrimaryImage(request: Request, response: Response, next: NextFunction) {
  try {
    response.json({
      data: await setAdminProductPrimaryImage(Number(request.params.productId), Number(request.params.imageId)),
    })
  } catch (error) {
    next(error)
  }
}

export async function deleteProductImage(request: Request, response: Response, next: NextFunction) {
  try {
    const productId = Number(request.params.productId)
    response.json({
      data: {
        ...await deleteAdminProductImage(productId, Number(request.params.imageId)),
        imageRagIndexed: await syncProductImageIndex(productId),
      },
    })
  } catch (error) {
    next(error)
  }
}

export async function changeProductStatus(request: Request, response: Response, next: NextFunction) {
  const productId = Number(request.params.productId)
  const status = readText(request.body.status)

  if (!productId || !['Active', 'Inactive'].includes(status)) {
    response.status(400).json({ message: 'Trạng thái sản phẩm không hợp lệ.' })
    return
  }

  try {
    const data = await updateAdminProductStatus(productId, status)
    const [ragIndexed, imageRagIndexed] = await Promise.all([
      syncProductIndex(productId, status === 'Active'),
      syncProductImageIndex(productId, status === 'Active'),
    ])
    response.json({ data: { ...data, ragIndexed, imageRagIndexed } })
  } catch (error) {
    next(error)
  }
}
