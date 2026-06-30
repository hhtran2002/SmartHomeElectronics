import { Router } from 'express'
import { getPool, sql } from '../config/database.js'

export const locationsRouter = Router()

locationsRouter.get('/provinces', async (_request, response, next) => {
  try {
    const pool = await getPool()
    const result = await pool.request().query(`
      SELECT ProvinceCode AS provinceCode, ProvinceName AS provinceName
      FROM dbo.AdministrativeProvince
      ORDER BY ProvinceName
    `)
    response.json({ data: result.recordset })
  } catch (error) {
    next(error)
  }
})

locationsRouter.get('/wards', async (request, response, next) => {
  const provinceCode = String(request.query.provinceCode ?? '').trim()
  if (!provinceCode) {
    response.status(400).json({ message: 'Vui lòng chọn tỉnh/thành trước.' })
    return
  }

  try {
    const pool = await getPool()
    const result = await pool.request()
      .input('provinceCode', sql.VarChar(10), provinceCode)
      .query(`
        SELECT WardCode AS wardCode, ProvinceCode AS provinceCode, WardName AS wardName
        FROM dbo.AdministrativeWard
        WHERE ProvinceCode = @provinceCode
        ORDER BY WardName
      `)
    response.json({ data: result.recordset })
  } catch (error) {
    next(error)
  }
})
