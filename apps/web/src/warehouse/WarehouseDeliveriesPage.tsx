import { useState } from 'react'
import { WarehouseReadyOrders } from './WarehouseReadyOrders'
import { WarehouseReturns } from './WarehouseReturns'
import { WarehouseVehicleManager } from './WarehouseVehicleManager'

type Props = { roles: string[]; token: string }

export function WarehouseDeliveriesPage({ roles, token }: Props) {
  const [refreshKey, setRefreshKey] = useState(0)
  const canManage = roles.includes('WarehouseStaff') || roles.includes('SystemAdmin')
  if (!token) return <div className="status-card error">Bạn cần đăng nhập trước khi vào khu vực bàn giao.</div>
  if (!canManage) return <div className="status-card error">Tài khoản chưa có quyền WarehouseStaff hoặc SystemAdmin.</div>
  const changed = () => setRefreshKey((current) => current + 1)

  return (
    <>
      <section className="section-heading"><div><span className="eyebrow">Giao nhận tại kho</span><h2>Phân công và bàn giao</h2><p>Kho chuẩn bị hàng, chọn người chịu trách nhiệm và chỉ xuất tồn khi shipper thực sự nhận kiện hàng.</p></div></section>
      <WarehouseReadyOrders refreshKey={refreshKey} token={token} onChanged={changed} />
      <WarehouseReturns refreshKey={refreshKey} token={token} onChanged={changed} />
      <WarehouseVehicleManager refreshKey={refreshKey} token={token} onChanged={changed} />
    </>
  )
}
