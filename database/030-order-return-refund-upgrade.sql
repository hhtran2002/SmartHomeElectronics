IF OBJECT_ID('dbo.OrderReturnRequest', 'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.OrderReturnRequest', 'EvidenceUrl') IS NULL
    ALTER TABLE dbo.OrderReturnRequest ADD EvidenceUrl NVARCHAR(500) NULL;

  IF COL_LENGTH('dbo.OrderReturnRequest', 'RefundMethod') IS NULL
    ALTER TABLE dbo.OrderReturnRequest ADD RefundMethod VARCHAR(20) NOT NULL CONSTRAINT DF_OrderReturnRequest_RefundMethod DEFAULT 'BankTransfer';

  IF COL_LENGTH('dbo.OrderReturnRequest', 'BankName') IS NULL
    ALTER TABLE dbo.OrderReturnRequest ADD BankName NVARCHAR(100) NULL;

  IF COL_LENGTH('dbo.OrderReturnRequest', 'BankAccountNumber') IS NULL
    ALTER TABLE dbo.OrderReturnRequest ADD BankAccountNumber VARCHAR(50) NULL;

  IF COL_LENGTH('dbo.OrderReturnRequest', 'BankAccountName') IS NULL
    ALTER TABLE dbo.OrderReturnRequest ADD BankAccountName NVARCHAR(150) NULL;

  IF COL_LENGTH('dbo.OrderReturnRequest', 'RefundStatus') IS NULL
    ALTER TABLE dbo.OrderReturnRequest ADD RefundStatus VARCHAR(20) NOT NULL CONSTRAINT DF_OrderReturnRequest_RefundStatus DEFAULT 'Pending';

  IF COL_LENGTH('dbo.OrderReturnRequest', 'RefundAmount') IS NULL
    ALTER TABLE dbo.OrderReturnRequest ADD RefundAmount DECIMAL(18,2) NULL;

  -- Backfill EvidenceUrl from ImageUrl if existing
  EXEC('UPDATE dbo.OrderReturnRequest SET EvidenceUrl = ImageUrl WHERE EvidenceUrl IS NULL AND ImageUrl IS NOT NULL;');
END;
