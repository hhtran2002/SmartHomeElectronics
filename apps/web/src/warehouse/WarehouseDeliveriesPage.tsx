import { useState } from 'react'
import { WarehouseReadyOrders } from './WarehouseReadyOrders'
import { WarehouseReturns } from './WarehouseReturns'
import { WarehouseVehicleManager } from './WarehouseVehicleManager'

type Props = { roles: string[]; token: string }
type DeliveriesTab = 'ready' | 'returns' | 'vehicles'

export function WarehouseDeliveriesPage({ roles, token }: Props) {
  const [activeTab, setActiveTab] = useState<DeliveriesTab>('ready')
  const [refreshKey, setRefreshKey] = useState(0)

  const canManage = roles.includes('WarehouseStaff') || roles.includes('SystemAdmin')
  if (!token) return <div className="status-card error">Bạn cần đăng nhập trước khi vào khu vực bàn giao.</div>
  if (!canManage) return <div className="status-card error">Tài khoản chưa có quyền WarehouseStaff hoặc SystemAdmin.</div>
  const changed = () => setRefreshKey((current) => current + 1)

  return (
    <>
      <section className="section-heading" style={{ marginBottom: '20px' }}>
        <div>
          <span className="eyebrow">Giao nhận tại kho</span>
          <h2>Phân công và bàn giao</h2>
          <p>Kho chuẩn bị hàng, chọn người chịu trách nhiệm và chỉ xuất tồn khi shipper thực sự nhận kiện hàng.</p>
        </div>
      </section>

      {/* Tab Selector Buttons */}
      <div className="mode-tabs" style={{ marginBottom: '20px', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px', display: 'flex', gap: '8px' }}>
        <button 
          className={activeTab === 'ready' ? 'active' : ''} 
          type="button" 
          onClick={() => setActiveTab('ready')}
          style={{ fontSize: '15px', fontWeight: '800', padding: '10px 20px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          📦 Đơn hàng cần bàn giao
        </button>
        <button 
          className={activeTab === 'returns' ? 'active' : ''} 
          type="button" 
          onClick={() => setActiveTab('returns')}
          style={{ fontSize: '15px', fontWeight: '800', padding: '10px 20px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          🔄 Hàng hoàn trả
        </button>
        <button 
          className={activeTab === 'vehicles' ? 'active' : ''} 
          type="button" 
          onClick={() => setActiveTab('vehicles')}
          style={{ fontSize: '15px', fontWeight: '800', padding: '10px 20px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          🚚 Phương tiện & Shipper
        </button>
      </div>

      <div style={{ marginTop: '16px' }}>
        {activeTab === 'ready' && (
          <WarehouseReadyOrders refreshKey={refreshKey} token={token} onChanged={changed} />
        )}
        {activeTab === 'returns' && (
          <WarehouseReturns refreshKey={refreshKey} token={token} onChanged={changed} />
        )}
        {activeTab === 'vehicles' && (
          <WarehouseVehicleManager refreshKey={refreshKey} token={token} onChanged={changed} />
        )}
      </div>
    </>
  )
}
