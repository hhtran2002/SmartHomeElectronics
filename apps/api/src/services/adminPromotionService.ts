import { getPool, sql } from '../config/database.js'

export type AdminPromotionInput = {
  promotionName: string
  discountType: string
  discountValue: number
  startAt: string
  endAt: string
  status: string
  skuIds: number[]
}

function toSqlDate(value: string) {
  return new Date(value)
}

export async function getPromotionSkuOptions() {
  const pool = await getPool()
  const result = await pool.request().query(`
    SELECT TOP (300)
      ps.SkuId AS skuId,
      ps.SkuCode AS skuCode,
      ps.Price AS price,
      p.ProductName AS productName,
      c.CategoryName AS categoryName,
      b.BrandName AS brandName
    FROM dbo.ProductSku ps
    INNER JOIN dbo.Product p ON p.ProductId = ps.ProductId
    INNER JOIN dbo.Category c ON c.CategoryId = p.CategoryId
    INNER JOIN dbo.Brand b ON b.BrandId = p.BrandId
    ORDER BY p.ProductName, ps.SkuCode
  `)
  return result.recordset
}

export async function getAdminPromotions() {
  const pool = await getPool()
  const result = await pool.request().query(`
    SELECT
      promo.PromotionId AS promotionId,
      promo.PromotionName AS promotionName,
      promo.DiscountType AS discountType,
      promo.DiscountValue AS discountValue,
      promo.StartAt AS startAt,
      promo.EndAt AS endAt,
      promo.Status AS status,
      COUNT(ps.SkuId) AS skuCount,
      STRING_AGG(CONVERT(varchar(30), ps.SkuId), ',') AS skuIds,
      STRING_AGG(ps.SkuCode, ', ') AS skuCodes
    FROM dbo.Promotion promo
    LEFT JOIN dbo.PromotionSku promoSku ON promoSku.PromotionId = promo.PromotionId
    LEFT JOIN dbo.ProductSku ps ON ps.SkuId = promoSku.SkuId
    GROUP BY
      promo.PromotionId,
      promo.PromotionName,
      promo.DiscountType,
      promo.DiscountValue,
      promo.StartAt,
      promo.EndAt,
      promo.Status
    ORDER BY promo.PromotionId DESC
  `)
  return result.recordset
}

export async function createAdminPromotion(input: AdminPromotionInput) {
  const pool = await getPool()
  const transaction = new sql.Transaction(pool)

  try {
    await transaction.begin()
    const tx = () => new sql.Request(transaction)

    const inserted = await tx()
      .input('promotionName', sql.NVarChar(200), input.promotionName)
      .input('discountType', sql.VarChar(30), input.discountType)
      .input('discountValue', sql.Decimal(18, 2), input.discountValue)
      .input('startAt', sql.DateTime2, toSqlDate(input.startAt))
      .input('endAt', sql.DateTime2, toSqlDate(input.endAt))
      .input('status', sql.VarChar(30), input.status)
      .query(`
        INSERT INTO dbo.Promotion (
          PromotionName, DiscountType, DiscountValue, StartAt, EndAt, Status
        )
        OUTPUT INSERTED.PromotionId AS promotionId
        VALUES (
          @promotionName, @discountType, @discountValue, @startAt, @endAt, @status
        )
      `)

    const promotionId = Number(inserted.recordset[0].promotionId)
    await replacePromotionSkus(tx, promotionId, input.skuIds)

    await transaction.commit()
    return { promotionId }
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
}

export async function updateAdminPromotion(promotionId: number, input: AdminPromotionInput) {
  const pool = await getPool()
  const transaction = new sql.Transaction(pool)

  try {
    await transaction.begin()
    const tx = () => new sql.Request(transaction)

    await tx()
      .input('promotionId', sql.BigInt, promotionId)
      .input('promotionName', sql.NVarChar(200), input.promotionName)
      .input('discountType', sql.VarChar(30), input.discountType)
      .input('discountValue', sql.Decimal(18, 2), input.discountValue)
      .input('startAt', sql.DateTime2, toSqlDate(input.startAt))
      .input('endAt', sql.DateTime2, toSqlDate(input.endAt))
      .input('status', sql.VarChar(30), input.status)
      .query(`
        UPDATE dbo.Promotion
        SET PromotionName = @promotionName,
            DiscountType = @discountType,
            DiscountValue = @discountValue,
            StartAt = @startAt,
            EndAt = @endAt,
            Status = @status
        WHERE PromotionId = @promotionId
      `)

    await replacePromotionSkus(tx, promotionId, input.skuIds)

    await transaction.commit()
    return { promotionId }
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
}

export async function updateAdminPromotionStatus(promotionId: number, status: string) {
  const pool = await getPool()
  await pool
    .request()
    .input('promotionId', sql.BigInt, promotionId)
    .input('status', sql.VarChar(30), status)
    .query(`
      UPDATE dbo.Promotion
      SET Status = @status
      WHERE PromotionId = @promotionId
    `)
  return { promotionId, status }
}

async function replacePromotionSkus(
  tx: () => sql.Request,
  promotionId: number,
  skuIds: number[],
) {
  await tx()
    .input('promotionId', sql.BigInt, promotionId)
    .query('DELETE FROM dbo.PromotionSku WHERE PromotionId = @promotionId')

  const uniqueSkuIds = [...new Set(skuIds.filter((skuId) => Number.isInteger(skuId) && skuId > 0))]
  for (const skuId of uniqueSkuIds) {
    await tx()
      .input('promotionId', sql.BigInt, promotionId)
      .input('skuId', sql.BigInt, skuId)
      .query(`
        INSERT INTO dbo.PromotionSku (PromotionId, SkuId)
        VALUES (@promotionId, @skuId)
      `)
  }
}
