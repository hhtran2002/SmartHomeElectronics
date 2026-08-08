import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { getCustomerOrder, getCustomerOrders, submitCustomerReturnRequest, submitCustomerReview } from '../api'
import type { CustomerOrder, CustomerOrderDetail } from '../types'
import { formatPrice } from '../utils'

type ReviewingItem = {
  orderDetailId: number
  productName: string
  imageUrl: string | null
  productSlug: string
}

export function CustomerOrdersPanel({ token }: { token: string }) {
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [detail, setDetail] = useState<CustomerOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Review modal state
  const [reviewingItem, setReviewingItem] = useState<ReviewingItem | null>(null)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewHoverRating, setReviewHoverRating] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [reviewSuccess, setReviewSuccess] = useState('')

  // Return request modal state
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [returnReason, setReturnReason] = useState('Sản phẩm lỗi/hỏng')
  const [returnNote, setReturnNote] = useState('')
  const [returnImageUrl, setReturnImageUrl] = useState('')
  const [returnSubmitting, setReturnSubmitting] = useState(false)
  const [returnError, setReturnError] = useState('')

  const loadOrders = useCallback(async () => {
    setLoading(true)
    try {
      const payload = await getCustomerOrders(token)
      setOrders(payload.data)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được đơn hàng.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { void loadOrders() }, [loadOrders])

  async function viewOrder(orderId: number) {
    setError('')
    try {
      const payload = await getCustomerOrder(orderId, token)
      setDetail(payload.data)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được chi tiết đơn.')
    }
  }

  function openReviewModal(item: ReviewingItem) {
    setReviewingItem(item)
    setReviewRating(5)
    setReviewHoverRating(0)
    setReviewComment('')
    setReviewError('')
    setReviewSuccess('')
  }

  function closeReviewModal() {
    setReviewingItem(null)
    setReviewError('')
    setReviewSuccess('')
  }

  async function handleReviewSubmit(event: FormEvent) {
    event.preventDefault()
    if (!reviewingItem) return
    if (!reviewComment.trim()) {
      setReviewError('Vui lòng nhập nội dung đánh giá.')
      return
    }
    setReviewSubmitting(true)
    setReviewError('')
    try {
      await submitCustomerReview({
        orderDetailId: reviewingItem.orderDetailId,
        rating: reviewRating,
        comment: reviewComment.trim(),
      }, token)
      setReviewSuccess('Đánh giá của bạn đã được gửi và đang chờ duyệt. Cảm ơn!')
      // Reload order detail so hasReview updates
      if (detail) {
        const refreshed = await getCustomerOrder(detail.order.orderId, token)
        setDetail(refreshed.data)
      }
      setTimeout(() => closeReviewModal(), 2000)
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Không gửi được đánh giá.')
    } finally {
      setReviewSubmitting(false)
    }
  }

  async function handleReturnSubmit(event: FormEvent) {
    event.preventDefault()
    if (!detail) return
    setReturnSubmitting(true)
    setReturnError('')
    try {
      await submitCustomerReturnRequest({
        orderId: detail.order.orderId,
        reason: returnReason,
        note: returnNote.trim(),
        imageUrl: returnImageUrl.trim(),
      }, token)
      setShowReturnModal(false)
      setReturnNote('')
      setReturnImageUrl('')
      const refreshed = await getCustomerOrder(detail.order.orderId, token)
      setDetail(refreshed.data)
    } catch (err) {
      setReturnError(err instanceof Error ? err.message : 'Không gửi được yêu cầu hoàn hàng.')
    } finally {
      setReturnSubmitting(false)
    }
  }

  if (loading) return <div className="status-card">Đang tải đơn hàng...</div>

  const isCompleted = detail?.order.orderStatusCode === 'Completed'

  return (
    <section className="customer-orders-panel">
      {error && <div className="status-card error">{error}</div>}

      {/* Return Request Modal */}
      {showReturnModal && detail && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowReturnModal(false) }}
        >
          <div style={{
            background: '#fff', borderRadius: '20px',
            padding: '32px', maxWidth: '480px', width: '100%',
            boxShadow: '0 25px 60px rgba(0,0,0,0.2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#eab308', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Khiếu nại / Đổi trả
                </span>
                <h3 style={{ margin: '4px 0 0', fontSize: '18px', color: '#0f172a' }}>
                  Yêu cầu hoàn hàng #{detail.order.orderCode}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReturnModal(false)}
                style={{ background: 'none', border: 0, fontSize: '22px', cursor: 'pointer', color: '#94a3b8' }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleReturnSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '8px' }}>
                  Lý do hoàn hàng
                </label>
                <select
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '10px',
                    border: '1.5px solid #cbd5e1', fontSize: '14px', background: '#fff',
                  }}
                >
                  <option value="Sản phẩm lỗi/hỏng">Sản phẩm bị lỗi hoặc hỏng</option>
                  <option value="Giao sai sản phẩm">Giao sai sản phẩm đã đặt</option>
                  <option value="Thiếu phụ kiện/quà tặng">Thiếu phụ kiện hoặc quà tặng</option>
                  <option value="Hàng hư hỏng khi vận chuyển">Hàng bị hư hỏng khi vận chuyển</option>
                  <option value="Sản phẩm không như mô tả">Sản phẩm không đúng mô tả</option>
                  <option value="Lý do khác">Lý do khác</option>
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '8px' }}>
                  Mô tả chi tiết sự cố
                </label>
                <textarea
                  rows={3}
                  placeholder="Mô tả cụ thể tình trạng sản phẩm hoặc lý do bạn muốn hoàn hàng..."
                  value={returnNote}
                  onChange={(e) => setReturnNote(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '10px',
                    border: '1.5px solid #cbd5e1', fontSize: '14px', fontFamily: 'inherit',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '8px' }}>
                  Link ảnh minh họa (tùy chọn)
                </label>
                <input
                  type="text"
                  placeholder="https://example.com/evidence-image.jpg"
                  value={returnImageUrl}
                  onChange={(e) => setReturnImageUrl(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '10px',
                    border: '1.5px solid #cbd5e1', fontSize: '14px',
                  }}
                />
              </div>

              {returnError && (
                <div style={{ marginBottom: '16px', padding: '10px 14px', background: '#fef2f2', borderRadius: '10px', color: '#dc2626', fontSize: '13px' }}>
                  {returnError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="submit"
                  disabled={returnSubmitting}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '12px', border: 0,
                    background: 'linear-gradient(135deg, #eab308, #ca8a04)',
                    color: '#fff', fontWeight: '700', fontSize: '14px', cursor: 'pointer',
                  }}
                >
                  {returnSubmitting ? 'Đang gửi...' : '🔄 Gửi yêu cầu hoàn hàng'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  style={{
                    padding: '12px 20px', borderRadius: '12px',
                    border: '1.5px solid #e2e8f0', background: '#fff',
                    color: '#64748b', fontWeight: '600', fontSize: '14px', cursor: 'pointer',
                  }}
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewingItem && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeReviewModal() }}
        >
          <div style={{
            background: '#fff', borderRadius: '20px',
            padding: '32px', maxWidth: '500px', width: '100%',
            boxShadow: '0 25px 60px rgba(0,0,0,0.2)',
            animation: 'fadeIn 0.2s ease',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#0ea5e9', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Đánh giá sản phẩm
                </span>
                <h3 style={{ margin: '4px 0 0', fontSize: '16px', color: '#0f172a', fontWeight: '800' }}>
                  {reviewingItem.productName}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeReviewModal}
                style={{ background: 'none', border: 0, fontSize: '22px', cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {reviewingItem.imageUrl && (
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <img
                  src={reviewingItem.imageUrl}
                  alt={reviewingItem.productName}
                  style={{ height: '80px', objectFit: 'contain', borderRadius: '8px' }}
                />
              </div>
            )}

            {reviewSuccess ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#16a34a', fontWeight: '700', fontSize: '15px' }}>
                {reviewSuccess}
              </div>
            ) : (
              <form onSubmit={handleReviewSubmit}>
                {/* Rating stars */}
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewRating(star)}
                        onMouseEnter={() => setReviewHoverRating(star)}
                        onMouseLeave={() => setReviewHoverRating(0)}
                        style={{
                          background: 'none', border: 0, cursor: 'pointer', padding: '4px',
                          fontSize: '36px', lineHeight: 1,
                          color: star <= (reviewHoverRating || reviewRating) ? '#f59e0b' : '#e2e8f0',
                          transition: 'color 0.15s, transform 0.15s',
                          transform: star <= (reviewHoverRating || reviewRating) ? 'scale(1.15)' : 'scale(1)',
                        }}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#64748b', marginTop: '6px' }}>
                    {['', 'Rất tệ', 'Tệ', 'Bình thường', 'Tốt', 'Rất tuyệt!'][reviewHoverRating || reviewRating]}
                  </div>
                </div>

                {/* Comment textarea */}
                <div style={{ marginBottom: '20px' }}>
                  <textarea
                    rows={4}
                    placeholder="Chia sẻ nhận xét thực tế về sản phẩm..."
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    style={{
                      width: '100%', padding: '12px 14px', borderRadius: '12px',
                      border: '1.5px solid #e2e8f0', fontSize: '14px', resize: 'vertical',
                      fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>

                {reviewError && (
                  <div style={{ marginBottom: '16px', padding: '10px 14px', background: '#fef2f2', borderRadius: '10px', color: '#dc2626', fontSize: '13px' }}>
                    {reviewError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="submit"
                    disabled={reviewSubmitting}
                    style={{
                      flex: 1, padding: '12px', borderRadius: '12px', border: 0,
                      background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                      color: '#fff', fontWeight: '700', fontSize: '14px',
                      cursor: reviewSubmitting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {reviewSubmitting ? 'Đang gửi...' : '⭐ Gửi đánh giá'}
                  </button>
                  <button
                    type="button"
                    onClick={closeReviewModal}
                    style={{
                      padding: '12px 20px', borderRadius: '12px',
                      border: '1.5px solid #e2e8f0', background: '#fff',
                      color: '#64748b', fontWeight: '600', fontSize: '14px', cursor: 'pointer',
                    }}
                  >
                    Hủy
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {!orders.length ? (
        <div className="status-card"><h3>Bạn chưa có đơn hàng</h3><a href="#/products">Bắt đầu mua sắm</a></div>
      ) : (
        <div className="customer-orders-layout">
          <div className="customer-order-list">
            {orders.map((order) => (
              <button
                className={detail?.order.orderId === order.orderId ? 'active' : ''}
                key={order.orderId}
                onClick={() => void viewOrder(order.orderId)}
                type="button"
              >
                <span>
                  <strong>{order.orderCode}</strong>
                  <small>{new Date(order.createdAt).toLocaleString('vi-VN')}</small>
                </span>
                <span>
                  <strong>{formatPrice(order.totalAmount)}</strong>
                  <small>{order.totalQuantity} sản phẩm</small>
                </span>
                <span className={`order-status ${order.orderStatusCode.toLowerCase()}`}>{order.orderStatusName}</span>
              </button>
            ))}
          </div>

          <aside className="customer-order-detail">
            {!detail ? (
              <div className="status-card">Chọn một đơn để xem sản phẩm đã mua.</div>
            ) : (
              <>
                <header>
                  <span className="eyebrow">Chi tiết đơn</span>
                  <h3>{detail.order.orderCode}</h3>
                  <p>{detail.order.orderStatusName} · {detail.order.paymentStatusName}</p>
                </header>

                {/* Return Request Banner / Button */}
                {isCompleted && (
                  <div style={{ margin: '16px 0', padding: '16px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    {detail.returnRequest ? (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>Trạng thái khiếu nại / hoàn hàng:</span>
                          <span style={{
                            padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700',
                            background: detail.returnRequest.status === 'Approved' ? '#f0fdf4' : detail.returnRequest.status === 'Rejected' ? '#fef2f2' : '#fefce8',
                            color: detail.returnRequest.status === 'Approved' ? '#16a34a' : detail.returnRequest.status === 'Rejected' ? '#dc2626' : '#ca8a04',
                            border: `1px solid ${detail.returnRequest.status === 'Approved' ? '#bbf7d0' : detail.returnRequest.status === 'Rejected' ? '#fecaca' : '#fef08a'}`,
                          }}>
                            {detail.returnRequest.status === 'Approved' ? '✅ Đã chấp nhận' : detail.returnRequest.status === 'Rejected' ? '❌ Từ chối' : '⏳ Đang chờ duyệt'}
                          </span>
                        </div>
                        <p style={{ margin: '4px 0', fontSize: '13px', color: '#475569' }}>
                          <strong>Lý do:</strong> {detail.returnRequest.reason}
                        </p>
                        {detail.returnRequest.note && (
                          <p style={{ margin: '4px 0', fontSize: '13px', color: '#475569' }}>
                            <strong>Mô tả:</strong> {detail.returnRequest.note}
                          </p>
                        )}
                        {detail.returnRequest.adminNote && (
                          <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#0284c7', background: '#f0f9ff', padding: '8px 12px', borderRadius: '8px' }}>
                            <strong>Phản hồi từ Admin:</strong> {detail.returnRequest.adminNote}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', color: '#64748b' }}>Bạn gặp sự cố với sản phẩm?</span>
                        <button
                          type="button"
                          onClick={() => {
                            setReturnReason('Sản phẩm lỗi/hỏng')
                            setReturnNote('')
                            setReturnImageUrl('')
                            setReturnError('')
                            setShowReturnModal(true)
                          }}
                          style={{
                            padding: '8px 16px', borderRadius: '10px',
                            background: '#fefce8', border: '1px solid #fef08a',
                            color: '#ca8a04', fontWeight: '700', fontSize: '13px', cursor: 'pointer',
                          }}
                        >
                          🔄 Yêu cầu hoàn hàng / Đổi trả
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <p><strong>Nhận hàng:</strong> {detail.order.receiverName} · {detail.order.receiverPhone}</p>
                <p><strong>Địa chỉ:</strong> {detail.order.shippingAddress}</p>

                <div className="customer-order-items">
                  {detail.items.map((item) => (
                    <article key={item.orderDetailId} style={{ alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{ display: 'flex', gap: '12px', flex: 1, alignItems: 'center' }}>
                        {item.imageUrl
                          ? <img alt={item.productName} src={item.imageUrl} style={{ width: '56px', height: '56px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #f1f5f9', flexShrink: 0 }} />
                          : <div className="order-image-placeholder" style={{ width: '56px', height: '56px', flexShrink: 0 }}>AA</div>
                        }
                        <div style={{ flex: 1 }}>
                          <strong style={{ fontSize: '14px' }}>{item.productName}</strong>
                          <small style={{ display: 'block', color: '#64748b' }}>SKU {item.skuCode} · SL {item.quantity}</small>
                        </div>
                        <strong style={{ whiteSpace: 'nowrap' }}>{formatPrice(item.lineTotal)}</strong>
                      </div>

                      {/* Review button - only shown for completed orders */}
                      {isCompleted && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px', borderTop: '1px solid #f8fafc' }}>
                          {item.hasReview ? (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '5px',
                              fontSize: '12px', fontWeight: '700', color: '#16a34a',
                              background: '#f0fdf4', borderRadius: '20px', padding: '5px 12px',
                            }}>
                              ✅ Đã đánh giá
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openReviewModal({
                                orderDetailId: item.orderDetailId,
                                productName: item.productName,
                                imageUrl: item.imageUrl,
                                productSlug: item.productSlug,
                              })}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '5px',
                                fontSize: '12px', fontWeight: '700', color: '#0284c7',
                                background: 'linear-gradient(135deg, #e0f2fe, #bae6fd)',
                                border: '1px solid #7dd3fc', borderRadius: '20px',
                                padding: '5px 14px', cursor: 'pointer',
                                transition: 'transform 0.15s, box-shadow 0.15s',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-1px)'
                                e.currentTarget.style.boxShadow = '0 4px 10px rgba(14,165,233,0.2)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)'
                                e.currentTarget.style.boxShadow = 'none'
                              }}
                            >
                              ⭐ Đánh giá
                            </button>
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                </div>

                <div className="customer-order-total">
                  <span>Tạm tính</span><strong>{formatPrice(detail.order.subtotalAmount)}</strong>
                  <span>Phí giao hàng</span><strong>{formatPrice(detail.order.shippingFee)}</strong>
                  <span>Tổng thanh toán</span><strong>{formatPrice(detail.order.totalAmount)}</strong>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </section>
  )
}
