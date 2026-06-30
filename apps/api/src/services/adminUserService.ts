import bcrypt from 'bcryptjs'
import { getPool, sql } from '../config/database.js'

export type CreateAdminUserInput = {
  fullName: string
  email: string | null
  phone: string | null
  password: string
  roleIds: number[]
}

export async function getAdminRoles() {
  const pool = await getPool()
  const result = await pool.request().query(`
    SELECT
      r.RoleId AS roleId,
      r.RoleCode AS roleCode,
      r.RoleName AS roleName,
      r.Description AS description,
      STRING_AGG(p.PermissionName, N', ') AS permissions
    FROM dbo.Role r
    LEFT JOIN dbo.RolePermission rp ON rp.RoleId = r.RoleId
    LEFT JOIN dbo.Permission p ON p.PermissionId = rp.PermissionId
    GROUP BY r.RoleId, r.RoleCode, r.RoleName, r.Description
    ORDER BY r.RoleId
  `)
  return result.recordset
}

export async function getAdminUsers() {
  const pool = await getPool()
  const result = await pool.request().query(`
    SELECT
      ua.UserId AS userId,
      ua.FullName AS fullName,
      ua.Email AS email,
      ua.Phone AS phone,
      ua.Status AS status,
      ua.CreatedAt AS createdAt,
      ua.UpdatedAt AS updatedAt,
      STRING_AGG(r.RoleCode, ',') AS roleCodes
    FROM dbo.UserAccount ua
    LEFT JOIN dbo.UserRole ur ON ur.UserId = ua.UserId
    LEFT JOIN dbo.Role r ON r.RoleId = ur.RoleId
    GROUP BY
      ua.UserId, ua.FullName, ua.Email, ua.Phone,
      ua.Status, ua.CreatedAt, ua.UpdatedAt
    ORDER BY ua.UserId DESC
  `)

  return result.recordset.map((user) => ({
    ...user,
    roles: user.roleCodes ? String(user.roleCodes).split(',') : [],
    roleCodes: undefined,
  }))
}

export async function createAdminUser(input: CreateAdminUserInput) {
  const pool = await getPool()
  const transaction = new sql.Transaction(pool)

  try {
    await transaction.begin()
    const tx = () => new sql.Request(transaction)

    const duplicate = await tx()
      .input('email', sql.VarChar(255), input.email)
      .input('phone', sql.VarChar(20), input.phone)
      .query(`
        SELECT TOP (1) UserId
        FROM dbo.UserAccount
        WHERE (@email IS NOT NULL AND Email = @email)
           OR (@phone IS NOT NULL AND Phone = @phone)
      `)
    if (duplicate.recordset.length) throw new Error('Email hoặc số điện thoại đã được sử dụng.')

    const validRoles = await tx().query(`
      SELECT RoleId
      FROM dbo.Role
      WHERE RoleId IN (${input.roleIds.join(',')})
    `)
    if (validRoles.recordset.length !== input.roleIds.length) throw new Error('Có vai trò không tồn tại.')

    const passwordHash = await bcrypt.hash(input.password, 12)
    const inserted = await tx()
      .input('fullName', sql.NVarChar(150), input.fullName)
      .input('email', sql.VarChar(255), input.email)
      .input('phone', sql.VarChar(20), input.phone)
      .input('passwordHash', sql.VarChar(255), passwordHash)
      .query(`
        INSERT INTO dbo.UserAccount (
          FullName, Email, Phone, PasswordHash, Status, CreatedAt
        )
        OUTPUT INSERTED.UserId
        VALUES (@fullName, @email, @phone, @passwordHash, 'Active', SYSDATETIME())
      `)

    const userId = Number(inserted.recordset[0].UserId)
    for (const roleId of input.roleIds) {
      await tx()
        .input('userId', sql.BigInt, userId)
        .input('roleId', sql.Int, roleId)
        .query(`
          INSERT INTO dbo.UserRole (UserId, RoleId, AssignedAt)
          VALUES (@userId, @roleId, SYSDATETIME())
        `)
    }

    await transaction.commit()
    return { userId }
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
}

export async function updateAdminUserRoles(input: {
  currentUserId: number
  userId: number
  roleIds: number[]
}) {
  const pool = await getPool()
  const transaction = new sql.Transaction(pool)

  try {
    await transaction.begin()
    const tx = () => new sql.Request(transaction)
    const roles = await tx().query(`
      SELECT RoleId, RoleCode
      FROM dbo.Role
      WHERE RoleId IN (${input.roleIds.join(',')})
    `)

    if (roles.recordset.length !== input.roleIds.length) throw new Error('Có vai trò không tồn tại.')
    if (input.userId === input.currentUserId && !roles.recordset.some((role) => role.RoleCode === 'SystemAdmin')) {
      throw new Error('Bạn không thể tự gỡ quyền SystemAdmin của chính mình.')
    }

    const user = await tx()
      .input('userId', sql.BigInt, input.userId)
      .query('SELECT UserId FROM dbo.UserAccount WITH (UPDLOCK, ROWLOCK) WHERE UserId = @userId')
    if (!user.recordset.length) throw new Error('Không tìm thấy người dùng.')

    await tx().input('userId', sql.BigInt, input.userId).query('DELETE FROM dbo.UserRole WHERE UserId = @userId')
    for (const roleId of input.roleIds) {
      await tx()
        .input('userId', sql.BigInt, input.userId)
        .input('roleId', sql.Int, roleId)
        .query(`
          INSERT INTO dbo.UserRole (UserId, RoleId, AssignedAt)
          VALUES (@userId, @roleId, SYSDATETIME())
        `)
    }

    await transaction.commit()
    return { userId: input.userId, roleIds: input.roleIds }
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
}

export async function updateAdminUserStatus(input: {
  currentUserId: number
  userId: number
  status: string
}) {
  if (input.userId === input.currentUserId && input.status !== 'Active') {
    throw new Error('Bạn không thể tự khóa hoặc vô hiệu hóa tài khoản của mình.')
  }

  const pool = await getPool()
  const result = await pool
    .request()
    .input('userId', sql.BigInt, input.userId)
    .input('status', sql.VarChar(30), input.status)
    .query(`
      UPDATE dbo.UserAccount
      SET Status = @status, UpdatedAt = SYSDATETIME()
      WHERE UserId = @userId
    `)

  if (result.rowsAffected[0] !== 1) throw new Error('Không tìm thấy người dùng.')
  return { userId: input.userId, status: input.status }
}
