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

      <section className="admin-metrics">
        <div><span>Tổng đơn</span><strong>{summary.totalOrders}</strong></div>
        <div><span>Đơn cần xử lý</span><strong>{summary.pendingOrders}</strong></div>
        <div><span>Tồn kho thấp</span><strong>{summary.lowStockCount}</strong></div>
      </section>

      <section className="admin-metrics dashboard-financial-metrics">
        <div><span>Doanh thu xuất hôm nay</span><strong>{formatPrice(summary.todayRevenue)}</strong></div>
        <div><span>Giá vốn hôm nay</span><strong>{formatPrice(summary.todayCostOfGoodsSold)}</strong></div>
        <div><span>Lãi gộp hôm nay</span><strong>{formatPrice(summary.todayGrossProfit)}</strong></div>
        <div><span>Doanh thu xuất tháng</span><strong>{formatPrice(summary.monthRevenue)}</strong></div>
        <div><span>Giá vốn tháng</span><strong>{formatPrice(summary.monthCostOfGoodsSold)}</strong></div>
        <div><span>Lãi gộp tháng</span><strong>{formatPrice(summary.monthGrossProfit)}</strong></div>
      </section>
      <p className="financial-note">Lãi gộp = doanh thu hàng đã xuất sau giảm giá (không gồm phí vận chuyển) − giá vốn bình quân đã chốt khi xuất kho.</p>

      <section className="admin-panel-card">
        <div className="section-heading compact">
          <div>
            <span className="eyebrow">Mới nhất</span>
            <h3>Đơn hàng gần đây</h3>
          </div>
          <a className="primary-link small" href="#/admin/orders">Xem tất cả</a>
        </div>
        <div className="admin-recent-orders">
          {dashboard.recentOrders.map((order) => (
            <div key={order.orderId}>
              <span>
                <strong>{order.orderCode}</strong>
                <small>{order.receiverName} · {order.orderStatusName}</small>
              </span>
              <strong>{formatPrice(order.totalAmount)}</strong>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
