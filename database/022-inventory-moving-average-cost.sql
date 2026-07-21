SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;

IF COL_LENGTH('dbo.Inventory', 'AverageUnitCost') IS NULL
BEGIN
  ALTER TABLE dbo.Inventory ADD AverageUnitCost DECIMAL(18,2) NOT NULL CONSTRAINT DF_Inventory_AverageUnitCost DEFAULT (0);
END;

IF COL_LENGTH('dbo.StockMovement', 'UnitCost') IS NULL
BEGIN
  ALTER TABLE dbo.StockMovement ADD UnitCost DECIMAL(18,2) NULL;
END;

IF COL_LENGTH('dbo.StockOutReceiptDetail', 'UnitCost') IS NULL
BEGIN
  ALTER TABLE dbo.StockOutReceiptDetail ADD UnitCost DECIMAL(18,2) NULL;
END;

IF COL_LENGTH('dbo.SalesOrderDetail', 'CostOfGoodsSold') IS NULL
BEGIN
  ALTER TABLE dbo.SalesOrderDetail ADD CostOfGoodsSold DECIMAL(18,2) NOT NULL CONSTRAINT DF_SalesOrderDetail_CostOfGoodsSold DEFAULT (0);
END;

-- Inventory seeded before this migration uses the SKU reference cost as its
-- opening cost. Every receipt after this point uses the moving-average formula.
UPDATE i
SET AverageUnitCost = ISNULL(ps.CostPrice, 0)
FROM dbo.Inventory i
INNER JOIN dbo.ProductSku ps ON ps.SkuId = i.SkuId
WHERE i.AverageUnitCost = 0;
