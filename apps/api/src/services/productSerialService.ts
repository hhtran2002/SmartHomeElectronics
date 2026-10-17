import { getPool, sql } from '../config/database.js'

export type SerialFilters = {
  search?: string
  status?: string
  skuId?: number
  page?: number
  pageSize?: number
}

export type SerialReportFilters = {
  fromDate?: string
  toDate?: string
  skuId?: number
  search?: string
}

export async function getAdminSerials(filters: SerialFilters = {}) {
  const pool = await getPool()
  const page = Math.max(1, filters.page ?? 1)
  const pageSize = Math.max(1, Math.min(100, filters.pageSize ?? 20))
  const offset = (page - 1) * pageSize
  const searchPattern = filters.search?.trim() ? `%${filters.search.trim()}%` : null

  const countReq = pool.request()
    .input('status', sql.VarChar(50), filters.status && filters.status !== 'All' ? filters.status : null)
    .input('skuId', sql.BigInt, filters.skuId && filters.skuId > 0 ? filters.skuId : null)
    .input('search', sql.NVarChar(200), searchPattern)

  const countResult = await countReq.query(`
    SELECT COUNT(*) AS total
    FROM dbo.ProductSerial ps
    INNER JOIN dbo.ProductSku sku ON sku.SkuId = ps.SkuId
    INNER JOIN dbo.Product p ON p.ProductId = ps.ProductId
    LEFT JOIN dbo.SalesOrder so ON so.OrderId = ps.OrderId
    WHERE (@status IS NULL OR ps.Status = @status)
      AND (@skuId IS NULL OR ps.SkuId = @skuId)
      AND (@search IS NULL OR ps.SerialNumber LIKE @search OR p.ProductName LIKE @search OR sku.SkuCode LIKE @search OR so.OrderCode LIKE @search)
  `)

  const total = Number(countResult.recordset[0]?.total ?? 0)

  const dataReq = pool.request()
    .input('status', sql.VarChar(50), filters.status && filters.status !== 'All' ? filters.status : null)
    .input('skuId', sql.BigInt, filters.skuId && filters.skuId > 0 ? filters.skuId : null)
    .input('search', sql.NVarChar(200), searchPattern)
    .input('offset', sql.Int, offset)
    .input('pageSize', sql.Int, pageSize)

  const dataResult = await dataReq.query(`
    SELECT
      ps.SerialId AS serialId,
      ps.SerialNumber AS serialNumber,
      ps.ProductId AS productId,
      p.ProductName AS productName,
      ps.SkuId AS skuId,
      sku.SkuCode AS skuCode,
      w.WarehouseId AS warehouseId,
      w.WarehouseName AS warehouseName,
      ps.CostPrice AS costPrice,
      ps.Status AS status,
      ps.OrderId AS orderId,
      so.OrderCode AS orderCode,
      ps.SoldPrice AS soldPrice,
      ps.SoldAt AS soldAt,
      ps.CreatedAt AS createdAt
    FROM dbo.ProductSerial ps
    INNER JOIN dbo.ProductSku sku ON sku.SkuId = ps.SkuId
    INNER JOIN dbo.Product p ON p.ProductId = ps.ProductId
    INNER JOIN dbo.Warehouse w ON w.WarehouseId = ps.WarehouseId
    LEFT JOIN dbo.SalesOrder so ON so.OrderId = ps.OrderId
    WHERE (@status IS NULL OR ps.Status = @status)
      AND (@skuId IS NULL OR ps.SkuId = @skuId)
      AND (@search IS NULL OR ps.SerialNumber LIKE @search OR p.ProductName LIKE @search OR sku.SkuCode LIKE @search OR so.OrderCode LIKE @search)
    ORDER BY ps.SerialId DESC
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
  `)

  return {
    data: dataResult.recordset.map((row) => ({
      serialId: Number(row.serialId),
      serialNumber: String(row.serialNumber),
      productId: Number(row.productId),
      productName: String(row.productName),
      skuId: Number(row.skuId),
      skuCode: String(row.skuCode),
      warehouseId: Number(row.warehouseId),
      warehouseName: String(row.warehouseName),
      costPrice: Number(row.costPrice),
      status: String(row.status),
      orderId: row.orderId ? Number(row.orderId) : null,
      orderCode: row.orderCode ? String(row.orderCode) : null,
      soldPrice: row.soldPrice !== null ? Number(row.soldPrice) : null,
      soldAt: row.soldAt ? new Date(row.soldAt).toISOString() : null,
      createdAt: new Date(row.createdAt).toISOString(),
    })),
    total,
    page,
    pageSize,
  }
}

export async function getSerialProfitReport(filters: SerialReportFilters = {}) {
  const pool = await getPool()
  const searchPattern = filters.search?.trim() ? `%${filters.search.trim()}%` : null

  const req = pool.request()
    .input('fromDate', sql.Date, filters.fromDate || '2000-01-01')
    .input('toDate', sql.Date, filters.toDate || '2099-12-31')
    .input('skuId', sql.BigInt, filters.skuId && filters.skuId > 0 ? filters.skuId : null)
    .input('search', sql.NVarChar(200), searchPattern)

  const result = await req.query(`
    SELECT
      ps.SerialId AS serialId,
      ps.SerialNumber AS serialNumber,
      p.ProductId AS productId,
      p.ProductName AS productName,
      c.CategoryName AS categoryName,
      sku.SkuId AS skuId,
      sku.SkuCode AS skuCode,
      ps.CostPrice AS costPrice,
      ps.SoldPrice AS soldPrice,
      (ps.SoldPrice - ps.CostPrice) AS profit,
      CASE
        WHEN ps.SoldPrice > 0 THEN CAST((ps.SoldPrice - ps.CostPrice) * 100.0 / ps.SoldPrice AS DECIMAL(5,2))
        ELSE 0
      END AS marginPercentage,
      so.OrderId AS orderId,
      so.OrderCode AS orderCode,
      ps.SoldAt AS soldAt
    FROM dbo.ProductSerial ps
    INNER JOIN dbo.ProductSku sku ON sku.SkuId = ps.SkuId
    INNER JOIN dbo.Product p ON p.ProductId = ps.ProductId
    INNER JOIN dbo.Category c ON c.CategoryId = p.CategoryId
    LEFT JOIN dbo.SalesOrder so ON so.OrderId = ps.OrderId
    WHERE ps.Status = 'Sold'
      AND (ps.SoldAt >= @fromDate AND ps.SoldAt < DATEADD(day, 1, @toDate))
      AND (@skuId IS NULL OR ps.SkuId = @skuId)
      AND (@search IS NULL OR ps.SerialNumber LIKE @search OR p.ProductName LIKE @search OR sku.SkuCode LIKE @search OR so.OrderCode LIKE @search)
    ORDER BY ps.SoldAt DESC, ps.SerialId DESC
  `)

  const items = result.recordset.map((row) => ({
    serialId: Number(row.serialId),
    serialNumber: String(row.serialNumber),
    productId: Number(row.productId),
    productName: String(row.productName),
    categoryName: String(row.categoryName),
    skuId: Number(row.skuId),
    skuCode: String(row.skuCode),
    costPrice: Number(row.costPrice),
    soldPrice: Number(row.soldPrice),
    profit: Number(row.profit),
    marginPercentage: Number(row.marginPercentage),
    orderId: row.orderId ? Number(row.orderId) : null,
    orderCode: row.orderCode ? String(row.orderCode) : null,
    soldAt: row.soldAt ? new Date(row.soldAt).toISOString() : null,
  }))

  const totalUnitsSold = items.length
  const totalRevenue = items.reduce((sum, item) => sum + item.soldPrice, 0)
  const totalCost = items.reduce((sum, item) => sum + item.costPrice, 0)
  const totalGrossProfit = totalRevenue - totalCost
  const grossMarginPercentage = totalRevenue > 0 ? Number(((totalGrossProfit / totalRevenue) * 100).toFixed(2)) : 0

  return {
    summary: {
      totalUnitsSold,
      totalRevenue,
      totalCost,
      totalGrossProfit,
      grossMarginPercentage,
    },
    items,
  }
}

export async function createSerialsForStockIn(
  warehouseId: number,
  skuId: number,
  quantity: number,
  unitCost: number,
  stockInReceiptId?: number
) {
  const pool = await getPool()
  const skuInfo = await pool.request()
    .input('skuId', sql.BigInt, skuId)
    .query('SELECT ps.ProductId, ps.SkuCode FROM dbo.ProductSku ps WHERE ps.SkuId = @skuId')

  if (!skuInfo.recordset.length) return []
  const { ProductId, SkuCode } = skuInfo.recordset[0]
  const cleanSku = String(SkuCode).replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  const createdSerials: string[] = []

  for (let i = 0; i < quantity; i++) {
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
    const serialNumber = `SN-${cleanSku}-${Date.now().toString().slice(-4)}${randomSuffix}`

    await pool.request()
      .input('prodId', sql.BigInt, ProductId)
      .input('skuId', sql.BigInt, skuId)
      .input('whId', sql.BigInt, warehouseId)
      .input('sn', sql.NVarChar(100), serialNumber)
      .input('cost', sql.Decimal(18, 2), unitCost)
      .input('receiptId', sql.BigInt, stockInReceiptId ?? null)
      .query(`
        INSERT INTO dbo.ProductSerial (ProductId, SkuId, WarehouseId, SerialNumber, CostPrice, Status, StockInReceiptId, CreatedAt, UpdatedAt)
        VALUES (@prodId, @skuId, @whId, @sn, @cost, 'InStock', @receiptId, SYSDATETIME(), SYSDATETIME())
      `)

    createdSerials.push(serialNumber)
  }

  return createdSerials
}

export async function assignSerialsForOrder(
  orderId: number,
  orderDetailId: number,
  skuId: number,
  quantity: number,
  unitSoldPrice: number
) {
  const pool = await getPool()
  // Lấy danh sách serial InStock của SKU này theo FIFO
  const available = await pool.request()
    .input('skuId', sql.BigInt, skuId)
    .input('qty', sql.Int, quantity)
    .query(`
      SELECT TOP (@qty) SerialId
      FROM dbo.ProductSerial WITH (UPDLOCK, HOLDLOCK)
      WHERE SkuId = @skuId AND Status = 'InStock'
      ORDER BY SerialId ASC
    `)

  for (const row of available.recordset) {
    await pool.request()
      .input('sId', sql.BigInt, row.SerialId)
      .input('orderId', sql.BigInt, orderId)
      .input('detailId', sql.BigInt, orderDetailId)
      .input('price', sql.Decimal(18, 2), unitSoldPrice)
      .query(`
        UPDATE dbo.ProductSerial
        SET Status = 'Sold',
            OrderId = @orderId,
            OrderDetailId = @detailId,
            SoldPrice = @price,
            SoldAt = SYSDATETIME(),
            UpdatedAt = SYSDATETIME()
        WHERE SerialId = @sId
      `)
  }
}
