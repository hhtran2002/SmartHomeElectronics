import { useCallback, useEffect, useState } from 'react'
import {
  assignWarehouseDelivery,
  getWarehouseDeliveryOptions,
  getWarehouseReadyOrders,
  handOverWarehouseDelivery,
} from '../api'
import type { DeliveryStaffOption, DeliveryVehicle, WarehouseReadyOrder } from '../types'

type Props = {
  refreshKey: number
  token: string
  onChanged: () => void
}

type AssignmentForm = {
  deliveryStaffId: number
  vehicleId: number
  estimatedDeliveryAt: string
  note: string
}

const emptyAssignment: AssignmentForm = {
  deliveryStaffId: 0,
  vehicleId: 0,
  estimatedDeliveryAt: '',
  note: '',
}

export function WarehouseReadyOrders({ refreshKey, token, onChanged }: Props) {
  const [orders, setOrders] = useState<WarehouseReadyOrder[]>([])
  const [staff, setStaff] = useState<DeliveryStaffOption[]>([])
  const [vehicles, setVehicles] = useState<DeliveryVehicle[]>([])
  const [forms, setForms] = useState<Record<number, AssignmentForm>>({})
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [orderPayload, optionPayload] = await Promise.all([
        getWarehouseReadyOrders(token),
        getWarehouseDeliveryOptions(token),
      ])
      setOrders(orderPayload.data)
      setStaff(optionPayload.data.deliveryStaff)
      setVehicles(optionPayload.data.vehicles)
      setForms((current) => {
        const next = { ...current }
        for (const order of orderPayload.data) {
          next[order.orderId] = next[order.orderId] ?? {
            ...emptyAssignment,
            deliveryStaffId: order.deliveryStaffId ?? 0,
            vehicleId: order.vehicleId ?? 0,
            estimatedDeliveryAt: order.estimatedDeliveryAt?.slice(0, 16) ?? '',
          }
        }
        return next
      })
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được đơn chờ bàn giao.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void loadData()
  }, [loadData, refreshKey])

  function patchForm(orderId: number, patch: Partial<AssignmentForm>) {
    setForms((current) => ({
      ...current,
      [orderId]: { ...(current[orderId] ?? emptyAssignment), ...patch },
    }))
  }

  async function assign(order: WarehouseReadyOrder) {
    const form = forms[order.orderId] ?? emptyAssignment
    setWorkingId(order.orderId)
    setError('')
    setMessage('')
    try {
      await assignWarehouseDelivery(order.orderId, form, token)
      setMessage(`Đã phân công shipper cho đơn ${order.orderCode}.`)
      await loadData()
      onChanged()
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : 'Không phân công được chuyến giao.')
    } finally {
      setWorkingId(null)
    }
  }

  async function handOver(order: WarehouseReadyOrder) {
    if (!window.confirm(`Xác nhận shipper đã nhận hàng của đơn ${order.orderCode} và hàng rời kho?`)) return
    setWorkingId(order.orderId)
    setError('')
    setMessage('')
    try {
      const result = await handOverWarehouseDelivery(order.orderId, token)
      setMessage(`Đã bàn giao ${result.data.orderCode} cho ${result.data.deliveryStaffName} bằng xe ${result.data.vehicleCode}.`)
      await loadData()
      onChanged()
    } catch (handoverError) {
      setError(handoverError instanceof Error ? handoverError.message : 'Không xác nhận được bàn giao.')
    } finally {
      setWorkingId(null)
    }
  }

  return (
    <section className="admin-panel-card warehouse-orders">
      <div className="section-heading compact">
        <div>
          <span className="eyebrow">ReadyToShip</span>
          <h3>Đơn chờ phân công và bàn giao</h3>
          <p>Phân công trước để shipper thấy nhiệm vụ; chỉ trừ tồn khi shipper có mặt và kho xác nhận bàn giao.</p>
        </div>
        <strong>{orders.length} đơn</strong>
      </div>

      {error && <div className="status-card error">{error}</div>}
      {message && <div className="status-card success">{message}</div>}
      {!loading && staff.length === 0 && (
        <div className="status-card error">Chưa có tài khoản hoạt động mang role DeliveryStaff. Hãy tạo tại trang Nhân viên.</div>
      )}
      {!loading && vehicles.filter((vehicle) => vehicle.status === 'Active').length === 0 && (
        <div className="status-card error">Chưa có phương tiện hoạt động. Hãy thêm xe ở phần bên dưới.</div>
      )}

      {loading ? (
        <div className="status-card">Đang tải đơn chờ bàn giao...</div>
      ) : orders.length === 0 ? (
        <div className="status-card">Hiện không có đơn nào chờ kho xử lý.</div>
      ) : (
        <div className="warehouse-order-list">
          {orders.map((order) => {
            const form = forms[order.orderId] ?? emptyAssignment
            const assigned = order.shipmentStatus === 'Picking'
            return (
              <article className="warehouse-order-card" key={order.orderId}>
                <header>
                  <div>
                    <strong>{order.orderCode}</strong>
                    <small>{order.receiverName} · {order.receiverPhone}</small>
                    <small>{order.shippingAddress}</small>
                  </div>
                  <span className={`delivery-status ${assigned ? 'picking' : 'pending'}`}>
                    {assigned ? 'Đã phân công' : 'Chưa phân công'}
                  </span>
                </header>

                <div className="warehouse-pick-list">
                  {order.items.map((item) => (
                    <div key={`${item.orderDetailId}-${item.warehouseId}`}>
                      <span>
                        <strong>{item.productName}</strong>
                        <small>SKU {item.skuCode}</small>
                      </span>
                      <span><strong>{item.quantityWaiting}</strong><small>Cần lấy</small></span>
                      <span><strong>{item.warehouseName}</strong><small>Kho lấy hàng</small></span>
                    </div>
                  ))}
                </div>

                <div className="delivery-assignment-grid">
                  <label>
                    Shipper
                    <select value={form.deliveryStaffId} onChange={(event) => patchForm(order.orderId, { deliveryStaffId: Number(event.target.value) })}>
                      <option value={0}>Chọn nhân viên</option>
                      {staff.map((item) => <option value={item.userId} key={item.userId}>{item.fullName} · {item.phone || 'chưa có SĐT'}</option>)}
                    </select>
                  </label>
                  <label>
                    Phương tiện
                    <select value={form.vehicleId} onChange={(event) => patchForm(order.orderId, { vehicleId: Number(event.target.value) })}>
                      <option value={0}>Chọn xe</option>
                      {vehicles.filter((vehicle) => vehicle.status === 'Active').map((vehicle) => (
                        <option value={vehicle.vehicleId} key={vehicle.vehicleId}>
                          {vehicle.vehicleCode}{vehicle.licensePlate ? ` · ${vehicle.licensePlate}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Dự kiến giao
                    <input type="datetime-local" value={form.estimatedDeliveryAt} onChange={(event) => patchForm(order.orderId, { estimatedDeliveryAt: event.target.value })} />
                  </label>
                  <label>
                    Ghi chú
                    <input value={form.note} onChange={(event) => patchForm(order.orderId, { note: event.target.value })} />
                  </label>
                </div>

                {assigned && (
                  <p className="assignment-summary">
                    Đang giao cho <strong>{order.deliveryStaffName}</strong> · xe <strong>{order.vehicleCode}</strong>
                    {order.licensePlate ? ` (${order.licensePlate})` : ''}
                  </p>
                )}
                <div className="delivery-actions">
                  <button disabled={workingId === order.orderId || !form.deliveryStaffId || !form.vehicleId} onClick={() => void assign(order)} type="button">
                    {workingId === order.orderId ? 'Đang xử lý...' : assigned ? 'Cập nhật phân công' : 'Phân công'}
                  </button>
                  {assigned && (
                    <button className="success-action" disabled={workingId === order.orderId} onClick={() => void handOver(order)} type="button">
                      Bàn giao & xuất kho
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
