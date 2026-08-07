import { getPool, sql } from '../config/database.js'

export type BrandDto = {
  id: number
  name: string
  country: string | null
  productCount: number
}

export async function getActiveBrands(): Promise<BrandDto[]> {
  const pool = await getPool()
  const result = await pool.request().query(`
    SELECT
      b.BrandId AS id,
      b.BrandName AS name,
      b.Country AS country,
      COUNT(p.ProductId) AS productCount
    FROM dbo.Brand b
    LEFT JOIN dbo.Product p ON p.BrandId = b.BrandId AND p.Status = 'Active'
    WHERE b.Status = 'Active'
    GROUP BY b.BrandId, b.BrandName, b.Country
    ORDER BY b.BrandName
  `)

  return result.recordset as BrandDto[]
}

export async function createBrandService(name: string, country: string | null): Promise<number> {
  const pool = await getPool()
  const result = await pool.request()
    .input('name', sql.NVarChar(100), name)
    .input('country', sql.NVarChar(100), country)
    .query(`
      INSERT INTO dbo.Brand (BrandName, Country, Status)
      OUTPUT INSERTED.BrandId
      VALUES (@name, @country, 'Active')
    `)
  return Number(result.recordset[0].BrandId)
}
