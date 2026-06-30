import { useEffect, useState } from 'react'
import { getAdminReports } from '../api'
import type { AdminReports } from '../types'
import { formatPrice } from '../utils'

type Props = {
  roles: string[]
  token: string
}

function canViewReports(roles: string[]) {
  return roles.includes('OrderAdmin') || roles.includes('SystemAdmin')
}

function defaultRange() {
  const now = new Date()
  const toDate = now.toISOString().slice(0, 10)
  const from = new Date(now)
  from.setDate(from.getDate() - 29)
  return {
    fromDate: from.toISOString().slice(0, 10),
    toDate,
  }
}

export function AdminReportsPage({ roles, token }: Props) {
  const [error, setError] = useState('')
  const [filters, setFilters] = useState(defaultRange)
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<AdminReports | null>(null)

  async function loadReports() {
    setLoading(true)
    setError('')
    try {
      const payload = await getAdminReports(token, filters)
      setReports(payload.data)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không tải được báo cáo.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!token || !canViewReports(roles)) return
    void loadReports()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles, token])

  if (!token) return <div className="status-card error">Bạn cần đăng nhập trước khi xem báo cáo.</div>
  if (!canViewReports(roles)) return <div className="status-card error">Tài khoản hiện tại chưa có quyền xem báo cáo.</div>

  return (
    <>
      <section className="section-heading">
        <div>
          <span className="eyebrow">Báo cáo thống kê</span>
          <h2>Doanh thu, khách hàng và mặt hàng</h2>
          <p>Theo dõi kết quả bán hàng theo thời gian, sản phẩm bán chạy, khách mua nhiều và cảnh báo tồn kho thấp.</p>
        </div>
      </section>

      <section className="report-filter-card">
        <label>
          Từ ngày
          <input
            type="date"
            value={filters.fromDate}
            onChange={(event) => setFilters((current) => ({ ...current, fromDate: event.target.value }))}
          />
        </label>
        <label>
          Đến ngày
          <input
            type="date"
            value={filters.toDate}
            onChange={(event) => setFilters((current) => ({ ...current, toDate: event.target.value }))}
          />
        </label>
        <button disabled={loading} onClick={loadReports}>
          {loading ? 'Đang tải...' : 'Xem báo cáo'}
        </button>
      </section>

      {error && <div className="status-card error">{error}</div>}
      {loading && !reports && <div className="status-card">Đang tải báo cáo...</div>}

      {reports && (
        <>
          <section className="admin-metrics report-metrics">
            <div><span>Tổng đơn</span><strong>{reports.summary.totalOrders}</strong></div>
            <div><span>Doanh thu gộp</span><strong>{formatPrice(reports.summary.grossRevenue)}</strong></div>
            <div><span>Đã thanh toán</span><strong>{formatPrice(reports.summary.paidRevenue)}</strong></div>
            <div><span>Giá trị đơn TB</span><strong>{formatPrice(reports.summary.averageOrderValue)}</strong></div>
            <div><span>Đơn huỷ</span><strong>{reports.summary.cancelledOrders}</strong></div>
          </section>

          <section className="reports-grid">
            <article className="admin-panel-card">
              <div className="section-heading compact">
                <div>
                  <span className="eyebrow">Theo thời gian</span>
                  <h3>Doanh thu theo ngày</h3>
                </div>
              </div>
              <div className="report-table">
                {reports.salesByDay.length === 0 ? (
                  <p className="form-hint">Chưa có đơn trong khoảng ngày này.</p>
                ) : reports.salesByDay.map((row) => (
                  <div key={row.reportDate}>
                    <span>{row.reportDate}</span>
                    <span>{row.orderCount} đơn</span>
                    <strong>{formatPrice(row.revenue)}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="admin-panel-card">
              <div className="section-heading compact">
                <div>
                  <span className="eyebrow">Theo trạng thái</span>
                  <h3>Tình trạng đơn hàng</h3>
                </div>
              </div>
              <div className="report-table compact-table">
                {reports.orderStatuses.map((row) => (
                  <div key={row.statusCode}>
                    <span>{row.statusName}</span>
                    <strong>{row.orderCount}</strong>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="reports-grid">
            <article className="admin-panel-card">
              <div className="section-heading compact">
                <div>
                  <span className="eyebrow">Theo mặt hàng</span>
                  <h3>Sản phẩm bán chạy</h3>
                </div>
              </div>
              <div className="report-list">
                {reports.topProducts.length === 0 ? (
                  <p className="form-hint">Chưa có sản phẩm bán ra.</p>
                ) : reports.topProducts.map((item) => (
                  <div key={`${item.skuId}-${item.skuCode}`}>
                    <span>
                      <strong>{item.productName}</strong>
                      <small>SKU {item.skuCode} · SL {item.quantitySold}</small>
                    </span>
                    <strong>{formatPrice(item.revenue)}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="admin-panel-card">
              <div className="section-heading compact">
                <div>
                  <span className="eyebrow">Theo khách hàng</span>
                  <h3>Khách mua nhiều</h3>
                </div>
              </div>
              <div className="report-list">
                {reports.topCustomers.length === 0 ? (
                  <p className="form-hint">Chưa có khách hàng trong khoảng ngày này.</p>
                ) : reports.topCustomers.map((customer) => (
                  <div key={customer.customerId}>
                    <span>
                      <strong>{customer.customerName}</strong>
                      <small>{customer.phone || customer.email || 'Chưa có liên hệ'} · {customer.orderCount} đơn</small>
                    </span>
                    <strong>{formatPrice(customer.totalSpent)}</strong>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="admin-panel-card">
            <div className="section-heading compact">
              <div>
                <span className="eyebrow">Kho hàng</span>
                <h3>Sản phẩm sắp hết hàng</h3>
              </div>
              <a className="primary-link small" href="#/admin/inventory">Qua kho</a>
            </div>
            <div className="report-list">
              {reports.lowStock.length === 0 ? (
                <p className="form-hint">Không có sản phẩm tồn thấp.</p>
              ) : reports.lowStock.map((item) => (
                <div key={item.inventoryId}>
                  <span>
                    <strong>{item.productName}</strong>
                    <small>SKU {item.skuCode} · Đang giữ {item.quantityReserved}</small>
                  </span>
                  <strong>Còn {item.availableQuantity} / mức {item.reorderLevel}</strong>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  )
}
