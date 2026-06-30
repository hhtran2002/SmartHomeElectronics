DECLARE @SkuId BIGINT = (
  SELECT TOP (1) SkuId
  FROM dbo.ProductSku
  WHERE SkuCode = 'AP-PH-AC0950'
);

IF @SkuId IS NOT NULL
   AND NOT EXISTS (
    SELECT 1
    FROM dbo.Promotion
    WHERE PromotionName = N'Sale demo máy lọc không khí Philips'
  )
BEGIN
  DECLARE @Promotion TABLE (PromotionId BIGINT);

  INSERT INTO dbo.Promotion (
    PromotionName,
    DiscountType,
    DiscountValue,
    StartAt,
    EndAt,
    Status
  )
  OUTPUT INSERTED.PromotionId INTO @Promotion
  VALUES (
    N'Sale demo máy lọc không khí Philips',
    'FixedPrice',
    3990000,
    DATEADD(day, -1, SYSDATETIME()),
    DATEADD(day, 14, SYSDATETIME()),
    'Active'
  );

  INSERT INTO dbo.PromotionSku (PromotionId, SkuId)
  SELECT PromotionId, @SkuId
  FROM @Promotion;
END;
