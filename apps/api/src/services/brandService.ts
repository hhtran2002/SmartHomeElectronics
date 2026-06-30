import { getPool } from '../config/database.js'

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
