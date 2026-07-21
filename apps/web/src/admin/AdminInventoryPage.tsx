import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  createAdminStockIn,
  createAdminStockOut,
  getAdminInventory,
  getAdminStockableSkus,
  getAdminStockMovements,
  getAdminWarehouses,
} from '../api'
import type { AdminInventoryItem, AdminStockMovement, AdminStockableSku, AdminWarehouse } from '../types'
import { WarehouseReadyOrders } from './WarehouseReadyOrders'

type Props = {
  roles: string[]
  token: string
}

type FormMode = 'in' | 'out'

const emptyForm = {
  warehouseId: 0,
  skuId: 0,
  quantity: 1,
  unitCost: 0,
  reason: 'Adjustment',
  note: '',
}

function canManageInventory(roles: string[]) {
  return roles.includes('WarehouseStaff') || roles.includes('SystemAdmin')
}

export function AdminInventoryPage({ roles, token }: Props) {
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [inventory, setInventory] = useState<AdminInventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<FormMode>('in')
  const [movements, setMovements] = useState<AdminStockMovement[]>([])
  const [saving, setSaving] = useState(false)
  const [stockableSkus, setStockableSkus] = useState<AdminStockableSku[]>([])
  const [success, setSuccess] = useState('')
  const [warehouses, setWarehouses] = useState<AdminWarehouse[]>([])

  const selectedItem = useMemo(
    () => inventory.find((item) => item.skuId === Number(form.skuId) && item.warehouseId === Number(form.warehouseId)),
    [form.skuId, form.warehouseId, inventory],
  )

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [warehousePayload, inventoryPayload, movementPayload, skuPayload] = await Promise.all([
        getAdminWarehouses(token),
        getAdminInventory(token),
        getAdminStockMovements(token),
        getAdminStockableSkus(token),
      ])
      setWarehouses(warehousePayload.data)
      setInventory(inventoryPayload.data)
      setMovements(movementPayload.data)
      setStockableSkus(skuPayload.data)

      const firstItem = inventoryPayload.data[0]
      if (firstItem && form.warehouseId === 0 && form.skuId === 0) {
        setForm((current) => ({
          ...current,
          warehouseId: firstItem.warehouseId,
          skuId: firstItem.skuId,
          unitCost: 0,
        }))
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không tải được dữ liệu kho.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!token || !canManageInventory(roles)) return
    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles, token])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      if (mode === 'in') {
        const payload = await createAdminStockIn({
          warehouseId: Number(form.warehouseId),
          skuId: Number(form.skuId),
          quantity: Number(form.quantity),
          unitCost: Number(form.unitCost),
          note: form.note,
        }, token)
        setSuccess(`Đã tạo phiếu nhập ${payload.data.receiptCode}.`)
      } else {
        const payload = await createAdminStockOut({
          warehouseId: Number(form.warehouseId),
          skuId: Number(form.skuId),
          quantity: Number(form.quantity),
          reason: form.reason,
          note: form.note,
        }, token)
        setSuccess(`Đã tạo phiếu xuất ${payload.data.receiptCode}.`)
      }

      setForm((current) => ({ ...current, quantity: 1, unitCost: 0, note: '' }))
      await loadData()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không lưu được phiếu kho.')
    } finally {
      setSaving(false)
    }
  }

  function chooseItem(item: AdminInventoryItem) {
    setForm((current) => ({
      ...current,
      warehouseId: item.warehouseId,
      skuId: item.skuId,
      unitCost: 0,
    }))
  }

  if (!token) {
    return <div className="status-card error">Bạn cần đăng nhập trước khi quản lý kho.</div>
  }

  if (!canManageInventory(roles)) {
    return <div className="status-card error">Tài khoản hiện tại chưa có quyền WarehouseStaff hoặc SystemAdmin.</div>
  }

  return (
    <>
      <section className="section-heading">
        <div>
          <span className="eyebrow">Quản lý kho</span>
          <h2>Nhập kho / xuất kho</h2>
          <p>Theo dõi tồn theo SKU, tạo phiếu nhập xuất và ghi lịch sử biến động kho.</p>
        </div>
      </section>

      {error && <div className="status-card error">{error}</div>}
      {success && <div className="status-card success">{success}</div>}

      <WarehouseReadyOrders token={token} onExported={loadData} />

      <section className="admin-inventory-layout">
        <div className="admin-inventory-list">
          {loading ? (
            <div className="status-card">Đang tải tồn kho...</div>
          ) : inventory.length === 0 ? (
            <div className="status-card">Chưa có dữ liệu tồn kho.</div>
          ) : (
            inventory.map((item) => (
              <button
                className={`inventory-row ${selectedItem?.inventoryId === item.inventoryId ? 'active' : ''}`}
                key={item.inventoryId}
                onClick={() => chooseItem(item)}
              >
                <span>
                  <strong>{item.productName}</strong>
                  <small>{item.categoryName} · {item.brandName} · SKU {item.skuCode}</small>
                </span>
                <span>
                  <strong>{item.availableQuantity}</strong>
                  <small>Khả dụng</small>
                </span>
                <span>
                  <strong>{item.quantityOnHand}</strong>
                  <small>Tồn thực tế</small>
                </span>
                <span className={item.availableQuantity <= item.reorderLevel ? 'stock-badge danger' : 'stock-badge'}>
                  {item.availableQuantity <= item.reorderLevel ? 'Tồn thấp' : 'Ổn'}
                </span>
              </button>
            ))
          )}
        </div>

        <aside className="admin-stock-card">
          <div className="mode-tabs">
            <button className={mode === 'in' ? 'active' : ''} type="button" onClick={() => setMode('in')}>
              Nhập kho
            </button>
            <button className={mode === 'out' ? 'active' : ''} type="button" onClick={() => setMode('out')}>
              Xuất kho
            </button>
          </div>

          <form className="admin-product-form stock-form" onSubmit={handleSubmit}>
            <span className="eyebrow">{mode === 'in' ? 'Phiếu nhập' : 'Phiếu xuất'}</span>
            <h3>{mode === 'in' ? 'Cộng tồn kho' : 'Trừ tồn kho'}</h3>

            <label>
              Kho
              <select
                required
                value={form.warehouseId}
                onChange={(event) => setForm({ ...form, warehouseId: Number(event.target.value) })}
              >
                <option value={0}>Chọn kho</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.warehouseId} value={warehouse.warehouseId}>
                    {warehouse.warehouseName}
                  </option>
                ))}
              </select>
            </label>

            <label>
              SKU
              <select
                required
                value={form.skuId}
                onChange={(event) => setForm({ ...form, skuId: Number(event.target.value) })}
              >
                <option value={0}>Chọn SKU</option>
                {(mode === 'in' ? stockableSkus : inventory).map((item) => (
                  <option key={item.skuId} value={item.skuId}>
                    {item.skuCode} · {item.productName}
                  </option>
                ))}
              </select>
            </label>

            {selectedItem && (
              <div className="stock-summary">
                <span>Tồn thực tế: <strong>{selectedItem.quantityOnHand}</strong></span>
                <span>Đang giữ: <strong>{selectedItem.quantityReserved}</strong></span>
                <span>Khả dụng: <strong>{selectedItem.availableQuantity}</strong></span>
                <span>Giá vốn bình quân: <strong>{selectedItem.averageUnitCost.toLocaleString('vi-VN')}đ</strong></span>
              </div>
            )}

            <label>
              Số lượng
              <input
                min={1}
                required
                type="number"
                value={form.quantity}
                onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })}
              />
            </label>

            {mode === 'in' ? (
              <label>
                Giá nhập / đơn vị
                <input
                  min={0}
                  required
                  type="number"
                  value={form.unitCost}
                  onChange={(event) => setForm({ ...form, unitCost: Number(event.target.value) })}
                />
              </label>
            ) : (
              <label>
                Lý do xuất
                <select
                  value={form.reason}
                  onChange={(event) => setForm({ ...form, reason: event.target.value })}
                >
                  <option value="Adjustment">Điều chỉnh kho</option>
                  <option value="Damage">Hàng hỏng</option>
                  <option value="Transfer">Chuyển kho</option>
                  <option value="Warranty">Xuất bảo hành</option>
                  <option value="ReturnHandling">Xử lý hàng trả</option>
                </select>
              </label>
            )}

            <label>
              Ghi chú
              <textarea
                value={form.note}
                onChange={(event) => setForm({ ...form, note: event.target.value })}
              />
            </label>

            <button disabled={saving}>{saving ? 'Đang lưu...' : mode === 'in' ? 'Tạo phiếu nhập' : 'Tạo phiếu xuất'}</button>
          </form>
        </aside>
      </section>

      <section className="admin-panel-card">
        <div className="section-heading compact">
          <div>
            <span className="eyebrow">Lịch sử kho</span>
            <h3>Biến động gần đây</h3>
          </div>
        </div>
        <div className="movement-list">
          {movements.length === 0 ? (
            <p className="form-hint">Chưa có biến động kho.</p>
          ) : (
            movements.map((movement) => (
              <div key={movement.stockMovementId}>
                <span className={movement.quantityChange > 0 ? 'stock-badge' : 'stock-badge danger'}>
                  {movement.quantityChange > 0 ? `+${movement.quantityChange}` : movement.quantityChange}
                </span>
                <strong>{movement.productName}</strong>
                <small>
                  {movement.warehouseName} · SKU {movement.skuCode} · {movement.sourceType}
                  {movement.adjustmentNote ? ` · ${movement.adjustmentNote}` : ''}
                </small>
              </div>
            ))
          )}
        </div>
      </section>

      <p className="form-hint">
        Giá nhập dùng để ghi chi tiết phiếu nhập. Giá bán trên website vẫn lấy theo SKU: {selectedItem ? selectedItem.skuCode : 'chưa chọn'}.
      </p>
    </>
  )
}
