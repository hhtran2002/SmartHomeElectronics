import { getPool, sql } from '../config/database.js'

export type ProductFilters = {
  search: string
  category: string
  brand: string
  minPrice: number | null
  maxPrice: number | null
  page: number
  pageSize: number
  onSale?: boolean
}

export type ProductListResult = {
  data: Record<string, unknown>[]
  total: number
  page: number
  pageSize: number
}

export async function getProductList(filters: ProductFilters): Promise<ProductListResult> {
  const offset = (filters.page - 1) * filters.pageSize
  const pool = await getPool()
  const result = await pool
    .request()
    .input('search', sql.NVarChar(255), `%${filters.search}%`)
    .input('category', sql.VarChar(200), filters.category)
    .input('brand', sql.NVarChar(150), filters.brand)
    .input('minPrice', sql.Decimal(18, 2), Number.isFinite(filters.minPrice) ? filters.minPrice : null)
    .input('maxPrice', sql.Decimal(18, 2), Number.isFinite(filters.maxPrice) ? filters.maxPrice : null)
    .input('offset', sql.Int, offset)
    .input('pageSize', sql.Int, filters.pageSize)
    .input('onSale', sql.Bit, filters.onSale ? 1 : 0)
    .query(`
      WITH ProductList AS (
        SELECT
          p.ProductId AS id,
          p.ProductName AS name,
          p.Slug AS slug,
          p.Description AS description,
          p.Highlights AS highlights,
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
          inventory.QuantityOnHand AS quantityOnHand
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
            promo.PromotionName,
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
        WHERE p.Status = 'Active'
          AND (@search = N'%%'
            OR p.ProductName LIKE @search
            OR c.CategoryName LIKE @search
            OR b.BrandName LIKE @search)
          AND (@category = '' OR c.Slug = @category)
          AND (@brand = N'' OR b.BrandName = @brand)
          AND (@onSale = 0 OR promotion.PromotionId IS NOT NULL)
          AND (@minPrice IS NULL OR (
            CASE
              WHEN promotion.PromotionId IS NULL THEN sku.Price
              WHEN promotion.DiscountType = 'Percent' THEN CASE WHEN sku.Price - (sku.Price * promotion.DiscountValue / 100) < 0 THEN 0 ELSE sku.Price - (sku.Price * promotion.DiscountValue / 100) END
              WHEN promotion.DiscountType = 'FixedAmount' THEN CASE WHEN sku.Price - promotion.DiscountValue < 0 THEN 0 ELSE sku.Price - promotion.DiscountValue END
              WHEN promotion.DiscountType = 'FixedPrice' THEN CASE WHEN promotion.DiscountValue < 0 THEN sku.Price ELSE promotion.DiscountValue END
              ELSE sku.Price
            END
          ) >= @minPrice)
          AND (@maxPrice IS NULL OR (
            CASE
              WHEN promotion.PromotionId IS NULL THEN sku.Price
              WHEN promotion.DiscountType = 'Percent' THEN CASE WHEN sku.Price - (sku.Price * promotion.DiscountValue / 100) < 0 THEN 0 ELSE sku.Price - (sku.Price * promotion.DiscountValue / 100) END
              WHEN promotion.DiscountType = 'FixedAmount' THEN CASE WHEN sku.Price - promotion.DiscountValue < 0 THEN 0 ELSE sku.Price - promotion.DiscountValue END
              WHEN promotion.DiscountType = 'FixedPrice' THEN CASE WHEN promotion.DiscountValue < 0 THEN sku.Price ELSE promotion.DiscountValue END
              ELSE sku.Price
            END
          ) <= @maxPrice)
      )
      SELECT
        p.*,
        ISNULL(p.quantityOnHand, 0) AS availableQuantity,
        COUNT(*) OVER() AS total
      FROM ProductList p
      ORDER BY p.id DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `)

  const total = Number(result.recordset[0]?.total ?? 0)
  const data = result.recordset.map(({ total: _total, quantityOnHand: _q, ...product }) => product)

  return { data, total, page: filters.page, pageSize: filters.pageSize }
}

export async function getProductBySlug(slug: string) {
  const pool = await getPool()
  const result = await pool
    .request()
    .input('slug', sql.VarChar(255), slug)
    .query(`
      SELECT TOP (1)
        p.ProductId AS id,
        p.ProductName AS name,
        p.Slug AS slug,
        p.Description AS description,
        p.Highlights AS highlights,
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
        sku.CostPrice AS costPrice,
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
        SELECT TOP (1) ps.SkuId, ps.SkuCode, ps.Price, ps.CostPrice
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
          promo.PromotionName,
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
      WHERE p.Slug = @slug AND p.Status = 'Active'
    `)

  const product = result.recordset[0]
  if (!product) return null

  const images = await pool
    .request()
    .input('productId', sql.BigInt, product.id)
    .query(`
      SELECT
        ImageId AS imageId,
        ImageUrl AS imageUrl,
        AltText AS altText,
        IsPrimary AS isPrimary,
        SortOrder AS sortOrder
      FROM dbo.ProductImage
      WHERE ProductId = @productId
      ORDER BY IsPrimary DESC, SortOrder, ImageId
    `)

  const attributes = await pool
    .request()
    .input('productId', sql.BigInt, product.id)
    .query(`
      SELECT
        ca.AttributeId AS attributeId,
        ca.AttributeName AS name,
        ca.DataType AS dataType,
        ca.Unit AS unit,
        COALESCE(
          pav.ValueText,
          CONVERT(NVARCHAR(100), pav.ValueNumber),
          CASE
            WHEN pav.ValueBoolean = 1 THEN N'Có'
            WHEN pav.ValueBoolean = 0 THEN N'Không'
            ELSE NULL
          END
        ) AS value
      FROM dbo.ProductAttributeValue pav
      INNER JOIN dbo.CategoryAttribute ca ON ca.AttributeId = pav.AttributeId
      WHERE pav.ProductId = @productId
      ORDER BY ca.AttributeId
    `)

  const reviewSummary = await pool
    .request()
    .input('productId', sql.BigInt, product.id)
    .query(`
      SELECT
        COUNT(*) AS reviewCount,
        ISNULL(AVG(CAST(Rating AS DECIMAL(4, 2))), 0) AS averageRating
      FROM dbo.Review
      WHERE ProductId = @productId
        AND Status = 'Approved'
        AND ParentReviewId IS NULL
    `)

  const reviews = await pool
    .request()
    .input('productId', sql.BigInt, product.id)
    .query(`
      SELECT TOP (100)
        CAST(r.ReviewId AS INT) AS reviewId,
        CAST(r.ParentReviewId AS INT) AS parentReviewId,
        r.Rating AS rating,
        r.Comment AS comment,
        r.CreatedAt AS createdAt,
        ua.FullName AS reviewerName
      FROM dbo.Review r
      INNER JOIN dbo.UserAccount ua ON ua.UserId = r.UserId
      WHERE r.ProductId = @productId AND r.Status = 'Approved'
      ORDER BY r.CreatedAt ASC
    `)

  const skus = await pool
    .request()
    .input('productId', sql.BigInt, product.id)
    .query(`
      SELECT
        ps.SkuId AS id,
        ps.SkuId AS skuId,
        ps.SkuCode AS skuCode,
        ps.VariantName AS variantName,
        ps.Price AS price,
        ps.Price AS originalPrice,
        ps.CostPrice AS costPrice,
        ISNULL(inv.QuantityOnHand, 0) AS availableQuantity,
        promotion.PromotionId AS promotionId,
        promotion.PromotionName AS promotionName,
        promotion.DiscountType AS promotionDiscountType,
        promotion.DiscountValue AS promotionDiscountValue,
        CASE
          WHEN promotion.PromotionId IS NULL THEN ps.Price
          WHEN promotion.DiscountType = 'Percent' THEN
            CASE WHEN ps.Price - (ps.Price * promotion.DiscountValue / 100) < 0 THEN 0 ELSE ps.Price - (ps.Price * promotion.DiscountValue / 100) END
          WHEN promotion.DiscountType = 'FixedAmount' THEN
            CASE WHEN ps.Price - promotion.DiscountValue < 0 THEN 0 ELSE ps.Price - promotion.DiscountValue END
          WHEN promotion.DiscountType = 'FixedPrice' THEN
            CASE WHEN promotion.DiscountValue < 0 THEN ps.Price ELSE promotion.DiscountValue END
          ELSE ps.Price
        END AS finalPrice
      FROM dbo.ProductSku ps
      OUTER APPLY (
        SELECT SUM(i.QuantityOnHand - i.QuantityReserved) AS QuantityOnHand
        FROM dbo.Inventory i
        WHERE i.SkuId = ps.SkuId
      ) inv
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
              SELECT 1
              FROM dbo.PromotionSku psPromo
              WHERE psPromo.PromotionId = promo.PromotionId
                AND psPromo.SkuId = ps.SkuId
            )
            OR EXISTS (
              SELECT 1
              FROM dbo.PromotionProduct pp
              WHERE pp.PromotionId = promo.PromotionId
                AND pp.ProductId = ps.ProductId
            )
          )
        ORDER BY
          CASE promo.DiscountType
            WHEN 'FixedPrice' THEN ps.Price - promo.DiscountValue
            WHEN 'FixedAmount' THEN promo.DiscountValue
            WHEN 'Percent' THEN ps.Price * promo.DiscountValue / 100
            ELSE 0
          END DESC,
          promo.EndAt ASC,
          promo.PromotionId DESC
      ) promotion
      WHERE ps.ProductId = @productId AND ps.Status = 'Active'
      ORDER BY ps.Price, ps.SkuId
    `)

  return {
    ...product,
    images: images.recordset,
    attributes: attributes.recordset,
    reviewSummary: reviewSummary.recordset[0] ?? { reviewCount: 0, averageRating: 0 },
    reviews: reviews.recordset,
    skus: skus.recordset,
  }
}
