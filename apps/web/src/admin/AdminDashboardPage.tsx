import { useEffect, useState } from 'react'
import { getAdminDashboard } from '../api'
import type { AdminDashboard } from '../types'
import { formatPrice } from '../utils'

type Props = {
  roles: string[]
  token: string
}

function canViewDashboard(roles: string[]) {
  return roles.includes('OrderAdmin') || roles.includes('WarehouseStaff') || roles.includes('SystemAdmin')
}

export function AdminDashboardPage({ roles, token }: Props) {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token || !canViewDashboard(roles)) return

    setLoading(true)
    setError('')
    void getAdminDashboard(token)
      .then((payload) => setDashboard(payload.data))
      .catch((error) => setError(error instanceof Error ? error.message : 'Không tải được dashboard.'))
      .finally(() => setLoading(false))
  }, [roles, token])

  if (!token) return <div className="status-card error">Bạn cần đăng nhập trước khi vào admin panel.</div>
  if (!canViewDashboard(roles)) return <div className="status-card error">Tài khoản hiện tại chưa có quyền vào admin panel.</div>
  if (loading) return <div className="status-card">Đang tải dashboard...</div>
  if (error) return <div className="status-card error">{error}</div>
  if (!dashboard) return <div className="status-card">Chưa có dữ liệu dashboard.</div>

  const { summary } = dashboard

  return (
    <>
      <section className="section-heading">
        <div>
          <span className="eyebrow">Tổng quan</span>
          <h2>Dashboard vận hành</h2>
          <p>Theo dõi nhanh đơn hàng, doanh thu, lãi gộp và cảnh báo tồn kho.</p>
        </div>
      </section>

      <section className="admin-metrics" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '20px' }}>
        <div style={{ borderLeft: '4px solid #0ea5e9', padding: '16px 20px' }}>
          <span>Tổng đơn hàng</span>
          <strong style={{ fontSize: '28px', color: '#0369a1', marginTop: '8px' }}>{summary.totalOrders}</strong>
        </div>
        <div style={{ borderLeft: '4px solid #f59e0b', padding: '16px 20px' }}>
          <span>Đơn cần xử lý</span>
          <strong style={{ fontSize: '28px', color: '#d97706', marginTop: '8px' }}>{summary.pendingOrders}</strong>
        </div>
        <div style={{ borderLeft: '4px solid #ef4444', padding: '16px 20px' }}>
          <span>Tồn kho thấp</span>
          <strong style={{ fontSize: '28px', color: '#dc2626', marginTop: '8px' }}>{summary.lowStockCount}</strong>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(340px, 1fr)', gap: '20px', marginTop: '24px', alignItems: 'start' }}>
        {/* Cột trái: Đơn hàng gần đây */}
        <section className="admin-panel-card" style={{ margin: 0, padding: '20px 24px' }}>
          <div className="section-heading compact" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span className="eyebrow">Mới nhất</span>
              <h3 style={{ margin: '4px 0 0', fontSize: '20px' }}>Đơn hàng gần đây</h3>
            </div>
            <a className="primary-link small" href="#/admin/orders">Xem tất cả</a>
          </div>
          <div className="admin-recent-orders" style={{ marginTop: '16px', gap: '8px' }}>
            {dashboard.recentOrders.map((order) => (
              <div key={order.orderId} style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  <strong>{order.orderCode}</strong>
                  <small style={{ marginTop: '2px' }}>{order.receiverName} · {order.orderStatusName}</small>
                </span>
                <strong style={{ fontSize: '16px' }}>{formatPrice(order.totalAmount)}</strong>
              </div>
            ))}
          </div>
        </section>

        {/* Cột phải: Báo cáo tài chính so sánh */}
        <section className="admin-panel-card" style={{ margin: 0, padding: '20px 24px' }}>
          <div className="section-heading compact">
            <div>
              <span className="eyebrow">Tài chính</span>
              <h3 style={{ margin: '4px 0 0', fontSize: '20px' }}>Hiệu quả kinh doanh</h3>
            </div>
          </div>
          <div style={{ marginTop: '16px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                  <th style={{ padding: '8px 0', fontWeight: '800' }}>Chỉ tiêu</th>
                  <th style={{ padding: '8px', textAlign: 'right', fontWeight: '800' }}>Hôm nay</th>
                  <th style={{ padding: '8px 0', textAlign: 'right', fontWeight: '800' }}>Tháng này</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 0', color: '#0f172a', fontWeight: '700' }}>Doanh thu</td>
                  <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '700', color: '#0369a1' }}>{formatPrice(summary.todayRevenue)}</td>
                  <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: '700', color: '#0369a1' }}>{formatPrice(summary.monthRevenue)}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 0', color: '#475569' }}>Giá vốn</td>
                  <td style={{ padding: '12px 8px', textAlign: 'right', color: '#64748b' }}>{formatPrice(summary.todayCostOfGoodsSold)}</td>
                  <td style={{ padding: '12px 0', textAlign: 'right', color: '#64748b' }}>{formatPrice(summary.monthCostOfGoodsSold)}</td>
                </tr>
                <tr style={{ fontWeight: '800' }}>
                  <td style={{ padding: '12px 0', color: '#1e293b' }}>Lãi gộp</td>
                  <td style={{ padding: '12px 8px', textAlign: 'right', color: '#16a34a' }}>{formatPrice(summary.todayGrossProfit)}</td>
                  <td style={{ padding: '12px 0', textAlign: 'right', color: '#16a34a' }}>{formatPrice(summary.monthGrossProfit)}</td>
                </tr>
              </tbody>
            </table>
            <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '16px', lineHeight: '1.5', margin: '16px 0 0' }}>
              * Lãi gộp = doanh thu hàng đã xuất sau giảm giá (không gồm phí vận chuyển) − giá vốn bình quân đã chốt khi xuất kho.
            </p>
          </div>
        </section>
      </div>
    </>
  )
}
