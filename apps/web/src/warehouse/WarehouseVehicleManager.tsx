import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createDeliveryVehicle, getWarehouseDeliveryOptions, updateDeliveryVehicleStatus } from '../api'
import type { DeliveryVehicle } from '../types'

type Props = { refreshKey: number; token: string; onChanged: () => void }

export function WarehouseVehicleManager({ refreshKey, token, onChanged }: Props) {
  const [vehicles, setVehicles] = useState<DeliveryVehicle[]>([])
  const [form, setForm] = useState({ vehicleCode: '', licensePlate: '', vehicleType: 'Xe máy', note: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadVehicles = useCallback(async () => {
    try {
      const payload = await getWarehouseDeliveryOptions(token)
      setVehicles(payload.data.vehicles)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được danh sách phương tiện.')
    }
  }, [token])

  useEffect(() => { void loadVehicles() }, [loadVehicles, refreshKey])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await createDeliveryVehicle(form, token)
      setForm({ vehicleCode: '', licensePlate: '', vehicleType: 'Xe máy', note: '' })
      setMessage('Đã thêm phương tiện giao hàng.')
      await loadVehicles()
      onChanged()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không thêm được phương tiện.')
    } finally {
      setSaving(false)
    }
  }

  async function changeStatus(vehicle: DeliveryVehicle) {
    const nextStatus = vehicle.status === 'Active' ? 'Maintenance' : 'Active'
    setError('')
    try {
      await updateDeliveryVehicleStatus(vehicle.vehicleId, nextStatus, token)
      await loadVehicles()
      onChanged()
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Không đổi được trạng thái xe.')
    }
  }

  return (
    <section className="delivery-management-grid">
      <article className="admin-panel-card">
        <div className="section-heading compact"><div><span className="eyebrow">Phương tiện</span><h3>Danh sách xe giao hàng</h3></div></div>
        {error && <div className="status-card error">{error}</div>}
        {message && <div className="status-card success">{message}</div>}
        <div className="vehicle-list">
          {vehicles.length === 0 ? <p className="form-hint">Chưa có phương tiện.</p> : vehicles.map((vehicle) => (
            <div key={vehicle.vehicleId}>
              <span><strong>{vehicle.vehicleCode}</strong><small>{vehicle.vehicleType} · {vehicle.licensePlate || 'không có biển số'}</small></span>
              <button className={vehicle.status === 'Active' ? '' : 'muted-action'} onClick={() => void changeStatus(vehicle)} type="button">
                {vehicle.status === 'Active' ? 'Đang hoạt động' : 'Bảo trì / bật lại'}
              </button>
            </div>
          ))}
        </div>
      </article>

      <form className="admin-product-form admin-panel-card vehicle-form" onSubmit={submit}>
        <span className="eyebrow">Thêm xe</span>
        <h3>Đăng ký phương tiện</h3>
        <label>Mã xe<input required value={form.vehicleCode} onChange={(event) => setForm({ ...form, vehicleCode: event.target.value })} placeholder="VD: XE-01" /></label>
        <label>Biển số<input value={form.licensePlate} onChange={(event) => setForm({ ...form, licensePlate: event.target.value })} placeholder="59-A1 123.45" /></label>
        <label>Loại xe<input required value={form.vehicleType} onChange={(event) => setForm({ ...form, vehicleType: event.target.value })} /></label>
        <label>Ghi chú<textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></label>
        <button disabled={saving}>{saving ? 'Đang thêm...' : 'Thêm phương tiện'}</button>
      </form>
    </section>
  )
}
