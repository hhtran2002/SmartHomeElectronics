SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

IF OBJECT_ID('dbo.DeliveryVehicle', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.DeliveryVehicle (
    VehicleId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_DeliveryVehicle PRIMARY KEY,
    VehicleCode VARCHAR(50) NOT NULL,
    LicensePlate VARCHAR(30) NULL,
    VehicleType NVARCHAR(50) NOT NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_DeliveryVehicle_Status DEFAULT ('Active'),
    Note NVARCHAR(500) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_DeliveryVehicle_CreatedAt DEFAULT (SYSDATETIME()),
    UpdatedAt DATETIME2(0) NULL,
    CONSTRAINT UQ_DeliveryVehicle_VehicleCode UNIQUE (VehicleCode),
    CONSTRAINT CK_DeliveryVehicle_Status CHECK (Status IN ('Active', 'Maintenance', 'Inactive'))
  );

  CREATE UNIQUE INDEX UQ_DeliveryVehicle_LicensePlate_NotNull
    ON dbo.DeliveryVehicle(LicensePlate)
    WHERE LicensePlate IS NOT NULL;
END;

IF COL_LENGTH('dbo.Shipment', 'VehicleId') IS NULL
  ALTER TABLE dbo.Shipment ADD VehicleId BIGINT NULL;

IF COL_LENGTH('dbo.Shipment', 'AssignedAt') IS NULL
  ALTER TABLE dbo.Shipment ADD AssignedAt DATETIME2(0) NULL;

IF COL_LENGTH('dbo.Shipment', 'HandedOverAt') IS NULL
  ALTER TABLE dbo.Shipment ADD HandedOverAt DATETIME2(0) NULL;

IF COL_LENGTH('dbo.Shipment', 'UpdatedAt') IS NULL
  ALTER TABLE dbo.Shipment ADD UpdatedAt DATETIME2(0) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Shipment_DeliveryVehicle')
BEGIN
  ALTER TABLE dbo.Shipment WITH CHECK
    ADD CONSTRAINT FK_Shipment_DeliveryVehicle FOREIGN KEY (VehicleId)
    REFERENCES dbo.DeliveryVehicle(VehicleId);
END;

IF COL_LENGTH('dbo.StockInReceipt', 'ShipmentId') IS NULL
  ALTER TABLE dbo.StockInReceipt ADD ShipmentId BIGINT NULL;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_StockInReceipt_Shipment')
BEGIN
  ALTER TABLE dbo.StockInReceipt WITH CHECK
    ADD CONSTRAINT FK_StockInReceipt_Shipment FOREIGN KEY (ShipmentId)
    REFERENCES dbo.Shipment(ShipmentId);
END;

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Shipment_Status')
  ALTER TABLE dbo.Shipment DROP CONSTRAINT CK_Shipment_Status;

ALTER TABLE dbo.Shipment WITH CHECK ADD CONSTRAINT CK_Shipment_Status CHECK (
  ShippingStatus IN ('Pending', 'Picking', 'Shipping', 'Delivered', 'Failed', 'Rescheduled', 'ReturnPending', 'Cancelled')
);

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_ShipmentStatusHistory_Status')
  ALTER TABLE dbo.ShipmentStatusHistory DROP CONSTRAINT CK_ShipmentStatusHistory_Status;

ALTER TABLE dbo.ShipmentStatusHistory WITH CHECK ADD CONSTRAINT CK_ShipmentStatusHistory_Status CHECK (
  Status IN ('Pending', 'Picking', 'Shipping', 'Delivered', 'Failed', 'Rescheduled', 'ReturnPending', 'Cancelled')
);

-- Existing orders were exported before the shipment module was connected.
-- Create legacy shipment records so reports and future support screens have a
-- continuous audit trail. DeliveryStaffId and VehicleId intentionally stay NULL
-- because that historical information cannot be reconstructed reliably.
EXEC(N'
  INSERT INTO dbo.Shipment (
    OrderId, WarehouseId, DeliveryStaffId, VehicleId, TrackingCode,
    ShippingStatus, ShippingFee, EstimatedDeliveryAt, DeliveredAt,
    AssignedAt, HandedOverAt, Note, CreatedAt, UpdatedAt
  )
  SELECT
    receipt.OrderId,
    receipt.WarehouseId,
    NULL,
    NULL,
    CONCAT(''LEGACY-'', receipt.OrderId, ''-'', receipt.WarehouseId),
    CASE WHEN orderStatus.StatusCode = ''Completed'' THEN ''Delivered'' ELSE ''Shipping'' END,
    salesOrder.ShippingFee,
    NULL,
    CASE WHEN orderStatus.StatusCode = ''Completed'' THEN salesOrder.UpdatedAt ELSE NULL END,
    NULL,
    receipt.ReceiptDate,
    N''Dữ liệu giao hàng được khởi tạo từ phiếu xuất kho cũ.'',
    receipt.ReceiptDate,
    salesOrder.UpdatedAt
  FROM dbo.StockOutReceipt receipt
  INNER JOIN dbo.SalesOrder salesOrder ON salesOrder.OrderId = receipt.OrderId
  INNER JOIN dbo.OrderStatus orderStatus ON orderStatus.OrderStatusId = salesOrder.OrderStatusId
  WHERE receipt.OrderId IS NOT NULL
    AND receipt.Reason = ''Order''
    AND receipt.Status = ''Confirmed''
    AND orderStatus.StatusCode IN (''Shipping'', ''Completed'')
    AND NOT EXISTS (
      SELECT 1
      FROM dbo.Shipment shipment
      WHERE shipment.OrderId = receipt.OrderId
        AND shipment.WarehouseId = receipt.WarehouseId
    );
');

INSERT INTO dbo.ShipmentItem (ShipmentId, OrderDetailId, Quantity)
SELECT shipment.ShipmentId, detail.OrderDetailId, SUM(detail.Quantity)
FROM dbo.StockOutReceipt receipt
INNER JOIN dbo.StockOutReceiptDetail detail ON detail.StockOutReceiptId = receipt.StockOutReceiptId
INNER JOIN dbo.Shipment shipment
  ON shipment.OrderId = receipt.OrderId
  AND shipment.WarehouseId = receipt.WarehouseId
WHERE receipt.OrderId IS NOT NULL
  AND detail.OrderDetailId IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM dbo.ShipmentItem existingItem
    WHERE existingItem.ShipmentId = shipment.ShipmentId
      AND existingItem.OrderDetailId = detail.OrderDetailId
  )
GROUP BY shipment.ShipmentId, detail.OrderDetailId;

INSERT INTO dbo.ShipmentStatusHistory (ShipmentId, Status, ChangedByUserId, Note, ChangedAt)
SELECT shipment.ShipmentId, shipment.ShippingStatus, NULL, N'Khởi tạo lịch sử từ dữ liệu xuất kho cũ.', shipment.CreatedAt
FROM dbo.Shipment shipment
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.ShipmentStatusHistory history WHERE history.ShipmentId = shipment.ShipmentId
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_Shipment_Order_Warehouse' AND object_id = OBJECT_ID('dbo.Shipment'))
  CREATE UNIQUE INDEX UQ_Shipment_Order_Warehouse ON dbo.Shipment(OrderId, WarehouseId);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_ShipmentItem_Shipment_OrderDetail' AND object_id = OBJECT_ID('dbo.ShipmentItem'))
  CREATE UNIQUE INDEX UQ_ShipmentItem_Shipment_OrderDetail ON dbo.ShipmentItem(ShipmentId, OrderDetailId);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_StockInReceipt_Shipment_NotNull' AND object_id = OBJECT_ID('dbo.StockInReceipt'))
  EXEC(N'CREATE UNIQUE INDEX UQ_StockInReceipt_Shipment_NotNull ON dbo.StockInReceipt(ShipmentId) WHERE ShipmentId IS NOT NULL;');

COMMIT TRANSACTION;
