import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  cancelShipperCodRemittance,
  createShipperCodRemittance,
  getShipperCodAccount,
} from '../api'
import type {
  CodCollectionStatus,
  CodRemittanceMethod,
  CodRemittanceStatus,
  ShipperCodAccount,
} from '../types'
import { formatPrice } from '../utils'

type Props = { roles: string[]; token: string }

const collectionLabels: Record<CodCollectionStatus, string> = {
  Outstanding: 'Chưa nộp',
  AwaitingConfirmation: 'Chờ xác nhận',
  PartiallyRemitted: 'Đã nộp một phần',
  Settled: 'Đã tất toán',
}

const remittanceLabels: Record<CodRemittanceStatus, string> = {
  Submitted: 'Chờ xác nhận',
  Confirmed: 'Đã xác nhận',
  Rejected: 'Bị từ chối',
  Cancelled: 'Đã hủy',
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

export function ShipperCodPage({ roles, token }: Props) {
  const [account, setAccount] = useState<ShipperCodAccount | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [method, setMethod] = useState<CodRemittanceMethod>('Cash')
  const [referenceCode, setReferenceCode] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const allowed = roles.includes('DeliveryStaff') || roles.includes('SystemAdmin')

  const loadAccount = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const payload = await getShipperCodAccount(token)
      setAccount(payload.data)
      setSelected((current) => current.filter((id) => (
        payload.data.collections.some((item) => item.codCollectionId === id && item.availableToSubmit > 0)
      )))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được công nợ COD.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { if (token && allowed) void loadAccount() }, [allowed, loadAccount, token])

  const selectable = useMemo(
    () => account?.collections.filter((item) => item.availableToSubmit > 0) ?? [],
    [account],
  )
  const selectedAmount = useMemo(() => selectable
    .filter((item) => selected.includes(item.codCollectionId))
    .reduce((sum, item) => sum + item.availableToSubmit, 0), [selectable, selected])

  function toggleCollection(codCollectionId: number) {
    setSelected((current) => current.includes(codCollectionId)
      ? current.filter((id) => id !== codCollectionId)
      : [...current, codCollectionId])
  }

  async function submitRemittance() {
    if (!selected.length) return
    if (method === 'BankTransfer' && !referenceCode.trim()) {
      setError('Vui lòng nhập mã tham chiếu chuyển khoản.')
      return
    }
    if (!window.confirm(`Tạo phiếu nộp ${formatPrice(selectedAmount)} và chờ shop xác nhận?`)) return
    setWorking(true)
    setError('')
    setMessage('')
    try {
      const payload = await createShipperCodRemittance({
        collectionIds: selected,
        method,
        referenceCode,
        note,
      }, token)
      setMessage(`Đã tạo phiếu ${payload.data.remittanceCode}. Công nợ chỉ giảm sau khi shop xác nhận.`)
      setSelected([])
      setReferenceCode('')
      setNote('')
      await loadAccount()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Không tạo được phiếu nộp tiền.')
    } finally {
      setWorking(false)
    }
  }

  async function cancelRemittance(codRemittanceId: number) {
    if (!window.confirm('Hủy phiếu đang chờ xác nhận này?')) return
    setWorking(true)
    setError('')
    setMessage('')
    try {
      await cancelShipperCodRemittance(codRemittanceId, token)
      setMessage('Đã hủy phiếu. Các khoản COD có thể được chọn để nộp lại.')
      await loadAccount()
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'Không hủy được phiếu.')
    } finally {
      setWorking(false)
    }
  }

  if (!token) return <div className="status-card error">Bạn cần đăng nhập trước khi xem tiền COD.</div>
  if (!allowed) return <div className="status-card error">Tài khoản chưa có quyền DeliveryStaff.</div>
  if (loading && !account) return <div className="status-card">Đang tải công nợ COD...</div>

  return (
    <>
      <section className="shipper-heading">
        <span className="eyebrow">Trách nhiệm thu hộ</span>
        <h1>Tiền COD</h1>
        <p>Đơn COD được ghi nhận phải nộp ngay khi bạn đánh dấu giao thành công.</p>
      </section>
      {error && <div className="status-card error cod-alert">{error}</div>}
      {message && <div className="status-card success-card cod-alert">{message}</div>}

      {account && <>
        <section className="cod-metrics">
          <div><span>Đã thu hôm nay</span><strong>{formatPrice(account.summary.collectedToday)}</strong></div>
          <div><span>Tổng COD đã thu</span><strong>{formatPrice(account.summary.totalCollected)}</strong></div>
          <div><span>Chờ shop xác nhận</span><strong>{formatPrice(account.summary.pendingConfirmation)}</strong></div>
          <div><span>Đã xác nhận nộp</span><strong>{formatPrice(account.summary.totalRemitted)}</strong></div>
          <div className="cod-debt"><span>Còn phải nộp</span><strong>{formatPrice(account.summary.outstandingAmount)}</strong></div>
        </section>

        <section className="cod-workspace">
          <article className="admin-panel-card cod-collection-panel">
            <div className="section-heading compact">
              <div><span className="eyebrow">Theo đơn đã giao</span><h3>Các khoản đã thu</h3></div>
              {selectable.length > 0 && <button className="text-action" type="button" onClick={() => setSelected(
                selected.length === selectable.length ? [] : selectable.map((item) => item.codCollectionId),
              )}>{selected.length === selectable.length ? 'Bỏ chọn' : 'Chọn tất cả có thể nộp'}</button>}
            </div>
            <div className="cod-collection-list">
              {account.collections.length === 0 ? <p className="form-hint">Chưa phát sinh đơn COD giao thành công.</p> : account.collections.map((item) => (
                <label className={`cod-collection-row ${item.status.toLowerCase()}`} key={item.codCollectionId}>
                  <input
                    checked={selected.includes(item.codCollectionId)}
                    disabled={item.availableToSubmit <= 0 || working}
                    type="checkbox"
                    onChange={() => toggleCollection(item.codCollectionId)}
                  />
                  <span><strong>{item.orderCode}</strong><small>Giao {formatDate(item.collectedAt)}</small></span>
                  <span><small>Đã thu</small><strong>{formatPrice(item.collectedAmount)}</strong></span>
                  <span><small>Đã nộp</small><strong>{formatPrice(item.remittedAmount)}</strong></span>
                  <span><small>Còn phải nộp</small><strong>{formatPrice(item.outstandingAmount)}</strong></span>
                  <em className={`cod-status ${item.status.toLowerCase()}`}>{collectionLabels[item.status]}</em>
                </label>
              ))}
            </div>
          </article>

          <aside className="admin-panel-card cod-submit-card">
            <span className="eyebrow">Tạo phiếu nộp tiền</span>
            <h3>{formatPrice(selectedAmount)}</h3>
            <p>Đã chọn {selected.length} khoản. Shop phải xác nhận thì số tiền này mới được tính là đã nộp.</p>
            <label>Phương thức
              <select value={method} onChange={(event) => setMethod(event.target.value as CodRemittanceMethod)}>
                <option value="Cash">Tiền mặt</option>
                <option value="BankTransfer">Chuyển khoản</option>
              </select>
            </label>
            {method === 'BankTransfer' && <label>Mã tham chiếu
              <input value={referenceCode} onChange={(event) => setReferenceCode(event.target.value)} placeholder="Mã giao dịch ngân hàng" />
            </label>}
            <label>Ghi chú
              <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ca giao sáng, nộp tại quầy..." />
            </label>
            <button disabled={working || selected.length === 0} type="button" onClick={() => void submitRemittance()}>
              {working ? 'Đang xử lý...' : 'Gửi yêu cầu nộp tiền'}
            </button>
          </aside>
        </section>

        <section className="admin-panel-card">
          <div className="section-heading compact"><div><span className="eyebrow">Audit</span><h3>Lịch sử phiếu nộp</h3></div></div>
          <div className="cod-remittance-list">
            {account.remittances.length === 0 ? <p className="form-hint">Chưa tạo phiếu nộp tiền nào.</p> : account.remittances.map((item) => (
              <article key={item.codRemittanceId}>
                <div><strong>{item.remittanceCode}</strong><small>{formatDate(item.submittedAt)} · {item.orderCodes || 'Không có đơn'}</small></div>
                <div><small>{item.method === 'Cash' ? 'Tiền mặt' : 'Chuyển khoản'}</small><strong>{formatPrice(item.declaredAmount)}</strong></div>
                <div><span className={`cod-status ${item.status.toLowerCase()}`}>{remittanceLabels[item.status]}</span>{item.reviewNote && <small>{item.reviewNote}</small>}</div>
                {item.status === 'Submitted' && <button className="danger-outline" disabled={working} type="button" onClick={() => void cancelRemittance(item.codRemittanceId)}>Hủy phiếu</button>}
              </article>
            ))}
          </div>
        </section>
      </>}
    </>
  )
}
