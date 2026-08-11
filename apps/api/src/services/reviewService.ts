import { getPool, sql } from '../config/database.js'
import { getReviewModerationRequired } from './reviewSettingsService.js'

export type ReviewInput = {
  userId: number
  roles?: string[]
  slug: string
  rating: number
  comment: string
  parentReviewId?: number | null
}

export async function createProductReview(input: ReviewInput) {
  const pool = await getPool()
  const productResult = await pool
    .request()
    .input('slug', sql.VarChar(255), input.slug)
    .query(`
      SELECT TOP (1) ProductId
      FROM dbo.Product
      WHERE Slug = @slug AND Status = 'Active'
    `)

  const productId = productResult.recordset[0]?.ProductId as number | undefined
  if (!productId) throw new Error('Không tìm thấy sản phẩm.')

  if (input.parentReviewId) {
    const parentResult = await pool
      .request()
      .input('parentReviewId', sql.BigInt, input.parentReviewId)
      .input('productId', sql.BigInt, productId)
      .query(`
        SELECT TOP (1) ReviewId
        FROM dbo.Review
        WHERE ReviewId = @parentReviewId
          AND ProductId = @productId
          AND Status = 'Approved'
      `)
    if (!parentResult.recordset[0]) throw new Error('Bình luận cha không hợp lệ.')
  }

  const isAdminOrStaff = Boolean(
    input.roles?.some((r) =>
      ['SystemAdmin', 'CustomerSupport', 'OrderAdmin', 'WarehouseStaff', 'Employee'].includes(r)
    )
  )

  const isReply = Boolean(input.parentReviewId)

  // Replies belong to a review thread, not to the order line that allowed the
  // author to create a root review. Keeping this NULL also prevents replies
  // from consuming the one-review-per-order-detail unique key.
  let orderDetailId: number | null = null
  if (!isReply) {
    const purchasedResult = await pool
      .request()
      .input('userId', sql.BigInt, input.userId)
      .input('productId', sql.BigInt, productId)
      .query(`
        SELECT TOP (1) sod.OrderDetailId
        FROM dbo.SalesOrderDetail sod
        INNER JOIN dbo.ProductSku ps ON ps.SkuId = sod.SkuId
        INNER JOIN dbo.SalesOrder so ON so.OrderId = sod.OrderId
        INNER JOIN dbo.CustomerProfile cp ON cp.CustomerId = so.CustomerId
        INNER JOIN dbo.OrderStatus os ON os.OrderStatusId = so.OrderStatusId
        WHERE cp.UserId = @userId
          AND ps.ProductId = @productId
          AND os.StatusCode = 'Completed'
        ORDER BY so.CreatedAt DESC
      `)

    orderDetailId = (purchasedResult.recordset[0]?.OrderDetailId as number | undefined) ?? null
  }

  if (!isReply && !isAdminOrStaff && !orderDetailId) {
    throw new Error('Bạn chỉ có thể đánh giá sản phẩm đã mua và đơn đã hoàn thành.')
  }

  const moderationRequired = await getReviewModerationRequired()
  const status = isAdminOrStaff || isReply || !moderationRequired ? 'Approved' : 'Pending'

  const inserted = await pool
    .request()
    .input('productId', sql.BigInt, productId)
    .input('orderDetailId', sql.BigInt, orderDetailId)
    .input('userId', sql.BigInt, input.userId)
    .input('rating', sql.TinyInt, isReply ? 5 : input.rating)
    .input('comment', sql.NVarChar(1000), input.comment)
    .input('parentReviewId', sql.BigInt, input.parentReviewId ?? null)
    .input('status', sql.VarChar(20), status)
    .query(`
      INSERT INTO dbo.Review (
        ProductId, OrderDetailId, UserId, Rating, Comment,
        Status, CreatedAt, ParentReviewId
      )
      OUTPUT INSERTED.ReviewId
      VALUES (
        @productId, @orderDetailId, @userId, @rating, @comment,
        @status, SYSDATETIME(), @parentReviewId
      )
    `)

  return { reviewId: inserted.recordset[0].ReviewId as number, status }
}

export async function listAdminReviews() {
  const pool = await getPool()
  const result = await pool.request().query(`
    SELECT TOP (200)
      r.ReviewId AS reviewId,
      r.ParentReviewId AS parentReviewId,
      r.ProductId AS productId,
      p.ProductName AS productName,
      p.Slug AS productSlug,
      ua.FullName AS reviewerName,
      r.Rating AS rating,
      r.Comment AS comment,
      r.Status AS status,
      r.CreatedAt AS createdAt
    FROM dbo.Review r
    INNER JOIN dbo.Product p ON p.ProductId = r.ProductId
    INNER JOIN dbo.UserAccount ua ON ua.UserId = r.UserId
    ORDER BY
      CASE r.Status WHEN 'Pending' THEN 0 WHEN 'Approved' THEN 1 ELSE 2 END,
      r.CreatedAt DESC
  `)
  return result.recordset
}

export async function updateReviewStatus(reviewId: number, status: string, moderatorId: number) {
  const allowed = new Set(['Pending', 'Approved', 'Hidden', 'Rejected'])
  if (!allowed.has(status)) throw new Error('Trạng thái review không hợp lệ.')

  const pool = await getPool()
  const result = await pool
    .request()
    .input('reviewId', sql.BigInt, reviewId)
    .input('status', sql.VarChar(20), status)
    .input('moderatorId', sql.BigInt, moderatorId)
    .query(`
      UPDATE dbo.Review
      SET Status = @status,
          ModeratedAt = SYSDATETIME(),
          ModeratedBy = @moderatorId,
          UpdatedAt = SYSDATETIME()
      WHERE ReviewId = @reviewId

      SELECT @@ROWCOUNT AS affectedRows
    `)

  if (!Number(result.recordset[0]?.affectedRows)) throw new Error('Không tìm thấy review.')
  return { reviewId, status }
}
