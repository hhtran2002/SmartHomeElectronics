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
import { formatPrice } from '../utils'

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
  
  const [inventorySearch, setInventorySearch] = useState('')
  const [inventoryPage, setInventoryPage] = useState(1)
  const [movementsPage, setMovementsPage] = useState(1)
  const [skuSearchQuery, setSkuSearchQuery] = useState('')
  const [skuDropdownOpen, setSkuDropdownOpen] = useState(false)
  const [selectedMovement, setSelectedMovement] = useState<AdminStockMovement | null>(null)
  const [showHistoryModal, setShowHistoryModal] = useState(false)

  const selectedItem = useMemo(
    () => inventory.find((item) => item.skuId === Number(form.skuId) && item.warehouseId === Number(form.warehouseId)),
    [form.skuId, form.warehouseId, inventory],
  )

  const filteredInventory = useMemo(() => {
    if (!inventorySearch.trim()) return inventory
    const query = inventorySearch.toLowerCase()
    return inventory.filter(item =>
      item.productName.toLowerCase().includes(query) ||
      item.skuCode.toLowerCase().includes(query) ||
      item.brandName.toLowerCase().includes(query) ||
      item.categoryName.toLowerCase().includes(query)
    )
  }, [inventory, inventorySearch])

  const inventoryPageSize = 10
  const totalInventoryPages = Math.max(1, Math.ceil(filteredInventory.length / inventoryPageSize))
  const paginatedInventory = useMemo(() => {
    const start = (inventoryPage - 1) * inventoryPageSize
    return filteredInventory.slice(start, start + inventoryPageSize)
  }, [inventoryPage, filteredInventory])

  useEffect(() => {
    if (inventoryPage > totalInventoryPages) setInventoryPage(totalInventoryPages)
  }, [inventoryPage, totalInventoryPages])

  const movementsPageSize = 10
  const totalMovementPages = Math.max(1, Math.ceil(movements.length / movementsPageSize))
  const paginatedMovements = useMemo(() => {
    const start = (movementsPage - 1) * movementsPageSize
    return movements.slice(start, start + movementsPageSize)
  }, [movementsPage, movements])

  useEffect(() => {
    if (movementsPage > totalMovementPages) setMovementsPage(totalMovementPages)
  }, [movementsPage, totalMovementPages])

  const selectedSkuObj = useMemo(() => {
    const list = mode === 'in' ? stockableSkus : inventory
    return list.find(item => item.skuId === Number(form.skuId))
  }, [mode, stockableSkus, inventory, form.skuId])

  useEffect(() => {
    if (selectedSkuObj) {
      setSkuSearchQuery(`${selectedSkuObj.skuCode} · ${selectedSkuObj.productName}`)
    } else {
      setSkuSearchQuery('')
    }
  }, [form.skuId, selectedSkuObj])

  const filteredSkusForSelect = useMemo(() => {
    const list = mode === 'in' ? stockableSkus : inventory
    const selectedText = selectedSkuObj ? `${selectedSkuObj.skuCode} · ${selectedSkuObj.productName}` : ''
    if (!skuSearchQuery.trim() || selectedText === skuSearchQuery) return list
    const query = skuSearchQuery.toLowerCase()
    return list.filter(item => 
      item.skuCode.toLowerCase().includes(query) || 
      item.productName.toLowerCase().includes(query)
    )
  }, [mode, stockableSkus, inventory, skuSearchQuery, selectedSkuObj])

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
      <section className="section-heading" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        <div>
          <span className="eyebrow">Quản lý kho</span>
          <h2>Nhập kho / xuất kho</h2>
          <p>Theo dõi tồn theo SKU, tạo phiếu nhập xuất và ghi lịch sử biến động kho.</p>
        </div>
        <div>
          <button
            className="primary-link"
            style={{
              padding: '10px 20px',
              borderRadius: '999px',
              fontSize: '14px',
              height: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
              color: '#ffffff',
              border: 0,
              cursor: 'pointer',
              fontWeight: '800',
              boxShadow: '0 8px 20px rgba(14, 165, 233, 0.2)'
            }}
            onClick={() => setShowHistoryModal(true)}
            type="button"
          >
            📜 Nhật ký kho hàng
          </button>
        </div>
      </section>

      {error && <div className="status-card error">{error}</div>}
      {success && <div className="status-card success">{success}</div>}

      <section className="admin-inventory-layout">
        <div className="admin-inventory-list">
          <div style={{ marginBottom: '14px' }}>
            <input
              type="text"
              placeholder="Tìm sản phẩm, SKU trong kho..."
              value={inventorySearch}
              onChange={(e) => {
                setInventorySearch(e.target.value)
                setInventoryPage(1)
              }}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '12px',
                border: '1px solid var(--blue-100)',
                outline: 'none',
                fontSize: '13px'
              }}
            />
          </div>

          {loading ? (
            <div className="status-card">Đang tải tồn kho...</div>
          ) : filteredInventory.length === 0 ? (
            <div className="status-card">Không tìm thấy sản phẩm nào.</div>
          ) : (
            paginatedInventory.map((item) => (
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

          {!loading && filteredInventory.length > 0 && (
            <div className="admin-pagination" style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '12px', padding: '10px', background: '#ffffff', border: '1px solid var(--blue-100)', borderRadius: '16px' }}>
              <button disabled={inventoryPage <= 1} onClick={() => setInventoryPage((current) => current - 1)} style={{ padding: '6px 12px', borderRadius: '999px', border: '1px solid var(--blue-200)', background: '#ffffff', cursor: 'pointer' }}>
                Trước
              </button>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '800' }}>Trang {inventoryPage} / {totalInventoryPages} · {filteredInventory.length} mục</span>
              <button disabled={inventoryPage >= totalInventoryPages} onClick={() => setInventoryPage((current) => current + 1)} style={{ padding: '6px 12px', borderRadius: '999px', border: '1px solid var(--blue-200)', background: '#ffffff', cursor: 'pointer' }}>
                Sau
              </button>
            </div>
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
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  required
                  placeholder="Tìm mã SKU hoặc tên sản phẩm..."
                  value={skuSearchQuery}
                  onFocus={() => setSkuDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setSkuDropdownOpen(false), 250)}
                  onChange={(e) => {
                    setSkuSearchQuery(e.target.value)
                    setSkuDropdownOpen(true)
                  }}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '14px', border: '1px solid var(--blue-100)', outline: 'none' }}
                />
                {skuDropdownOpen && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 100,
                    maxHeight: '220px',
                    overflowY: 'auto',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
                    marginTop: '4px'
                  }}>
                    {filteredSkusForSelect.length === 0 ? (
                      <div style={{ padding: '10px 14px', color: '#64748b', fontSize: '13px' }}>Không tìm thấy SKU nào</div>
                    ) : (
                      filteredSkusForSelect.map((item) => (
                        <button
                          key={item.skuId}
                          type="button"
                          onMouseDown={() => {
                            setForm({ ...form, skuId: item.skuId })
                            setSkuDropdownOpen(false)
                          }}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '10px 14px',
                            border: 0,
                            background: form.skuId === item.skuId ? '#e0f2fe' : 'transparent',
                            cursor: 'pointer',
                            fontSize: '13px',
                            color: '#0f172a',
                            borderBottom: '1px solid #f1f5f9'
                          }}
                        >
                          <strong>{item.skuCode}</strong> · {item.productName}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
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

      {showHistoryModal && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowHistoryModal(false)}>
          <section
            aria-modal="true"
            className="admin-product-modal"
            style={{ maxWidth: '1000px', width: '95%', height: 'calc(100vh - 80px)', borderRadius: '24px' }}
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <span className="eyebrow">Lịch sử biến động</span>
                <h3>Nhật ký kho hàng</h3>
              </div>
              <button type="button" onClick={() => setShowHistoryModal(false)}>Đóng</button>
            </div>

            <div className="modal-scroll" style={{ display: 'flex', flexDirection: 'column', padding: '20px', gap: '16px', flex: 1, overflowY: 'auto' }}>
              <div style={{ overflowX: 'auto', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #cbd5e1', color: '#475569', fontWeight: '800' }}>
                      <th style={{ padding: '12px 8px' }}>Mã GD</th>
                      <th style={{ padding: '12px 8px' }}>Sản phẩm</th>
                      <th style={{ padding: '12px 8px' }}>Kho</th>
                      <th style={{ padding: '12px 8px', textAlign: 'center' }}>Số lượng</th>
                      <th style={{ padding: '12px 8px', textAlign: 'right' }}>Đơn giá</th>
                      <th style={{ padding: '12px 8px' }}>Thời gian</th>
                      <th style={{ padding: '12px 8px' }}>Người tạo</th>
                      <th style={{ padding: '12px 8px', textAlign: 'center' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>Chưa có biến động kho.</td>
                      </tr>
                    ) : (
                      paginatedMovements.map((movement) => (
                        <tr 
                          key={movement.stockMovementId} 
                          style={{ borderBottom: '1px solid #e2e8f0', cursor: 'pointer' }}
                          onClick={() => setSelectedMovement(movement)}
                          className="table-row-hover"
                        >
                          <td style={{ padding: '12px 8px', fontWeight: '700', color: '#64748b' }}>#{movement.stockMovementId}</td>
                          <td style={{ padding: '12px 8px' }}>
                            <strong style={{ display: 'block', color: '#0f172a' }}>{movement.productName}</strong>
                            <small style={{ color: '#0ea5e9', fontWeight: '800' }}>SKU: {movement.skuCode}</small>
                          </td>
                          <td style={{ padding: '12px 8px', color: '#334155' }}>{movement.warehouseName}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                            <span className={movement.quantityChange > 0 ? 'stock-badge' : 'stock-badge danger'}>
                              {movement.quantityChange > 0 ? `+${movement.quantityChange}` : movement.quantityChange}
                            </span>
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '600' }}>
                            {movement.unitCost ? formatPrice(movement.unitCost) : '—'}
                          </td>
                          <td style={{ padding: '12px 8px', color: '#475569' }}>
                            {new Date(movement.createdAt).toLocaleString('vi-VN')}
                          </td>
                          <td style={{ padding: '12px 8px', color: '#475569' }}>{movement.createdBy || 'Hệ thống'}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMovement(movement);
                              }}
                              style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #0ea5e9', color: '#0ea5e9', background: 'transparent', fontSize: '11px', cursor: 'pointer', fontWeight: '700' }}
                            >
                              Chi tiết
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {!loading && movements.length > 0 && (
                <div className="admin-pagination" style={{ display: 'flex', justifyContent: 'center', gap: '10px', alignItems: 'center', marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                  <button disabled={movementsPage <= 1} onClick={() => setMovementsPage((current) => current - 1)} style={{ padding: '6px 12px', borderRadius: '8px', cursor: 'pointer' }}>
                    Trang trước
                  </button>
                  <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '800' }}>Trang {movementsPage} / {totalMovementPages} · {movements.length} bản ghi</span>
                  <button disabled={movementsPage >= totalMovementPages} onClick={() => setMovementsPage((current) => current + 1)} style={{ padding: '6px 12px', borderRadius: '8px', cursor: 'pointer' }}>
                    Trang sau
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {selectedMovement && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setSelectedMovement(null)}>
          <section
            aria-modal="true"
            className="admin-product-modal"
            style={{ maxWidth: '560px', width: '90%', height: 'auto', borderRadius: '24px' }}
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <span className="eyebrow">Chi tiết lịch sử kho</span>
                <h3>Mã GD #{selectedMovement.stockMovementId}</h3>
              </div>
              <button type="button" onClick={() => setSelectedMovement(null)}>Đóng</button>
            </div>
            
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '14px' }}>
              <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                <span style={{ color: '#64748b', fontSize: '12px' }}>Sản phẩm / SKU</span>
                <strong style={{ display: 'block', fontSize: '15px', color: '#0f172a', marginTop: '2px' }}>{selectedMovement.productName}</strong>
                <small style={{ color: '#0ea5e9', fontWeight: '800' }}>SKU: {selectedMovement.skuCode}</small>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>Kho hàng</span>
                  <strong style={{ display: 'block', color: '#0f172a', marginTop: '2px' }}>{selectedMovement.warehouseName}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>Thời gian</span>
                  <strong style={{ display: 'block', color: '#0f172a', marginTop: '2px' }}>{new Date(selectedMovement.createdAt).toLocaleString('vi-VN')}</strong>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>Loại biến động</span>
                  <span className={selectedMovement.quantityChange > 0 ? 'stock-badge' : 'stock-badge danger'} style={{ display: 'inline-block', marginTop: '4px' }}>
                    {selectedMovement.quantityChange > 0 ? 'Nhập kho (+)' : 'Xuất kho (-)'}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>Số lượng thay đổi</span>
                  <strong style={{ display: 'block', color: '#0f172a', fontSize: '16px', marginTop: '2px' }}>{Math.abs(selectedMovement.quantityChange)}</strong>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>Đơn giá</span>
                  <strong style={{ display: 'block', color: '#0f172a', marginTop: '2px' }}>{selectedMovement.unitCost ? formatPrice(selectedMovement.unitCost) : '—'}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>Tổng trị giá</span>
                  <strong style={{ display: 'block', color: '#0ea5e9', fontSize: '15px', marginTop: '2px' }}>
                    {selectedMovement.unitCost ? formatPrice(selectedMovement.unitCost * Math.abs(selectedMovement.quantityChange)) : '—'}
                  </strong>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>Nguồn biến động</span>
                  <strong style={{ display: 'block', color: '#0f172a', marginTop: '2px' }}>{selectedMovement.sourceType}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>Người thực hiện</span>
                  <strong style={{ display: 'block', color: '#0f172a', marginTop: '2px' }}>{selectedMovement.createdBy || 'Hệ thống'}</strong>
                </div>
              </div>

              {selectedMovement.adjustmentNote && (
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>Ghi chú điều chỉnh</span>
                  <p style={{ margin: '4px 0 0', color: '#475569', background: '#f8fafc', padding: '10px', borderRadius: '8px' }}>{selectedMovement.adjustmentNote}</p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      <p className="form-hint">
        Giá nhập dùng để ghi chi tiết phiếu nhập. Giá bán trên website vẫn lấy theo SKU: {selectedItem ? selectedItem.skuCode : 'chưa chọn'}.
      </p>
    </>
  )
}
