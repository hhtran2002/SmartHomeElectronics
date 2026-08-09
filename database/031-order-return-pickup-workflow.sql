IF OBJECT_ID('dbo.OrderReturnRequest', 'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.OrderReturnRequest', 'ReturnShipmentId') IS NULL
    ALTER TABLE dbo.OrderReturnRequest ADD ReturnShipmentId BIGINT NULL;

  IF COL_LENGTH('dbo.OrderReturnRequest', 'DeliveryStaffId') IS NULL
    ALTER TABLE dbo.OrderReturnRequest ADD DeliveryStaffId BIGINT NULL;

  IF COL_LENGTH('dbo.OrderReturnRequest', 'WarehouseConfirmedAt') IS NULL
    ALTER TABLE dbo.OrderReturnRequest ADD WarehouseConfirmedAt DATETIME2(0) NULL;

  IF COL_LENGTH('dbo.OrderReturnRequest', 'WarehouseConfirmedBy') IS NULL
    ALTER TABLE dbo.OrderReturnRequest ADD WarehouseConfirmedBy BIGINT NULL;

  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_OrderReturnRequest_ReturnShipment')
  BEGIN
    ALTER TABLE dbo.OrderReturnRequest WITH CHECK
      ADD CONSTRAINT FK_OrderReturnRequest_ReturnShipment FOREIGN KEY (ReturnShipmentId)
      REFERENCES dbo.Shipment(ShipmentId);
  END;

  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_OrderReturnRequest_DeliveryStaff')
  BEGIN
    ALTER TABLE dbo.OrderReturnRequest WITH CHECK
      ADD CONSTRAINT FK_OrderReturnRequest_DeliveryStaff FOREIGN KEY (DeliveryStaffId)
      REFERENCES dbo.UserAccount(UserId);
  END;
END;
