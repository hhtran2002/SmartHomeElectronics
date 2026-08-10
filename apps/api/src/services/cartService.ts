import { getPool, sql } from '../config/database.js'

export type CartMutationItem = { skuId: number; quantity: number }

async function ensureActiveCart(userId: number) {
  const pool = await getPool()
  const transaction = new sql.Transaction(pool)
  try {
    await transaction.begin()
    const request = () => new sql.Request(transaction)
    const existing = await request()
      .input('userId', sql.BigInt, userId)
      .query(`SELECT TOP (1) CartId FROM dbo.Cart WITH (UPDLOCK, HOLDLOCK) WHERE UserId = @userId AND Status = 'Active' ORDER BY CartId DESC`)
    let cartId = Number(existing.recordset[0]?.CartId)
    if (!cartId) {
      const inserted = await request()
        .input('userId', sql.BigInt, userId)
        .query(`INSERT INTO dbo.Cart (UserId, Status, CreatedAt, UpdatedAt) OUTPUT INSERTED.CartId VALUES (@userId, 'Active', SYSDATETIME(), SYSDATETIME())`)
      cartId = Number(inserted.recordset[0].CartId)
    }
    await transaction.commit()
    return cartId
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
}

export async function getUserCart(userId: number) {
  const pool = await getPool()
  const result = await pool.request().input('userId', sql.BigInt, userId).query(`
    SELECT
      ps.SkuId AS skuId, ps.SkuCode AS skuCode, p.Slug AS productSlug,
      p.ProductName AS productName, b.BrandName AS brandName, c.CategoryName AS categoryName,
      image.ImageUrl AS imageUrl, ps.Price AS price, ps.Price AS originalPrice,
      CAST(NULL AS nvarchar(200)) AS promotionName,
      ISNULL(stock.AvailableQuantity, 0) AS availableQuantity, ci.Quantity AS quantity
    FROM dbo.Cart cart
    INNER JOIN dbo.CartItem ci ON ci.CartId = cart.CartId
    INNER JOIN dbo.ProductSku ps ON ps.SkuId = ci.SkuId
    INNER JOIN dbo.Product p ON p.ProductId = ps.ProductId
    INNER JOIN dbo.Brand b ON b.BrandId = p.BrandId
    INNER JOIN dbo.Category c ON c.CategoryId = p.CategoryId
    OUTER APPLY (SELECT TOP (1) pi.ImageUrl FROM dbo.ProductImage pi WHERE pi.ProductId = p.ProductId ORDER BY pi.IsPrimary DESC, pi.SortOrder, pi.ImageId) image
    OUTER APPLY (SELECT SUM(i.QuantityOnHand - i.QuantityReserved) AS AvailableQuantity FROM dbo.Inventory i WHERE i.SkuId = ps.SkuId) stock
    WHERE cart.UserId = @userId AND cart.Status = 'Active'
    ORDER BY ci.AddedAt, ci.CartItemId
  `)
  return result.recordset
}

export async function setUserCartItem(userId: number, item: CartMutationItem) {
  const cartId = await ensureActiveCart(userId)
  const pool = await getPool()
  const stock = await pool.request().input('skuId', sql.BigInt, item.skuId).query(`
    SELECT ISNULL(SUM(i.QuantityOnHand - i.QuantityReserved), 0) AS AvailableQuantity
    FROM dbo.ProductSku ps LEFT JOIN dbo.Inventory i ON i.SkuId = ps.SkuId
    WHERE ps.SkuId = @skuId AND ps.Status = 'Active'
  `)
  const available = Number(stock.recordset[0]?.AvailableQuantity ?? 0)
  if (available < 1) throw new Error('Sản phẩm không còn hàng.')
  const quantity = Math.min(item.quantity, available)
  await pool.request()
    .input('cartId', sql.BigInt, cartId).input('skuId', sql.BigInt, item.skuId).input('quantity', sql.Int, quantity)
    .query(`
      IF EXISTS (SELECT 1 FROM dbo.CartItem WHERE CartId = @cartId AND SkuId = @skuId)
        UPDATE dbo.CartItem SET Quantity = @quantity WHERE CartId = @cartId AND SkuId = @skuId;
      ELSE
        INSERT INTO dbo.CartItem (CartId, SkuId, Quantity, AddedAt) VALUES (@cartId, @skuId, @quantity, SYSDATETIME());
      UPDATE dbo.Cart SET UpdatedAt = SYSDATETIME() WHERE CartId = @cartId;
    `)
  return getUserCart(userId)
}

export async function mergeUserCart(userId: number, items: CartMutationItem[]) {
  const current = await getUserCart(userId) as Array<{ skuId: number; quantity: number }>
  const quantities = new Map(current.map((item) => [Number(item.skuId), Number(item.quantity)]))
  for (const item of items) {
    await setUserCartItem(userId, { ...item, quantity: Math.max(item.quantity, quantities.get(item.skuId) ?? 0) })
  }
  return getUserCart(userId)
}

export async function removeUserCartItem(userId: number, skuId?: number) {
  const pool = await getPool()
  await pool.request().input('userId', sql.BigInt, userId).input('skuId', sql.BigInt, skuId ?? null).query(`
    DELETE ci FROM dbo.CartItem ci INNER JOIN dbo.Cart c ON c.CartId = ci.CartId
    WHERE c.UserId = @userId AND c.Status = 'Active' AND (@skuId IS NULL OR ci.SkuId = @skuId);
    UPDATE dbo.Cart SET UpdatedAt = SYSDATETIME() WHERE UserId = @userId AND Status = 'Active';
  `)
  return getUserCart(userId)
}
