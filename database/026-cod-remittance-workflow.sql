SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID('dbo.CodCollection', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CodCollection (
    CodCollectionId BIGINT IDENTITY(1,1) NOT NULL
      CONSTRAINT PK_CodCollection PRIMARY KEY,
    PaymentId BIGINT NOT NULL,
    ShipmentId BIGINT NOT NULL,
    OrderId BIGINT NOT NULL,
    DeliveryStaffId BIGINT NOT NULL,
    CollectedAmount DECIMAL(18,2) NOT NULL,
    CollectedAt DATETIME2(0) NOT NULL,
    Status VARCHAR(30) NOT NULL
      CONSTRAINT DF_CodCollection_Status DEFAULT ('Outstanding'),
    CreatedAt DATETIME2(0) NOT NULL
      CONSTRAINT DF_CodCollection_CreatedAt DEFAULT (SYSDATETIME()),
    UpdatedAt DATETIME2(0) NULL,
    CONSTRAINT FK_CodCollection_Payment FOREIGN KEY (PaymentId)
      REFERENCES dbo.Payment(PaymentId),
    CONSTRAINT FK_CodCollection_Shipment FOREIGN KEY (ShipmentId)
      REFERENCES dbo.Shipment(ShipmentId),
    CONSTRAINT FK_CodCollection_SalesOrder FOREIGN KEY (OrderId)
      REFERENCES dbo.SalesOrder(OrderId),
    CONSTRAINT FK_CodCollection_DeliveryStaff FOREIGN KEY (DeliveryStaffId)
      REFERENCES dbo.UserAccount(UserId),
    CONSTRAINT CK_CodCollection_Amount CHECK (CollectedAmount > 0),
    CONSTRAINT CK_CodCollection_Status CHECK (
      Status IN ('Outstanding', 'PartiallyRemitted', 'Settled')
    ),
    CONSTRAINT UQ_CodCollection_Payment UNIQUE (PaymentId),
    CONSTRAINT UQ_CodCollection_Shipment UNIQUE (ShipmentId)
  );
END;

IF OBJECT_ID('dbo.CodRemittance', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CodRemittance (
    CodRemittanceId BIGINT IDENTITY(1,1) NOT NULL
      CONSTRAINT PK_CodRemittance PRIMARY KEY,
    RemittanceCode VARCHAR(50) NOT NULL,
    DeliveryStaffId BIGINT NOT NULL,
    DeclaredAmount DECIMAL(18,2) NOT NULL,
    Method VARCHAR(30) NOT NULL,
    Status VARCHAR(30) NOT NULL
      CONSTRAINT DF_CodRemittance_Status DEFAULT ('Submitted'),
    SubmittedByUserId BIGINT NOT NULL,
    SubmittedAt DATETIME2(0) NOT NULL
      CONSTRAINT DF_CodRemittance_SubmittedAt DEFAULT (SYSDATETIME()),
    ReviewedByUserId BIGINT NULL,
    ReviewedAt DATETIME2(0) NULL,
    ReferenceCode VARCHAR(100) NULL,
    Note NVARCHAR(500) NULL,
    ReviewNote NVARCHAR(500) NULL,
    CreatedAt DATETIME2(0) NOT NULL
      CONSTRAINT DF_CodRemittance_CreatedAt DEFAULT (SYSDATETIME()),
    UpdatedAt DATETIME2(0) NULL,
    CONSTRAINT FK_CodRemittance_DeliveryStaff FOREIGN KEY (DeliveryStaffId)
      REFERENCES dbo.UserAccount(UserId),
    CONSTRAINT FK_CodRemittance_SubmittedBy FOREIGN KEY (SubmittedByUserId)
      REFERENCES dbo.UserAccount(UserId),
    CONSTRAINT FK_CodRemittance_ReviewedBy FOREIGN KEY (ReviewedByUserId)
      REFERENCES dbo.UserAccount(UserId),
    CONSTRAINT CK_CodRemittance_Amount CHECK (DeclaredAmount > 0),
    CONSTRAINT CK_CodRemittance_Method CHECK (Method IN ('Cash', 'BankTransfer')),
    CONSTRAINT CK_CodRemittance_Status CHECK (
      Status IN ('Submitted', 'Confirmed', 'Rejected', 'Cancelled')
    ),
    CONSTRAINT UQ_CodRemittance_Code UNIQUE (RemittanceCode)
  );
END;

IF OBJECT_ID('dbo.CodRemittanceItem', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CodRemittanceItem (
    CodRemittanceId BIGINT NOT NULL,
    CodCollectionId BIGINT NOT NULL,
    Amount DECIMAL(18,2) NOT NULL,
    CreatedAt DATETIME2(0) NOT NULL
      CONSTRAINT DF_CodRemittanceItem_CreatedAt DEFAULT (SYSDATETIME()),
    CONSTRAINT PK_CodRemittanceItem PRIMARY KEY (CodRemittanceId, CodCollectionId),
    CONSTRAINT FK_CodRemittanceItem_Remittance FOREIGN KEY (CodRemittanceId)
      REFERENCES dbo.CodRemittance(CodRemittanceId),
    CONSTRAINT FK_CodRemittanceItem_Collection FOREIGN KEY (CodCollectionId)
      REFERENCES dbo.CodCollection(CodCollectionId),
    CONSTRAINT CK_CodRemittanceItem_Amount CHECK (Amount > 0)
  );
END;

IF OBJECT_ID('dbo.CodRemittanceStatusHistory', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CodRemittanceStatusHistory (
    CodRemittanceStatusHistoryId BIGINT IDENTITY(1,1) NOT NULL
      CONSTRAINT PK_CodRemittanceStatusHistory PRIMARY KEY,
    CodRemittanceId BIGINT NOT NULL,
    FromStatus VARCHAR(30) NULL,
    ToStatus VARCHAR(30) NOT NULL,
    ChangedByUserId BIGINT NOT NULL,
    Note NVARCHAR(500) NULL,
    ChangedAt DATETIME2(0) NOT NULL
      CONSTRAINT DF_CodRemittanceStatusHistory_ChangedAt DEFAULT (SYSDATETIME()),
    CONSTRAINT FK_CodRemittanceStatusHistory_Remittance FOREIGN KEY (CodRemittanceId)
      REFERENCES dbo.CodRemittance(CodRemittanceId),
    CONSTRAINT FK_CodRemittanceStatusHistory_User FOREIGN KEY (ChangedByUserId)
      REFERENCES dbo.UserAccount(UserId),
    CONSTRAINT CK_CodRemittanceStatusHistory_FromStatus CHECK (
      FromStatus IS NULL OR FromStatus IN ('Submitted', 'Confirmed', 'Rejected', 'Cancelled')
    ),
    CONSTRAINT CK_CodRemittanceStatusHistory_ToStatus CHECK (
      ToStatus IN ('Submitted', 'Confirmed', 'Rejected', 'Cancelled')
    )
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.CodCollection')
    AND name = 'IX_CodCollection_Staff_Status_Date'
)
  CREATE INDEX IX_CodCollection_Staff_Status_Date
    ON dbo.CodCollection(DeliveryStaffId, Status, CollectedAt DESC);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.CodRemittance')
    AND name = 'IX_CodRemittance_Status_Date'
)
  CREATE INDEX IX_CodRemittance_Status_Date
    ON dbo.CodRemittance(Status, SubmittedAt DESC, DeliveryStaffId);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.CodRemittanceItem')
    AND name = 'IX_CodRemittanceItem_Collection'
)
  CREATE INDEX IX_CodRemittanceItem_Collection
    ON dbo.CodRemittanceItem(CodCollectionId, CodRemittanceId)
    INCLUDE (Amount);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.CodRemittanceStatusHistory')
    AND name = 'IX_CodRemittanceHistory_Remittance_Date'
)
  CREATE INDEX IX_CodRemittanceHistory_Remittance_Date
    ON dbo.CodRemittanceStatusHistory(CodRemittanceId, ChangedAt DESC);

COMMIT TRANSACTION;
