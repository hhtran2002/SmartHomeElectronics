import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  changeCustomerPassword, createCustomerAddress, deleteCustomerAddress,
  getCustomerAddresses, getCustomerProfile, getProvinces, getWards,
  updateCustomerAddress, updateCustomerProfile,
} from '../api'
import type {
  AdministrativeProvince, AdministrativeWard,
  CustomerAddress, CustomerAddressPayload, CustomerProfile,
} from '../types'
import { CustomerOrdersPanel } from './CustomerOrdersPanel'

type Props = { token: string; onNameChanged: (fullName: string, email: string | null) => void }
const emptyAddress: CustomerAddressPayload = {
  receiverName: '', receiverPhone: '', province: '', provinceCode: '',
  district: '', ward: '', wardCode: '', streetAddress: '', isDefault: false,
}

export function ProfilePage({ token, onNameChanged }: Props) {
  const [activeTab, setActiveTab] = useState<'profile' | 'orders'>('profile')
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [addresses, setAddresses] = useState<CustomerAddress[]>([])
  const [provinces, setProvinces] = useState<AdministrativeProvince[]>([])
  const [wards, setWards] = useState<AdministrativeWard[]>([])
  const [addressForm, setAddressForm] = useState(emptyAddress)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    if (!token) return
    try {
      const [profilePayload, addressPayload, provincePayload] = await Promise.all([
        getCustomerProfile(token), getCustomerAddresses(token), getProvinces(),
      ])
      setProfile(profilePayload.data)
      setAddresses(addressPayload.data)
      setProvinces(provincePayload.data)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được hồ sơ.')
    }
  }, [token])

  useEffect(() => { void loadData() }, [loadData])

  useEffect(() => {
    if (!addressForm.provinceCode) {
      setWards([])
      return
    }
    void getWards(addressForm.provinceCode).then((payload) => setWards(payload.data)).catch(() => setWards([]))
  }, [addressForm.provinceCode])

  function chooseProvince(provinceCode: string) {
    const province = provinces.find((item) => item.provinceCode === provinceCode)
    setAddressForm((current) => ({
      ...current,
      provinceCode,
      province: province?.provinceName ?? '',
      wardCode: '',
      ward: '',
      district: '',
    }))
  }

  function chooseWard(wardCode: string) {
    const ward = wards.find((item) => item.wardCode === wardCode)
    setAddressForm((current) => ({ ...current, wardCode, ward: ward?.wardName ?? '', district: '' }))
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault()
    if (!profile) return
    setError(''); setMessage('')
    try {
      const result = await updateCustomerProfile({
        fullName: profile.fullName, email: profile.email ?? '',
        dateOfBirth: profile.dateOfBirth?.slice(0, 10) ?? '', gender: profile.gender ?? '',
      }, token)
      onNameChanged(result.data.fullName, result.data.email)
      setMessage('Đã cập nhật thông tin cá nhân.')
      await loadData()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không cập nhật được hồ sơ.')
    }
  }

  async function saveAddress(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage('')
    try {
      if (editingId) await updateCustomerAddress(editingId, addressForm, token)
      else await createCustomerAddress(addressForm, token)
      setAddressForm(emptyAddress); setEditingId(null)
      setMessage(editingId ? 'Đã cập nhật địa chỉ.' : 'Đã thêm địa chỉ.')
      await loadData()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không lưu được địa chỉ.')
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage('')
    if (password.newPassword !== password.confirmPassword) {
      setError('Xác nhận mật khẩu mới không khớp.'); return
    }
    try {
      await changeCustomerPassword({ currentPassword: password.currentPassword, newPassword: password.newPassword }, token)
      setPassword({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setMessage('Đã đổi mật khẩu.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không đổi được mật khẩu.')
    }
  }

  function editAddress(address: CustomerAddress) {
    setEditingId(address.addressId)
    setAddressForm({
      receiverName: address.receiverName,
      receiverPhone: address.receiverPhone,
      province: address.province,
      provinceCode: address.provinceCode ?? '',
      district: '',
      ward: address.ward,
      wardCode: address.wardCode ?? '',
      streetAddress: address.streetAddress,
      isDefault: address.isDefault,
    })
  }

  if (!token) return <main className="profile-page"><div className="status-card error">Bạn cần đăng nhập để xem hồ sơ.</div></main>
  if (!profile) return <main className="profile-page"><div className="status-card">Đang tải hồ sơ...</div></main>

  return (
    <main className="profile-page">
      <section className="section-heading">
        <div><span className="eyebrow">Tài khoản khách hàng</span><h2>Hồ sơ của tôi</h2><p>Quản lý thông tin cá nhân, mật khẩu, địa chỉ và đơn hàng.</p></div>
      </section>
      {error && <div className="status-card error">{error}</div>}
      {message && <div className="status-card success">{message}</div>}
      <div className="profile-tabs">
        <button className={activeTab === 'profile' ? 'active' : ''} onClick={() => setActiveTab('profile')} type="button">Thông tin tài khoản</button>
        <button className={activeTab === 'orders' ? 'active' : ''} onClick={() => setActiveTab('orders')} type="button">Đơn hàng của tôi</button>
      </div>

      {activeTab === 'orders' ? <CustomerOrdersPanel token={token} /> : (
        <div className="profile-grid">
          <div className="profile-column">
            <form className="profile-card" onSubmit={saveProfile}>
              <h3>Thông tin cá nhân</h3>
              <label>Tên hiển thị<input required value={profile.fullName} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} /></label>
              <label>Số điện thoại đăng nhập<input disabled value={profile.phone ?? ''} /><small>Số điện thoại đăng nhập không thể thay đổi.</small></label>
              <label>Email<input type="email" value={profile.email ?? ''} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></label>
              <div className="form-grid">
                <label>Ngày sinh<input type="date" value={profile.dateOfBirth?.slice(0, 10) ?? ''} onChange={(e) => setProfile({ ...profile, dateOfBirth: e.target.value })} /></label>
                <label>Giới tính<select value={profile.gender ?? ''} onChange={(e) => setProfile({ ...profile, gender: e.target.value })}><option value="">Không chọn</option><option value="Nam">Nam</option><option value="Nữ">Nữ</option><option value="Khác">Khác</option></select></label>
              </div>
              <p className="profile-points">Điểm tích lũy: <strong>{profile.loyaltyPoint}</strong></p>
              <button>Lưu thông tin</button>
            </form>
            <form className="profile-card" onSubmit={changePassword}>
              <h3>Đổi mật khẩu</h3>
              <label>Mật khẩu hiện tại<input required type="password" value={password.currentPassword} onChange={(e) => setPassword({ ...password, currentPassword: e.target.value })} /></label>
              <label>Mật khẩu mới<input required minLength={6} type="password" value={password.newPassword} onChange={(e) => setPassword({ ...password, newPassword: e.target.value })} /></label>
              <label>Xác nhận mật khẩu mới<input required type="password" value={password.confirmPassword} onChange={(e) => setPassword({ ...password, confirmPassword: e.target.value })} /></label>
              <button>Đổi mật khẩu</button>
            </form>
          </div>
          <div className="profile-column">
            <section className="profile-card">
              <h3>Địa chỉ nhận hàng</h3>
              <div className="address-list">
                {addresses.map((address) => (
                  <article key={address.addressId}>
                    <strong>{address.receiverName} · {address.receiverPhone}</strong>
                    <p>{address.streetAddress}, {address.ward}, {address.province}</p>
                    {address.isDefault && <span>Mặc định</span>}
                    <div><button type="button" onClick={() => editAddress(address)}>Sửa</button><button type="button" onClick={() => void deleteCustomerAddress(address.addressId, token).then(loadData).catch((e) => setError(e.message))}>Xóa</button></div>
                  </article>
                ))}
                {!addresses.length && <p>Chưa có địa chỉ nhận hàng.</p>}
              </div>
            </section>
            <form className="profile-card" onSubmit={saveAddress}>
              <h3>{editingId ? 'Sửa địa chỉ' : 'Thêm địa chỉ'}</h3>
              <div className="form-grid">
                <label>Người nhận<input required value={addressForm.receiverName} onChange={(e) => setAddressForm({ ...addressForm, receiverName: e.target.value })} /></label>
                <label>SĐT người nhận<input required value={addressForm.receiverPhone} onChange={(e) => setAddressForm({ ...addressForm, receiverPhone: e.target.value })} /></label>
                <label>Tỉnh / Thành phố<select required value={addressForm.provinceCode ?? ''} onChange={(e) => chooseProvince(e.target.value)}><option value="">Chọn tỉnh/thành</option>{provinces.map((province) => <option key={province.provinceCode} value={province.provinceCode}>{province.provinceName}</option>)}</select></label>
                <label>Xã / Phường / Đặc khu<select required value={addressForm.wardCode ?? ''} onChange={(e) => chooseWard(e.target.value)} disabled={!addressForm.provinceCode}><option value="">Chọn xã/phường</option>{wards.map((ward) => <option key={ward.wardCode} value={ward.wardCode}>{ward.wardName}</option>)}</select></label>
              </div>
              <label>Địa chỉ cụ thể<input required value={addressForm.streetAddress} onChange={(e) => setAddressForm({ ...addressForm, streetAddress: e.target.value })} placeholder="Số nhà, tên đường, tòa nhà..." /></label>
              <label className="check-label"><input checked={addressForm.isDefault} onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })} type="checkbox" /> Đặt làm địa chỉ mặc định</label>
              <button>{editingId ? 'Cập nhật địa chỉ' : 'Thêm địa chỉ'}</button>
              {editingId && <button className="secondary-button" onClick={() => { setEditingId(null); setAddressForm(emptyAddress) }} type="button">Hủy sửa</button>}
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
