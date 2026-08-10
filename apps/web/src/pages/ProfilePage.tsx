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
import './ProfilePage.css'

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
  if (!profile) return <main className="profile-page"><div className={`status-card${error ? ' error' : ''}`}>{error || 'Đang tải hồ sơ...'}</div></main>

  const initial = profile.fullName.trim().charAt(0).toUpperCase() || 'A'

  return (
    <main className="profile-page profile-editorial">
      <header className="profile-intro">
        <div className="profile-intro-copy">
          <span className="profile-kicker">Tài khoản khách hàng</span>
          <h1>Hồ sơ của tôi</h1>
          <p>Thông tin cá nhân, địa chỉ giao hàng và lịch sử mua sắm của bạn.</p>
        </div>
        <div className="profile-identity">
          <span className="profile-identity-avatar">{initial}</span>
          <div className="profile-identity-name">
            <strong>{profile.fullName}</strong>
            <small>{profile.email || profile.phone || 'Thành viên AA Smart'}</small>
          </div>
          <div className="profile-identity-stat">
            <strong>{profile.loyaltyPoint}</strong>
            <small>Điểm tích lũy</small>
          </div>
          <div className="profile-identity-stat">
            <strong>{addresses.length}</strong>
            <small>Địa chỉ</small>
          </div>
        </div>
      </header>

      <nav className="profile-tabs" aria-label="Nội dung tài khoản">
        <button className={activeTab === 'profile' ? 'active' : ''} onClick={() => setActiveTab('profile')} type="button">Thông tin tài khoản</button>
        <button className={activeTab === 'orders' ? 'active' : ''} onClick={() => setActiveTab('orders')} type="button">Đơn hàng của tôi</button>
      </nav>

      {error && <div className="profile-notice error">{error}</div>}
      {message && <div className="profile-notice success">{message}</div>}

      {activeTab === 'orders' ? <CustomerOrdersPanel token={token} /> : (
        <div className="profile-workspace">
          <section className="profile-section profile-personal-section">
            <div className="profile-section-heading">
              <span>01</span>
              <div><h2>Thông tin cá nhân</h2><p>Thông tin dùng cho tài khoản và hóa đơn mua hàng.</p></div>
            </div>
            <form className="profile-form profile-personal-form" onSubmit={saveProfile}>
              <div className="profile-field-grid">
                <label>Tên hiển thị<input required value={profile.fullName} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} /></label>
                <label>Email<input type="email" value={profile.email ?? ''} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></label>
                <label>Số điện thoại đăng nhập<input disabled value={profile.phone ?? ''} /><small>Không thể thay đổi số dùng để đăng nhập.</small></label>
                <label>Ngày sinh<input type="date" value={profile.dateOfBirth?.slice(0, 10) ?? ''} onChange={(e) => setProfile({ ...profile, dateOfBirth: e.target.value })} /></label>
                <label>Giới tính<select value={profile.gender ?? ''} onChange={(e) => setProfile({ ...profile, gender: e.target.value })}><option value="">Không chọn</option><option value="Nam">Nam</option><option value="Nữ">Nữ</option><option value="Khác">Khác</option></select></label>
              </div>
              <div className="profile-form-actions"><button type="submit">Lưu thay đổi</button></div>
            </form>
          </section>

          <section className="profile-section profile-security-section">
            <div className="profile-section-heading">
              <span>02</span>
              <div><h2>Bảo mật</h2><p>Cập nhật mật khẩu đăng nhập định kỳ.</p></div>
            </div>
            <form className="profile-form profile-security-form" onSubmit={changePassword}>
              <label>Mật khẩu hiện tại<input required type="password" value={password.currentPassword} onChange={(e) => setPassword({ ...password, currentPassword: e.target.value })} /></label>
              <label>Mật khẩu mới<input required minLength={6} type="password" value={password.newPassword} onChange={(e) => setPassword({ ...password, newPassword: e.target.value })} /><small>Tối thiểu 6 ký tự.</small></label>
              <label>Xác nhận mật khẩu mới<input required type="password" value={password.confirmPassword} onChange={(e) => setPassword({ ...password, confirmPassword: e.target.value })} /></label>
              <div className="profile-form-actions"><button type="submit">Đổi mật khẩu</button></div>
            </form>
          </section>

          <section className="profile-section profile-address-section">
            <div className="profile-section-heading">
              <span>03</span>
              <div><h2>Địa chỉ nhận hàng</h2><p>Chọn địa chỉ đã lưu hoặc thêm nơi nhận hàng mới.</p></div>
            </div>
            <div className="profile-address-workspace">
              <div className="profile-address-book">
                <div className="profile-address-book-head"><strong>Địa chỉ đã lưu</strong><span>{addresses.length}</span></div>
                <div className="address-list">
                  {addresses.map((address) => (
                    <article key={address.addressId}>
                      <div className="address-copy">
                        <div><strong>{address.receiverName}</strong><span>{address.receiverPhone}</span>{address.isDefault && <em>Mặc định</em>}</div>
                        <p>{address.streetAddress}, {address.ward}, {address.province}</p>
                      </div>
                      <div className="address-actions"><button type="button" onClick={() => editAddress(address)}>Sửa</button><button type="button" onClick={() => void deleteCustomerAddress(address.addressId, token).then(loadData).catch((e) => setError(e.message))}>Xóa</button></div>
                    </article>
                  ))}
                  {!addresses.length && <p className="profile-empty-address">Bạn chưa lưu địa chỉ nhận hàng.</p>}
                </div>
              </div>

              <form className="profile-form profile-address-form" onSubmit={saveAddress}>
                <div className="profile-address-form-head"><strong>{editingId ? 'Chỉnh sửa địa chỉ' : 'Thêm địa chỉ mới'}</strong>{editingId && <span>Đang chỉnh sửa</span>}</div>
                <div className="profile-field-grid">
                  <label>Người nhận<input required value={addressForm.receiverName} onChange={(e) => setAddressForm({ ...addressForm, receiverName: e.target.value })} /></label>
                  <label>SĐT người nhận<input required value={addressForm.receiverPhone} onChange={(e) => setAddressForm({ ...addressForm, receiverPhone: e.target.value })} /></label>
                  <label>Tỉnh / Thành phố<select required value={addressForm.provinceCode ?? ''} onChange={(e) => chooseProvince(e.target.value)}><option value="">Chọn tỉnh/thành</option>{provinces.map((province) => <option key={province.provinceCode} value={province.provinceCode}>{province.provinceName}</option>)}</select></label>
                  <label>Xã / Phường / Đặc khu<select required value={addressForm.wardCode ?? ''} onChange={(e) => chooseWard(e.target.value)} disabled={!addressForm.provinceCode}><option value="">Chọn xã/phường</option>{wards.map((ward) => <option key={ward.wardCode} value={ward.wardCode}>{ward.wardName}</option>)}</select></label>
                  <label className="profile-field-wide">Địa chỉ cụ thể<input required value={addressForm.streetAddress} onChange={(e) => setAddressForm({ ...addressForm, streetAddress: e.target.value })} placeholder="Số nhà, tên đường, tòa nhà..." /></label>
                </div>
                <div className="profile-address-form-footer">
                  <label className="check-label"><input checked={addressForm.isDefault} onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })} type="checkbox" /> Đặt làm địa chỉ mặc định</label>
                  <div className="profile-form-actions">
                    {editingId && <button className="secondary-button" onClick={() => { setEditingId(null); setAddressForm(emptyAddress) }} type="button">Hủy</button>}
                    <button type="submit">{editingId ? 'Cập nhật địa chỉ' : 'Thêm địa chỉ'}</button>
                  </div>
                </div>
              </form>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
