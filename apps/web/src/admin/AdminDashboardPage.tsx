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

// SVG Line + Bar chart component (no external deps)
function RevenueChart({ data }: { data: AdminDashboard['salesByDay'] }) {
  if (!data.length) return null

  const W = 520
  const H = 160
  const PAD = { top: 16, right: 16, bottom: 32, left: 60 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  const maxRev = Math.max(...data.map((d) => Number(d.revenue)), 1)
  const maxY = Math.max(maxRev, 1)

  const xStep = chartW / (data.length - 1 || 1)

  const revPoints = data.map((d, i) => ({
    x: PAD.left + i * xStep,
    y: PAD.top + chartH - (Number(d.revenue) / maxY) * chartH,
  }))

  const profitPoints = data.map((d, i) => ({
    x: PAD.left + i * xStep,
    y: PAD.top + chartH - (Number(d.grossProfit) / maxY) * chartH,
  }))

  function toPath(points: { x: number; y: number }[]) {
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  }

  function toArea(points: { x: number; y: number }[]) {
    const bottom = PAD.top + chartH
    const first = points[0]
    const last = points[points.length - 1]
    return `${toPath(points)} L ${last.x.toFixed(1)} ${bottom} L ${first.x.toFixed(1)} ${bottom} Z`
  }

  // Y-axis labels
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: PAD.top + chartH - t * chartH,
    label: formatPrice(maxY * t),
  }))

  function fmtDate(dateStr: string) {
    const d = new Date(dateStr)
    return `${d.getDate()}/${d.getMonth() + 1}`
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      <defs>
        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.01" />
        </linearGradient>
        <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yTicks.map((tick) => (
        <g key={tick.y}>
          <line x1={PAD.left} y1={tick.y} x2={W - PAD.right} y2={tick.y} stroke="#f1f5f9" strokeWidth="1" />
          <text x={PAD.left - 6} y={tick.y + 4} fontSize="9" fill="#94a3b8" textAnchor="end">{tick.label}</text>
        </g>
      ))}

      {/* Revenue area fill */}
      <path d={toArea(revPoints)} fill="url(#revGrad)" />
      {/* Profit area fill */}
      <path d={toArea(profitPoints)} fill="url(#profitGrad)" />

      {/* Revenue line */}
      <path d={toPath(revPoints)} fill="none" stroke="#0ea5e9" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {/* Profit line */}
      <path d={toPath(profitPoints)} fill="none" stroke="#10b981" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="5 3" />

      {/* X-axis labels + data points */}
      {data.map((d, i) => (
        <g key={i}>
          <text x={revPoints[i].x} y={H - 6} fontSize="9" fill="#94a3b8" textAnchor="middle">{fmtDate(d.reportDate)}</text>
          <circle cx={revPoints[i].x} cy={revPoints[i].y} r="3.5" fill="#0ea5e9" stroke="#fff" strokeWidth="1.5" />
        </g>
      ))}
    </svg>
  )
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

  const { summary, salesByDay, topProducts } = dashboard

  const maxTopRev = Math.max(...(topProducts ?? []).map((p) => Number(p.revenue)), 1)

  return (
    <>
      <section className="section-heading">
        <div>
          <span className="eyebrow">Tổng quan</span>
          <h2>Dashboard vận hành</h2>
          <p>Theo dõi nhanh đơn hàng, doanh thu, lãi gộp và cảnh báo tồn kho.</p>
        </div>
      </section>

      {/* KPI Cards */}
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

      {/* Row 1: Chart + Financial */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(300px, 1fr)', gap: '20px', marginTop: '24px', alignItems: 'start' }}>

        {/* Revenue Chart */}
        <section className="admin-panel-card" style={{ margin: 0, padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <span className="eyebrow">7 ngày gần nhất</span>
              <h3 style={{ margin: '4px 0 0', fontSize: '18px' }}>Doanh thu & Lãi gộp</h3>
            </div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '12px', fontWeight: '700' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#0ea5e9' }}>
                <span style={{ display: 'inline-block', width: '24px', height: '2.5px', background: '#0ea5e9', borderRadius: '2px' }} />
                Doanh thu
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#10b981' }}>
                <span style={{ display: 'inline-block', width: '20px', borderTop: '2px dashed #10b981' }} />
                Lãi gộp
              </span>
            </div>
          </div>
          <RevenueChart data={salesByDay ?? []} />
        </section>

        {/* Financial Table */}
        <section className="admin-panel-card" style={{ margin: 0, padding: '20px 24px' }}>
          <div className="section-heading compact">
            <div>
              <span className="eyebrow">Tài chính</span>
              <h3 style={{ margin: '4px 0 0', fontSize: '18px' }}>Hiệu quả kinh doanh</h3>
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

      {/* Row 2: Top Products + Recent Orders */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)', gap: '20px', marginTop: '20px', alignItems: 'start' }}>

        {/* Top Products this month */}
        <section className="admin-panel-card" style={{ margin: 0, padding: '20px 24px' }}>
          <div style={{ marginBottom: '16px' }}>
            <span className="eyebrow">Tháng này</span>
            <h3 style={{ margin: '4px 0 0', fontSize: '18px' }}>Top sản phẩm bán chạy</h3>
          </div>
          {(topProducts ?? []).length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '13px' }}>Chưa có dữ liệu tháng này.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {(topProducts ?? []).map((p, i) => {
                const pct = Math.round((Number(p.revenue) / maxTopRev) * 100)
                return (
                  <div key={p.productName}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ color: '#94a3b8', marginRight: '6px' }}>#{i + 1}</span>
                        {p.productName}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: '800', color: '#0369a1' }}>{formatPrice(Number(p.revenue))}</span>
                    </div>
                    <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${pct}%`,
                        background: i === 0
                          ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                          : i === 1
                          ? 'linear-gradient(90deg, #94a3b8, #cbd5e1)'
                          : 'linear-gradient(90deg, #0ea5e9, #38bdf8)',
                        borderRadius: '99px', transition: 'width 0.8s ease',
                      }} />
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>
                      {p.quantitySold} sản phẩm đã bán
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Recent Orders */}
        <section className="admin-panel-card" style={{ margin: 0, padding: '20px 24px' }}>
          <div className="section-heading compact" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <span className="eyebrow">Mới nhất</span>
              <h3 style={{ margin: '4px 0 0', fontSize: '18px' }}>Đơn hàng gần đây</h3>
            </div>
            <a className="primary-link small" href="#/admin/orders">Xem tất cả</a>
          </div>
          <div className="admin-recent-orders" style={{ gap: '8px' }}>
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
      </div>
    </>
  )
}
