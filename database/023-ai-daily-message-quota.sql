SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

IF OBJECT_ID('dbo.AiDailyUsage', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.AiDailyUsage (
    AiDailyUsageId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AiDailyUsage PRIMARY KEY,
    UserId BIGINT NOT NULL,
    UsageDate DATE NOT NULL,
    MessageCount INT NOT NULL CONSTRAINT DF_AiDailyUsage_MessageCount DEFAULT (0),
    UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_AiDailyUsage_UpdatedAt DEFAULT (SYSDATETIME()),
    CONSTRAINT FK_AiDailyUsage_UserAccount FOREIGN KEY (UserId) REFERENCES dbo.UserAccount(UserId),
    CONSTRAINT UQ_AiDailyUsage_User_Date UNIQUE (UserId, UsageDate),
    CONSTRAINT CK_AiDailyUsage_MessageCount CHECK (MessageCount >= 0)
  );
END;
