import { useEffect, useMemo, useState } from 'react'
import { getAdminReports, getCustomerSalesReport, searchReportCustomers } from '../api'
import type { AdminReports, CustomerSalesReport, ReportCustomerSummary } from '../types'
import { formatPrice } from '../utils'

type Props = { roles: string[]; token: string }
type ReportMode = 'time' | 'customer' | 'product'

function canViewReports(roles: string[]) {
  return roles.includes('OrderAdmin') || roles.includes('SystemAdmin')
}

function defaultRange() {
  const now = new Date()
  const from = new Date(now)
  from.setDate(from.getDate() - 29)
  return { fromDate: from.toISOString().slice(0, 10), toDate: now.toISOString().slice(0, 10) }
}

export function AdminReportsPage({ roles, token }: Props) {
  const [mode, setMode] = useState<ReportMode>('time')
  const [filters, setFilters] = useState(defaultRange)
  const [reports, setReports] = useState<AdminReports | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customers, setCustomers] = useState<ReportCustomerSummary[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState(0)
  const [customerReport, setCustomerReport] = useState<CustomerSalesReport | null>(null)

  const products = useMemo(() => {
    const query = productSearch.trim().toLocaleLowerCase('vi-VN')
    return (reports?.topProducts ?? []).filter((item) => !query
      || item.productName.toLocaleLowerCase('vi-VN').includes(query)
      || item.skuCode.toLocaleLowerCase('vi-VN').includes(query))
  }, [productSearch, reports])

  async function loadReports() {
    setLoading(true)
    setError('')
    try {
      const payload = await getAdminReports(token, filters)
      setReports(payload.data)
      if (selectedCustomerId) await loadCustomerDetail(selectedCustomerId)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không tải được báo cáo.')
    } finally { setLoading(false) }
  }

  async function findCustomers() {
    setLoading(true)
    setError('')
    try {
      const payload = await searchReportCustomers(token, filters, customerSearch)
      setCustomers(payload.data)
      const nextId = payload.data.some((item) => item.customerId === selectedCustomerId)
        ? selectedCustomerId : (payload.data[0]?.customerId ?? 0)
      setSelectedCustomerId(nextId)
      if (nextId) await loadCustomerDetail(nextId)
      else setCustomerReport(null)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không tìm được khách hàng.')
    } finally { setLoading(false) }
  }

  async function loadCustomerDetail(customerId: number) {
    if (!customerId) { setCustomerReport(null); return }
    const payload = await getCustomerSalesReport(token, customerId, filters)
    setCustomerReport(payload.data)
  }

  useEffect(() => {
    if (!token || !canViewReports(roles)) return
    void loadReports()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles, token])

  useEffect(() => {
    if (mode === 'customer' && customers.length === 0 && token) void findCustomers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  if (!token) return <div className="status-card error">Bạn cần đăng nhập trước khi xem báo cáo.</div>
  if (!canViewReports(roles)) return <div className="status-card error">Tài khoản hiện tại chưa có quyền xem báo cáo.</div>

  return (
    <>
      <section className="section-heading">
        <div>
          <span className="eyebrow">Báo cáo thống kê bán hàng</span>
          <h2>Theo thời gian, khách hàng và mặt hàng</h2>
          <p>Chọn đúng loại báo cáo cần xem theo nội dung đề cương.</p>
        </div>
      </section>

      <nav className="report-mode-tabs" aria-label="Chọn loại báo cáo">
        <button className={mode === 'time' ? 'active' : ''} onClick={() => setMode('time')}>Theo thời gian</button>
        <button className={mode === 'customer' ? 'active' : ''} onClick={() => setMode('customer')}>Theo khách hàng</button>
        <button className={mode === 'product' ? 'active' : ''} onClick={() => setMode('product')}>Theo mặt hàng</button>
      </nav>

      <section className="report-filter-card">
        <label>Từ ngày<input type="date" value={filters.fromDate} onChange={(event) => setFilters((current) => ({ ...current, fromDate: event.target.value }))} /></label>
        <label>Đến ngày<input type="date" value={filters.toDate} onChange={(event) => setFilters((current) => ({ ...current, toDate: event.target.value }))} /></label>
        <button disabled={loading} onClick={() => void loadReports()}>{loading ? 'Đang tải...' : 'Xem báo cáo'}</button>
      </section>

      {error && <div className="status-card error">{error}</div>}
      {loading && !reports && <div className="status-card">Đang tải báo cáo...</div>}

      {reports && mode === 'time' && (
        <>
          <section className="admin-metrics report-metrics">
            <div><span>Tổng đơn</span><strong>{reports.summary.totalOrders}</strong></div>
            <div><span>Doanh thu</span><strong>{formatPrice(reports.summary.grossRevenue)}</strong></div>
            <div><span>Đã thanh toán</span><strong>{formatPrice(reports.summary.paidRevenue)}</strong></div>
            <div><span>Giá trị đơn TB</span><strong>{formatPrice(reports.summary.averageOrderValue)}</strong></div>
            <div><span>Đơn hủy</span><strong>{reports.summary.cancelledOrders}</strong></div>
          </section>
          <section className="admin-panel-card">
            <div className="section-heading compact"><div><span className="eyebrow">Theo thời gian</span><h3>Kết quả bán hàng từng ngày</h3></div></div>
            <div className="report-table">
              {reports.salesByDay.length === 0 ? <p className="form-hint">Chưa có đơn trong khoảng ngày này.</p> : reports.salesByDay.map((row) => (
                <div key={row.reportDate}>
                  <span>{row.reportDate}</span><span>{row.orderCount} đơn</span>
                  <span className="report-profit-value"><small>Doanh thu {formatPrice(row.revenue)}</small><strong>Đã xuất {formatPrice(row.fulfilledRevenue)}</strong></span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {reports && mode === 'product' && (
        <section className="admin-panel-card">
          <div className="section-heading compact"><div><span className="eyebrow">Theo mặt hàng</span><h3>Số lượng và doanh thu từng mặt hàng</h3></div></div>
          <label className="report-search">Tìm mặt hàng<input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Tên sản phẩm hoặc mã SKU" /></label>
          <div className="report-list">
            {products.length === 0 ? <p className="form-hint">Không có mặt hàng phù hợp.</p> : products.map((item) => (
              <div key={`${item.skuId}-${item.skuCode}`}><span><strong>{item.productName}</strong><small>SKU {item.skuCode} · Đã bán {item.quantitySold}</small></span><strong>{formatPrice(item.revenue)}</strong></div>
            ))}
          </div>
        </section>
      )}

      {mode === 'customer' && (
        <>
          <section className="customer-report-picker">
            <label>Tìm khách hàng<input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Họ tên, số điện thoại hoặc email" /></label>
            <button disabled={loading} onClick={() => void findCustomers()}>Tìm</button>
            <label>Chọn khách hàng
              <select value={selectedCustomerId} onChange={(event) => { const id = Number(event.target.value); setSelectedCustomerId(id); void loadCustomerDetail(id) }}>
                <option value={0}>Chọn khách hàng</option>
                {customers.map((customer) => <option key={customer.customerId} value={customer.customerId}>{customer.customerName} — {customer.phone || customer.email || `#${customer.customerId}`}</option>)}
              </select>
            </label>
          </section>
          {customerReport && (
            <>
              <section className="admin-metrics report-metrics customer-metrics">
                <div><span>Khách hàng</span><strong>{customerReport.customer.customerName}</strong></div>
                <div><span>Số đơn đã mua</span><strong>{customerReport.customer.orderCount}</strong></div>
                <div><span>Tổng giá trị mua</span><strong>{formatPrice(customerReport.customer.totalSpent)}</strong></div>
                <div><span>Đã thanh toán</span><strong>{formatPrice(customerReport.customer.paidAmount)}</strong></div>
                <div><span>Trung bình/đơn</span><strong>{formatPrice(customerReport.customer.averageOrderValue)}</strong></div>
              </section>
              <section className="admin-panel-card">
                <div className="section-heading compact"><div><span className="eyebrow">Chi tiết khách hàng</span><h3>{customerReport.customer.phone || 'Chưa có SĐT'} · {customerReport.customer.email || 'Chưa có email'}</h3></div></div>
                <div className="report-list">
                  {customerReport.orders.length === 0 ? <p className="form-hint">Khách hàng chưa có đơn trong khoảng thời gian này.</p> : customerReport.orders.map((order) => (
                    <div key={order.orderId}><span><strong>{order.orderCode}</strong><small>{new Date(order.createdAt).toLocaleDateString('vi-VN')} · {order.totalQuantity} sản phẩm · {order.orderStatusName} · {order.paymentStatusName}</small></span><strong>{formatPrice(order.totalAmount)}</strong></div>
                  ))}
                </div>
              </section>
            </>
          )}
        </>
      )}
    </>
  )
}
