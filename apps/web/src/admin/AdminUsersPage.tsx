import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  createAdminUser,
  getAdminRoles,
  getAdminUsers,
  updateAdminUserRoles,
  updateAdminUserStatus,
} from '../api'
import type { AdminRole, AdminUser } from '../types'

type Props = {
  currentUserId: number | null
  roles: string[]
  token: string
}

const initialForm = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  roleIds: [] as number[],
}

export function AdminUsersPage({ currentUserId, roles, token }: Props) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [roleOptions, setRoleOptions] = useState<AdminRole[]>([])
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([])
  const [form, setForm] = useState(initialForm)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const allowed = roles.includes('SystemAdmin')
  const selectedUser = users.find((user) => user.userId === selectedUserId) ?? null
  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return users
    return users.filter((user) =>
      [user.fullName, user.email, user.phone, ...user.roles]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword)),
    )
  }, [search, users])

  const loadData = useCallback(async () => {
    if (!allowed || !token) return
    setLoading(true)
    setError('')
    try {
      const [userPayload, rolePayload] = await Promise.all([
        getAdminUsers(token),
        getAdminRoles(token),
      ])
      setUsers(userPayload.data)
      setRoleOptions(rolePayload.data)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được dữ liệu nhân viên.')
    } finally {
      setLoading(false)
    }
  }, [allowed, token])

  useEffect(() => {
    void loadData()
  }, [loadData])

  function selectUser(user: AdminUser) {
    setSelectedUserId(user.userId)
    setSelectedRoleIds(
      roleOptions.filter((role) => user.roles.includes(role.roleCode)).map((role) => role.roleId),
    )
    setError('')
    setMessage('')
  }

  function toggleRole(roleId: number, target: 'create' | 'edit') {
    if (target === 'create') {
      setForm((current) => ({
        ...current,
        roleIds: current.roleIds.includes(roleId)
          ? current.roleIds.filter((id) => id !== roleId)
          : [...current.roleIds, roleId],
      }))
      return
    }
    setSelectedRoleIds((current) =>
      current.includes(roleId) ? current.filter((id) => id !== roleId) : [...current, roleId],
    )
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await createAdminUser(form, token)
      setForm(initialForm)
      setMessage('Đã tạo tài khoản nhân viên.')
      await loadData()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không tạo được nhân viên.')
    } finally {
      setSaving(false)
    }
  }

  async function saveRoles() {
    if (!selectedUser) return
    setSaving(true)
    setError('')
    try {
      await updateAdminUserRoles(selectedUser.userId, selectedRoleIds, token)
      setMessage('Đã cập nhật vai trò.')
      await loadData()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không cập nhật được vai trò.')
    } finally {
      setSaving(false)
    }
  }

  async function changeStatus(status: AdminUser['status']) {
    if (!selectedUser) return
    setSaving(true)
    setError('')
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
    return <div className="status-card error">Chỉ tài khoản SystemAdmin được quản lý nhân viên.</div>
  }

  return (
    <section className="admin-page">
      <span className="eyebrow">Quản trị hệ thống</span>
      <h1>Nhân viên & phân quyền</h1>
      <p className="section-copy">Tạo tài khoản, gán vai trò và kiểm soát trạng thái truy cập.</p>

      {error && <div className="status-card error">{error}</div>}
      {message && <div className="status-card">{message}</div>}

      <div className="admin-users-layout">
        <div className="admin-panel-card">
          <div className="admin-users-toolbar">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm tên, email, số điện thoại hoặc vai trò"
            />
            <strong>{filteredUsers.length} tài khoản</strong>
          </div>

          {loading ? <p>Đang tải...</p> : (
            <div className="admin-users-list">
              {filteredUsers.map((user) => (
                <button
                  className={`admin-user-row ${selectedUserId === user.userId ? 'active' : ''}`}
                  key={user.userId}
                  onClick={() => selectUser(user)}
                  type="button"
                >
                  <div>
                    <strong>{user.fullName} {user.userId === currentUserId ? '(Bạn)' : ''}</strong>
                    <small>{user.email || user.phone || 'Chưa có liên hệ'}</small>
                  </div>
                  <div className="admin-user-roles">
                    {user.roles.length ? user.roles.map((role) => <span key={role}>{role}</span>) : <span>Chưa có role</span>}
                  </div>
                  <span className={`user-status ${user.status.toLowerCase()}`}>{user.status}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="admin-users-side">
          <form className="admin-product-form" onSubmit={handleCreate}>
            <span className="eyebrow">Thêm mới</span>
            <h3>Tạo nhân viên</h3>
            <label>Họ tên<input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></label>
            <div className="form-grid">
              <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
              <label>Số điện thoại<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            </div>
            <label>Mật khẩu ban đầu<input required minLength={6} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
            <RolePicker roles={roleOptions} selected={form.roleIds} onToggle={(id) => toggleRole(id, 'create')} />
            <button disabled={saving || form.roleIds.length === 0}>Tạo tài khoản</button>
          </form>

          {selectedUser && (
            <div className="admin-product-form">
              <span className="eyebrow">Tài khoản #{selectedUser.userId}</span>
              <h3>{selectedUser.fullName}</h3>
              <RolePicker roles={roleOptions} selected={selectedRoleIds} onToggle={(id) => toggleRole(id, 'edit')} />
              <button disabled={saving || selectedRoleIds.length === 0} onClick={() => void saveRoles()} type="button">Lưu vai trò</button>
              <div className="admin-status-actions">
                <button disabled={saving} onClick={() => void changeStatus('Active')} type="button">Mở tài khoản</button>
                <button disabled={saving || selectedUser.userId === currentUserId} onClick={() => void changeStatus('Locked')} type="button">Khóa</button>
                <button disabled={saving || selectedUser.userId === currentUserId} onClick={() => void changeStatus('Disabled')} type="button">Vô hiệu hóa</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function RolePicker({ roles, selected, onToggle }: {
  roles: AdminRole[]
  selected: number[]
  onToggle: (roleId: number) => void
}) {
  return (
    <fieldset className="role-picker">
      <legend>Vai trò và quyền đi kèm</legend>
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
