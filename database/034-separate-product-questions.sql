SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
GO

IF COL_LENGTH('dbo.Review', 'ContentType') IS NULL
BEGIN
  ALTER TABLE dbo.Review
    ADD ContentType VARCHAR(20) NOT NULL
      CONSTRAINT DF_Review_ContentType DEFAULT 'Review';
END;
GO

;WITH ContentTree AS (
  SELECT
    ReviewId,
    CAST(CASE WHEN OrderDetailId IS NULL THEN 'Question' ELSE 'Review' END AS VARCHAR(20)) AS ContentType
  FROM dbo.Review
  WHERE ParentReviewId IS NULL

  UNION ALL

  SELECT child.ReviewId, parent.ContentType
  FROM dbo.Review child
  INNER JOIN ContentTree parent ON parent.ReviewId = child.ParentReviewId
)
UPDATE review
SET ContentType = tree.ContentType
FROM dbo.Review review
INNER JOIN ContentTree tree ON tree.ReviewId = review.ReviewId
OPTION (MAXRECURSION 0);

IF NOT EXISTS (
  SELECT 1
  FROM sys.check_constraints
  WHERE name = 'CK_Review_ContentType'
    AND parent_object_id = OBJECT_ID('dbo.Review')
)
BEGIN
  ALTER TABLE dbo.Review
    ADD CONSTRAINT CK_Review_ContentType
      CHECK (ContentType IN ('Review', 'Question'));
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_Review_Product_ContentType_Status'
    AND object_id = OBJECT_ID('dbo.Review')
)
BEGIN
  CREATE INDEX IX_Review_Product_ContentType_Status
    ON dbo.Review(ProductId, ContentType, Status, ParentReviewId, CreatedAt);
END;
