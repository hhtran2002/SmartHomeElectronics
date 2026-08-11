IF OBJECT_ID('dbo.AppSetting', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.AppSetting (
    SettingKey VARCHAR(100) NOT NULL,
    SettingValue NVARCHAR(1000) NOT NULL,
    UpdatedAt DATETIME2(0) NOT NULL
      CONSTRAINT DF_AppSetting_UpdatedAt DEFAULT SYSDATETIME(),
    UpdatedBy BIGINT NULL,
    CONSTRAINT PK_AppSetting PRIMARY KEY (SettingKey),
    CONSTRAINT FK_AppSetting_UpdatedBy FOREIGN KEY (UpdatedBy)
      REFERENCES dbo.UserAccount(UserId)
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM dbo.AppSetting WHERE SettingKey = 'ReviewModerationRequired'
)
BEGIN
  INSERT INTO dbo.AppSetting (SettingKey, SettingValue)
  VALUES ('ReviewModerationRequired', N'true');
END;
