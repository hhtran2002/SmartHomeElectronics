import { useEffect, useState } from 'react'
import { getAdminReturnRequests, updateAdminReturnWorkflow } from '../api'
import type { AdminReturnRequest } from '../types'
import { formatPrice } from '../utils'

type Props = { roles: string[]; token: string }
type WorkflowStatus = AdminReturnRequest['workflowStatus']

const workflowLabels: Record<WorkflowStatus, string> = {
  Reviewing: 'Đang xử lý',
  Returning: 'Đang hoàn hàng',
  Refunded: 'Đã hoàn tiền',
}

export function AdminReturnsPage({ roles, token }: Props) {
  const [requests, setRequests] = useState<AdminReturnRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const allowed = roles.some((role) => ['SystemAdmin', 'OrderAdmin', 'CustomerSupport'].includes(role))

  async function loadData() {
    if (!token || !allowed) return
    setLoading(true)
    setError('')
    try {
      const payload = await getAdminReturnRequests(token)
      setRequests(payload.data)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được yêu cầu hoàn hàng.')
    } finally { setLoading(false) }
  }

  useEffect(() => { void loadData() }, [token, allowed]) // eslint-disable-line react-hooks/exhaustive-deps

  async function changeWorkflow(item: AdminReturnRequest, workflowStatus: WorkflowStatus) {
    if (workflowStatus === item.workflowStatus) return
    if (workflowStatus === 'Refunded' && !window.confirm(
      `Xác nhận đã nhận lại hàng và hoàn tiền cho đơn ${item.orderCode}? Hệ thống sẽ nhập trả tồn kho và không thể chuyển lùi trạng thái.`,
    )) return
    setWorkingId(item.returnRequestId)
    setError('')
    setMessage('')
    try {
      await updateAdminReturnWorkflow(item.returnRequestId, workflowStatus, token)
      setMessage(`Đã chuyển yêu cầu ${item.orderCode} sang “${workflowLabels[workflowStatus]}”.`)
      await loadData()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Không cập nhật được trạng thái hoàn hàng.')
    } finally { setWorkingId(null) }
  }

  if (!allowed) return <div className="status-card error">Tài khoản chưa có quyền xử lý yêu cầu hoàn hàng.</div>

  return (
    <>
      <section className="section-heading">
        <div>
          <span className="eyebrow">Theo dõi phát sinh đơn hàng</span>
          <h2>Khiếu nại và hoàn hàng</h2>
          <p>Kiểm tra minh chứng và cập nhật tiến trình bằng trạng thái của yêu cầu.</p>
        </div>
      </section>

      {error && <div className="status-card error">{error}</div>}
      {message && <div className="status-card success">{message}</div>}

      {loading ? <div className="status-card">Đang tải yêu cầu hoàn hàng...</div> : requests.length === 0 ? (
        <div className="status-card">Chưa có yêu cầu hoàn hàng.</div>
      ) : (
        <section className="return-request-list">
          {requests.map((item) => (
            <article className="return-request-card" key={item.returnRequestId}>
              <header>
                <div>
                  <span className="eyebrow">Yêu cầu #{item.returnRequestId}</span>
                  <h3>{item.orderCode}</h3>
                  <p>{item.customerName} · {item.phone || item.email || 'Chưa có liên hệ'}</p>
                </div>
                <strong>{formatPrice(item.refundAmount ?? item.totalAmount)}</strong>
              </header>

              <div className="return-request-body">
                <div className="return-request-evidence">
                  <span>Lý do</span><strong>{item.reason}</strong>
                  {item.note && <p>{item.note}</p>}
                  {item.evidenceUrl && <a href={item.evidenceUrl} rel="noreferrer" target="_blank">Xem minh chứng đính kèm ↗</a>}
                </div>
                <div className="return-request-bank">
                  <span>Tài khoản nhận hoàn tiền</span>
                  <strong>{item.bankName || 'Chưa cung cấp ngân hàng'}</strong>
                  <small>{item.bankAccountNumber || '—'} · {item.bankAccountName || '—'}</small>
                </div>
              </div>

              <label className="status-select return-status-select">
                Trạng thái hoàn hàng
                <select
                  disabled={workingId === item.returnRequestId || item.workflowStatus === 'Refunded'}
                  value={item.workflowStatus}
                  onChange={(event) => void changeWorkflow(item, event.target.value as WorkflowStatus)}
                >
                  <option value="Reviewing">Đang xử lý</option>
                  <option value="Returning">Đang hoàn hàng</option>
                  <option value="Refunded">Đã hoàn tiền</option>
                </select>
              </label>

              <footer>
                <small>Tạo lúc {new Date(item.createdAt).toLocaleString('vi-VN')}</small>
                <span className={`return-workflow-badge ${item.workflowStatus.toLowerCase()}`}>
                  {workingId === item.returnRequestId ? 'Đang cập nhật...' : workflowLabels[item.workflowStatus]}
                </span>
                {item.inventoryRestockedAt && <small>Đã trả tồn kho lúc {new Date(item.inventoryRestockedAt).toLocaleString('vi-VN')}</small>}
              </footer>
            </article>
          ))}
        </section>
      )}
    </>
  )
}
