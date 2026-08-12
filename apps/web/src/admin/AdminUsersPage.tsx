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
import { featureFlags } from '../featureFlags'

type Props = {
  currentUserId: number | null
  roles: string[]
  token: string
}

type EmployeeForm = AdminEmployeePayload & { password: string }
type DetailTab = 'profile' | 'roles' | 'approval'

const emptyEmployeeForm: EmployeeForm = {
  fullName: '', email: '', phone: '', password: '', roleIds: [],
  position: '', department: '', dateOfBirth: '', gender: '',
  provinceCode: '', wardCode: '', streetAddress: '', hireDate: '',
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

function localIsoDate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function validateEmployeeForm(form: EmployeeForm, includePassword: boolean) {
  const today = localIsoDate()
  if (!form.fullName.trim()) return { step: 1, message: 'Vui lòng nhập họ tên nhân viên.' }
  if (!form.phone.trim()) return { step: 1, message: 'Vui lòng nhập số điện thoại nhân viên.' }
  if (!form.dateOfBirth || form.dateOfBirth >= today) return { step: 1, message: 'Ngày sinh phải là một ngày hợp lệ trước hôm nay.' }
  if (!form.gender) return { step: 1, message: 'Vui lòng chọn giới tính nhân viên.' }
  if (!form.position.trim()) return { step: 2, message: 'Vui lòng nhập chức danh nhân viên.' }
  if (!form.department.trim()) return { step: 2, message: 'Vui lòng nhập phòng ban nhân viên.' }
  if (!form.hireDate || form.hireDate > today) return { step: 2, message: 'Ngày vào làm không được lớn hơn ngày hiện tại.' }
  if (!form.provinceCode) return { step: 2, message: 'Vui lòng chọn tỉnh/thành.' }
  if (!form.wardCode) return { step: 2, message: 'Vui lòng chọn xã/phường.' }
  if (!form.streetAddress.trim()) return { step: 2, message: 'Vui lòng nhập địa chỉ nhà.' }
  if (form.roleIds.length === 0) return { step: 3, message: 'Vui lòng chọn ít nhất một vai trò nhân viên.' }
  if (includePassword && form.password.length < 6) return { step: 3, message: 'Mật khẩu ban đầu phải có ít nhất 6 ký tự.' }
  return null
}

export function AdminUsersPage({ currentUserId, roles, token }: Props) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [roleOptions, setRoleOptions] = useState<AdminRole[]>([])
  const [provinces, setProvinces] = useState<AdministrativeProvince[]>([])
  const [createWards, setCreateWards] = useState<AdministrativeWard[]>([])
  const [editWards, setEditWards] = useState<AdministrativeWard[]>([])
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createStep, setCreateStep] = useState(1)
  const [detailTab, setDetailTab] = useState<DetailTab>('profile')
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
    () => roleOptions.filter((role) => role.roleCode !== 'Customer'
      && (featureFlags.extendedDeliveryWorkflow || role.roleCode !== 'DeliveryStaff')),
    [roleOptions],
  )
  const selectedUser = users.find((user) => user.userId === selectedUserId) ?? null
  const stats = useMemo(() => ({
    total: users.filter((user) => user.employeeProfile).length,
    pending: users.filter((user) => user.employeeProfile?.approvalStatus === 'Pending').length,
    approved: users.filter((user) => user.employeeProfile?.approvalStatus === 'Approved').length,
    missing: users.filter((user) => !user.employeeProfile).length,
  }), [users])
  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return users.filter((user) => {
      const approvalStatus = user.employeeProfile?.approvalStatus ?? 'Missing'
      if (approvalFilter !== 'All' && approvalStatus !== approvalFilter) return false
      if (!keyword) return true
      return [
        user.fullName, user.email, user.phone, user.employeeProfile?.employeeCode,
        user.employeeProfile?.position, user.employeeProfile?.department, ...user.roles,
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(keyword))
    })
  }, [approvalFilter, search, users])

  const loadData = useCallback(async () => {
    if (!allowed || !token) return
    setLoading(true)
    setError('')
    try {
      const [userPayload, rolePayload, provincePayload] = await Promise.all([
        getAdminUsers(token), getAdminRoles(token), getProvinces(),
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

  useEffect(() => { void loadData() }, [loadData])

  useEffect(() => {
    if (!createForm.provinceCode) { setCreateWards([]); return }
    void getWards(createForm.provinceCode).then((payload) => setCreateWards(payload.data)).catch(() => setCreateWards([]))
  }, [createForm.provinceCode])

  useEffect(() => {
    if (!editForm.provinceCode) { setEditWards([]); return }
    void getWards(editForm.provinceCode).then((payload) => setEditWards(payload.data)).catch(() => setEditWards([]))
  }, [editForm.provinceCode])

  useEffect(() => {
    if (!selectedUser) return
    setEditForm(profileToForm(selectedUser, roleOptions))
  }, [roleOptions, selectedUser])

  useEffect(() => {
    if (!createOpen && !selectedUser) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || saving) return
      setCreateOpen(false)
      setSelectedUserId(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [createOpen, saving, selectedUser])

  function openCreate() {
    setCreateForm(emptyEmployeeForm)
    setCreateStep(1)
    setError('')
    setMessage('')
    setCreateOpen(true)
  }

  function selectUser(user: AdminUser) {
    setSelectedUserId(user.userId)
    setEditForm(profileToForm(user, roleOptions))
    setDetailTab('profile')
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

  const canContinueCreate = createStep === 1
    ? Boolean(createForm.fullName && createForm.phone && createForm.dateOfBirth && createForm.gender)
    : Boolean(createForm.position && createForm.department && createForm.hireDate
      && createForm.provinceCode && createForm.wardCode && createForm.streetAddress)

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    const validationError = validateEmployeeForm(createForm, true)
    if (validationError) {
      setCreateStep(validationError.step)
      setError(validationError.message)
      return
    }
    setSaving(true); setError(''); setMessage('')
    try {
      const result = await createAdminUser(createForm, token)
      setCreateForm(emptyEmployeeForm)
      setCreateOpen(false)
      setCreateStep(1)
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
    const validationError = validateEmployeeForm(editForm, false)
    if (validationError) {
      setDetailTab(validationError.step === 3 ? 'roles' : 'profile')
      setError(validationError.message)
      return
    }
    setSaving(true); setError(''); setMessage('')
    try {
      const hadProfile = Boolean(selectedUser.employeeProfile)
      await saveAdminEmployeeProfile(selectedUser.userId, employeePayload(editForm), token)
      setMessage(hadProfile ? 'Đã cập nhật hồ sơ và vai trò nhân viên.' : 'Đã tạo hồ sơ chuyển đổi. Tài khoản đang chờ duyệt.')
      await loadData()
      setDetailTab('approval')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không lưu được hồ sơ nhân viên.')
    } finally {
      setSaving(false)
    }
  }

  async function review(action: 'Approved' | 'Rejected') {
    if (!selectedUser) return
    setSaving(true); setError(''); setMessage('')
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
    setSaving(true); setError(''); setMessage('')
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

  if (!allowed) return <div className="status-card error">Chỉ tài khoản SystemAdmin được quản lý hồ sơ nhân viên.</div>

  return (
    <section className="admin-page employee-admin-page">
      <header className="employee-page-header">
        <div>
          <span className="eyebrow">Quản trị hệ thống</span>
          <h1>Hồ sơ nhân viên</h1>
          <p className="section-copy">Quản lý hồ sơ, trạng thái xét duyệt và quyền truy cập của nhân viên.</p>
        </div>
        <button className="employee-primary-action" onClick={openCreate} type="button">+ Thêm nhân viên</button>
      </header>

      {error && !createOpen && !selectedUser && <div className="status-card error">{error}</div>}
      {message && <div className="status-card">{message}</div>}

      <div className="employee-metrics">
        <div><span>Hồ sơ nhân viên</span><strong>{stats.total}</strong></div>
        <div><span>Chờ duyệt</span><strong>{stats.pending}</strong></div>
        <div><span>Đã duyệt</span><strong>{stats.approved}</strong></div>
        <div><span>Chưa có hồ sơ</span><strong>{stats.missing}</strong></div>
      </div>

      <div className="admin-panel-card employee-list-panel">
        <div className="admin-users-toolbar">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên, mã nhân viên, liên hệ, chức danh hoặc role" />
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
                <button className="admin-user-row" key={user.userId} onClick={() => selectUser(user)} type="button">
                  <div>
                    <strong>{user.fullName} {user.userId === currentUserId ? '(Bạn)' : ''}</strong>
                    <small>{profile?.employeeCode ?? 'Chưa có mã nhân viên'} · {user.email || user.phone || 'Chưa có liên hệ'}</small>
                  </div>
                  <div className="admin-user-roles">
                    {user.roles.filter((role) => featureFlags.extendedDeliveryWorkflow || role !== 'DeliveryStaff').length
                      ? user.roles.filter((role) => featureFlags.extendedDeliveryWorkflow || role !== 'DeliveryStaff').map((role) => <span key={role}>{role}</span>)
                      : <span>Chưa có role hiển thị</span>}
                    <span className={`approval-status ${(profile?.approvalStatus ?? 'missing').toLowerCase()}`}>
                      {profile ? approvalLabels[profile.approvalStatus] : 'Chưa có hồ sơ'}
                    </span>
                  </div>
                  <span className={`user-status ${user.status.toLowerCase()}`}>{accountStatusLabels[user.status]}</span>
                  <span className="employee-row-arrow" aria-hidden="true">›</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {createOpen && (
        <div className="employee-modal-backdrop" onMouseDown={() => !saving && setCreateOpen(false)}>
          <form className="employee-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={handleCreate}>
            <ModalHeader eyebrow="Thêm mới" title="Tạo hồ sơ nhân viên" onClose={() => setCreateOpen(false)} disabled={saving} />
            <div className="employee-stepper" aria-label="Tiến trình tạo nhân viên">
              {['Cá nhân', 'Công việc', 'Tài khoản & quyền'].map((label, index) => (
                <button className={createStep === index + 1 ? 'active' : createStep > index + 1 ? 'done' : ''} key={label} onClick={() => index + 1 < createStep && setCreateStep(index + 1)} type="button">
                  <span>{index + 1}</span>{label}
                </button>
              ))}
            </div>
            <div className="employee-modal-body">
              {error && <div className="status-card error">{error}</div>}
              {createStep === 1 && <FormSection title="Thông tin cá nhân" copy="Thông tin định danh và liên hệ cơ bản."><PersonalFields form={createForm} onChange={setCreateForm} /></FormSection>}
              {createStep === 2 && <FormSection title="Công việc & địa chỉ" copy="Thông tin phục vụ quản lý nhân sự nội bộ."><EmploymentFields form={createForm} provinces={provinces} wards={createWards} onChange={setCreateForm} /></FormSection>}
              {createStep === 3 && (
                <FormSection title="Tài khoản & quyền" copy="Role quyết định chức năng nhân viên được phép sử dụng.">
                  <label>Mật khẩu ban đầu<input required minLength={6} type="password" value={createForm.password} onChange={(event) => setCreateForm({ ...createForm, password: event.target.value })} /></label>
                  <RolePicker compact roles={employeeRoleOptions} selected={createForm.roleIds} onToggle={(id) => toggleRole(id, 'create')} />
                </FormSection>
              )}
            </div>
            <footer className="employee-modal-footer">
              <button className="secondary-button" disabled={saving || createStep === 1} onClick={() => setCreateStep((step) => step - 1)} type="button">Quay lại</button>
              {createStep < 3
                ? <button disabled={!canContinueCreate} onClick={() => setCreateStep((step) => step + 1)} type="button">Tiếp tục</button>
                : <button disabled={saving || createForm.password.length < 6 || createForm.roleIds.length === 0}>Tạo tài khoản chờ duyệt</button>}
            </footer>
          </form>
        </div>
      )}

      {selectedUser && (
        <div className="employee-modal-backdrop" onMouseDown={() => !saving && setSelectedUserId(null)}>
          <form className="employee-modal employee-detail-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={saveProfile}>
            <ModalHeader
              eyebrow={selectedUser.employeeProfile?.employeeCode ?? `Tài khoản #${selectedUser.userId}`}
              title={selectedUser.fullName}
              onClose={() => setSelectedUserId(null)}
              disabled={saving}
            />
            <div className="employee-detail-tabs">
              <button className={detailTab === 'profile' ? 'active' : ''} onClick={() => setDetailTab('profile')} type="button">Hồ sơ</button>
              <button className={detailTab === 'roles' ? 'active' : ''} onClick={() => setDetailTab('roles')} type="button">Vai trò</button>
              <button className={detailTab === 'approval' ? 'active' : ''} onClick={() => setDetailTab('approval')} type="button">Xét duyệt & truy cập</button>
            </div>
            <div className="employee-modal-body">
              {error && <div className="status-card error">{error}</div>}
              {detailTab === 'profile' && (
                <div className="employee-detail-sections">
                  <FormSection title="Thông tin cá nhân"><PersonalFields form={editForm} onChange={setEditForm} /></FormSection>
                  <FormSection title="Công việc & địa chỉ"><EmploymentFields form={editForm} provinces={provinces} wards={editWards} onChange={setEditForm} /></FormSection>
                </div>
              )}
              {detailTab === 'roles' && (
                <FormSection title="Vai trò nhân viên" copy="Customer không thể được gán trực tiếp cùng role nhân viên.">
                  <RolePicker compact roles={employeeRoleOptions} selected={editForm.roleIds} onToggle={(id) => toggleRole(id, 'edit')} />
                </FormSection>
              )}
              {detailTab === 'approval' && (
                <ApprovalPanel
                  currentUserId={currentUserId}
                  rejectionReason={rejectionReason}
                  saving={saving}
                  user={selectedUser}
                  onReasonChange={setRejectionReason}
                  onReview={review}
                  onStatusChange={changeStatus}
                />
              )}
            </div>
            <footer className="employee-modal-footer">
              <button className="secondary-button" onClick={() => setSelectedUserId(null)} type="button">Đóng</button>
              {detailTab === 'profile' && <button onClick={() => setDetailTab('roles')} type="button">Tiếp: vai trò</button>}
              {detailTab === 'roles' && (
                <button disabled={saving || editForm.roleIds.length === 0 || selectedUser.userId === currentUserId}>
                  {selectedUser.employeeProfile ? 'Lưu hồ sơ & vai trò' : 'Tạo hồ sơ nhân viên'}
                </button>
              )}
            </footer>
          </form>
        </div>
      )}
    </section>
  )
}

function ModalHeader({ eyebrow, title, disabled, onClose }: {
  eyebrow: string
  title: string
  disabled: boolean
  onClose: () => void
}) {
  return (
    <header className="employee-modal-header">
      <div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>
      <button aria-label="Đóng" disabled={disabled} onClick={onClose} type="button">×</button>
    </header>
  )
}

function FormSection({ title, copy, children }: { title: string; copy?: string; children: React.ReactNode }) {
  return (
    <section className="employee-form-section">
      <div className="employee-form-section-heading"><h3>{title}</h3>{copy && <p>{copy}</p>}</div>
      <div className="employee-form-fields">{children}</div>
    </section>
  )
}

function PersonalFields({ form, onChange }: { form: EmployeeForm; onChange: (form: EmployeeForm) => void }) {
  const today = localIsoDate()
  return (
    <div className="employee-field-grid">
      <label className="field-span-2">Họ tên<input required value={form.fullName} onChange={(event) => onChange({ ...form, fullName: event.target.value })} /></label>
      <label>Email<input type="email" value={form.email} onChange={(event) => onChange({ ...form, email: event.target.value })} /></label>
      <label>Số điện thoại<input required value={form.phone} onChange={(event) => onChange({ ...form, phone: event.target.value })} /></label>
      <label>Ngày sinh<input max={today} required type="date" value={form.dateOfBirth} onChange={(event) => onChange({ ...form, dateOfBirth: event.target.value })} /></label>
      <label>Giới tính
        <select required value={form.gender} onChange={(event) => onChange({ ...form, gender: event.target.value as EmployeeForm['gender'] })}>
          <option value="">Chọn giới tính</option><option value="Male">Nam</option><option value="Female">Nữ</option><option value="Other">Khác</option>
        </select>
      </label>
    </div>
  )
}

function EmploymentFields({ form, provinces, wards, onChange }: {
  form: EmployeeForm
  provinces: AdministrativeProvince[]
  wards: AdministrativeWard[]
  onChange: (form: EmployeeForm) => void
}) {
  const today = localIsoDate()
  return (
    <div className="employee-field-grid">
      <label>Chức danh<input required placeholder="Nhân viên giao hàng" value={form.position} onChange={(event) => onChange({ ...form, position: event.target.value })} /></label>
      <label>Phòng ban<input required placeholder="Vận chuyển / Kho vận" value={form.department} onChange={(event) => onChange({ ...form, department: event.target.value })} /></label>
      <label>Ngày vào làm<input max={today} required type="date" value={form.hireDate} onChange={(event) => onChange({ ...form, hireDate: event.target.value })} /></label>
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
      <label className="field-span-2">Địa chỉ nhà<input required placeholder="Số nhà, tên đường..." value={form.streetAddress} onChange={(event) => onChange({ ...form, streetAddress: event.target.value })} /></label>
    </div>
  )
}

function ApprovalPanel({ user, currentUserId, saving, rejectionReason, onReasonChange, onReview, onStatusChange }: {
  user: AdminUser
  currentUserId: number | null
  saving: boolean
  rejectionReason: string
  onReasonChange: (reason: string) => void
  onReview: (action: 'Approved' | 'Rejected') => Promise<void>
  onStatusChange: (status: 'Active' | 'Locked' | 'Disabled') => Promise<void>
}) {
  const profile = user.employeeProfile
  if (!profile) return <div className="employee-empty-state"><strong>Chưa có hồ sơ nhân viên</strong><p>Hoàn thiện thông tin ở tab Hồ sơ, chọn role rồi lưu trước khi xét duyệt.</p></div>
  return (
    <div className="employee-approval-panel">
      <div className="employee-approval-summary">
        <div><span>Hồ sơ</span><strong>{approvalLabels[profile.approvalStatus]}</strong></div>
        <div><span>Tài khoản</span><strong>{accountStatusLabels[user.status]}</strong></div>
        <div><span>Ngày vào làm</span><strong>{new Date(profile.hireDate).toLocaleDateString('vi-VN')}</strong></div>
      </div>
      {profile.rejectionReason && <div className="status-card error">Lý do từ chối: {profile.rejectionReason}</div>}
      {profile.approvalStatus === 'Pending' && (
        <div className="employee-review-actions">
          <button disabled={saving} onClick={() => void onReview('Approved')} type="button">Duyệt & kích hoạt</button>
          <label>Lý do nếu từ chối<textarea value={rejectionReason} onChange={(event) => onReasonChange(event.target.value)} /></label>
          <button className="danger-button" disabled={saving || !rejectionReason.trim()} onClick={() => void onReview('Rejected')} type="button">Từ chối hồ sơ</button>
        </div>
      )}
      {profile.approvalStatus === 'Approved' && (
        <div className="employee-audit-note">Duyệt bởi {profile.approvedByName ?? `#${profile.approvedByUserId}`}{profile.approvedAt ? ` lúc ${new Date(profile.approvedAt).toLocaleString('vi-VN')}` : ''}.</div>
      )}
      <div className="admin-status-actions">
        <button disabled={saving || profile.approvalStatus !== 'Approved'} onClick={() => void onStatusChange('Active')} type="button">Mở tài khoản</button>
        <button disabled={saving || user.userId === currentUserId} onClick={() => void onStatusChange('Locked')} type="button">Khóa</button>
        <button disabled={saving || user.userId === currentUserId} onClick={() => void onStatusChange('Disabled')} type="button">Vô hiệu hóa</button>
      </div>
    </div>
  )
}

function RolePicker({ roles, selected, compact = false, onToggle }: {
  roles: AdminRole[]
  selected: number[]
  compact?: boolean
  onToggle: (roleId: number) => void
}) {
  return (
    <fieldset className={`role-picker ${compact ? 'compact-role-picker' : ''}`}>
      <legend>Vai trò nhân viên và quyền đi kèm</legend>
      <div className="role-picker-options">
        {roles.map((role) => (
          <label key={role.roleId}>
            <input checked={selected.includes(role.roleId)} onChange={() => onToggle(role.roleId)} type="checkbox" />
            <span><strong>{role.roleName}</strong><small>{role.permissions || role.description || role.roleCode}</small></span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
