import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  createAdminPromotion,
  getAdminPromotions,
  getAdminPromotionSkuOptions,
  updateAdminPromotion,
  updateAdminPromotionStatus,
} from '../api'
import type { AdminPromotion, AdminPromotionPayload, AdminPromotionSkuOption } from '../types'
import { formatPrice } from '../utils'

type Props = {
  roles: string[]
  token: string
}

type PromotionFormProps = {
  editingId: number | null
  form: AdminPromotionPayload
  saving: boolean
  skuOptions: AdminPromotionSkuOption[]
  onCancel: () => void
  onChange: (form: AdminPromotionPayload) => void
  onSubmit: (event: FormEvent) => void
}

const emptyForm: AdminPromotionPayload = {
  promotionName: '',
  discountType: 'FixedPrice',
  discountValue: 0,
  startAt: '',
  endAt: '',
  status: 'Active',
  skuIds: [],
}

function canManagePromotions(roles: string[]) {
  return roles.includes('SystemAdmin')
}

function toDateTimeInput(value: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function defaultDateRange() {
  const now = new Date()
  const end = new Date(now)
  end.setDate(end.getDate() + 7)
  const format = (date: Date) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    return local.toISOString().slice(0, 16)
  }
  return {
    startAt: format(now),
    endAt: format(end),
  }
}

function makeEmptyForm(): AdminPromotionPayload {
  return {
    ...emptyForm,
    ...defaultDateRange(),
  }
}

function parseSkuIds(value: string | null) {
  if (!value) return []
  return value.split(',').map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0)
}

function toForm(promotion: AdminPromotion): AdminPromotionPayload {
  return {
    promotionName: promotion.promotionName,
    discountType: promotion.discountType,
    discountValue: Number(promotion.discountValue),
    startAt: toDateTimeInput(promotion.startAt),
    endAt: toDateTimeInput(promotion.endAt),
    status: promotion.status,
    skuIds: parseSkuIds(promotion.skuIds),
  }
}

function describeDiscount(promotion: Pick<AdminPromotionPayload, 'discountType' | 'discountValue'>) {
  if (promotion.discountType === 'Percent') return `Giảm ${promotion.discountValue}%`
  if (promotion.discountType === 'FixedAmount') return `Giảm ${formatPrice(promotion.discountValue)}`
  return `Giá sale ${formatPrice(promotion.discountValue)}`
}

function PromotionForm({
  editingId,
  form,
  saving,
  skuOptions,
  onCancel,
  onChange,
  onSubmit,
}: PromotionFormProps) {
  const selectedSkus = useMemo(
    () => skuOptions.filter((sku) => form.skuIds.includes(Number(sku.skuId))),
    [form.skuIds, skuOptions],
  )

  function toggleSku(skuId: number) {
    onChange({
      ...form,
      skuIds: form.skuIds.includes(skuId)
        ? form.skuIds.filter((item) => item !== skuId)
        : [...form.skuIds, skuId],
    })
  }

  return (
    <form className="admin-product-form promotion-form in-modal" onSubmit={onSubmit}>
      <span className="eyebrow">{editingId ? 'Cập nhật' : 'Thêm mới'}</span>
      <h3>{editingId ? 'Sửa giảm giá' : 'Tạo giảm giá'}</h3>

      <label>
        Tên chương trình
        <input
          required
          value={form.promotionName}
          onChange={(event) => onChange({ ...form, promotionName: event.target.value })}
        />
      </label>

      <div className="checkout-grid">
        <label>
          Kiểu giảm
          <select
            value={form.discountType}
            onChange={(event) => onChange({
              ...form,
              discountType: event.target.value as AdminPromotionPayload['discountType'],
            })}
          >
            <option value="FixedPrice">Set giá sale</option>
            <option value="FixedAmount">Giảm tiền</option>
            <option value="Percent">Giảm phần trăm</option>
          </select>
        </label>

        <label>
          Giá trị giảm
          <input
            min={1}
            required
            type="number"
            value={form.discountValue}
            onChange={(event) => onChange({ ...form, discountValue: Number(event.target.value) })}
          />
        </label>
      </div>

      <div className="checkout-grid">
        <label>
          Bắt đầu
          <input
            required
            type="datetime-local"
            value={form.startAt}
            onChange={(event) => onChange({ ...form, startAt: event.target.value })}
          />
        </label>
        <label>
          Kết thúc
          <input
            required
            type="datetime-local"
            value={form.endAt}
            onChange={(event) => onChange({ ...form, endAt: event.target.value })}
          />
        </label>
      </div>

      <label>
        Trạng thái
        <select
          value={form.status}
          onChange={(event) => onChange({ ...form, status: event.target.value as AdminPromotionPayload['status'] })}
        >
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="Expired">Expired</option>
        </select>
      </label>

      <fieldset className="sku-picker">
        <legend>SKU áp dụng</legend>
        <div>
          {skuOptions.map((sku) => (
            <label key={sku.skuId}>
              <input
                checked={form.skuIds.includes(Number(sku.skuId))}
                type="checkbox"
                onChange={() => toggleSku(Number(sku.skuId))}
              />
              <span>
                <strong>{sku.skuCode} · {formatPrice(sku.price)}</strong>
                <small>{sku.productName}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {selectedSkus.length > 0 && (
        <p className="form-hint">
          Đang chọn {selectedSkus.length} SKU. Giá sale sẽ tự áp dụng trong khoảng thời gian đã đặt.
        </p>
      )}

      <div className="modal-actions">
        <button disabled={saving}>{saving ? 'Đang lưu...' : editingId ? 'Cập nhật' : 'Tạo giảm giá'}</button>
        <button type="button" onClick={onCancel}>Hủy</button>
      </div>
    </form>
  )
}

export function AdminPromotionsPage({ roles, token }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState<AdminPromotionPayload>(makeEmptyForm)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [promotions, setPromotions] = useState<AdminPromotion[]>([])
  const [saving, setSaving] = useState(false)
  const [skuOptions, setSkuOptions] = useState<AdminPromotionSkuOption[]>([])
  const [success, setSuccess] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [promotionPayload, skuPayload] = await Promise.all([
        getAdminPromotions(token),
        getAdminPromotionSkuOptions(token),
      ])
      setPromotions(promotionPayload.data)
      setSkuOptions(skuPayload.data)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không tải được chương trình giảm giá.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (!token || !canManagePromotions(roles)) return
    void loadData()
  }, [loadData, roles, token])

  function openCreateModal() {
    setEditingId(null)
    setForm(makeEmptyForm())
    setIsModalOpen(true)
  }

  function openEditModal(promotion: AdminPromotion) {
    setEditingId(promotion.promotionId)
    setForm(toForm(promotion))
    setIsModalOpen(true)
  }

  function closeModal() {
    setEditingId(null)
    setForm(makeEmptyForm())
    setIsModalOpen(false)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      if (editingId) {
        await updateAdminPromotion(editingId, form, token)
        setSuccess('Đã cập nhật chương trình giảm giá.')
      } else {
        await createAdminPromotion(form, token)
        setSuccess('Đã tạo chương trình giảm giá.')
      }
      closeModal()
      await loadData()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không lưu được chương trình giảm giá.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus(promotion: AdminPromotion) {
    const nextStatus = promotion.status === 'Active' ? 'Inactive' : 'Active'
    await updateAdminPromotionStatus(promotion.promotionId, nextStatus, token)
    await loadData()
  }

  if (!token) return <div className="status-card error">Bạn cần đăng nhập trước khi quản lý khuyến mãi.</div>
  if (!canManagePromotions(roles)) return <div className="status-card error">Tài khoản hiện tại chưa có quyền SystemAdmin.</div>

  return (
    <>
      <section className="section-heading">
        <div>
          <span className="eyebrow">Khuyến mãi</span>
          <h2>Quản lý giảm giá sản phẩm</h2>
          <p>Set trước thời gian bắt đầu/kết thúc, chọn SKU áp dụng và hệ thống tự trả về giá sale khi chương trình đang active.</p>
        </div>
        <button onClick={openCreateModal}>+ Tạo giảm giá</button>
      </section>

      {error && <div className="status-card error">{error}</div>}
      {success && <div className="status-card success">{success}</div>}

      <section className="admin-panel-card promotion-panel">
        <div className="section-heading compact">
          <div>
            <span className="eyebrow">Danh sách</span>
            <h3>Chương trình giảm giá</h3>
          </div>
        </div>

        <div className="promotion-list">
          {loading ? (
            <div className="status-card">Đang tải khuyến mãi...</div>
          ) : promotions.length === 0 ? (
            <p className="form-hint">Chưa có chương trình giảm giá.</p>
          ) : promotions.map((promotion) => (
            <article className="promotion-row" key={promotion.promotionId}>
              <div>
                <strong>{promotion.promotionName}</strong>
                <small>{describeDiscount(promotion)} · {promotion.skuCount} SKU</small>
                <small>{promotion.skuCodes || 'Chưa gắn SKU'}</small>
              </div>
              <div>
                <strong>{promotion.status}</strong>
                <small>{toDateTimeInput(promotion.startAt)} → {toDateTimeInput(promotion.endAt)}</small>
              </div>
              <div className="row-actions">
                <button onClick={() => openEditModal(promotion)}>Sửa</button>
                <button onClick={() => void toggleStatus(promotion)}>
                  {promotion.status === 'Active' ? 'Tắt' : 'Bật'}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {isModalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={closeModal}>
          <section
            aria-modal="true"
            className="admin-product-modal promotion-modal"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <span className="eyebrow">{editingId ? 'Cập nhật' : 'Thêm mới'}</span>
                <h3>{editingId ? 'Sửa chương trình giảm giá' : 'Tạo chương trình giảm giá'}</h3>
              </div>
              <button type="button" onClick={closeModal}>Đóng</button>
            </div>
            <div className="promotion-modal-scroll">
              <PromotionForm
                editingId={editingId}
                form={form}
                saving={saving}
                skuOptions={skuOptions}
                onCancel={closeModal}
                onChange={setForm}
                onSubmit={handleSubmit}
              />
            </div>
          </section>
        </div>
      )}
    </>
  )
}
