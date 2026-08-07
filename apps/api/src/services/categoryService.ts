import { getPool, sql } from '../config/database.js'

export type CategoryDto = {
  id: number
  name: string
  slug: string
  productCount: number
}

export async function getActiveCategories(): Promise<CategoryDto[]> {
  const pool = await getPool()
  const result = await pool.request().query(`
    SELECT
      c.CategoryId AS id,
      c.CategoryName AS name,
      c.Slug AS slug,
      COUNT(p.ProductId) AS productCount
    FROM dbo.Category c
    LEFT JOIN dbo.Product p ON p.CategoryId = c.CategoryId AND p.Status = 'Active'
    WHERE c.Status = 'Active'
    GROUP BY c.CategoryId, c.CategoryName, c.Slug
    ORDER BY c.CategoryName
  `)

  return result.recordset as CategoryDto[]
}

export async function createCategoryService(name: string, slug: string): Promise<number> {
  const pool = await getPool()
  const result = await pool.request()
    .input('name', sql.NVarChar(100), name)
    .input('slug', sql.VarChar(100), slug)
    .query(`
      INSERT INTO dbo.Category (CategoryName, Slug, Status)
      OUTPUT INSERTED.CategoryId
      VALUES (@name, @slug, 'Active')
    `)
  return Number(result.recordset[0].CategoryId)
}
