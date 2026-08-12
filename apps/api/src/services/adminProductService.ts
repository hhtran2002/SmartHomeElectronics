import { getPool, sql } from '../config/database.js'

export type AdminProductInput = {
  productName: string
  categoryId: number
  brandId: number
  description: string
  highlights: string
  basePrice: number
  warrantyMonths: number
  installRequired: boolean
  skuId?: number
  skuCode: string
  price: number
  costPrice: number | null
  imageUrl: string
  variants?: {
    skuId?: number
    skuCode: string
    variantName: string
    price: number
    costPrice: number | null
  }[]
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

async function ensureUniqueSkuCode(tx: () => sql.Request, skuCode: string, currentSkuId?: number): Promise<string> {
  let uniqueSku = skuCode.trim()
  let count = 0
  let isUnique = false

  while (!isUnique && count < 20) {
    const testSku = count === 0 ? uniqueSku : `${uniqueSku}-${count}`
    const req = tx().input('skuCodeCheck', sql.VarChar(100), testSku)
    if (currentSkuId) {
      req.input('currentSkuIdCheck', sql.BigInt, currentSkuId)
    }

    const checkResult = await req.query(`
      SELECT 1 FROM dbo.ProductSku 
      WHERE SkuCode = @skuCodeCheck 
      ${currentSkuId ? 'AND SkuId != @currentSkuIdCheck' : ''}
    `)

    if (checkResult.recordset.length === 0) {
      uniqueSku = testSku
      isUnique = true
    } else {
      count++
    }
  }

  if (!isUnique) {
    const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase()
    uniqueSku = `${skuCode}-${randomSuffix}`
  }

  return uniqueSku
}

export async function getAdminProducts() {
  const pool = await getPool()
  const result = await pool.request().query(`
    SELECT TOP (200)
      p.ProductId AS productId,
      p.ProductName AS productName,
      p.Slug AS slug,
      p.Description AS description,
      p.Highlights AS highlights,
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
      .input('highlights', sql.NVarChar(sql.MAX), input.highlights || null)
      .input('basePrice', sql.Decimal(18, 2), input.basePrice)
      .input('warrantyMonths', sql.Int, input.warrantyMonths)
      .input('installRequired', sql.Bit, input.installRequired)
      .query(`
        INSERT INTO dbo.Product (
          CategoryId, BrandId, ProductName, Slug, Description, Highlights,
          BasePrice, WarrantyMonths, InstallRequired, Status, CreatedAt
        )
        OUTPUT INSERTED.ProductId
        VALUES (
          @categoryId, @brandId, @productName, @slug, @description, @highlights,
          @basePrice, @warrantyMonths, @installRequired, 'Active', SYSDATETIME()
        )
      `)

    const productId = Number(insertedProduct.recordset[0].ProductId)

    if (input.variants && input.variants.length > 0) {
      for (const variant of input.variants) {
        const uniqueSku = await ensureUniqueSkuCode(tx, variant.skuCode)
        await tx()
          .input('productId', sql.BigInt, productId)
          .input('skuCode', sql.VarChar(100), uniqueSku)
          .input('variantName', sql.NVarChar(100), variant.variantName)
          .input('price', sql.Decimal(18, 2), variant.price)
          .input('costPrice', sql.Decimal(18, 2), Number.isFinite(variant.costPrice) ? variant.costPrice : null)
          .query(`
            INSERT INTO dbo.ProductSku (ProductId, SkuCode, Barcode, VariantName, Price, CostPrice, Status, CreatedAt)
            VALUES (@productId, @skuCode, NULL, @variantName, @price, @costPrice, 'Active', SYSDATETIME())
          `)
      }
    } else {
      const uniqueSku = await ensureUniqueSkuCode(tx, input.skuCode)
      await tx()
        .input('productId', sql.BigInt, productId)
        .input('skuCode', sql.VarChar(100), uniqueSku)
        .input('price', sql.Decimal(18, 2), input.price)
        .input('costPrice', sql.Decimal(18, 2), Number.isFinite(input.costPrice) ? input.costPrice : null)
        .query(`
          INSERT INTO dbo.ProductSku (ProductId, SkuCode, Barcode, VariantName, Price, CostPrice, Status, CreatedAt)
          VALUES (@productId, @skuCode, NULL, N'Mặc định', @price, @costPrice, 'Active', SYSDATETIME())
        `)
    }

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
      .input('highlights', sql.NVarChar(sql.MAX), input.highlights || null)
      .input('basePrice', sql.Decimal(18, 2), input.basePrice)
      .input('warrantyMonths', sql.Int, input.warrantyMonths)
      .input('installRequired', sql.Bit, input.installRequired)
      .query(`
        UPDATE dbo.Product
        SET CategoryId = @categoryId,
            BrandId = @brandId,
            ProductName = @productName,
            Description = @description,
            Highlights = @highlights,
            BasePrice = @basePrice,
            WarrantyMonths = @warrantyMonths,
            InstallRequired = @installRequired,
            UpdatedAt = SYSDATETIME()
        WHERE ProductId = @productId
      `)

    if (input.variants && input.variants.length > 0) {
      const currentSkusResult = await tx()
        .input('productId', sql.BigInt, productId)
        .query('SELECT SkuId FROM dbo.ProductSku WHERE ProductId = @productId AND Status = \'Active\'')
      const currentSkuIds = currentSkusResult.recordset.map(r => Number(r.SkuId))

      const updatedSkuIds = input.variants.map(v => Number(v.skuId)).filter(Boolean)

      const removedSkuIds = currentSkuIds.filter(id => !updatedSkuIds.includes(id))
      for (const removedId of removedSkuIds) {
        await tx()
          .input('skuId', sql.BigInt, removedId)
          .query('UPDATE dbo.ProductSku SET Status = \'Inactive\' WHERE SkuId = @skuId')
      }

      for (const variant of input.variants) {
        if (variant.skuId) {
          const uniqueSku = await ensureUniqueSkuCode(tx, variant.skuCode, variant.skuId)
          await tx()
            .input('skuId', sql.BigInt, variant.skuId)
            .input('skuCode', sql.VarChar(100), uniqueSku)
            .input('variantName', sql.NVarChar(100), variant.variantName)
            .input('price', sql.Decimal(18, 2), variant.price)
            .input('costPrice', sql.Decimal(18, 2), Number.isFinite(variant.costPrice) ? variant.costPrice : null)
            .query(`
              UPDATE dbo.ProductSku
              SET SkuCode = @skuCode,
                  VariantName = @variantName,
                  Price = @price,
                  CostPrice = @costPrice,
                  Status = 'Active'
              WHERE SkuId = @skuId
            `)
        } else {
          const uniqueSku = await ensureUniqueSkuCode(tx, variant.skuCode)
          await tx()
            .input('productId', sql.BigInt, productId)
            .input('skuCode', sql.VarChar(100), uniqueSku)
            .input('variantName', sql.NVarChar(100), variant.variantName)
            .input('price', sql.Decimal(18, 2), variant.price)
            .input('costPrice', sql.Decimal(18, 2), Number.isFinite(variant.costPrice) ? variant.costPrice : null)
            .query(`
              INSERT INTO dbo.ProductSku (ProductId, SkuCode, Barcode, VariantName, Price, CostPrice, Status, CreatedAt)
              VALUES (@productId, @skuCode, NULL, @variantName, @price, @costPrice, 'Active', SYSDATETIME())
            `)
        }
      }
    } else {
      if (input.skuId) {
        const uniqueSku = await ensureUniqueSkuCode(tx, input.skuCode, input.skuId)
        await tx()
          .input('skuId', sql.BigInt, input.skuId)
          .input('skuCode', sql.VarChar(100), uniqueSku)
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

    const target = await tx()
      .input('productId', sql.BigInt, productId)
      .input('imageId', sql.BigInt, imageId)
      .query(`
        SELECT ImageId
        FROM dbo.ProductImage WITH (UPDLOCK, HOLDLOCK)
        WHERE ProductId = @productId AND ImageId = @imageId
      `)

    if (!target.recordset.length) {
      throw new Error('Không tìm thấy ảnh thuộc sản phẩm này.')
    }

    await tx()
      .input('productId', sql.BigInt, productId)
      .input('imageId', sql.BigInt, imageId)
      .query(`
        UPDATE dbo.ProductImage
        SET IsPrimary = CASE WHEN ImageId = @imageId THEN 1 ELSE 0 END
        WHERE ProductId = @productId;

        ;WITH RankedImages AS (
          SELECT ImageId,
            ROW_NUMBER() OVER (
              ORDER BY CASE WHEN ImageId = @imageId THEN 0 ELSE 1 END, SortOrder, ImageId
            ) AS NewSortOrder
          FROM dbo.ProductImage
          WHERE ProductId = @productId
        )
        UPDATE image
        SET SortOrder = ranked.NewSortOrder
        FROM dbo.ProductImage image
        INNER JOIN RankedImages ranked ON ranked.ImageId = image.ImageId;
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
  const transaction = new sql.Transaction(pool)

  try {
    await transaction.begin()
    const result = await new sql.Request(transaction)
      .input('productId', sql.BigInt, productId)
      .input('imageId', sql.BigInt, imageId)
      .query(`
        DECLARE @WasPrimary bit = 0;
        SELECT @WasPrimary = IsPrimary
        FROM dbo.ProductImage WITH (UPDLOCK, HOLDLOCK)
        WHERE ProductId = @productId AND ImageId = @imageId;

        DELETE FROM dbo.ProductImage
        WHERE ProductId = @productId AND ImageId = @imageId;

        DECLARE @DeletedCount int = @@ROWCOUNT;
        IF @DeletedCount = 1 AND @WasPrimary = 1
        BEGIN
          DECLARE @NextImageId bigint = (
            SELECT TOP (1) ImageId
            FROM dbo.ProductImage
            WHERE ProductId = @productId
            ORDER BY SortOrder, ImageId
          );
          UPDATE dbo.ProductImage
          SET IsPrimary = CASE WHEN ImageId = @NextImageId THEN 1 ELSE 0 END
          WHERE ProductId = @productId;
        END;

        ;WITH RankedImages AS (
          SELECT ImageId, ROW_NUMBER() OVER (ORDER BY IsPrimary DESC, SortOrder, ImageId) AS NewSortOrder
          FROM dbo.ProductImage
          WHERE ProductId = @productId
        )
        UPDATE image
        SET SortOrder = ranked.NewSortOrder
        FROM dbo.ProductImage image
        INNER JOIN RankedImages ranked ON ranked.ImageId = image.ImageId;

        SELECT @DeletedCount AS deletedCount;
      `)

    if (!Number(result.recordset[0]?.deletedCount)) {
      throw new Error('Không tìm thấy ảnh thuộc sản phẩm này.')
    }

    await transaction.commit()
    return { productId, imageId }
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
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
