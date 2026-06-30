IF NOT EXISTS (SELECT 1 FROM dbo.Coupon WHERE CouponCode = 'AASMART50')
BEGIN
  INSERT INTO dbo.Coupon (
    CouponCode, CouponName, DiscountType, DiscountValue, MaxDiscountAmount,
    MinOrderAmount, UsageLimit, UsedCount, UsagePerCustomer,
    StartAt, EndAt, Status, CreatedAt
  )
  VALUES (
    'AASMART50', N'Giảm 50k demo checkout', 'FixedAmount', 50000, NULL,
    1000000, 100, 0, 1,
    SYSDATETIME(), DATEADD(DAY, 30, SYSDATETIME()), 'Active', SYSDATETIME()
  );
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Coupon WHERE CouponCode = 'AASMART10')
BEGIN
  INSERT INTO dbo.Coupon (
    CouponCode, CouponName, DiscountType, DiscountValue, MaxDiscountAmount,
    MinOrderAmount, UsageLimit, UsedCount, UsagePerCustomer,
    StartAt, EndAt, Status, CreatedAt
  )
  VALUES (
    'AASMART10', N'Giảm 10% tối đa 300k', 'Percent', 10, 300000,
    2000000, 100, 0, 1,
    SYSDATETIME(), DATEADD(DAY, 30, SYSDATETIME()), 'Active', SYSDATETIME()
  );
END;
