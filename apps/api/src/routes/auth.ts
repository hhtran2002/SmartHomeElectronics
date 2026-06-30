import bcrypt from 'bcryptjs'
import { Router } from 'express'
import { requireAuth, signAuthToken, type AuthRequest, type AuthUser } from '../auth.js'
import { getPool, sql } from '../config/database.js'

export const authRouter = Router()

function readText(value: unknown) {
  return String(value ?? '').trim()
}

async function getAuthUser(userId: number): Promise<AuthUser | null> {
  const pool = await getPool()
  const result = await pool
    .request()
    .input('userId', sql.BigInt, userId)
    .query(`
      SELECT
        ua.UserId AS userId,
        ua.FullName AS fullName,
        ua.Email AS email,
        ua.Phone AS phone,
        r.RoleCode AS roleCode
      FROM dbo.UserAccount ua
      LEFT JOIN dbo.UserRole ur ON ur.UserId = ua.UserId
      LEFT JOIN dbo.Role r ON r.RoleId = ur.RoleId
      WHERE ua.UserId = @userId AND ua.Status = 'Active'
    `)

  if (result.recordset.length === 0) return null

  const first = result.recordset[0]
  return {
    userId: Number(first.userId),
    fullName: first.fullName,
    email: first.email,
    phone: first.phone,
    roles: result.recordset.map((row) => row.roleCode).filter(Boolean),
  }
}

authRouter.post('/register', async (request, response, next) => {
  const fullName = readText(request.body.fullName)
  const email = readText(request.body.email)
  const phone = readText(request.body.phone)
  const password = String(request.body.password ?? '')

  if (!fullName || !password || (!email && !phone)) {
    response.status(400).json({ message: 'Vui lòng nhập họ tên, mật khẩu và email hoặc số điện thoại.' })
    return
  }

  if (password.length < 6) {
    response.status(400).json({ message: 'Mật khẩu phải có ít nhất 6 ký tự.' })
    return
  }

  const pool = await getPool()
  const transaction = new sql.Transaction(pool)

  try {
    await transaction.begin()
    const txRequest = () => new sql.Request(transaction)

    const existed = await txRequest()
      .input('email', sql.VarChar(255), email || null)
      .input('phone', sql.VarChar(20), phone || null)
      .query(`
        SELECT TOP (1) UserId
        FROM dbo.UserAccount
        WHERE (@email IS NOT NULL AND Email = @email)
           OR (@phone IS NOT NULL AND Phone = @phone)
      `)

    if (existed.recordset.length > 0) {
      throw new Error('Email hoặc số điện thoại đã được dùng.')
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const insertedUser = await txRequest()
      .input('fullName', sql.NVarChar(150), fullName)
      .input('email', sql.VarChar(255), email || null)
      .input('phone', sql.VarChar(20), phone || null)
      .input('passwordHash', sql.VarChar(255), passwordHash)
      .query(`
        INSERT INTO dbo.UserAccount (FullName, Email, Phone, PasswordHash, Status, CreatedAt)
        OUTPUT INSERTED.UserId
        VALUES (@fullName, @email, @phone, @passwordHash, 'Active', SYSDATETIME())
      `)

    const userId = Number(insertedUser.recordset[0].UserId)

    await txRequest()
      .input('userId', sql.BigInt, userId)
      .query(`
        INSERT INTO dbo.UserRole (UserId, RoleId, AssignedAt)
        VALUES (@userId, 1, SYSDATETIME())
      `)

    await txRequest()
      .input('userId', sql.BigInt, userId)
      .query(`
        INSERT INTO dbo.CustomerProfile (UserId, LoyaltyPoint)
        VALUES (@userId, 0)
      `)

    await transaction.commit()

    const user = await getAuthUser(userId)
    const token = signAuthToken(user!)
    response.status(201).json({ data: { user, token } })
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    if (error instanceof Error) {
      response.status(400).json({ message: error.message })
      return
    }
    next(error)
  }
})

authRouter.post('/login', async (request, response, next) => {
  try {
    const identifier = readText(request.body.identifier)
    const password = String(request.body.password ?? '')

    if (!identifier || !password) {
      response.status(400).json({ message: 'Vui lòng nhập tài khoản và mật khẩu.' })
      return
    }

    const pool = await getPool()
    const loginResult = await pool
      .request()
      .input('identifier', sql.VarChar(255), identifier)
      .query(`
        SELECT TOP (1) UserId, PasswordHash, Status
        FROM dbo.UserAccount
        WHERE Email = @identifier OR Phone = @identifier
      `)

    const account = loginResult.recordset[0]
    if (!account || account.Status !== 'Active') {
      response.status(401).json({ message: 'Tài khoản hoặc mật khẩu không đúng.' })
      return
    }

    const passwordOk = await bcrypt.compare(password, account.PasswordHash)
    if (!passwordOk) {
      response.status(401).json({ message: 'Tài khoản hoặc mật khẩu không đúng.' })
      return
    }

    const user = await getAuthUser(Number(account.UserId))
    const token = signAuthToken(user!)
    response.json({ data: { user, token } })
  } catch (error) {
    next(error)
  }
})

authRouter.get('/me', requireAuth, (request: AuthRequest, response) => {
  response.json({ data: { user: request.user } })
})
