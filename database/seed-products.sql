SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;

BEGIN TRANSACTION;

MERGE dbo.Category AS target
USING (VALUES
  (N'Tivi', 'tivi'),
  (N'Máy giặt', 'may-giat'),
  (N'Tủ lạnh', 'tu-lanh'),
  (N'Robot hút bụi', 'robot-hut-bui'),
  (N'Máy lọc không khí', 'may-loc-khong-khi')
) AS source(CategoryName, Slug)
ON target.Slug = source.Slug
WHEN MATCHED THEN
  UPDATE SET CategoryName = source.CategoryName, Status = 'Active'
WHEN NOT MATCHED THEN
  INSERT (CategoryName, Slug, Status)
  VALUES (source.CategoryName, source.Slug, 'Active');

MERGE dbo.Brand AS target
USING (VALUES
  (N'Samsung', N'Hàn Quốc'),
  (N'LG', N'Hàn Quốc'),
  (N'Sony', N'Nhật Bản'),
  (N'TCL', N'Trung Quốc'),
  (N'Aqua', N'Nhật Bản'),
  (N'Hitachi', N'Nhật Bản'),
  (N'Toshiba', N'Nhật Bản'),
  (N'Panasonic', N'Nhật Bản'),
  (N'Xiaomi', N'Trung Quốc'),
  (N'Dreame', N'Trung Quốc'),
  (N'Ecovacs', N'Trung Quốc'),
  (N'Philips', N'Hà Lan'),
  (N'Sharp', N'Nhật Bản')
) AS source(BrandName, Country)
ON target.BrandName = source.BrandName
WHEN MATCHED THEN
  UPDATE SET Country = source.Country, Status = 'Active'
WHEN NOT MATCHED THEN
  INSERT (BrandName, Country, Status)
  VALUES (source.BrandName, source.Country, 'Active');

IF NOT EXISTS (SELECT 1 FROM dbo.Warehouse WHERE WarehouseName = N'Kho trung tâm')
BEGIN
  INSERT dbo.Warehouse (WarehouseName, Address, Status)
  VALUES (N'Kho trung tâm', N'Thành phố Hồ Chí Minh', 'Active');
END;

DECLARE @Products TABLE (
  CategorySlug varchar(200),
  BrandName nvarchar(150),
  ProductName nvarchar(255),
  Slug varchar(255),
  Description nvarchar(max),
  Price decimal(18,2),
  CostPrice decimal(18,2),
  WarrantyMonths int,
  InstallRequired bit,
  SkuCode varchar(100),
  Quantity int
);

INSERT @Products VALUES
('tivi', N'TCL', N'TCL Google TV QD-Mini LED 55C6KS 55 inch 4K', 'tcl-google-tv-55c6ks',
 N'Tivi 4K màn hình 55 inch, nền tảng Google TV, phù hợp phòng khách hiện đại.', 15220000, 12900000, 24, 1, 'TV-TCL-55C6KS', 12),
('tivi', N'Samsung', N'Samsung Smart TV QLED QA65Q6FA 65 inch 4K', 'samsung-qled-qa65q6fa',
 N'Smart TV QLED 65 inch độ phân giải 4K, thiết kế viền mỏng và kho ứng dụng thông minh.', 12990000, 11000000, 24, 1, 'TV-SS-QA65Q6FA', 10),
('tivi', N'LG', N'LG Smart TV NanoCell 55NANO80ASA 55 inch 4K', 'lg-nanocell-55nano80asa',
 N'Tivi NanoCell 55 inch với hình ảnh 4K và hệ điều hành thông minh dễ sử dụng.', 12990000, 10900000, 24, 1, 'TV-LG-55NANO80', 9),
('tivi', N'Sony', N'Sony Google TV BRAVIA 2 II K-55S25VM2 55 inch 4K', 'sony-bravia-k55s25vm2',
 N'Google TV BRAVIA 55 inch, hình ảnh 4K và khả năng truy cập nội dung trực tuyến.', 17090000, 14500000, 24, 1, 'TV-SN-K55S25', 7),

('may-giat', N'Aqua', N'Máy giặt Aqua 11 Kg AQW-FR110JT BK', 'aqua-11kg-aqw-fr110jt',
 N'Máy giặt khối lượng 11 kg, đáp ứng nhu cầu giặt giũ của gia đình đông người.', 5190000, 4400000, 24, 1, 'WM-AQ-FR110JT', 16),
('may-giat', N'Hitachi', N'Máy giặt Hitachi Inverter 10 Kg LTL 10MV00 GG', 'hitachi-inverter-10kg-ltl10mv00',
 N'Máy giặt Inverter 10 kg vận hành tiết kiệm điện, phù hợp gia đình từ 5 đến 7 người.', 6490000, 5500000, 24, 1, 'WM-HT-LTL10MV', 11),
('may-giat', N'Toshiba', N'Máy giặt Toshiba Inverter 12 Kg AW-DUK1300KV', 'toshiba-inverter-12kg-aw-duk1300kv',
 N'Máy giặt Inverter 12 kg với lồng giặt lớn và nhiều chương trình chăm sóc quần áo.', 7090000, 6000000, 24, 1, 'WM-TS-DUK1300', 8),
('may-giat', N'Panasonic', N'Máy giặt Panasonic 8.5 Kg NA-F85A9BRV', 'panasonic-85kg-na-f85a9brv',
 N'Máy giặt cửa trên 8.5 kg, thiết kế gọn và phù hợp nhu cầu gia đình nhỏ.', 4970000, 4200000, 24, 1, 'WM-PN-F85A9', 14),

('tu-lanh', N'Samsung', N'Tủ lạnh Samsung Inverter 236 lít RT22M4032BY/SV', 'samsung-inverter-236l-rt22m4032by',
 N'Tủ lạnh Inverter 236 lít, thiết kế hai cửa và dung tích phù hợp gia đình nhỏ.', 6170000, 5200000, 24, 1, 'RF-SS-RT22M4032', 10),
('tu-lanh', N'Samsung', N'Tủ lạnh Samsung Inverter 488 lít RF48A4010B4/SV', 'samsung-inverter-488l-rf48a4010b4',
 N'Tủ lạnh nhiều cửa dung tích 488 lít, không gian lưu trữ rộng cho gia đình.', 18410000, 15600000, 24, 1, 'RF-SS-RF48A4010', 6),
('tu-lanh', N'Aqua', N'Tủ lạnh Aqua Inverter 358 lít AQR-T410FA', 'aqua-inverter-358l-aqr-t410fa',
 N'Tủ lạnh Inverter 358 lít với bề mặt hiện đại và ngăn chứa linh hoạt.', 9840000, 8300000, 24, 1, 'RF-AQ-T410FA', 9),
('tu-lanh', N'LG', N'Tủ lạnh LG Inverter 315 lít LTB31BLM', 'lg-inverter-315l-ltb31blm',
 N'Tủ lạnh Inverter 315 lít, cân bằng giữa dung tích sử dụng và khả năng tiết kiệm điện.', 9180000, 7800000, 24, 1, 'RF-LG-LTB31BLM', 8),

('robot-hut-bui', N'Xiaomi', N'Robot hút bụi lau nhà Xiaomi Vacuum E5', 'xiaomi-vacuum-e5',
 N'Robot hút bụi kết hợp lau nhà, thời lượng hoạt động khoảng 120 phút.', 1990000, 1650000, 12, 0, 'RB-XM-VAC-E5', 20),
('robot-hut-bui', N'Xiaomi', N'Robot hút bụi lau nhà Xiaomi X20+', 'xiaomi-robot-x20-plus',
 N'Robot hút bụi lau nhà có trạm hỗ trợ làm sạch, thời lượng sử dụng khoảng 140 phút.', 7890000, 6700000, 12, 0, 'RB-XM-X20PLUS', 13),
('robot-hut-bui', N'Dreame', N'Robot hút bụi lau nhà Dreame D20 Ultra', 'dreame-d20-ultra',
 N'Robot hút bụi lau nhà cao cấp với khả năng làm sạch tự động và quản lý qua ứng dụng.', 9990000, 8400000, 12, 0, 'RB-DR-D20ULT', 7),
('robot-hut-bui', N'Ecovacs', N'Robot hút bụi Ecovacs Deebot N30 PRO OMNI', 'ecovacs-deebot-n30-pro-omni',
 N'Robot hút bụi lau nhà có trạm OMNI và thời lượng hoạt động dài.', 7890000, 6650000, 12, 0, 'RB-EC-N30PRO', 9),

('may-loc-khong-khi', N'Xiaomi', N'Máy lọc không khí Xiaomi Smart Air Purifier 4 Lite', 'xiaomi-air-purifier-4-lite',
 N'Máy lọc không khí công suất 33W, kết nối thông minh và phù hợp phòng sinh hoạt.', 2340000, 1950000, 12, 0, 'AP-XM-4LITE', 18),
('may-loc-khong-khi', N'LG', N'Máy lọc không khí LG PuriCare 360 Hit AS60GHWG0', 'lg-puricare-360-as60ghwg0',
 N'Máy lọc không khí dạng tháp 360 độ, hỗ trợ theo dõi chất lượng không khí.', 4990000, 4200000, 12, 0, 'AP-LG-AS60', 10),
('may-loc-khong-khi', N'Sharp', N'Máy lọc không khí Sharp FP-J30E-A', 'sharp-air-purifier-fp-j30e-a',
 N'Máy lọc không khí nhỏ gọn công suất 50W, phù hợp phòng ngủ và phòng làm việc.', 1990000, 1650000, 12, 0, 'AP-SH-FPJ30', 15),
('may-loc-khong-khi', N'Philips', N'Máy lọc không khí Philips AC0950/10', 'philips-air-purifier-ac0950-10',
 N'Máy lọc không khí công suất 23W với thiết kế gọn, phù hợp không gian gia đình.', 4240000, 3600000, 24, 0, 'AP-PH-AC0950', 11);

MERGE dbo.Product AS target
USING (
  SELECT c.CategoryId, b.BrandId, p.*
  FROM @Products p
  JOIN dbo.Category c ON c.Slug = p.CategorySlug
  JOIN dbo.Brand b ON b.BrandName = p.BrandName
) AS source
ON target.Slug = source.Slug
WHEN MATCHED THEN UPDATE SET
  CategoryId = source.CategoryId,
  BrandId = source.BrandId,
  ProductName = source.ProductName,
  Description = source.Description,
  BasePrice = source.Price,
  WarrantyMonths = source.WarrantyMonths,
  InstallRequired = source.InstallRequired,
  Status = 'Active',
  UpdatedAt = SYSUTCDATETIME()
WHEN NOT MATCHED THEN INSERT
  (CategoryId, BrandId, ProductName, Slug, Description, BasePrice,
   WarrantyMonths, InstallRequired, Status)
VALUES
  (source.CategoryId, source.BrandId, source.ProductName, source.Slug,
   source.Description, source.Price, source.WarrantyMonths,
   source.InstallRequired, 'Active');

MERGE dbo.ProductSku AS target
USING (
  SELECT product.ProductId, seed.SkuCode, seed.Price, seed.CostPrice
  FROM @Products seed
  JOIN dbo.Product product ON product.Slug = seed.Slug
) AS source
ON target.SkuCode = source.SkuCode
WHEN MATCHED THEN UPDATE SET
  ProductId = source.ProductId,
  Price = source.Price,
  CostPrice = source.CostPrice,
  Status = 'Active'
WHEN NOT MATCHED THEN INSERT
  (ProductId, SkuCode, VariantName, Price, CostPrice, Status)
VALUES
  (source.ProductId, source.SkuCode, N'Phiên bản tiêu chuẩn',
   source.Price, source.CostPrice, 'Active');

DECLARE @WarehouseId bigint = (
  SELECT TOP (1) WarehouseId
  FROM dbo.Warehouse
  WHERE WarehouseName = N'Kho trung tâm'
);

MERGE dbo.Inventory AS target
USING (
  SELECT @WarehouseId AS WarehouseId, sku.SkuId, seed.Quantity
  FROM @Products seed
  JOIN dbo.ProductSku sku ON sku.SkuCode = seed.SkuCode
) AS source
ON target.WarehouseId = source.WarehouseId AND target.SkuId = source.SkuId
WHEN MATCHED THEN UPDATE SET
  QuantityOnHand = source.Quantity,
  QuantityReserved = 0,
  ReorderLevel = 3,
  UpdatedAt = SYSUTCDATETIME()
WHEN NOT MATCHED THEN INSERT
  (WarehouseId, SkuId, QuantityOnHand, QuantityReserved, ReorderLevel)
VALUES
  (source.WarehouseId, source.SkuId, source.Quantity, 0, 3);

COMMIT TRANSACTION;

SELECT
  (SELECT COUNT(*) FROM dbo.Category) AS CategoryCount,
  (SELECT COUNT(*) FROM dbo.Brand) AS BrandCount,
  (SELECT COUNT(*) FROM dbo.Product) AS ProductCount,
  (SELECT COUNT(*) FROM dbo.ProductSku) AS SkuCount,
  (SELECT SUM(QuantityOnHand) FROM dbo.Inventory) AS StockQuantity;
