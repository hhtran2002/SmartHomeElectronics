import { useEffect, useMemo, useState } from 'react'
import { getAdminReports, getCustomerSalesReport, getSerialProfitReport, searchReportCustomers } from '../api'
import type { AdminReports, CustomerSalesReport, ReportCustomerSummary } from '../types'
import { formatPrice } from '../utils'

type Props = { roles: string[]; token: string }
type ReportMode = 'time' | 'customer' | 'product' | 'profit'

type ProfitReportData = {
  summary: {
    totalUnitsSold: number
    totalRevenue: number
    totalCost: number
    totalGrossProfit: number
    grossMarginPercentage: number
  }
  items: Array<{
    serialId: number
    serialNumber: string
    productId: number
    productName: string
    categoryName: string
    skuId: number
    skuCode: string
    costPrice: number
    soldPrice: number
    profit: number
    marginPercentage: number
    orderId: number | null
    orderCode: string | null
    soldAt: string | null
  }>
}

function canViewReports(roles: string[]) {
  return roles.includes('OrderAdmin') || roles.includes('SystemAdmin')
}

function defaultRange() {
  const now = new Date()
  const from = new Date(now)
  from.setDate(from.getDate() - 29)
  return { fromDate: from.toISOString().slice(0, 10), toDate: now.toISOString().slice(0, 10) }
}

function formatReportDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('vi-VN', {
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
  })
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
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null)

  // Profit / Loss report state
  const [profitReport, setProfitReport] = useState<ProfitReportData | null>(null)
  const [profitSearch, setProfitSearch] = useState('')

  const products = useMemo(() => {
    const query = productSearch.trim().toLocaleLowerCase('vi-VN')
    return (reports?.topProducts ?? []).filter((item) => !query
      || item.productName.toLocaleLowerCase('vi-VN').includes(query)
      || item.skuCode.toLocaleLowerCase('vi-VN').includes(query))
  }, [productSearch, reports])

  const filteredProfitItems = useMemo(() => {
    if (!profitReport?.items) return []
    const q = profitSearch.trim().toLowerCase()
    if (!q) return profitReport.items
    return profitReport.items.filter((item) =>
      item.serialNumber.toLowerCase().includes(q)
      || item.productName.toLowerCase().includes(q)
      || item.skuCode.toLowerCase().includes(q)
      || (item.orderCode && item.orderCode.toLowerCase().includes(q))
    )
  }, [profitReport, profitSearch])

  async function loadReports() {
    setLoading(true)
    setError('')
    try {
      if (mode === 'profit') {
        const profitPayload = await getSerialProfitReport(token, {
          fromDate: filters.fromDate,
          toDate: filters.toDate,
          search: profitSearch.trim() || undefined,
        })
        setProfitReport(profitPayload.data)
      } else {
        const payload = await getAdminReports(token, filters)
        setReports(payload.data)
        if (selectedCustomerId) await loadCustomerDetail(selectedCustomerId)
      }
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
    setExpandedOrderId(null)
    const payload = await getCustomerSalesReport(token, customerId, filters)
    setCustomerReport(payload.data)
  }

  useEffect(() => {
    if (!token || !canViewReports(roles)) return
    void loadReports()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles, token, mode])

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
          <h2>Theo thời gian, khách hàng, mặt hàng và lợi nhuận</h2>
          <p>Báo cáo doanh số, giá vốn và tỷ suất lợi nhuận bám sát nội dung đề cương.</p>
        </div>
      </section>

      <nav className="report-mode-tabs" aria-label="Chọn loại báo cáo">
        <button className={mode === 'time' ? 'active' : ''} onClick={() => setMode('time')}>Theo thời gian</button>
        <button className={mode === 'customer' ? 'active' : ''} onClick={() => setMode('customer')}>Theo khách hàng</button>
        <button className={mode === 'product' ? 'active' : ''} onClick={() => setMode('product')}>Theo mặt hàng</button>
        <button className={mode === 'profit' ? 'active' : ''} onClick={() => setMode('profit')}>Lợi nhuận (Lãi / Lỗ)</button>
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
            <div><span>Giá trị đơn chưa hủy</span><strong>{formatPrice(reports.summary.grossRevenue)}</strong></div>
            <div><span>Giá trị đã thanh toán</span><strong>{formatPrice(reports.summary.paidRevenue)}</strong></div>
            <div><span>TB đơn chưa hủy</span><strong>{formatPrice(reports.summary.averageOrderValue)}</strong></div>
            <div><span>Đơn hủy</span><strong>{reports.summary.cancelledOrders}</strong></div>
          </section>
          <section className="admin-panel-card">
            <div className="section-heading compact"><div><span className="eyebrow">Theo thời gian</span><h3>Kết quả bán hàng từng ngày</h3></div></div>
            <div className="report-time-definitions">
              <p><strong>Giá trị đơn chưa hủy</strong><span>Tổng tiền của các đơn được tạo trong ngày và chưa bị hủy, bao gồm phí vận chuyển; có thể gồm đơn chưa thanh toán nên không phải doanh thu thực nhận.</span></p>
              <p><strong>Tiền hàng đã xuất kho</strong><span>Tiền hàng sau giảm giá, không gồm phí vận chuyển, của các đơn tạo trong ngày đang giao hoặc đã hoàn thành.</span></p>
            </div>
            <div className="report-time-table">
              <div className="report-time-header" aria-hidden="true">
                <span>Ngày ghi nhận</span><span>Số đơn</span><span>Giá trị đơn chưa hủy</span><span>Tiền hàng đã xuất kho</span>
              </div>
              {reports.salesByDay.length === 0 ? <p className="form-hint">Chưa có đơn trong khoảng ngày này.</p> : reports.salesByDay.map((row) => (
                <div className="report-time-row" key={row.reportDate}>
                  <strong>{formatReportDate(row.reportDate)}</strong>
                  <span><small>Số đơn</small>{row.orderCount} đơn</span>
                  <span><small>Giá trị đơn chưa hủy</small>{formatPrice(row.revenue)}</span>
                  <span><small>Tiền hàng đã xuất kho</small>{formatPrice(row.fulfilledRevenue)}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {reports && mode === 'product' && (
        <section className="admin-panel-card">
          <div className="section-heading compact"><div><span className="eyebrow">Theo mặt hàng</span><h3>Số lượng và giá trị đơn theo mặt hàng</h3><p>Giá trị tiền hàng sau khuyến mãi sản phẩm trên các đơn chưa hủy; chưa phân bổ mã giảm giá cấp đơn.</p></div></div>
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
                <div className="report-order-list">
                  {customerReport.orders.length === 0 ? <p className="form-hint">Khách hàng chưa có đơn trong khoảng thời gian này.</p> : customerReport.orders.map((order) => (
                    <article className={expandedOrderId === order.orderId ? 'expanded' : ''} key={order.orderId}>
                      <button
                        className="report-order-summary"
                        type="button"
                        aria-expanded={expandedOrderId === order.orderId}
                        onClick={() => setExpandedOrderId((current) => current === order.orderId ? null : order.orderId)}
                      >
                        <span><strong>{order.orderCode}</strong><small>{new Date(order.createdAt).toLocaleDateString('vi-VN')} · {order.totalQuantity} sản phẩm · {order.orderStatusName} · {order.paymentStatusName}</small></span>
                        <strong>{formatPrice(order.totalAmount)}</strong>
                        <span className="report-order-chevron" aria-hidden="true">⌄</span>
                      </button>
                      {expandedOrderId === order.orderId && (
                        <div className="report-order-items">
                          <div className="report-order-item report-order-item-header" aria-hidden="true">
                            <span>Mặt hàng</span><span>Đơn giá</span><span>Số lượng</span><span>Thành tiền</span>
                          </div>
                          {(order.items ?? []).map((item) => (
                            <div className="report-order-item" key={item.orderDetailId}>
                              <span><strong>{item.productName}</strong><small>SKU {item.skuCode}</small></span>
                              <span data-label="Đơn giá">{formatPrice(item.unitPrice)}</span>
                              <span data-label="Số lượng">{item.quantity}</span>
                              <strong data-label="Thành tiền">{formatPrice(item.lineTotal)}</strong>
                            </div>
                          ))}
                          {(order.items ?? []).length === 0 && <p className="form-hint">Đơn hàng chưa có chi tiết mặt hàng.</p>}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            </>
          )}
        </>
      )}

      {mode === 'profit' && (
        <>
          {profitReport && (
            <section className="admin-metrics report-metrics">
              <div><span>Tổng máy đã bán</span><strong>{profitReport.summary.totalUnitsSold} chiếc</strong></div>
              <div><span>Tổng doanh thu</span><strong>{formatPrice(profitReport.summary.totalRevenue)}</strong></div>
              <div><span>Tổng giá vốn</span><strong>{formatPrice(profitReport.summary.totalCost)}</strong></div>
              <div><span>Lợi nhuận gộp (Lãi)</span><strong style={{ color: '#16715b' }}>{formatPrice(profitReport.summary.totalGrossProfit)}</strong></div>
              <div><span>Tỷ suất lợi nhuận</span><strong>{profitReport.summary.grossMarginPercentage}%</strong></div>
            </section>
          )}

          <section className="admin-panel-card">
            <div className="section-heading compact">
              <div>
                <span className="eyebrow">Hiệu quả kinh doanh đích danh</span>
                <h3>Báo cáo Lãi / Lỗ chi tiết theo từng sản phẩm & máy bán ra</h3>
                <p>Giá vốn được ghi nhận đích danh theo mã Serial/S/N tại thời điểm xuất kho đơn hàng.</p>
              </div>
            </div>

            <label className="report-search">
              Tìm kiếm
              <input
                value={profitSearch}
                onChange={(event) => setProfitSearch(event.target.value)}
                placeholder="Mã Serial (S/N), tên sản phẩm, SKU hoặc mã đơn..."
              />
            </label>

            <div style={{ overflowX: 'auto', marginTop: '16px' }}>
              <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>Mã Serial (S/N)</th>
                    <th style={{ padding: '10px 12px' }}>Sản phẩm</th>
                    <th style={{ padding: '10px 12px' }}>SKU</th>
                    <th style={{ padding: '10px 12px' }}>Đơn hàng</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Giá vốn</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Giá bán</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Tiền lãi (Lãi/Lỗ)</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Tỷ suất</th>
                    <th style={{ padding: '10px 12px' }}>Ngày bán</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProfitItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                        {loading ? 'Đang tính toán báo cáo...' : 'Không có sản phẩm nào bán ra trong khoảng ngày này.'}
                      </td>
                    </tr>
                  ) : (
                    filteredProfitItems.map((item) => {
                      const isProfit = item.profit > 0
                      const isZero = item.profit === 0
                      return (
                        <tr key={item.serialId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 12px' }}>
                            <code style={{ fontSize: '12px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', color: '#334155' }}>
                              {item.serialNumber}
                            </code>
                          </td>
                          <td style={{ padding: '10px 12px', maxWidth: '240px' }}>
                            <strong style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#0f172a' }}>
                              {item.productName}
                            </strong>
                            <small style={{ color: '#64748b' }}>{item.categoryName}</small>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <code style={{ fontSize: '11px', color: '#64748b' }}>{item.skuCode}</code>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            {item.orderCode ? (
                              <span style={{ fontWeight: 600, color: '#0284c7', fontSize: '12px' }}>{item.orderCode}</span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b' }}>
                            {formatPrice(item.costPrice)}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>
                            {formatPrice(item.soldPrice)}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: isProfit ? '#16715b' : isZero ? '#64748b' : '#dc2626' }}>
                            {isProfit ? `+${formatPrice(item.profit)}` : formatPrice(item.profit)}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: isProfit ? '#e6f4ea' : isZero ? '#f1f5f9' : '#fce8e6',
                              color: isProfit ? '#137333' : isZero ? '#5f6368' : '#c5221f',
                            }}>
                              {item.marginPercentage}%
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', color: '#64748b', fontSize: '12px', whiteSpace: 'nowrap' }}>
                            {item.soldAt ? new Date(item.soldAt).toLocaleDateString('vi-VN') : '—'}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  )
}
