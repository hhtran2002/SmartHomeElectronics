import { QdrantClient } from '@qdrant/js-client-rest'
import { getPool, sql } from '../config/database.js'

const collectionName = 'products'

function getQdrantClient(): QdrantClient | null {
  const url = process.env.QDRANT_URL?.trim()
  const apiKey = process.env.QDRANT_API_KEY?.trim()
  if (!url) return null
  return new QdrantClient({ url, apiKey })
}

export type RecommendedProduct = {
  id: number
  productId: number
  name: string
  slug: string
  basePrice: number
  price: number | null
  originalPrice?: number | null
  finalPrice?: number | null
  categoryName: string
  categorySlug: string
  brandName: string
  imageUrl: string | null
  availableQuantity: number
  warrantyMonths: number
  installRequired: boolean
  similarityScore?: number
}

async function loadProductsByIds(productIds: number[]): Promise<RecommendedProduct[]> {
  if (productIds.length === 0) return []
  const pool = await getPool()
  const idList = productIds.join(',')

  const result = await pool.request().query(`
    SELECT
      p.ProductId AS id,
      p.ProductId AS productId,
      p.ProductName AS name,
      p.Slug AS slug,
      p.BasePrice AS basePrice,
      p.WarrantyMonths AS warrantyMonths,
      p.InstallRequired AS installRequired,
      c.CategoryName AS categoryName,
      c.Slug AS categorySlug,
      b.BrandName AS brandName,
      image.ImageUrl AS imageUrl,
      sku.SkuId AS skuId,
      sku.SkuCode AS skuCode,
      sku.Price AS price,
      sku.Price AS originalPrice,
      promotion.PromotionId AS promotionId,
      promotion.PromotionName AS promotionName,
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
      ISNULL(inventory.AvailableQuantity, 0) AS availableQuantity
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
      SELECT TOP (1) ps.*
      FROM dbo.ProductSku ps
      WHERE ps.ProductId = p.ProductId AND ps.Status = 'Active'
      ORDER BY ps.Price, ps.SkuId
    ) sku
    OUTER APPLY (
      SELECT SUM(i.QuantityOnHand - i.QuantityReserved) AS AvailableQuantity
      FROM dbo.Inventory i
      WHERE i.SkuId = sku.SkuId
    ) inventory
    OUTER APPLY (
      SELECT TOP (1)
        promo.PromotionId,
        promo.PromotionName,
        promo.DiscountType,
        promo.DiscountValue
      FROM dbo.Promotion promo
      WHERE promo.Status = 'Active'
        AND promo.StartAt <= SYSDATETIME()
        AND promo.EndAt > SYSDATETIME()
        AND (
          EXISTS (
            SELECT 1 FROM dbo.PromotionSku psPromo
            WHERE psPromo.PromotionId = promo.PromotionId AND psPromo.SkuId = sku.SkuId
          )
          OR EXISTS (
            SELECT 1 FROM dbo.PromotionProduct pp
            WHERE pp.PromotionId = promo.PromotionId AND pp.ProductId = p.ProductId
          )
        )
      ORDER BY
        CASE promo.DiscountType
          WHEN 'FixedPrice' THEN sku.Price - promo.DiscountValue
          WHEN 'FixedAmount' THEN promo.DiscountValue
          WHEN 'Percent' THEN sku.Price * promo.DiscountValue / 100
          ELSE 0
        END DESC,
        promo.EndAt ASC,
        promo.PromotionId DESC
    ) promotion
    WHERE p.ProductId IN (${idList}) AND p.Status = 'Active'
  `)

  const map = new Map<number, RecommendedProduct>()
  for (const row of result.recordset) {
    map.set(Number(row.id), {
      id: Number(row.id),
      productId: Number(row.productId),
      name: String(row.name),
      slug: String(row.slug),
      basePrice: Number(row.basePrice),
      price: row.price !== null ? Number(row.price) : null,
      originalPrice: row.originalPrice !== null ? Number(row.originalPrice) : null,
      finalPrice: row.finalPrice !== null ? Number(row.finalPrice) : null,
      categoryName: String(row.categoryName),
      categorySlug: String(row.categorySlug),
      brandName: String(row.brandName),
      imageUrl: row.imageUrl ? String(row.imageUrl) : null,
      availableQuantity: Number(row.availableQuantity),
      warrantyMonths: Number(row.warrantyMonths),
      installRequired: Boolean(row.installRequired),
    })
  }

  // Giữ nguyên thứ tự của productIds đã được xếp hạng theo score
  return productIds.map((id) => map.get(id)).filter((item): item is RecommendedProduct => Boolean(item))
}

export async function getSimilarProducts(productId: number, limit = 4): Promise<RecommendedProduct[]> {
  const pool = await getPool()
  // Lấy category và basePrice của sản phẩm hiện tại để filter/fallback
  const currentProdRes = await pool.request()
    .input('productId', sql.BigInt, productId)
    .query('SELECT CategoryId, BasePrice FROM dbo.Product WHERE ProductId = @productId')

  if (!currentProdRes.recordset.length) return []
  const currentCategory = Number(currentProdRes.recordset[0].CategoryId)
  const currentPrice = Number(currentProdRes.recordset[0].BasePrice)

  // Cách 1: Thử tìm kiếm gợi ý qua Qdrant Vector Recommendation
  const qdrant = getQdrantClient()
  if (qdrant) {
    try {
      const exists = await qdrant.collectionExists(collectionName)
      if (exists.exists) {
        // Tìm vector của các điểm gần nhất với productId này
        const recResults = await qdrant.recommend(collectionName, {
          positive: [productId],
          limit: Math.max(limit * 2, 8),
          with_payload: ['productId', 'category'],
        })

        if (recResults && recResults.length > 0) {
          const matchedIds = recResults
            .map((r) => Number(r.id))
            .filter((id) => id !== productId)
            .slice(0, limit)

          if (matchedIds.length > 0) {
            const products = await loadProductsByIds(matchedIds)
            if (products.length > 0) {
              return products
            }
          }
        }
      }
    } catch (err) {
      console.warn('Qdrant recommend fallback to SQL:', err instanceof Error ? err.message : String(err))
    }
  }

  // Cách 2 (Fallback SQL Content-based Similarity):
  // Lấy các sản phẩm cùng danh mục, độ lệch giá nhỏ nhất so với sản phẩm hiện tại
  const fallbackRes = await pool.request()
    .input('curId', sql.BigInt, productId)
    .input('catId', sql.BigInt, currentCategory)
    .input('curPrice', sql.Decimal(18, 2), currentPrice)
    .input('limit', sql.Int, limit)
    .query(`
      SELECT TOP (@limit) p.ProductId AS id
      FROM dbo.Product p
      WHERE p.ProductId <> @curId
        AND p.CategoryId = @catId
        AND p.Status = 'Active'
      ORDER BY ABS(p.BasePrice - @curPrice) ASC, p.ProductId DESC
    `)

  const fallbackIds = fallbackRes.recordset.map((r) => Number(r.id))
  return loadProductsByIds(fallbackIds)
}
