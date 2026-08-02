import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import { getPool, sql } from '../config/database.js'
import {
  createAdminUser,
  getAdminUsers,
  reviewAdminEmployee,
  saveAdminEmployeeProfile,
  updateAdminUserRoles,
  updateAdminUserStatus,
} from '../services/adminUserService.js'
import { getWarehouseDeliveryOptions } from '../services/warehouseDeliveryService.js'

const createdUserIds: number[] = []

async function cleanup() {
  if (!createdUserIds.length) return
  const pool = await getPool()
  const idList = createdUserIds.filter(Number.isInteger).join(',')
  if (!idList) return
  const transaction = new sql.Transaction(pool)
  await transaction.begin()
  try {
    const tx = () => new sql.Request(transaction)
    await tx().query(`DELETE FROM dbo.EmployeeProfile WHERE UserId IN (${idList})`)
    await tx().query(`DELETE FROM dbo.UserRole WHERE UserId IN (${idList})`)
    await tx().query(`DELETE FROM dbo.CustomerProfile WHERE UserId IN (${idList})`)
    await tx().query(`DELETE FROM dbo.UserAccount WHERE UserId IN (${idList})`)
    await transaction.commit()
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
}

async function main() {
  const pool = await getPool()
  const fixtures = await pool.request().query(`
    SELECT TOP (1) account.UserId AS AdminUserId
    FROM dbo.UserAccount account
    INNER JOIN dbo.UserRole userRole ON userRole.UserId = account.UserId
    INNER JOIN dbo.Role role ON role.RoleId = userRole.RoleId
    WHERE role.RoleCode = 'SystemAdmin' AND account.Status = 'Active'
    ORDER BY account.UserId;

    SELECT RoleId, RoleCode FROM dbo.Role
    WHERE RoleCode IN ('Customer', 'DeliveryStaff', 'WarehouseStaff');

    SELECT TOP (1) province.ProvinceCode, ward.WardCode
    FROM dbo.AdministrativeProvince province
    INNER JOIN dbo.AdministrativeWard ward ON ward.ProvinceCode = province.ProvinceCode
    ORDER BY province.ProvinceCode, ward.WardCode;

    SELECT TOP (1) account.UserId AS CustomerUserId
    FROM dbo.UserAccount account
    INNER JOIN dbo.UserRole userRole ON userRole.UserId = account.UserId
    INNER JOIN dbo.Role role ON role.RoleId = userRole.RoleId
    LEFT JOIN dbo.EmployeeProfile employee ON employee.UserId = account.UserId
    WHERE role.RoleCode = 'Customer' AND employee.EmployeeId IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM dbo.UserRole adminUserRole
        INNER JOIN dbo.Role adminRole ON adminRole.RoleId = adminUserRole.RoleId
        WHERE adminUserRole.UserId = account.UserId AND adminRole.RoleCode = 'SystemAdmin'
      )
    ORDER BY account.UserId;
  `)
  const recordsets = fixtures.recordsets as unknown as Array<Array<Record<string, unknown>>>
  const adminUserId = Number(recordsets[0][0]?.AdminUserId)
  const roles = new Map(recordsets[1].map((role) => [String(role.RoleCode), Number(role.RoleId)]))
  const provinceCode = String(recordsets[2][0]?.ProvinceCode ?? '')
  const wardCode = String(recordsets[2][0]?.WardCode ?? '')
  const existingCustomerId = Number(recordsets[3][0]?.CustomerUserId)
  const deliveryRoleId = roles.get('DeliveryStaff')!
  const warehouseRoleId = roles.get('WarehouseStaff')!
  const customerRoleId = roles.get('Customer')!

  assert.ok(adminUserId && deliveryRoleId && warehouseRoleId && customerRoleId && provinceCode && wardCode)

  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const baseProfile = {
    fullName: 'Nhân viên kiểm thử',
    email: `employee-test-${suffix}@example.test`,
    phone: `09${suffix.slice(-8)}`,
    position: 'Nhân viên giao hàng',
    department: 'Vận chuyển',
    dateOfBirth: '1995-05-20',
    gender: 'Male' as const,
    provinceCode,
    wardCode,
    streetAddress: '123 Đường kiểm thử',
    hireDate: '2025-01-15',
  }

  const created = await createAdminUser({
    ...baseProfile,
    password: 'Test123!',
    roleIds: [deliveryRoleId],
    createdByUserId: adminUserId,
  })
  createdUserIds.push(created.userId)
  assert.equal(created.status, 'Pending')
  assert.match(created.employeeCode, /^EMP\d{6,}$/)

  const pending = await pool.request()
    .input('userId', sql.BigInt, created.userId)
    .query(`
      SELECT account.Status, employee.ApprovalStatus
      FROM dbo.UserAccount account
      INNER JOIN dbo.EmployeeProfile employee ON employee.UserId = account.UserId
      WHERE account.UserId = @userId
    `)
  assert.equal(pending.recordset[0].Status, 'Pending')
  assert.equal(pending.recordset[0].ApprovalStatus, 'Pending')

  const optionsBeforeApproval = await getWarehouseDeliveryOptions()
  assert.ok(!optionsBeforeApproval.deliveryStaff.some((staff) => Number(staff.userId) === created.userId))

  await assert.rejects(
    updateAdminUserStatus({ currentUserId: adminUserId, userId: created.userId, status: 'Active' }),
    /hồ sơ chưa được duyệt/,
  )

  if (existingCustomerId) {
    await assert.rejects(
      updateAdminUserRoles({
        currentUserId: adminUserId,
        userId: existingCustomerId,
        roleIds: [deliveryRoleId],
      }),
      /tạo hồ sơ nhân viên/,
    )
  }

  await reviewAdminEmployee({
    reviewerUserId: adminUserId,
    userId: created.userId,
    action: 'Approved',
    rejectionReason: null,
  })
  const optionsAfterApproval = await getWarehouseDeliveryOptions()
  assert.ok(optionsAfterApproval.deliveryStaff.some((staff) => Number(staff.userId) === created.userId))

  const rejected = await createAdminUser({
    ...baseProfile,
    fullName: 'Nhân viên bị từ chối',
    email: `rejected-test-${suffix}@example.test`,
    phone: `08${suffix.slice(-8)}`,
    password: 'Test123!',
    roleIds: [warehouseRoleId],
    createdByUserId: adminUserId,
  })
  createdUserIds.push(rejected.userId)
  await assert.rejects(
    reviewAdminEmployee({
      reviewerUserId: adminUserId,
      userId: rejected.userId,
      action: 'Rejected',
      rejectionReason: null,
    }),
    /lý do từ chối/,
  )
  await reviewAdminEmployee({
    reviewerUserId: adminUserId,
    userId: rejected.userId,
    action: 'Rejected',
    rejectionReason: 'Hồ sơ kiểm thử chưa đạt.',
  })
  await saveAdminEmployeeProfile({
    ...baseProfile,
    fullName: 'Nhân viên đã bổ sung',
    email: `rejected-test-${suffix}@example.test`,
    phone: `08${suffix.slice(-8)}`,
    roleIds: [warehouseRoleId],
    currentUserId: adminUserId,
    userId: rejected.userId,
  })
  const resubmitted = await pool.request()
    .input('userId', sql.BigInt, rejected.userId)
    .query(`
      SELECT account.Status, employee.ApprovalStatus, employee.RejectionReason
      FROM dbo.UserAccount account
      INNER JOIN dbo.EmployeeProfile employee ON employee.UserId = account.UserId
      WHERE account.UserId = @userId
    `)
  assert.equal(resubmitted.recordset[0].Status, 'Pending')
  assert.equal(resubmitted.recordset[0].ApprovalStatus, 'Pending')
  assert.equal(resubmitted.recordset[0].RejectionReason, null)

  const passwordHash = await bcrypt.hash('Test123!', 4)
  const tempCustomer = await pool.request()
    .input('fullName', sql.NVarChar(150), 'Khách hàng chuyển đổi kiểm thử')
    .input('email', sql.VarChar(255), `customer-convert-${suffix}@example.test`)
    .input('phone', sql.VarChar(20), `07${suffix.slice(-8)}`)
    .input('passwordHash', sql.VarChar(255), passwordHash)
    .query(`
      INSERT INTO dbo.UserAccount (FullName, Email, Phone, PasswordHash, Status, CreatedAt)
      OUTPUT INSERTED.UserId
      VALUES (@fullName, @email, @phone, @passwordHash, 'Active', SYSDATETIME())
    `)
  const customerUserId = Number(tempCustomer.recordset[0].UserId)
  createdUserIds.push(customerUserId)
  await pool.request()
    .input('userId', sql.BigInt, customerUserId)
    .input('customerRoleId', sql.Int, customerRoleId)
    .query(`
      INSERT INTO dbo.UserRole (UserId, RoleId, AssignedAt) VALUES (@userId, @customerRoleId, SYSDATETIME());
      INSERT INTO dbo.CustomerProfile (UserId, LoyaltyPoint) VALUES (@userId, 0);
    `)
  await saveAdminEmployeeProfile({
    ...baseProfile,
    fullName: 'Khách hàng đã chuyển thành nhân viên',
    email: `customer-convert-${suffix}@example.test`,
    phone: `07${suffix.slice(-8)}`,
    roleIds: [warehouseRoleId],
    currentUserId: adminUserId,
    userId: customerUserId,
  })
  const converted = await pool.request()
    .input('userId', sql.BigInt, customerUserId)
    .query(`
      SELECT account.Status, employee.ApprovalStatus, role.RoleCode,
        CASE WHEN customer.CustomerId IS NULL THEN 0 ELSE 1 END AS PreservedCustomerProfile
      FROM dbo.UserAccount account
      INNER JOIN dbo.EmployeeProfile employee ON employee.UserId = account.UserId
      INNER JOIN dbo.UserRole userRole ON userRole.UserId = account.UserId
      INNER JOIN dbo.Role role ON role.RoleId = userRole.RoleId
      LEFT JOIN dbo.CustomerProfile customer ON customer.UserId = account.UserId
      WHERE account.UserId = @userId
    `)
  assert.equal(converted.recordset[0].Status, 'Pending')
  assert.equal(converted.recordset[0].ApprovalStatus, 'Pending')
  assert.equal(converted.recordset[0].RoleCode, 'WarehouseStaff')
  assert.equal(converted.recordset[0].PreservedCustomerProfile, 1)

  const adminUsers = await getAdminUsers()
  const approvedUser = adminUsers.find((user) => Number(user.userId) === created.userId)
  assert.equal(approvedUser?.employeeProfile?.approvalStatus, 'Approved')

  console.log('PASS: create pending employee')
  console.log('PASS: pending employee cannot be activated or assigned as shipper')
  console.log('PASS: direct staff-role assignment to customer is blocked')
  console.log('PASS: approval activates employee and enables shipper selection')
  console.log('PASS: rejection requires reason and resubmission returns to pending')
  console.log('PASS: customer conversion preserves customer history and requires approval')
  console.log('PASS: admin user query returns private employee profile to SystemAdmin service')
}

async function run() {
  try {
    await main()
  } finally {
    await cleanup()
    const pool = await getPool()
    await pool.close()
  }
}

void run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
