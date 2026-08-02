import bcrypt from 'bcryptjs'
import { getPool, sql } from '../config/database.js'

export type EmployeeProfileInput = {
  fullName: string
  email: string | null
  phone: string
  roleIds: number[]
  position: string
  department: string
  dateOfBirth: string
  gender: 'Male' | 'Female' | 'Other'
  provinceCode: string
  wardCode: string
  streetAddress: string
  hireDate: string
}

export type CreateAdminUserInput = EmployeeProfileInput & {
  password: string
  createdByUserId: number
}

type TransactionRequest = () => sql.Request

async function getEmployeeRoles(tx: TransactionRequest, roleIds: number[]) {
  const roles = await tx().query(`
    SELECT RoleId, RoleCode
    FROM dbo.Role
    WHERE RoleId IN (${roleIds.join(',')})
  `)
  if (roles.recordset.length !== roleIds.length) throw new Error('Có vai trò không tồn tại.')
  if (roles.recordset.some((role) => role.RoleCode === 'Customer')) {
    throw new Error('Tài khoản nhân viên không được gán vai trò Customer.')
  }
  return roles.recordset
}

async function validateEmployeeLocation(tx: TransactionRequest, provinceCode: string, wardCode: string) {
  const result = await tx()
    .input('provinceCode', sql.VarChar(10), provinceCode)
    .input('wardCode', sql.VarChar(10), wardCode)
    .query(`
      SELECT TOP (1) ward.WardCode
      FROM dbo.AdministrativeWard ward
      WHERE ward.WardCode = @wardCode AND ward.ProvinceCode = @provinceCode
    `)
  if (!result.recordset.length) throw new Error('Tỉnh/thành hoặc xã/phường của nhân viên không hợp lệ.')
}

async function ensureUniqueContact(
  tx: TransactionRequest,
  email: string | null,
  phone: string,
  excludedUserId?: number,
) {
  const duplicate = await tx()
    .input('email', sql.VarChar(255), email)
    .input('phone', sql.VarChar(20), phone)
    .input('excludedUserId', sql.BigInt, excludedUserId ?? null)
    .query(`
      SELECT TOP (1) UserId
      FROM dbo.UserAccount
      WHERE (@excludedUserId IS NULL OR UserId <> @excludedUserId)
        AND ((@email IS NOT NULL AND Email = @email) OR Phone = @phone)
    `)
  if (duplicate.recordset.length) throw new Error('Email hoặc số điện thoại đã được sử dụng.')
}

async function nextEmployeeCode(tx: TransactionRequest) {
  const result = await tx().query(`
    SELECT ISNULL(MAX(TRY_CONVERT(INT, SUBSTRING(EmployeeCode, 4, 47))), 0) + 1 AS NextNumber
    FROM dbo.EmployeeProfile WITH (UPDLOCK, HOLDLOCK)
    WHERE EmployeeCode LIKE 'EMP%'
  `)
  return `EMP${String(Number(result.recordset[0].NextNumber)).padStart(6, '0')}`
}

async function replaceRoles(tx: TransactionRequest, userId: number, roleIds: number[]) {
  await tx().input('userId', sql.BigInt, userId).query('DELETE FROM dbo.UserRole WHERE UserId = @userId')
  for (const roleId of roleIds) {
    await tx()
      .input('userId', sql.BigInt, userId)
      .input('roleId', sql.Int, roleId)
      .query(`
        INSERT INTO dbo.UserRole (UserId, RoleId, AssignedAt)
        VALUES (@userId, @roleId, SYSDATETIME())
      `)
  }
}

async function insertEmployeeProfile(
  tx: TransactionRequest,
  userId: number,
  employeeCode: string,
  input: EmployeeProfileInput,
  createdByUserId: number,
) {
  await tx()
    .input('userId', sql.BigInt, userId)
    .input('employeeCode', sql.VarChar(50), employeeCode)
    .input('position', sql.NVarChar(100), input.position)
    .input('department', sql.NVarChar(100), input.department)
    .input('dateOfBirth', sql.Date, input.dateOfBirth)
    .input('gender', sql.VarChar(20), input.gender)
    .input('provinceCode', sql.VarChar(10), input.provinceCode)
    .input('wardCode', sql.VarChar(10), input.wardCode)
    .input('streetAddress', sql.NVarChar(300), input.streetAddress)
    .input('hireDate', sql.Date, input.hireDate)
    .input('createdByUserId', sql.BigInt, createdByUserId)
    .query(`
      INSERT INTO dbo.EmployeeProfile (
        UserId, EmployeeCode, Position, Department, DateOfBirth, Gender,
        ProvinceCode, WardCode, StreetAddress, HireDate, ApprovalStatus,
        CreatedByUserId, CreatedAt
      )
      VALUES (
        @userId, @employeeCode, @position, @department, @dateOfBirth, @gender,
        @provinceCode, @wardCode, @streetAddress, @hireDate, 'Pending',
        @createdByUserId, SYSDATETIME()
      )
    `)
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
    WITH UserRoles AS (
      SELECT userRole.UserId, STRING_AGG(role.RoleCode, ',') AS RoleCodes
      FROM dbo.UserRole userRole
      INNER JOIN dbo.Role role ON role.RoleId = userRole.RoleId
      GROUP BY userRole.UserId
    )
    SELECT
      account.UserId AS userId,
      account.FullName AS fullName,
      account.Email AS email,
      account.Phone AS phone,
      account.Status AS status,
      account.CreatedAt AS createdAt,
      account.UpdatedAt AS updatedAt,
      roles.RoleCodes AS roleCodes,
      profile.EmployeeId AS employeeId,
      profile.EmployeeCode AS employeeCode,
      profile.Position AS position,
      profile.Department AS department,
      profile.DateOfBirth AS dateOfBirth,
      profile.Gender AS gender,
      profile.ProvinceCode AS provinceCode,
      province.ProvinceName AS provinceName,
      profile.WardCode AS wardCode,
      ward.WardName AS wardName,
      profile.StreetAddress AS streetAddress,
      profile.HireDate AS hireDate,
      profile.ApprovalStatus AS approvalStatus,
      profile.CreatedByUserId AS createdByUserId,
      creator.FullName AS createdByName,
      profile.ApprovedByUserId AS approvedByUserId,
      approver.FullName AS approvedByName,
      profile.ApprovedAt AS approvedAt,
      profile.RejectionReason AS rejectionReason,
      profile.CreatedAt AS employeeCreatedAt,
      profile.UpdatedAt AS employeeUpdatedAt
    FROM dbo.UserAccount account
    LEFT JOIN UserRoles roles ON roles.UserId = account.UserId
    LEFT JOIN dbo.EmployeeProfile profile ON profile.UserId = account.UserId
    LEFT JOIN dbo.AdministrativeProvince province ON province.ProvinceCode = profile.ProvinceCode
    LEFT JOIN dbo.AdministrativeWard ward ON ward.WardCode = profile.WardCode
    LEFT JOIN dbo.UserAccount creator ON creator.UserId = profile.CreatedByUserId
    LEFT JOIN dbo.UserAccount approver ON approver.UserId = profile.ApprovedByUserId
    ORDER BY account.UserId DESC
  `)

  return result.recordset.map((user) => ({
    ...user,
    roles: user.roleCodes ? String(user.roleCodes).split(',') : [],
    roleCodes: undefined,
    employeeProfile: user.employeeId ? {
      employeeId: Number(user.employeeId),
      employeeCode: user.employeeCode,
      position: user.position,
      department: user.department,
      dateOfBirth: user.dateOfBirth,
      gender: user.gender,
      provinceCode: user.provinceCode,
      provinceName: user.provinceName,
      wardCode: user.wardCode,
      wardName: user.wardName,
      streetAddress: user.streetAddress,
      hireDate: user.hireDate,
      approvalStatus: user.approvalStatus,
      createdByUserId: user.createdByUserId ? Number(user.createdByUserId) : null,
      createdByName: user.createdByName,
      approvedByUserId: user.approvedByUserId ? Number(user.approvedByUserId) : null,
      approvedByName: user.approvedByName,
      approvedAt: user.approvedAt,
      rejectionReason: user.rejectionReason,
      createdAt: user.employeeCreatedAt,
      updatedAt: user.employeeUpdatedAt,
    } : null,
    employeeId: undefined,
    employeeCode: undefined,
    position: undefined,
    department: undefined,
    dateOfBirth: undefined,
    gender: undefined,
    provinceCode: undefined,
    provinceName: undefined,
    wardCode: undefined,
    wardName: undefined,
    streetAddress: undefined,
    hireDate: undefined,
    approvalStatus: undefined,
    createdByUserId: undefined,
    createdByName: undefined,
    approvedByUserId: undefined,
    approvedByName: undefined,
    approvedAt: undefined,
    rejectionReason: undefined,
    employeeCreatedAt: undefined,
    employeeUpdatedAt: undefined,
  }))
}

export async function createAdminUser(input: CreateAdminUserInput) {
  const pool = await getPool()
  const transaction = new sql.Transaction(pool)

  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE)
    const tx = () => new sql.Request(transaction)

    await ensureUniqueContact(tx, input.email, input.phone)
    await getEmployeeRoles(tx, input.roleIds)
    await validateEmployeeLocation(tx, input.provinceCode, input.wardCode)

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
        VALUES (@fullName, @email, @phone, @passwordHash, 'Pending', SYSDATETIME())
      `)

    const userId = Number(inserted.recordset[0].UserId)
    const employeeCode = await nextEmployeeCode(tx)
    await insertEmployeeProfile(tx, userId, employeeCode, input, input.createdByUserId)
    await replaceRoles(tx, userId, input.roleIds)

    await transaction.commit()
    return { userId, employeeCode, status: 'Pending', approvalStatus: 'Pending' }
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
}

export async function saveAdminEmployeeProfile(input: EmployeeProfileInput & {
  currentUserId: number
  userId: number
}) {
  if (input.userId === input.currentUserId) {
    throw new Error('Bạn không thể chuyển chính tài khoản quản trị đang đăng nhập sang trạng thái chờ duyệt.')
  }

  const pool = await getPool()
  const transaction = new sql.Transaction(pool)
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE)
    const tx = () => new sql.Request(transaction)
    const userResult = await tx()
      .input('userId', sql.BigInt, input.userId)
      .query(`
        SELECT account.UserId, profile.EmployeeId, profile.ApprovalStatus
        FROM dbo.UserAccount account WITH (UPDLOCK, ROWLOCK)
        LEFT JOIN dbo.EmployeeProfile profile ON profile.UserId = account.UserId
        WHERE account.UserId = @userId
      `)
    const user = userResult.recordset[0]
    if (!user) throw new Error('Không tìm thấy người dùng.')

    await ensureUniqueContact(tx, input.email, input.phone, input.userId)
    await getEmployeeRoles(tx, input.roleIds)
    await validateEmployeeLocation(tx, input.provinceCode, input.wardCode)

    await tx()
      .input('userId', sql.BigInt, input.userId)
      .input('fullName', sql.NVarChar(150), input.fullName)
      .input('email', sql.VarChar(255), input.email)
      .input('phone', sql.VarChar(20), input.phone)
      .query(`
        UPDATE dbo.UserAccount
        SET FullName = @fullName, Email = @email, Phone = @phone, UpdatedAt = SYSDATETIME()
        WHERE UserId = @userId
      `)

    let employeeCode: string
    if (!user.EmployeeId) {
      employeeCode = await nextEmployeeCode(tx)
      await insertEmployeeProfile(tx, input.userId, employeeCode, input, input.currentUserId)
      await tx()
        .input('userId', sql.BigInt, input.userId)
        .query(`UPDATE dbo.UserAccount SET Status = 'Pending', UpdatedAt = SYSDATETIME() WHERE UserId = @userId`)
    } else {
      const remainsApproved = user.ApprovalStatus === 'Approved'
      await tx()
        .input('userId', sql.BigInt, input.userId)
        .input('position', sql.NVarChar(100), input.position)
        .input('department', sql.NVarChar(100), input.department)
        .input('dateOfBirth', sql.Date, input.dateOfBirth)
        .input('gender', sql.VarChar(20), input.gender)
        .input('provinceCode', sql.VarChar(10), input.provinceCode)
        .input('wardCode', sql.VarChar(10), input.wardCode)
        .input('streetAddress', sql.NVarChar(300), input.streetAddress)
        .input('hireDate', sql.Date, input.hireDate)
        .input('remainsApproved', sql.Bit, remainsApproved)
        .query(`
          UPDATE dbo.EmployeeProfile
          SET Position = @position,
              Department = @department,
              DateOfBirth = @dateOfBirth,
              Gender = @gender,
              ProvinceCode = @provinceCode,
              WardCode = @wardCode,
              StreetAddress = @streetAddress,
              HireDate = @hireDate,
              ApprovalStatus = CASE WHEN @remainsApproved = 1 THEN 'Approved' ELSE 'Pending' END,
              ApprovedByUserId = CASE WHEN @remainsApproved = 1 THEN ApprovedByUserId ELSE NULL END,
              ApprovedAt = CASE WHEN @remainsApproved = 1 THEN ApprovedAt ELSE NULL END,
              RejectionReason = NULL,
              UpdatedAt = SYSDATETIME()
          WHERE UserId = @userId
        `)
      if (!remainsApproved) {
        await tx()
          .input('userId', sql.BigInt, input.userId)
          .query(`UPDATE dbo.UserAccount SET Status = 'Pending', UpdatedAt = SYSDATETIME() WHERE UserId = @userId`)
      }
      const codeResult = await tx()
        .input('userId', sql.BigInt, input.userId)
        .query('SELECT EmployeeCode FROM dbo.EmployeeProfile WHERE UserId = @userId')
      employeeCode = String(codeResult.recordset[0].EmployeeCode)
    }

    await replaceRoles(tx, input.userId, input.roleIds)
    await transaction.commit()
    return { userId: input.userId, employeeCode }
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
    const roleCodes = roles.recordset.map((role) => String(role.RoleCode))
    const containsCustomer = roleCodes.includes('Customer')
    const containsEmployeeRole = roleCodes.some((roleCode) => roleCode !== 'Customer')
    if (containsCustomer && containsEmployeeRole) {
      throw new Error('Không thể trộn vai trò Customer với vai trò nhân viên.')
    }
    if (input.userId === input.currentUserId && !roleCodes.includes('SystemAdmin')) {
      throw new Error('Bạn không thể tự gỡ quyền SystemAdmin của chính mình.')
    }

    const user = await tx()
      .input('userId', sql.BigInt, input.userId)
      .query(`
        SELECT account.UserId, profile.EmployeeId, profile.ApprovalStatus
        FROM dbo.UserAccount account WITH (UPDLOCK, ROWLOCK)
        LEFT JOIN dbo.EmployeeProfile profile ON profile.UserId = account.UserId
        WHERE account.UserId = @userId
      `)
    if (!user.recordset.length) throw new Error('Không tìm thấy người dùng.')

    const employee = user.recordset[0]
    if (containsEmployeeRole && !employee.EmployeeId) {
      throw new Error('Phải tạo hồ sơ nhân viên trước khi gán vai trò nhân viên.')
    }
    if (containsCustomer && employee.EmployeeId) {
      throw new Error('Tài khoản đã có hồ sơ nhân viên không thể chuyển trực tiếp thành Customer.')
    }

    await replaceRoles(tx, input.userId, input.roleIds)
    await transaction.commit()
    return { userId: input.userId, roleIds: input.roleIds }
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
}

export async function reviewAdminEmployee(input: {
  reviewerUserId: number
  userId: number
  action: 'Approved' | 'Rejected'
  rejectionReason: string | null
}) {
  if (input.userId === input.reviewerUserId && input.action === 'Rejected') {
    throw new Error('Bạn không thể tự từ chối hồ sơ của chính mình.')
  }
  if (input.action === 'Rejected' && !input.rejectionReason) {
    throw new Error('Vui lòng nhập lý do từ chối hồ sơ.')
  }

  const pool = await getPool()
  const transaction = new sql.Transaction(pool)
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE)
    const tx = () => new sql.Request(transaction)
    const currentResult = await tx()
      .input('userId', sql.BigInt, input.userId)
      .query(`
        SELECT account.UserId, profile.EmployeeId, profile.ApprovalStatus
        FROM dbo.UserAccount account WITH (UPDLOCK, ROWLOCK)
        LEFT JOIN dbo.EmployeeProfile profile WITH (UPDLOCK, ROWLOCK) ON profile.UserId = account.UserId
        WHERE account.UserId = @userId
      `)
    const current = currentResult.recordset[0]
    if (!current?.EmployeeId) throw new Error('Tài khoản chưa có hồ sơ nhân viên.')
    if (current.ApprovalStatus !== 'Pending') throw new Error('Chỉ hồ sơ đang chờ duyệt mới được xử lý.')

    const roles = await tx()
      .input('userId', sql.BigInt, input.userId)
      .query(`
        SELECT role.RoleCode
        FROM dbo.UserRole userRole
        INNER JOIN dbo.Role role ON role.RoleId = userRole.RoleId
        WHERE userRole.UserId = @userId
      `)
    if (!roles.recordset.length || roles.recordset.some((role) => role.RoleCode === 'Customer')) {
      throw new Error('Hồ sơ nhân viên phải có ít nhất một vai trò nhân viên và không được có role Customer.')
    }

    if (input.action === 'Approved') {
      await tx()
        .input('userId', sql.BigInt, input.userId)
        .input('reviewerUserId', sql.BigInt, input.reviewerUserId)
        .query(`
          UPDATE dbo.EmployeeProfile
          SET ApprovalStatus = 'Approved', ApprovedByUserId = @reviewerUserId,
              ApprovedAt = SYSDATETIME(), RejectionReason = NULL, UpdatedAt = SYSDATETIME()
          WHERE UserId = @userId
        `)
      await tx()
        .input('userId', sql.BigInt, input.userId)
        .query(`UPDATE dbo.UserAccount SET Status = 'Active', UpdatedAt = SYSDATETIME() WHERE UserId = @userId`)
    } else {
      await tx()
        .input('userId', sql.BigInt, input.userId)
        .input('rejectionReason', sql.NVarChar(500), input.rejectionReason)
        .query(`
          UPDATE dbo.EmployeeProfile
          SET ApprovalStatus = 'Rejected', ApprovedByUserId = NULL, ApprovedAt = NULL,
              RejectionReason = @rejectionReason, UpdatedAt = SYSDATETIME()
          WHERE UserId = @userId
        `)
      await tx()
        .input('userId', sql.BigInt, input.userId)
        .query(`UPDATE dbo.UserAccount SET Status = 'Disabled', UpdatedAt = SYSDATETIME() WHERE UserId = @userId`)
    }

    await transaction.commit()
    return { userId: input.userId, approvalStatus: input.action }
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
  if (input.status === 'Active') {
    const eligibility = await pool.request()
      .input('userId', sql.BigInt, input.userId)
      .query(`
        SELECT
          account.Status,
          profile.ApprovalStatus,
          SUM(CASE WHEN role.RoleCode <> 'Customer' THEN 1 ELSE 0 END) AS EmployeeRoleCount
        FROM dbo.UserAccount account
        LEFT JOIN dbo.EmployeeProfile profile ON profile.UserId = account.UserId
        LEFT JOIN dbo.UserRole userRole ON userRole.UserId = account.UserId
        LEFT JOIN dbo.Role role ON role.RoleId = userRole.RoleId
        WHERE account.UserId = @userId
        GROUP BY account.Status, profile.ApprovalStatus
      `)
    const user = eligibility.recordset[0]
    if (!user) throw new Error('Không tìm thấy người dùng.')
    if (Number(user.EmployeeRoleCount) > 0 && user.ApprovalStatus !== 'Approved') {
      throw new Error('Không thể kích hoạt tài khoản nhân viên khi hồ sơ chưa được duyệt.')
    }
  }

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
