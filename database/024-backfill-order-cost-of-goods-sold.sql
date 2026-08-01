SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;

-- Receipts created before moving-average costing was introduced did not have
-- a frozen unit cost. ProductSku.CostPrice is the only historical opening-cost
-- reference available for those rows, so use it once as the migration fallback.
UPDATE detail
SET detail.UnitCost = ISNULL(sku.CostPrice, 0)
FROM dbo.StockOutReceiptDetail detail
INNER JOIN dbo.ProductSku sku ON sku.SkuId = detail.SkuId
WHERE detail.UnitCost IS NULL OR detail.UnitCost = 0;

UPDATE movement
SET movement.UnitCost = receiptCost.UnitCost
FROM dbo.StockMovement movement
INNER JOIN (
  SELECT StockOutReceiptId, SkuId, MAX(UnitCost) AS UnitCost
  FROM dbo.StockOutReceiptDetail
  GROUP BY StockOutReceiptId, SkuId
) receiptCost
  ON receiptCost.StockOutReceiptId = movement.StockOutReceiptId
  AND receiptCost.SkuId = movement.SkuId
WHERE movement.UnitCost IS NULL OR movement.UnitCost = 0;

-- Rebuild COGS from confirmed order stock-out receipts. This is idempotent and
-- deliberately replaces, rather than increments, the legacy zero/default value.
UPDATE orderDetail
SET orderDetail.CostOfGoodsSold = receiptCost.CostOfGoodsSold
FROM dbo.SalesOrderDetail orderDetail
INNER JOIN (
  SELECT
    detail.OrderDetailId,
    SUM(detail.Quantity * detail.UnitCost) AS CostOfGoodsSold
  FROM dbo.StockOutReceiptDetail detail
  INNER JOIN dbo.StockOutReceipt receipt
    ON receipt.StockOutReceiptId = detail.StockOutReceiptId
  WHERE detail.OrderDetailId IS NOT NULL
    AND receipt.Reason = 'Order'
    AND receipt.Status = 'Confirmed'
  GROUP BY detail.OrderDetailId
) receiptCost ON receiptCost.OrderDetailId = orderDetail.OrderDetailId;
