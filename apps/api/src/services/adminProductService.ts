import { getPool, sql } from '../config/database.js'

export type AdminProductInput = {
  productName: string
  categoryId: number
  brandId: number
  description: string
  basePrice: number
  warrantyMonths: number
  installRequired: boolean
  skuId?: number
  skuCode: string
  price: number
  costPrice: number | null
  imageUrl: string
}

function makeSlug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function getAdminProducts() {
  const pool = await getPool()
  const result = await pool.request().query(`
    SELECT TOP (200)
      p.ProductId AS productId,
      p.ProductName AS productName,
      p.Slug AS slug,
      p.BasePrice AS basePrice,
      p.WarrantyMonths AS warrantyMonths,
      p.InstallRequired AS installRequired,
      p.Status AS status,
      c.CategoryId AS categoryId,
      c.CategoryName AS categoryName,
      b.BrandId AS brandId,
      b.BrandName AS brandName,
      sku.SkuId AS skuId,
      sku.SkuCode AS skuCode,
      sku.Price AS price,
      sku.CostPrice AS costPrice,
      sku.Status AS skuStatus,
      image.ImageUrl AS imageUrl,
      ISNULL(inventory.AvailableQuantity, 0) AS availableQuantity
    FROM dbo.Product p
    INNER JOIN dbo.Category c ON c.CategoryId = p.CategoryId
    INNER JOIN dbo.Brand b ON b.BrandId = p.BrandId
    OUTER APPLY (
      SELECT TOP (1) ps.*
      FROM dbo.ProductSku ps
      WHERE ps.ProductId = p.ProductId
      ORDER BY CASE WHEN ps.Status = 'Active' THEN 0 ELSE 1 END, ps.SkuId
    ) sku
    OUTER APPLY (
      SELECT TOP (1) pi.ImageUrl
      FROM dbo.ProductImage pi
      WHERE pi.ProductId = p.ProductId
      ORDER BY pi.IsPrimary DESC, pi.SortOrder, pi.ImageId
    ) image
    OUTER APPLY (
      SELECT SUM(i.QuantityOnHand - i.QuantityReserved) AS AvailableQuantity
      FROM dbo.Inventory i
      WHERE i.SkuId = sku.SkuId
    ) inventory
    ORDER BY p.ProductId DESC
  `)
  return result.recordset
}

export async function createAdminProduct(input: AdminProductInput) {
  const pool = await getPool()
  const transaction = new sql.Transaction(pool)

  try {
    await transaction.begin()
    const tx = () => new sql.Request(transaction)
    const slug = `${makeSlug(input.productName)}-${Date.now().toString().slice(-5)}`

    const insertedProduct = await tx()
      .input('categoryId', sql.BigInt, input.categoryId)
      .input('brandId', sql.BigInt, input.brandId)
      .input('productName', sql.NVarChar(255), input.productName)
      .input('slug', sql.VarChar(255), slug)
      .input('description', sql.NVarChar(sql.MAX), input.description || null)
      .input('basePrice', sql.Decimal(18, 2), input.basePrice)
      .input('warrantyMonths', sql.Int, input.warrantyMonths)
      .input('installRequired', sql.Bit, input.installRequired)
      .query(`
        INSERT INTO dbo.Product (
          CategoryId, BrandId, ProductName, Slug, Description,
          BasePrice, WarrantyMonths, InstallRequired, Status, CreatedAt
        )
        OUTPUT INSERTED.ProductId
        VALUES (
          @categoryId, @brandId, @productName, @slug, @description,
          @basePrice, @warrantyMonths, @installRequired, 'Active', SYSDATETIME()
        )
      `)

    const productId = Number(insertedProduct.recordset[0].ProductId)

    await tx()
      .input('productId', sql.BigInt, productId)
      .input('skuCode', sql.VarChar(100), input.skuCode)
      .input('price', sql.Decimal(18, 2), input.price)
      .input('costPrice', sql.Decimal(18, 2), Number.isFinite(input.costPrice) ? input.costPrice : null)
      .query(`
        INSERT INTO dbo.ProductSku (ProductId, SkuCode, Barcode, VariantName, Price, CostPrice, Status, CreatedAt)
        VALUES (@productId, @skuCode, NULL, N'Mặc định', @price, @costPrice, 'Active', SYSDATETIME())
      `)

    if (input.imageUrl) {
      await tx()
        .input('productId', sql.BigInt, productId)
        .input('imageUrl', sql.NVarChar(500), input.imageUrl)
        .input('altText', sql.NVarChar(255), input.productName)
        .query(`
          INSERT INTO dbo.ProductImage (ProductId, ImageUrl, AltText, IsPrimary, SortOrder, CreatedAt)
          VALUES (@productId, @imageUrl, @altText, 1, 1, SYSDATETIME())
        `)
    }

    await transaction.commit()
    return { productId }
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
}

export async function updateAdminProduct(productId: number, input: AdminProductInput) {
  const pool = await getPool()
  const transaction = new sql.Transaction(pool)

  try {
    await transaction.begin()
    const tx = () => new sql.Request(transaction)

    await tx()
      .input('productId', sql.BigInt, productId)
      .input('categoryId', sql.BigInt, input.categoryId)
      .input('brandId', sql.BigInt, input.brandId)
      .input('productName', sql.NVarChar(255), input.productName)
      .input('description', sql.NVarChar(sql.MAX), input.description || null)
      .input('basePrice', sql.Decimal(18, 2), input.basePrice)
      .input('warrantyMonths', sql.Int, input.warrantyMonths)
      .input('installRequired', sql.Bit, input.installRequired)
      .query(`
        UPDATE dbo.Product
        SET CategoryId = @categoryId,
            BrandId = @brandId,
            ProductName = @productName,
            Description = @description,
            BasePrice = @basePrice,
            WarrantyMonths = @warrantyMonths,
            InstallRequired = @installRequired,
            UpdatedAt = SYSDATETIME()
        WHERE ProductId = @productId
      `)

    if (input.skuId) {
      await tx()
        .input('skuId', sql.BigInt, input.skuId)
        .input('skuCode', sql.VarChar(100), input.skuCode)
        .input('price', sql.Decimal(18, 2), input.price)
        .input('costPrice', sql.Decimal(18, 2), Number.isFinite(input.costPrice) ? input.costPrice : null)
        .query(`
          UPDATE dbo.ProductSku
          SET SkuCode = @skuCode,
              Price = @price,
              CostPrice = @costPrice
          WHERE SkuId = @skuId
        `)
    }

    if (input.imageUrl) {
      const existingImage = await tx()
        .input('productId', sql.BigInt, productId)
        .query(`
          SELECT TOP (1) ImageId
          FROM dbo.ProductImage
          WHERE ProductId = @productId
          ORDER BY IsPrimary DESC, SortOrder, ImageId
        `)

      const imageId = existingImage.recordset[0]?.ImageId
      if (imageId) {
        await tx()
          .input('imageId', sql.BigInt, imageId)
          .input('imageUrl', sql.NVarChar(500), input.imageUrl)
          .input('altText', sql.NVarChar(255), input.productName)
          .query(`
            UPDATE dbo.ProductImage
            SET ImageUrl = @imageUrl,
                AltText = @altText,
                IsPrimary = 1
            WHERE ImageId = @imageId
          `)
      } else {
        await tx()
          .input('productId', sql.BigInt, productId)
          .input('imageUrl', sql.NVarChar(500), input.imageUrl)
          .input('altText', sql.NVarChar(255), input.productName)
          .query(`
            INSERT INTO dbo.ProductImage (ProductId, ImageUrl, AltText, IsPrimary, SortOrder, CreatedAt)
            VALUES (@productId, @imageUrl, @altText, 1, 1, SYSDATETIME())
          `)
      }
    }

    await transaction.commit()
    return { productId }
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
}

export async function getAdminProductImages(productId: number) {
  const pool = await getPool()
  const result = await pool
    .request()
    .input('productId', sql.BigInt, productId)
    .query(`
      SELECT
        ImageId AS imageId,
        ImageUrl AS imageUrl,
        AltText AS altText,
        IsPrimary AS isPrimary,
        SortOrder AS sortOrder
      FROM dbo.ProductImage
      WHERE ProductId = @productId
      ORDER BY IsPrimary DESC, SortOrder, ImageId
    `)
  return result.recordset
}

export async function addAdminProductImage(productId: number, imageUrl: string, altText: string) {
  const pool = await getPool()
  const result = await pool
    .request()
    .input('productId', sql.BigInt, productId)
    .input('imageUrl', sql.NVarChar(500), imageUrl)
    .input('altText', sql.NVarChar(255), altText || null)
    .query(`
      DECLARE @SortOrder int = ISNULL((SELECT MAX(SortOrder) FROM dbo.ProductImage WHERE ProductId = @productId), 0) + 1;
      DECLARE @IsPrimary bit = CASE WHEN EXISTS (SELECT 1 FROM dbo.ProductImage WHERE ProductId = @productId) THEN 0 ELSE 1 END;

      INSERT INTO dbo.ProductImage (ProductId, ImageUrl, AltText, IsPrimary, SortOrder, CreatedAt)
      OUTPUT INSERTED.ImageId AS imageId
      VALUES (@productId, @imageUrl, @altText, @IsPrimary, @SortOrder, SYSDATETIME())
    `)
  return result.recordset[0]
}

export async function setAdminProductPrimaryImage(productId: number, imageId: number) {
  const pool = await getPool()
  const transaction = new sql.Transaction(pool)

  try {
    await transaction.begin()
    const tx = () => new sql.Request(transaction)

    await tx()
      .input('productId', sql.BigInt, productId)
      .query('UPDATE dbo.ProductImage SET IsPrimary = 0 WHERE ProductId = @productId')

    await tx()
      .input('productId', sql.BigInt, productId)
      .input('imageId', sql.BigInt, imageId)
      .query(`
        UPDATE dbo.ProductImage
        SET IsPrimary = 1, SortOrder = 1
        WHERE ProductId = @productId AND ImageId = @imageId
      `)

    await transaction.commit()
    return { productId, imageId }
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
}

export async function deleteAdminProductImage(productId: number, imageId: number) {
  const pool = await getPool()
  await pool
    .request()
    .input('productId', sql.BigInt, productId)
    .input('imageId', sql.BigInt, imageId)
    .query('DELETE FROM dbo.ProductImage WHERE ProductId = @productId AND ImageId = @imageId')
  return { productId, imageId }
}

export async function updateAdminProductStatus(productId: number, status: string) {
  const pool = await getPool()
  await pool
    .request()
    .input('productId', sql.BigInt, productId)
    .input('status', sql.VarChar(30), status)
    .query(`
      UPDATE dbo.Product
      SET Status = @status, UpdatedAt = SYSDATETIME()
      WHERE ProductId = @productId

      UPDATE dbo.ProductSku
      SET Status = @status
      WHERE ProductId = @productId
    `)
  return { productId, status }
}
