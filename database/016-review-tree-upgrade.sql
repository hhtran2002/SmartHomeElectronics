IF COL_LENGTH('dbo.Review', 'ParentReviewId') IS NULL
BEGIN
  ALTER TABLE dbo.Review
    ADD ParentReviewId BIGINT NULL;
END;

IF COL_LENGTH('dbo.Review', 'UpdatedAt') IS NULL
BEGIN
  ALTER TABLE dbo.Review
    ADD UpdatedAt DATETIME2 NULL;
END;

IF COL_LENGTH('dbo.Review', 'ModeratedAt') IS NULL
BEGIN
  ALTER TABLE dbo.Review
    ADD ModeratedAt DATETIME2 NULL;
END;

IF COL_LENGTH('dbo.Review', 'ModeratedBy') IS NULL
BEGIN
  ALTER TABLE dbo.Review
    ADD ModeratedBy BIGINT NULL;
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.foreign_keys
  WHERE name = 'FK_Review_ParentReview'
    AND parent_object_id = OBJECT_ID('dbo.Review')
)
BEGIN
  ALTER TABLE dbo.Review
    ADD CONSTRAINT FK_Review_ParentReview
      FOREIGN KEY (ParentReviewId) REFERENCES dbo.Review(ReviewId);
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.foreign_keys
  WHERE name = 'FK_Review_ModeratedBy'
    AND parent_object_id = OBJECT_ID('dbo.Review')
)
BEGIN
  ALTER TABLE dbo.Review
    ADD CONSTRAINT FK_Review_ModeratedBy
      FOREIGN KEY (ModeratedBy) REFERENCES dbo.UserAccount(UserId);
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.check_constraints
  WHERE name = 'CK_Review_Status'
    AND parent_object_id = OBJECT_ID('dbo.Review')
)
BEGIN
  ALTER TABLE dbo.Review
    ADD CONSTRAINT CK_Review_Status
      CHECK (Status IN ('Pending', 'Approved', 'Hidden', 'Rejected'));
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_Review_Product_Status_Parent'
    AND object_id = OBJECT_ID('dbo.Review')
)
BEGIN
  CREATE INDEX IX_Review_Product_Status_Parent
    ON dbo.Review(ProductId, Status, ParentReviewId, CreatedAt);
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_Review_User_Product'
    AND object_id = OBJECT_ID('dbo.Review')
)
BEGIN
  CREATE INDEX IX_Review_User_Product
    ON dbo.Review(UserId, ProductId);
END;
