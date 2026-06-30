IF OBJECT_ID('dbo.AdministrativeWard', 'U') IS NOT NULL
  DROP TABLE dbo.AdministrativeWard;

IF OBJECT_ID('dbo.AdministrativeProvince', 'U') IS NOT NULL
  DROP TABLE dbo.AdministrativeProvince;

CREATE TABLE dbo.AdministrativeProvince (
  ProvinceCode VARCHAR(10) NOT NULL CONSTRAINT PK_AdministrativeProvince PRIMARY KEY,
  ProvinceName NVARCHAR(150) NOT NULL
);

CREATE TABLE dbo.AdministrativeWard (
  WardCode VARCHAR(10) NOT NULL CONSTRAINT PK_AdministrativeWard PRIMARY KEY,
  ProvinceCode VARCHAR(10) NOT NULL,
  WardName NVARCHAR(150) NOT NULL,
  CONSTRAINT FK_AdministrativeWard_Province
    FOREIGN KEY (ProvinceCode) REFERENCES dbo.AdministrativeProvince(ProvinceCode)
);

CREATE INDEX IX_AdministrativeWard_ProvinceCode
  ON dbo.AdministrativeWard(ProvinceCode, WardName);

IF COL_LENGTH('dbo.Address', 'ProvinceCode') IS NULL
  ALTER TABLE dbo.Address ADD ProvinceCode VARCHAR(10) NULL;

IF COL_LENGTH('dbo.Address', 'WardCode') IS NULL
  ALTER TABLE dbo.Address ADD WardCode VARCHAR(10) NULL;
