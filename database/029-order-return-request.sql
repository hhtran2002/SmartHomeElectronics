IF OBJECT_ID('dbo.OrderReturnRequest', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.OrderReturnRequest (
    ReturnRequestId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    OrderId BIGINT NOT NULL,
    UserId BIGINT NOT NULL,
    Reason NVARCHAR(255) NOT NULL,
    Note NVARCHAR(1000) NULL,
    ImageUrl NVARCHAR(500) NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_OrderReturnRequest_Status DEFAULT 'Pending',
    AdminNote NVARCHAR(1000) NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_OrderReturnRequest_CreatedAt DEFAULT SYSDATETIME(),
    ProcessedAt DATETIME2 NULL,
    ProcessedBy BIGINT NULL,
    CONSTRAINT FK_OrderReturnRequest_SalesOrder FOREIGN KEY (OrderId) REFERENCES dbo.SalesOrder(OrderId),
    CONSTRAINT FK_OrderReturnRequest_UserAccount FOREIGN KEY (UserId) REFERENCES dbo.UserAccount(UserId),
    CONSTRAINT FK_OrderReturnRequest_ProcessedBy FOREIGN KEY (ProcessedBy) REFERENCES dbo.UserAccount(UserId),
    CONSTRAINT CK_OrderReturnRequest_Status CHECK (Status IN ('Pending', 'Approved', 'Rejected'))
  );

  CREATE INDEX IX_OrderReturnRequest_OrderId ON dbo.OrderReturnRequest(OrderId);
  CREATE INDEX IX_OrderReturnRequest_UserId ON dbo.OrderReturnRequest(UserId);
  CREATE INDEX IX_OrderReturnRequest_Status ON dbo.OrderReturnRequest(Status);
END;
