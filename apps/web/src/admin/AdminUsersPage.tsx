import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  createAdminUser,
  getAdminRoles,
  getAdminUsers,
  getProvinces,
  getWards,
  reviewAdminEmployee,
  saveAdminEmployeeProfile,
  updateAdminUserStatus,
} from '../api'
import type {
  AdminEmployeePayload,
  AdminRole,
  AdminUser,
  AdministrativeProvince,
  AdministrativeWard,
} from '../types'

type Props = {
  currentUserId: number | null
  roles: string[]
  token: string
}

type EmployeeForm = AdminEmployeePayload & { password: string }

const emptyEmployeeForm: EmployeeForm = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  roleIds: [],
  position: '',
  department: '',
  dateOfBirth: '',
  gender: '',
  provinceCode: '',
  wardCode: '',
  streetAddress: '',
  hireDate: '',
}

const accountStatusLabels: Record<AdminUser['status'], string> = {
  Pending: 'Chờ kích hoạt',
  Active: 'Đang hoạt động',
  Locked: 'Đã khóa',
  Disabled: 'Vô hiệu hóa',
}

const approvalLabels = {
  Pending: 'Chờ duyệt',
  Approved: 'Đã duyệt',
  Rejected: 'Bị từ chối',
}

function profileToForm(user: AdminUser, roleOptions: AdminRole[]): EmployeeForm {
  const profile = user.employeeProfile
  return {
    ...emptyEmployeeForm,
    fullName: user.fullName,
    email: user.email ?? '',
    phone: user.phone ?? '',
    roleIds: roleOptions
      .filter((role) => role.roleCode !== 'Customer' && user.roles.includes(role.roleCode))
      .map((role) => role.roleId),
    position: profile?.position ?? '',
    department: profile?.department ?? '',
    dateOfBirth: profile?.dateOfBirth?.slice(0, 10) ?? '',
    gender: profile?.gender ?? '',
    provinceCode: profile?.provinceCode ?? '',
    wardCode: profile?.wardCode ?? '',
    streetAddress: profile?.streetAddress ?? '',
    hireDate: profile?.hireDate?.slice(0, 10) ?? '',
  }
}

function employeePayload(form: EmployeeForm): AdminEmployeePayload {
  const { password: _password, ...payload } = form
  return payload
}

export function AdminUsersPage({ currentUserId, roles, token }: Props) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [roleOptions, setRoleOptions] = useState<AdminRole[]>([])
  const [provinces, setProvinces] = useState<AdministrativeProvince[]>([])
  const [createWards, setCreateWards] = useState<AdministrativeWard[]>([])
  const [editWards, setEditWards] = useState<AdministrativeWard[]>([])
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [createForm, setCreateForm] = useState<EmployeeForm>(emptyEmployeeForm)
  const [editForm, setEditForm] = useState<EmployeeForm>(emptyEmployeeForm)
  const [search, setSearch] = useState('')
  const [approvalFilter, setApprovalFilter] = useState('All')
  const [rejectionReason, setRejectionReason] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const allowed = roles.includes('SystemAdmin')
  const employeeRoleOptions = useMemo(
    () => roleOptions.filter((role) => role.roleCode !== 'Customer'),
    [roleOptions],
  )
  const selectedUser = users.find((user) => user.userId === selectedUserId) ?? null
  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return users.filter((user) => {
      const approvalStatus = user.employeeProfile?.approvalStatus ?? 'Missing'
      if (approvalFilter !== 'All' && approvalStatus !== approvalFilter) return false
      if (!keyword) return true
      return [
        user.fullName,
        user.email,
        user.phone,
        user.employeeProfile?.employeeCode,
        user.employeeProfile?.position,
        user.employeeProfile?.department,
        ...user.roles,
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(keyword))
    })
  }, [approvalFilter, search, users])

  const loadData = useCallback(async () => {
    if (!allowed || !token) return
    setLoading(true)
    setError('')
    try {
      const [userPayload, rolePayload, provincePayload] = await Promise.all([
        getAdminUsers(token),
        getAdminRoles(token),
        getProvinces(),
      ])
      setUsers(userPayload.data)
      setRoleOptions(rolePayload.data)
      setProvinces(provincePayload.data)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được dữ liệu nhân viên.')
    } finally {
      setLoading(false)
    }
  }, [allowed, token])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (!createForm.provinceCode) {
      setCreateWards([])
      return
    }
    void getWards(createForm.provinceCode)
      .then((payload) => setCreateWards(payload.data))
      .catch(() => setCreateWards([]))
  }, [createForm.provinceCode])

  useEffect(() => {
    if (!editForm.provinceCode) {
      setEditWards([])
      return
    }
    void getWards(editForm.provinceCode)
      .then((payload) => setEditWards(payload.data))
      .catch(() => setEditWards([]))
  }, [editForm.provinceCode])

  useEffect(() => {
    if (!selectedUser) return
    setEditForm(profileToForm(selectedUser, roleOptions))
  }, [roleOptions, selectedUser])

  function selectUser(user: AdminUser) {
    setSelectedUserId(user.userId)
    setEditForm(profileToForm(user, roleOptions))
    setRejectionReason('')
    setError('')
    setMessage('')
  }

  function toggleRole(roleId: number, target: 'create' | 'edit') {
    const setter = target === 'create' ? setCreateForm : setEditForm
    setter((current) => ({
      ...current,
      roleIds: current.roleIds.includes(roleId)
        ? current.roleIds.filter((id) => id !== roleId)
        : [...current.roleIds, roleId],
    }))
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const result = await createAdminUser(createForm, token)
      setCreateForm(emptyEmployeeForm)
      setMessage(`Đã tạo ${result.data.employeeCode}. Tài khoản đang chờ duyệt và chưa thể đăng nhập.`)
      await loadData()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không tạo được nhân viên.')
    } finally {
      setSaving(false)
    }
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault()
    if (!selectedUser) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const hadProfile = Boolean(selectedUser.employeeProfile)
      await saveAdminEmployeeProfile(selectedUser.userId, employeePayload(editForm), token)
      setMessage(hadProfile ? 'Đã cập nhật hồ sơ và vai trò nhân viên.' : 'Đã tạo hồ sơ chuyển đổi. Tài khoản đang chờ duyệt.')
      await loadData()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không lưu được hồ sơ nhân viên.')
    } finally {
      setSaving(false)
    }
  }

  async function review(action: 'Approved' | 'Rejected') {
    if (!selectedUser) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await reviewAdminEmployee(selectedUser.userId, { action, rejectionReason }, token)
      setMessage(action === 'Approved' ? 'Đã duyệt hồ sơ và kích hoạt tài khoản.' : 'Đã từ chối hồ sơ và vô hiệu hóa tài khoản.')
      setRejectionReason('')
      await loadData()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không xử lý được hồ sơ.')
    } finally {
      setSaving(false)
    }
  }

  async function changeStatus(status: 'Active' | 'Locked' | 'Disabled') {
    if (!selectedUser) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await updateAdminUserStatus(selectedUser.userId, status, token)
      setMessage('Đã cập nhật trạng thái tài khoản.')
      await loadData()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không cập nhật được trạng thái.')
    } finally {
      setSaving(false)
    }
  }

  if (!allowed) {
    return <div className="status-card error">Chỉ tài khoản SystemAdmin được quản lý hồ sơ nhân viên.</div>
  }

  return (
    <section className="admin-page">
      <span className="eyebrow">Quản trị hệ thống</span>
      <h1>Hồ sơ nhân viên & phân quyền</h1>
      <p className="section-copy">
        Nhân viên chỉ được đăng nhập sau khi hồ sơ được duyệt. Role kiểm soát quyền hệ thống;
        chức danh và phòng ban mô tả vị trí trong tổ chức.
      </p>

      {error && <div className="status-card error">{error}</div>}
      {message && <div className="status-card">{message}</div>}

      <div className="admin-users-layout">
        <div className="admin-panel-card">
          <div className="admin-users-toolbar">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm tên, mã nhân viên, liên hệ, chức danh hoặc role"
            />
            <select value={approvalFilter} onChange={(event) => setApprovalFilter(event.target.value)}>
              <option value="All">Tất cả hồ sơ</option>
              <option value="Pending">Chờ duyệt</option>
              <option value="Approved">Đã duyệt</option>
              <option value="Rejected">Bị từ chối</option>
              <option value="Missing">Chưa có hồ sơ</option>
            </select>
            <strong>{filteredUsers.length} tài khoản</strong>
          </div>

          {loading ? <p>Đang tải...</p> : (
            <div className="admin-users-list">
              {filteredUsers.map((user) => {
                const profile = user.employeeProfile
                return (
                  <button
                    className={`admin-user-row ${selectedUserId === user.userId ? 'active' : ''}`}
                    key={user.userId}
                    onClick={() => selectUser(user)}
                    type="button"
                  >
                    <div>
                      <strong>{user.fullName} {user.userId === currentUserId ? '(Bạn)' : ''}</strong>
                      <small>{profile?.employeeCode ?? 'Chưa có mã nhân viên'} · {user.email || user.phone || 'Chưa có liên hệ'}</small>
                    </div>
                    <div className="admin-user-roles">
                      {user.roles.length ? user.roles.map((role) => <span key={role}>{role}</span>) : <span>Chưa có role</span>}
                      <span className={`approval-status ${(profile?.approvalStatus ?? 'missing').toLowerCase()}`}>
                        {profile ? approvalLabels[profile.approvalStatus] : 'Chưa có hồ sơ'}
                      </span>
                    </div>
                    <span className={`user-status ${user.status.toLowerCase()}`}>{accountStatusLabels[user.status]}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="admin-users-side">
          <form className="admin-product-form employee-form" onSubmit={handleCreate}>
            <span className="eyebrow">Thêm mới</span>
            <h3>Tạo hồ sơ nhân viên</h3>
            <EmployeeFields
              form={createForm}
              provinces={provinces}
              wards={createWards}
              onChange={setCreateForm}
            />
            <label>Mật khẩu ban đầu<input required minLength={6} type="password" value={createForm.password} onChange={(event) => setCreateForm({ ...createForm, password: event.target.value })} /></label>
            <RolePicker roles={employeeRoleOptions} selected={createForm.roleIds} onToggle={(id) => toggleRole(id, 'create')} />
            <button disabled={saving || createForm.roleIds.length === 0}>Tạo tài khoản chờ duyệt</button>
          </form>

          {selectedUser && (
            <form className="admin-product-form employee-form" onSubmit={saveProfile}>
              <span className="eyebrow">
                {selectedUser.employeeProfile?.employeeCode ?? `Tài khoản #${selectedUser.userId}`}
              </span>
              <h3>{selectedUser.employeeProfile ? 'Chi tiết hồ sơ nhân viên' : 'Tạo hồ sơ / chuyển thành nhân viên'}</h3>
              {selectedUser.employeeProfile?.rejectionReason && (
                <div className="status-card error">Lý do từ chối: {selectedUser.employeeProfile.rejectionReason}</div>
              )}
              <EmployeeFields
                form={editForm}
                provinces={provinces}
                wards={editWards}
                onChange={setEditForm}
              />
              <RolePicker roles={employeeRoleOptions} selected={editForm.roleIds} onToggle={(id) => toggleRole(id, 'edit')} />
              <button disabled={saving || editForm.roleIds.length === 0 || selectedUser.userId === currentUserId}>
                {selectedUser.employeeProfile ? 'Lưu hồ sơ & vai trò' : 'Tạo hồ sơ nhân viên'}
              </button>

              {selectedUser.employeeProfile?.approvalStatus === 'Pending' && (
                <div className="employee-review-actions">
                  <button disabled={saving} onClick={() => void review('Approved')} type="button">Duyệt & kích hoạt</button>
                  <label>
                    Lý do nếu từ chối
                    <textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} />
                  </label>
                  <button className="danger-button" disabled={saving || !rejectionReason.trim()} onClick={() => void review('Rejected')} type="button">Từ chối hồ sơ</button>
                </div>
              )}

              {selectedUser.employeeProfile?.approvalStatus === 'Approved' && (
                <div className="employee-audit-note">
                  Duyệt bởi {selectedUser.employeeProfile.approvedByName ?? `#${selectedUser.employeeProfile.approvedByUserId}`}
                  {selectedUser.employeeProfile.approvedAt ? ` lúc ${new Date(selectedUser.employeeProfile.approvedAt).toLocaleString('vi-VN')}` : ''}.
                </div>
              )}

              <div className="admin-status-actions">
                <button disabled={saving || selectedUser.employeeProfile?.approvalStatus !== 'Approved'} onClick={() => void changeStatus('Active')} type="button">Mở tài khoản</button>
                <button disabled={saving || selectedUser.userId === currentUserId} onClick={() => void changeStatus('Locked')} type="button">Khóa</button>
                <button disabled={saving || selectedUser.userId === currentUserId} onClick={() => void changeStatus('Disabled')} type="button">Vô hiệu hóa</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}

function EmployeeFields({ form, provinces, wards, onChange }: {
  form: EmployeeForm
  provinces: AdministrativeProvince[]
  wards: AdministrativeWard[]
  onChange: (form: EmployeeForm) => void
}) {
  return (
    <>
      <label>Họ tên<input required value={form.fullName} onChange={(event) => onChange({ ...form, fullName: event.target.value })} /></label>
      <div className="form-grid">
        <label>Email<input type="email" value={form.email} onChange={(event) => onChange({ ...form, email: event.target.value })} /></label>
        <label>Số điện thoại<input required value={form.phone} onChange={(event) => onChange({ ...form, phone: event.target.value })} /></label>
      </div>
      <div className="form-grid">
        <label>Ngày sinh<input required type="date" value={form.dateOfBirth} onChange={(event) => onChange({ ...form, dateOfBirth: event.target.value })} /></label>
        <label>Giới tính
          <select required value={form.gender} onChange={(event) => onChange({ ...form, gender: event.target.value as EmployeeForm['gender'] })}>
            <option value="">Chọn giới tính</option>
            <option value="Male">Nam</option>
            <option value="Female">Nữ</option>
            <option value="Other">Khác</option>
          </select>
        </label>
      </div>
      <div className="form-grid">
        <label>Chức danh<input required placeholder="Nhân viên giao hàng" value={form.position} onChange={(event) => onChange({ ...form, position: event.target.value })} /></label>
        <label>Phòng ban<input required placeholder="Vận chuyển / Kho vận" value={form.department} onChange={(event) => onChange({ ...form, department: event.target.value })} /></label>
      </div>
      <label>Ngày vào làm<input required type="date" value={form.hireDate} onChange={(event) => onChange({ ...form, hireDate: event.target.value })} /></label>
      <div className="form-grid">
        <label>Tỉnh/thành
          <select required value={form.provinceCode} onChange={(event) => onChange({ ...form, provinceCode: event.target.value, wardCode: '' })}>
            <option value="">Chọn tỉnh/thành</option>
            {provinces.map((province) => <option key={province.provinceCode} value={province.provinceCode}>{province.provinceName}</option>)}
          </select>
        </label>
        <label>Xã/phường
          <select required disabled={!form.provinceCode} value={form.wardCode} onChange={(event) => onChange({ ...form, wardCode: event.target.value })}>
            <option value="">Chọn xã/phường</option>
            {wards.map((ward) => <option key={ward.wardCode} value={ward.wardCode}>{ward.wardName}</option>)}
          </select>
        </label>
      </div>
      <label>Địa chỉ nhà<input required placeholder="Số nhà, tên đường..." value={form.streetAddress} onChange={(event) => onChange({ ...form, streetAddress: event.target.value })} /></label>
    </>
  )
}

function RolePicker({ roles, selected, onToggle }: {
  roles: AdminRole[]
  selected: number[]
  onToggle: (roleId: number) => void
}) {
  return (
    <fieldset className="role-picker">
      <legend>Vai trò nhân viên và quyền đi kèm</legend>
      {roles.map((role) => (
        <label key={role.roleId}>
          <input
            checked={selected.includes(role.roleId)}
            onChange={() => onToggle(role.roleId)}
            type="checkbox"
          />
          <span>
            <strong>{role.roleName}</strong>
            <small>{role.permissions || role.description || role.roleCode}</small>
          </span>
        </label>
      ))}
    </fieldset>
  )
}
