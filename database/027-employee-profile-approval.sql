SET XACT_ABORT ON;
GO

IF OBJECT_ID('dbo.EmployeeProfile', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.EmployeeProfile (
    EmployeeId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_EmployeeProfile PRIMARY KEY,
    UserId BIGINT NOT NULL,
    EmployeeCode VARCHAR(50) NOT NULL,
    Position NVARCHAR(100) NULL,
    Department NVARCHAR(100) NULL,
    CONSTRAINT UQ_EmployeeProfile_UserId UNIQUE (UserId),
    CONSTRAINT UQ_EmployeeProfile_EmployeeCode UNIQUE (EmployeeCode),
    CONSTRAINT FK_EmployeeProfile_UserAccount FOREIGN KEY (UserId) REFERENCES dbo.UserAccount(UserId)
  );
END;
GO

IF COL_LENGTH('dbo.EmployeeProfile', 'DateOfBirth') IS NULL
  ALTER TABLE dbo.EmployeeProfile ADD DateOfBirth DATE NULL;
GO

IF COL_LENGTH('dbo.EmployeeProfile', 'Gender') IS NULL
  ALTER TABLE dbo.EmployeeProfile ADD Gender VARCHAR(20) NULL;
GO

IF COL_LENGTH('dbo.EmployeeProfile', 'ProvinceCode') IS NULL
  ALTER TABLE dbo.EmployeeProfile ADD ProvinceCode VARCHAR(10) NULL;
GO

IF COL_LENGTH('dbo.EmployeeProfile', 'WardCode') IS NULL
  ALTER TABLE dbo.EmployeeProfile ADD WardCode VARCHAR(10) NULL;
GO

IF COL_LENGTH('dbo.EmployeeProfile', 'StreetAddress') IS NULL
  ALTER TABLE dbo.EmployeeProfile ADD StreetAddress NVARCHAR(300) NULL;
GO

IF COL_LENGTH('dbo.EmployeeProfile', 'HireDate') IS NULL
  ALTER TABLE dbo.EmployeeProfile ADD HireDate DATE NULL;
GO

IF COL_LENGTH('dbo.EmployeeProfile', 'ApprovalStatus') IS NULL
  ALTER TABLE dbo.EmployeeProfile ADD ApprovalStatus VARCHAR(20) NOT NULL
    CONSTRAINT DF_EmployeeProfile_ApprovalStatus DEFAULT ('Pending');
GO

IF COL_LENGTH('dbo.EmployeeProfile', 'CreatedByUserId') IS NULL
  ALTER TABLE dbo.EmployeeProfile ADD CreatedByUserId BIGINT NULL;
GO

IF COL_LENGTH('dbo.EmployeeProfile', 'ApprovedByUserId') IS NULL
  ALTER TABLE dbo.EmployeeProfile ADD ApprovedByUserId BIGINT NULL;
GO

IF COL_LENGTH('dbo.EmployeeProfile', 'ApprovedAt') IS NULL
  ALTER TABLE dbo.EmployeeProfile ADD ApprovedAt DATETIME2(0) NULL;
GO

IF COL_LENGTH('dbo.EmployeeProfile', 'RejectionReason') IS NULL
  ALTER TABLE dbo.EmployeeProfile ADD RejectionReason NVARCHAR(500) NULL;
GO

IF COL_LENGTH('dbo.EmployeeProfile', 'CreatedAt') IS NULL
  ALTER TABLE dbo.EmployeeProfile ADD CreatedAt DATETIME2(0) NOT NULL
    CONSTRAINT DF_EmployeeProfile_CreatedAt DEFAULT (SYSDATETIME());
GO

IF COL_LENGTH('dbo.EmployeeProfile', 'UpdatedAt') IS NULL
  ALTER TABLE dbo.EmployeeProfile ADD UpdatedAt DATETIME2(0) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_EmployeeProfile_Gender')
  ALTER TABLE dbo.EmployeeProfile WITH CHECK ADD CONSTRAINT CK_EmployeeProfile_Gender
    CHECK (Gender IS NULL OR Gender IN ('Male', 'Female', 'Other'));
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_EmployeeProfile_ApprovalStatus')
  ALTER TABLE dbo.EmployeeProfile WITH CHECK ADD CONSTRAINT CK_EmployeeProfile_ApprovalStatus
    CHECK (ApprovalStatus IN ('Pending', 'Approved', 'Rejected'));
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_EmployeeProfile_ApprovedCompleteness')
  ALTER TABLE dbo.EmployeeProfile WITH CHECK ADD CONSTRAINT CK_EmployeeProfile_ApprovedCompleteness
    CHECK (
      ApprovalStatus <> 'Approved'
      OR (
        NULLIF(LTRIM(RTRIM(Position)), '') IS NOT NULL
        AND NULLIF(LTRIM(RTRIM(Department)), '') IS NOT NULL
        AND DateOfBirth IS NOT NULL
        AND Gender IS NOT NULL
        AND ProvinceCode IS NOT NULL
        AND WardCode IS NOT NULL
        AND NULLIF(LTRIM(RTRIM(StreetAddress)), '') IS NOT NULL
        AND HireDate IS NOT NULL
        AND ApprovedByUserId IS NOT NULL
        AND ApprovedAt IS NOT NULL
      )
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_EmployeeProfile_Province')
  ALTER TABLE dbo.EmployeeProfile WITH CHECK ADD CONSTRAINT FK_EmployeeProfile_Province
    FOREIGN KEY (ProvinceCode) REFERENCES dbo.AdministrativeProvince(ProvinceCode);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_EmployeeProfile_Ward')
  ALTER TABLE dbo.EmployeeProfile WITH CHECK ADD CONSTRAINT FK_EmployeeProfile_Ward
    FOREIGN KEY (WardCode) REFERENCES dbo.AdministrativeWard(WardCode);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_EmployeeProfile_CreatedBy')
  ALTER TABLE dbo.EmployeeProfile WITH CHECK ADD CONSTRAINT FK_EmployeeProfile_CreatedBy
    FOREIGN KEY (CreatedByUserId) REFERENCES dbo.UserAccount(UserId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_EmployeeProfile_ApprovedBy')
  ALTER TABLE dbo.EmployeeProfile WITH CHECK ADD CONSTRAINT FK_EmployeeProfile_ApprovedBy
    FOREIGN KEY (ApprovedByUserId) REFERENCES dbo.UserAccount(UserId);
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_EmployeeProfile_ApprovalStatus' AND object_id = OBJECT_ID('dbo.EmployeeProfile')
)
  CREATE INDEX IX_EmployeeProfile_ApprovalStatus ON dbo.EmployeeProfile(ApprovalStatus, EmployeeId);
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_UserAccount_Status')
  ALTER TABLE dbo.UserAccount DROP CONSTRAINT CK_UserAccount_Status;
GO

ALTER TABLE dbo.UserAccount WITH CHECK ADD CONSTRAINT CK_UserAccount_Status
  CHECK (Status IN ('Pending', 'Active', 'Locked', 'Disabled'));
GO
