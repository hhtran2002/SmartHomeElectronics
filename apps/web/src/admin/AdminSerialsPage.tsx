import { useEffect, useState } from 'react'
import { getAdminSerials } from '../api'
import { formatPrice } from '../utils'

type SerialItem = {
  serialId: number
  serialNumber: string
  productId: number
  productName: string
  skuId: number
  skuCode: string
  warehouseId: number
  warehouseName: string
  costPrice: number
  status: string
  orderId: number | null
  orderCode: string | null
  soldPrice: number | null
  soldAt: string | null
  createdAt: string
}

type Props = { roles: string[]; token: string }

function canView(roles: string[]) {
  return roles.includes('SystemAdmin') || roles.includes('WarehouseStaff') || roles.includes('OrderAdmin')
}

function statusBadge(status: string) {
  switch (status) {
    case 'InStock':
      return { text: 'Trong kho', bg: '#e6f4ea', color: '#137333' }
    case 'Sold':
      return { text: 'Đã bán', bg: '#e0f2fe', color: '#0369a1' }
    case 'Returned':
      return { text: 'Hoàn trả', bg: '#fef3c7', color: '#b45309' }
    case 'Defective':
      return { text: 'Lỗi / Hỏng', bg: '#fee2e2', color: '#b91c1c' }
    default:
      return { text: status, bg: '#f1f5f9', color: '#475569' }
  }
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function AdminSerialsPage({ roles, token }: Props) {
  const [serials, setSerials] = useState<SerialItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const pageSize = 20
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  async function loadSerials(currentPage = page) {
    setLoading(true)
    setError('')
    try {
      const res = await getAdminSerials(token, {
        page: currentPage,
        pageSize,
        search: search.trim() || undefined,
        status: statusFilter !== 'All' ? statusFilter : undefined,
      })
      setSerials(res.data)
      setTotal(res.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được dữ liệu serial.')
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setPage(1)
    void loadSerials(1)
  }, [statusFilter])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void loadSerials(page)
  }, [page])

  if (!token) return <div className="status-card error">Bạn cần đăng nhập trước khi xem danh sách Serial.</div>
  if (!canView(roles)) return <div className="status-card error">Tài khoản hiện tại chưa có quyền quản lý Serial.</div>

  return (
    <>
      <section className="section-heading">
        <div>
          <span className="eyebrow">Quản lý kho hàng &amp; Thiết bị vật lý</span>
          <h2>Tra cứu mã Serial / S/N</h2>
          <p>
            Theo dõi từng chiếc máy cụ thể theo số sê-ri, giá vốn nhập kho và đơn hàng xuất bán.
          </p>
        </div>
      </section>

      {/* Thông báo điều hướng đến báo cáo lãi/lỗ */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 18px',
        marginBottom: '20px',
        background: '#f0fdf4',
        border: '1px solid #bbf7d0',
        borderRadius: '12px',
        fontSize: '13px',
        color: '#166534',
      }}>
        <div>
          💡 <strong>Báo cáo Lợi nhuận (Lãi / Lỗ):</strong> Đã được tích hợp trực tiếp vào phân hệ Báo cáo chung theo đúng đề cương tốt nghiệp.
        </div>
        <a
          href="#/admin/reports"
          style={{
            padding: '6px 14px',
            background: '#16715b',
            color: '#ffffff',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: '12px',
            whiteSpace: 'nowrap',
          }}
        >
          📊 Xem báo cáo tài chính →
        </a>
      </div>

      {/* Filter Card */}
      <section className="report-filter-card" style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label style={{ flex: 1, minWidth: '260px' }}>
          Tìm kiếm thiết bị
          <input
            placeholder="Tìm theo mã S/N, tên sản phẩm, SKU hoặc mã đơn..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(1)
                void loadSerials(1)
              }
            }}
          />
        </label>
        <label style={{ minWidth: '180px' }}>
          Trạng thái máy
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="All">Tất cả trạng thái</option>
            <option value="InStock">Trong kho</option>
            <option value="Sold">Đã bán</option>
            <option value="Returned">Hoàn trả</option>
            <option value="Defective">Lỗi / Hỏng</option>
          </select>
        </label>
        <button disabled={loading} onClick={() => { setPage(1); void loadSerials(1) }}>
          {loading ? 'Đang tìm...' : '🔍 Tìm kiếm'}
        </button>
      </section>

      {error && <div className="status-card error">{error}</div>}

      {/* Bảng danh sách Serial */}
      <section className="admin-panel-card" style={{ marginTop: '20px' }}>
        <div className="section-heading compact">
          <div>
            <span className="eyebrow">Danh sách thiết bị</span>
            <h3>Tổng cộng {total} máy vật lý đã ghi nhận</h3>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px' }}>Mã Serial (S/N)</th>
                <th style={{ padding: '10px 12px' }}>Tên sản phẩm</th>
                <th style={{ padding: '10px 12px' }}>SKU</th>
                <th style={{ padding: '10px 12px' }}>Kho lưu trữ</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Giá vốn</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Trạng thái</th>
                <th style={{ padding: '10px 12px' }}>Đơn hàng</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Giá bán</th>
                <th style={{ padding: '10px 12px' }}>Ngày bán</th>
                <th style={{ padding: '10px 12px' }}>Ngày nhập</th>
              </tr>
            </thead>
            <tbody>
              {loading && serials.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                    Đang tải dữ liệu thiết bị...
                  </td>
                </tr>
              ) : serials.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                    Không tìm thấy máy nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                serials.map((s) => {
                  const badge = statusBadge(s.status)
                  return (
                    <tr key={s.serialId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <code style={{ fontSize: '12px', background: '#f1f5f9', padding: '3px 8px', borderRadius: '4px', color: '#0f172a', fontWeight: 600 }}>
                          {s.serialNumber}
                        </code>
                      </td>
                      <td style={{ padding: '10px 12px', maxWidth: '220px' }}>
                        <span title={s.productName} style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600, color: '#0f172a' }}>
                          {s.productName}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <code style={{ fontSize: '11px', color: '#64748b' }}>{s.skuCode}</code>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#475569' }}>
                        {s.warehouseName}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#334155' }}>
                        {formatPrice(s.costPrice)}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: badge.bg,
                          color: badge.color,
                        }}>
                          {badge.text}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {s.orderCode ? (
                          <span style={{ fontWeight: 600, color: '#0284c7', fontSize: '12px' }}>{s.orderCode}</span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>
                        {s.soldPrice !== null ? formatPrice(s.soldPrice) : <span style={{ color: '#94a3b8' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#64748b', fontSize: '12px', whiteSpace: 'nowrap' }}>
                        {formatDate(s.soldAt)}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#94a3b8', fontSize: '12px', whiteSpace: 'nowrap' }}>
                        {formatDate(s.createdAt)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 8px 8px',
            borderTop: '1px solid #f1f5f9',
            marginTop: '12px',
          }}>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
              Hiển thị {serials.length} trên tổng {total} thiết bị
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  color: page <= 1 ? '#94a3b8' : '#0f172a',
                }}
              >
                ‹ Trước
              </button>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                Trang {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  color: page >= totalPages ? '#94a3b8' : '#0f172a',
                }}
              >
                Sau ›
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  )
}
