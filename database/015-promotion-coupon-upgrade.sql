IF COL_LENGTH('dbo.Coupon', 'CouponName') IS NULL
BEGIN
  ALTER TABLE dbo.Coupon
    ADD CouponName NVARCHAR(200) NULL;
END;

IF COL_LENGTH('dbo.Coupon', 'MaxDiscountAmount') IS NULL
BEGIN
  ALTER TABLE dbo.Coupon
    ADD MaxDiscountAmount DECIMAL(18, 2) NULL;
END;

IF COL_LENGTH('dbo.Coupon', 'UsagePerCustomer') IS NULL
BEGIN
  ALTER TABLE dbo.Coupon
    ADD UsagePerCustomer INT NULL;
END;

IF COL_LENGTH('dbo.Coupon', 'CreatedAt') IS NULL
BEGIN
  ALTER TABLE dbo.Coupon
    ADD CreatedAt DATETIME2 NOT NULL
      CONSTRAINT DF_Coupon_CreatedAt DEFAULT (SYSDATETIME());
END;

IF COL_LENGTH('dbo.Coupon', 'UpdatedAt') IS NULL
BEGIN
  ALTER TABLE dbo.Coupon
    ADD UpdatedAt DATETIME2 NULL;
END;

IF EXISTS (
  SELECT 1
  FROM sys.check_constraints
  WHERE name = 'CK_Promotion_DiscountType'
    AND parent_object_id = OBJECT_ID('dbo.Promotion')
)
BEGIN
  ALTER TABLE dbo.Promotion DROP CONSTRAINT CK_Promotion_DiscountType;
END;

ALTER TABLE dbo.Promotion
  ADD CONSTRAINT CK_Promotion_DiscountType
  CHECK (DiscountType IN ('Percent', 'FixedAmount', 'FixedPrice'));

IF EXISTS (
  SELECT 1
  FROM sys.check_constraints
  WHERE name = 'CK_Coupon_DiscountType'
    AND parent_object_id = OBJECT_ID('dbo.Coupon')
)
BEGIN
  ALTER TABLE dbo.Coupon DROP CONSTRAINT CK_Coupon_DiscountType;
END;

ALTER TABLE dbo.Coupon
  ADD CONSTRAINT CK_Coupon_DiscountType
  CHECK (DiscountType IN ('Percent', 'FixedAmount'));

IF NOT EXISTS (
  SELECT 1
  FROM sys.check_constraints
  WHERE name = 'CK_Coupon_MaxDiscountAmount'
    AND parent_object_id = OBJECT_ID('dbo.Coupon')
)
BEGIN
  EXEC('ALTER TABLE dbo.Coupon
    ADD CONSTRAINT CK_Coupon_MaxDiscountAmount
    CHECK (MaxDiscountAmount IS NULL OR MaxDiscountAmount > 0);');
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.check_constraints
  WHERE name = 'CK_Coupon_UsagePerCustomer'
    AND parent_object_id = OBJECT_ID('dbo.Coupon')
)
BEGIN
  EXEC('ALTER TABLE dbo.Coupon
    ADD CONSTRAINT CK_Coupon_UsagePerCustomer
    CHECK (UsagePerCustomer IS NULL OR UsagePerCustomer > 0);');
END;

IF OBJECT_ID('dbo.PromotionSku', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.PromotionSku (
    PromotionId BIGINT NOT NULL,
    SkuId BIGINT NOT NULL,
    CONSTRAINT PK_PromotionSku PRIMARY KEY (PromotionId, SkuId),
    CONSTRAINT FK_PromotionSku_Promotion
      FOREIGN KEY (PromotionId) REFERENCES dbo.Promotion(PromotionId),
    CONSTRAINT FK_PromotionSku_ProductSku
      FOREIGN KEY (SkuId) REFERENCES dbo.ProductSku(SkuId)
  );
END;

IF OBJECT_ID('dbo.CouponTarget', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CouponTarget (
    CouponTargetId BIGINT IDENTITY(1,1) NOT NULL
      CONSTRAINT PK_CouponTarget PRIMARY KEY,
    CouponId BIGINT NOT NULL,
    TargetType VARCHAR(30) NOT NULL,
    TargetId BIGINT NULL,
    CreatedAt DATETIME2 NOT NULL
      CONSTRAINT DF_CouponTarget_CreatedAt DEFAULT (SYSDATETIME()),
    CONSTRAINT FK_CouponTarget_Coupon
      FOREIGN KEY (CouponId) REFERENCES dbo.Coupon(CouponId),
    CONSTRAINT CK_CouponTarget_TargetType
      CHECK (TargetType IN ('All', 'Category', 'Brand', 'Product', 'Sku', 'Customer')),
    CONSTRAINT CK_CouponTarget_TargetId
      CHECK (
        (TargetType = 'All' AND TargetId IS NULL)
        OR (TargetType <> 'All' AND TargetId IS NOT NULL)
      )
  );

  CREATE INDEX IX_CouponTarget_CouponId
    ON dbo.CouponTarget(CouponId);
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_Promotion_Time_Status'
    AND object_id = OBJECT_ID('dbo.Promotion')
)
BEGIN
  CREATE INDEX IX_Promotion_Time_Status
    ON dbo.Promotion(Status, StartAt, EndAt);
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_Coupon_Code_Status_Time'
    AND object_id = OBJECT_ID('dbo.Coupon')
)
BEGIN
  CREATE INDEX IX_Coupon_Code_Status_Time
    ON dbo.Coupon(CouponCode, Status, StartAt, EndAt);
END;
