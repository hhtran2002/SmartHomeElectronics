import { getPool } from '../config/database.js'

export type PaymentMethodDto = {
  paymentMethodId: number
  methodCode: string
  methodName: string
  status: string
}

export async function getActivePaymentMethods(): Promise<PaymentMethodDto[]> {
  const pool = await getPool()
  const result = await pool.request().query(`
    SELECT
      PaymentMethodId AS paymentMethodId,
      MethodCode AS methodCode,
      MethodName AS methodName,
      Status AS status
    FROM dbo.PaymentMethod
    WHERE Status = 'Active' AND MethodCode IN ('COD', 'BANK_TRANSFER')
    ORDER BY PaymentMethodId
  `)

  return result.recordset as PaymentMethodDto[]
}
