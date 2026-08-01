import { useCallback, useEffect, useState } from 'react'
import { confirmWarehouseShipmentReturn, getWarehousePendingReturns } from '../api'
import type { WarehouseReturnShipment } from '../types'

type Props = { refreshKey: number; token: string; onChanged: () => void }

export function WarehouseReturns({ refreshKey, token, onChanged }: Props) {
  const [shipments, setShipments] = useState<WarehouseReturnShipment[]>([])
  const [workingId, setWorkingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadReturns = useCallback(async () => {
    try {
      const payload = await getWarehousePendingReturns(token)
      setShipments(payload.data)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được hàng chờ trả kho.')
    }
  }, [token])

  useEffect(() => { void loadReturns() }, [loadReturns, refreshKey])

  async function confirmReturn(shipment: WarehouseReturnShipment) {
    if (!window.confirm(`Chỉ xác nhận khi kho đã nhận và kiểm đủ hàng của đơn ${shipment.orderCode}. Tiếp tục?`)) return
    setWorkingId(shipment.shipmentId)
    setError('')
    setMessage('')
    try {
      const result = await confirmWarehouseShipmentReturn(shipment.shipmentId, token)
      setMessage(`Đã nhập lại hàng bằng phiếu ${result.data.receiptCode} và hủy đơn ${result.data.orderCode}.`)
      await loadReturns()
      onChanged()
    } catch (returnError) {
      setError(returnError instanceof Error ? returnError.message : 'Không xác nhận được hàng trả.')
    } finally {
      setWorkingId(null)
    }
  }

  return (
    <section className="admin-panel-card warehouse-returns">
      <div className="section-heading compact">
        <div><span className="eyebrow">ReturnPending</span><h3>Hàng giao thất bại chờ trả kho</h3><p>Không cộng tồn cho đến khi thủ kho thực sự nhận và kiểm hàng.</p></div>
        <strong>{shipments.length} chuyến</strong>
      </div>
      {error && <div className="status-card error">{error}</div>}
      {message && <div className="status-card success">{message}</div>}
      {shipments.length === 0 ? <div className="status-card">Không có hàng chờ trả kho.</div> : (
        <div className="warehouse-order-list">
          {shipments.map((shipment) => (
            <article className="warehouse-order-card" key={shipment.shipmentId}>
              <header>
                <div><strong>{shipment.orderCode}</strong><small>{shipment.trackingCode} · {shipment.deliveryStaffName}</small><small>{shipment.returnReason}</small></div>
                <button className="success-action" disabled={workingId === shipment.shipmentId} onClick={() => void confirmReturn(shipment)} type="button">
                  {workingId === shipment.shipmentId ? 'Đang nhập lại...' : 'Xác nhận đã nhận hàng'}
                </button>
              </header>
              <div className="warehouse-pick-list">
                {shipment.items.map((item) => <div key={item.orderDetailId}><span><strong>{item.productName}</strong><small>SKU {item.skuCode}</small></span><span><strong>{item.quantity}</strong><small>Nhận lại</small></span></div>)}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
