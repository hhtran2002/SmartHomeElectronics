import { getPool, sql } from '../config/database.js'

const dailyMessageLimit = 4

export class AiDailyQuotaExceededError extends Error {
  constructor() {
    super(`Bạn đã dùng hết ${dailyMessageLimit} lượt tư vấn AI hôm nay. Vui lòng quay lại vào ngày mai.`)
  }
}

function vietnamDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

export async function consumeAiDailyMessage(userId: number) {
  const pool = await getPool()
  const transaction = new sql.Transaction(pool)
  const usageDate = vietnamDate()

  try {
    await transaction.begin()
    const request = () => new sql.Request(transaction)
    const currentResult = await request()
      .input('userId', sql.BigInt, userId)
      .input('usageDate', sql.Date, usageDate)
      .query(`
        SELECT MessageCount
        FROM dbo.AiDailyUsage WITH (UPDLOCK, HOLDLOCK)
        WHERE UserId = @userId AND UsageDate = @usageDate
      `)

    const current = currentResult.recordset[0]
    const used = Number(current?.MessageCount ?? 0)
    if (used >= dailyMessageLimit) throw new AiDailyQuotaExceededError()

    if (current) {
      await request()
        .input('userId', sql.BigInt, userId)
        .input('usageDate', sql.Date, usageDate)
        .query(`UPDATE dbo.AiDailyUsage SET MessageCount = MessageCount + 1, UpdatedAt = SYSDATETIME() WHERE UserId = @userId AND UsageDate = @usageDate`)
    } else {
      await request()
        .input('userId', sql.BigInt, userId)
        .input('usageDate', sql.Date, usageDate)
        .query(`INSERT INTO dbo.AiDailyUsage (UserId, UsageDate, MessageCount) VALUES (@userId, @usageDate, 1)`)
    }

    await transaction.commit()
    return { limit: dailyMessageLimit, remaining: dailyMessageLimit - used - 1 }
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
}
