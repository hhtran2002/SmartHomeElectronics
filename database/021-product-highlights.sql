IF COL_LENGTH('dbo.Product', 'Highlights') IS NULL
BEGIN
  ALTER TABLE dbo.Product ADD Highlights NVARCHAR(MAX) NULL;
END;
