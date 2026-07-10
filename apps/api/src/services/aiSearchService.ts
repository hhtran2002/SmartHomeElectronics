import { getPool, sql } from '../config/database.js'

type AiSearchProduct = {
  id: number
  name: string
  slug: string
  description: string | null
  basePrice: number
  warrantyMonths: number
  installRequired: boolean
  status: string
  categoryName: string
  categorySlug: string
  brandName: string
  imageUrl: string | null
  skuId: number | null
  skuCode: string | null
  price: number | null
  originalPrice: number | null
  finalPrice: number | null
  availableQuantity: number
  searchText: string
  imageUrls: string[]
}

type AiScore = {
  productId: number
  score: number
  keywordScore?: number | null
  semanticScore?: number | null
  imageScore?: number | null
  reason: string
}

type AiSearchFilters = {
  category?: string
  brand?: string
  minPrice?: number | null
  maxPrice?: number | null
  limit?: number
}

const aiServiceUrl = process.env.AI_SERVICE_URL ?? 'http://127.0.0.1:8001'

function toNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

async function fetchJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`AI service error: ${response.status}`)
  }

  return response.json() as Promise<T>
}

export async function loadProductsForAiSearch(filters: AiSearchFilters = {}) {
  const pool = await getPool()

  const productResult = await pool
    .request()
    .input('category', sql.VarChar(200), filters.category ?? '')
    .input('brand', sql.NVarChar(150), filters.brand ?? '')
    .input('minPrice', sql.Decimal(18, 2), Number.isFinite(filters.minPrice) ? filters.minPrice : null)
    .input('maxPrice', sql.Decimal(18, 2), Number.isFinite(filters.maxPrice) ? filters.maxPrice : null)
    .query(`
      WITH ProductList AS (
        SELECT
          p.ProductId AS id,
          p.ProductName AS name,
          p.Slug AS slug,
          p.Description AS description,
          p.BasePrice AS basePrice,
          p.WarrantyMonths AS warrantyMonths,
          p.InstallRequired AS installRequired,
          p.Status AS status,
          c.CategoryName AS categoryName,
          c.Slug AS categorySlug,
          b.BrandName AS brandName,
          image.ImageUrl AS imageUrl,
          sku.SkuId AS skuId,
          sku.SkuCode AS skuCode,
          sku.Price AS price,
          sku.Price AS originalPrice,
          promotion.PromotionId AS promotionId,
          promotion.DiscountType AS promotionDiscountType,
          promotion.DiscountValue AS promotionDiscountValue,
          CASE
            WHEN promotion.PromotionId IS NULL THEN sku.Price
            WHEN promotion.DiscountType = 'Percent' THEN
              CASE WHEN sku.Price - (sku.Price * promotion.DiscountValue / 100) < 0 THEN 0 ELSE sku.Price - (sku.Price * promotion.DiscountValue / 100) END
            WHEN promotion.DiscountType = 'FixedAmount' THEN
              CASE WHEN sku.Price - promotion.DiscountValue < 0 THEN 0 ELSE sku.Price - promotion.DiscountValue END
            WHEN promotion.DiscountType = 'FixedPrice' THEN
              CASE WHEN promotion.DiscountValue < 0 THEN sku.Price ELSE promotion.DiscountValue END
            ELSE sku.Price
          END AS finalPrice,
          ISNULL(inventory.QuantityOnHand, 0) AS availableQuantity
        FROM dbo.Product p
        INNER JOIN dbo.Category c ON c.CategoryId = p.CategoryId
        INNER JOIN dbo.Brand b ON b.BrandId = p.BrandId

        OUTER APPLY (
          SELECT TOP (1) pi.ImageUrl
          FROM dbo.ProductImage pi
          WHERE pi.ProductId = p.ProductId
          ORDER BY pi.IsPrimary DESC, pi.SortOrder, pi.ImageId
        ) image

        OUTER APPLY (
          SELECT TOP (1) ps.SkuId, ps.SkuCode, ps.Price
          FROM dbo.ProductSku ps
          WHERE ps.ProductId = p.ProductId AND ps.Status = 'Active'
          ORDER BY ps.Price, ps.SkuId
        ) sku

        OUTER APPLY (
          SELECT SUM(i.QuantityOnHand - i.QuantityReserved) AS QuantityOnHand
          FROM dbo.Inventory i
          WHERE i.SkuId = sku.SkuId
        ) inventory

        OUTER APPLY (
          SELECT TOP (1)
            promo.PromotionId,
            promo.DiscountType,
            promo.DiscountValue
          FROM dbo.Promotion promo
          WHERE promo.Status = 'Active'
            AND promo.StartAt <= SYSDATETIME()
            AND promo.EndAt > SYSDATETIME()
            AND (
              EXISTS (
                SELECT 1
                FROM dbo.PromotionSku psPromo
                WHERE psPromo.PromotionId = promo.PromotionId
                  AND psPromo.SkuId = sku.SkuId
              )
              OR EXISTS (
                SELECT 1
                FROM dbo.PromotionProduct pp
                WHERE pp.PromotionId = promo.PromotionId
                  AND pp.ProductId = p.ProductId
              )
            )
        ) promotion

        WHERE p.Status = 'Active'
          AND (@category = '' OR c.Slug = @category)
          AND (@brand = N'' OR b.BrandName = @brand)
      )

      SELECT *
      FROM ProductList
      WHERE (@minPrice IS NULL OR finalPrice >= @minPrice)
        AND (@maxPrice IS NULL OR finalPrice <= @maxPrice)
      ORDER BY id DESC
    `)

  const attributeResult = await pool.request().query(`
    SELECT
      pav.ProductId AS productId,
      ca.AttributeName AS attributeName,
      ca.Unit AS unit,
      COALESCE(
        pav.ValueText,
        CONVERT(NVARCHAR(100), pav.ValueNumber),
        CASE
          WHEN pav.ValueBoolean = 1 THEN N'Có'
          WHEN pav.ValueBoolean = 0 THEN N'Không'
          ELSE NULL
        END
      ) AS attributeValue
    FROM dbo.ProductAttributeValue pav
    INNER JOIN dbo.CategoryAttribute ca ON ca.AttributeId = pav.AttributeId
  `)

  const imageResult = await pool.request().query(`
    SELECT ProductId AS productId, ImageUrl AS imageUrl
    FROM dbo.ProductImage
    WHERE ImageUrl IS NOT NULL AND ImageUrl <> ''
    ORDER BY IsPrimary DESC, SortOrder, ImageId
  `)

  const attrMap = new Map<number, string[]>()

  for (const row of attributeResult.recordset) {
    const productId = Number(row.productId)
    const parts = [row.attributeName, row.attributeValue, row.unit].filter(Boolean).join(' ')
    attrMap.set(productId, [...(attrMap.get(productId) ?? []), parts])
  }

  const imageMap = new Map<number, string[]>()

  for (const row of imageResult.recordset) {
    const productId = Number(row.productId)
    imageMap.set(productId, [...(imageMap.get(productId) ?? []), String(row.imageUrl)])
  }

  return productResult.recordset.map((row) => {
    const productId = Number(row.id)
    const attributes = attrMap.get(productId) ?? []
    const imageUrls = imageMap.get(productId) ?? []
    const primaryImage = row.imageUrl ? String(row.imageUrl) : null

    const product: AiSearchProduct = {
      id: productId,
      name: String(row.name ?? ''),
      slug: String(row.slug ?? ''),
      description: row.description ?? null,
      basePrice: Number(row.basePrice ?? 0),
      warrantyMonths: Number(row.warrantyMonths ?? 0),
      installRequired: Boolean(row.installRequired),
      status: String(row.status ?? 'Active'),
      categoryName: String(row.categoryName ?? ''),
      categorySlug: String(row.categorySlug ?? ''),
      brandName: String(row.brandName ?? ''),
      imageUrl: primaryImage,
      skuId: toNumber(row.skuId),
      skuCode: row.skuCode ? String(row.skuCode) : null,
      price: toNumber(row.price),
      originalPrice: toNumber(row.originalPrice),
      finalPrice: toNumber(row.finalPrice),
      availableQuantity: Number(row.availableQuantity ?? 0),
      searchText: [row.name, row.description, row.categoryName, row.brandName, ...attributes].filter(Boolean).join(' '),
      imageUrls,
    }

    return product
  })
}

function mergeAiScores(products: AiSearchProduct[], scores: AiScore[]) {
  const productMap = new Map(products.map((product) => [product.id, product]))

  return scores
    .map((score) => {
      const product = productMap.get(Number(score.productId))

      if (!product) return null

      return {
        ...product,
        aiScore: score.score,
        keywordScore: score.keywordScore ?? null,
        semanticScore: score.semanticScore ?? null,
        imageScore: score.imageScore ?? null,
        aiReason: score.reason,
      }
    })
    .filter((product) => product !== null)
}

export async function semanticAiSearch(query: string, filters: AiSearchFilters = {}) {
  const products = await loadProductsForAiSearch(filters)
  const limit = filters.limit ?? 12

  const aiPayload = {
    query,
    limit,
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      brandName: product.brandName,
      categoryName: product.categoryName,
      description: product.description,
      searchText: product.searchText,
      imageUrls: product.imageUrls,
    })),
  }

  const aiResult = await fetchJson<{ data: AiScore[] }>(`${aiServiceUrl}/semantic`, aiPayload)

  return mergeAiScores(products, aiResult.data)
}

export async function imageAiSearch(imageBase64: string, filters: AiSearchFilters = {}) {
  const products = await loadProductsForAiSearch(filters)
  const limit = filters.limit ?? 12

  const aiPayload = {
    imageBase64,
    limit,
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      brandName: product.brandName,
      categoryName: product.categoryName,
      description: product.description,
      searchText: product.searchText,
      imageUrls: product.imageUrls,
    })),
  }

  const aiResult = await fetchJson<{ data: AiScore[] }>(`${aiServiceUrl}/image`, aiPayload)

  return mergeAiScores(products, aiResult.data)
}