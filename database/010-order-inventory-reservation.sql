IF OBJECT_ID('dbo.OrderInventoryReservation', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.OrderInventoryReservation (
    OrderInventoryReservationId BIGINT IDENTITY(1,1) NOT NULL
      CONSTRAINT PK_OrderInventoryReservation PRIMARY KEY,
    OrderDetailId BIGINT NOT NULL,
    InventoryId BIGINT NOT NULL,
    QuantityReserved INT NOT NULL,
    QuantityFulfilled INT NOT NULL
      CONSTRAINT DF_OrderInventoryReservation_QuantityFulfilled DEFAULT (0),
    CreatedAt DATETIME2 NOT NULL
      CONSTRAINT DF_OrderInventoryReservation_CreatedAt DEFAULT (SYSDATETIME()),
    UpdatedAt DATETIME2 NULL,
    CONSTRAINT FK_OrderInventoryReservation_OrderDetail
      FOREIGN KEY (OrderDetailId) REFERENCES dbo.SalesOrderDetail(OrderDetailId),
    CONSTRAINT FK_OrderInventoryReservation_Inventory
      FOREIGN KEY (InventoryId) REFERENCES dbo.Inventory(InventoryId),
    CONSTRAINT CK_OrderInventoryReservation_Quantities
      CHECK (
        QuantityReserved > 0
        AND QuantityFulfilled >= 0
        AND QuantityFulfilled <= QuantityReserved
      ),
    CONSTRAINT UQ_OrderInventoryReservation_OrderDetail_Inventory
      UNIQUE (OrderDetailId, InventoryId)
  );

  CREATE INDEX IX_OrderInventoryReservation_InventoryId
    ON dbo.OrderInventoryReservation(InventoryId);
END;
