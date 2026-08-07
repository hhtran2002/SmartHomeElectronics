import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  createAdminProduct,
  getAdminProducts,
  updateAdminProduct,
  updateAdminProductStatus,
} from '../api'
import type { AdminProduct, AdminProductPayload, Brand, Category } from '../types'
import { formatPrice } from '../utils'
import { AdminProductImages } from './AdminProductImages'

type Props = {
  brands: Brand[]
  categories: Category[]
  roles: string[]
  token: string
}

type ProductFormProps = {
  brands: Brand[]
  categories: Category[]
  editingId: number | null
  form: AdminProductPayload
  saving: boolean
  onCancel?: () => void
  onChange: (form: AdminProductPayload) => void
  onSubmit: (event: FormEvent) => void
}

const pageSize = 10

const emptyForm: AdminProductPayload = {
  productName: '',
  categoryId: 0,
  brandId: 0,
  description: '',
  highlights: '',
  basePrice: 0,
  warrantyMonths: 12,
  installRequired: false,
  skuId: null,
  skuCode: '',
  price: 0,
  costPrice: null,
  imageUrl: '',
}

function canManageProducts(roles: string[]) {
  return roles.includes('SystemAdmin')
}

function toForm(product: AdminProduct): AdminProductPayload {
  return {
    productName: product.productName,
    categoryId: product.categoryId,
    brandId: product.brandId,
    description: product.description ?? '',
    highlights: product.highlights ?? '',
    basePrice: Number(product.basePrice),
    warrantyMonths: product.warrantyMonths,
    installRequired: product.installRequired,
    skuId: product.skuId,
    skuCode: product.skuCode ?? '',
    price: Number(product.price ?? product.basePrice),
    costPrice: product.costPrice,
    imageUrl: product.imageUrl ?? '',
  }
}

function ProductForm({
  brands,
  categories,
  editingId,
  form,
  saving,
  onCancel,
  onChange,
  onSubmit,
}: ProductFormProps) {
  return (
    <form className="admin-product-form" onSubmit={onSubmit}>
      <span className="eyebrow">{editingId ? 'Cập nhật' : 'Thêm mới'}</span>
      <h3>{editingId ? 'Sửa sản phẩm' : 'Tạo sản phẩm'}</h3>

      <label>
        Tên sản phẩm
        <input
          required
          value={form.productName}
          onChange={(event) => onChange({ ...form, productName: event.target.value })}
        />
      </label>

      <label>
        Danh mục
        <select
          required
          value={form.categoryId}
          onChange={(event) => onChange({ ...form, categoryId: Number(event.target.value) })}
        >
          <option value={0}>Chọn danh mục</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
      </label>

      <label>
        Thương hiệu
        <select
          required
          value={form.brandId}
          onChange={(event) => onChange({ ...form, brandId: Number(event.target.value) })}
        >
          <option value={0}>Chọn thương hiệu</option>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>{brand.name}</option>
          ))}
        </select>
      </label>

      <label>
        Mô tả
        <textarea
          value={form.description}
          onChange={(event) => onChange({ ...form, description: event.target.value })}
        />
      </label>

      <label>
        Đặc điểm nổi bật
        <textarea value={form.highlights} placeholder="Mỗi dòng là một điểm nổi bật" onChange={(event) => onChange({ ...form, highlights: event.target.value })} />
      </label>

      <div className="checkout-grid">
        <label>
          Giá tham khảo Product
          <input
            required
            type="number"
            value={form.basePrice}
            onChange={(event) => onChange({ ...form, basePrice: Number(event.target.value) })}
          />
        </label>
        <label>
          Giá bán thực tế SKU
          <input
            required
            type="number"
            value={form.price}
            onChange={(event) => onChange({ ...form, price: Number(event.target.value) })}
          />
        </label>
        <label>
          Mã SKU
          <input
            required
            value={form.skuCode}
            onChange={(event) => onChange({ ...form, skuCode: event.target.value })}
          />
        </label>
        <label>
          Giá vốn SKU
          <input
            type="number"
            value={form.costPrice ?? ''}
            onChange={(event) => onChange({
              ...form,
              costPrice: event.target.value ? Number(event.target.value) : null,
            })}
          />
        </label>
        <label>
          Bảo hành
          <input
            required
            type="number"
            value={form.warrantyMonths}
            onChange={(event) => onChange({ ...form, warrantyMonths: Number(event.target.value) })}
          />
        </label>
      </div>

      <p className="form-hint">Giá bán trên website và đơn hàng lấy theo SKU.</p>

      <label className="checkbox-label">
        <input
          checked={form.installRequired}
          type="checkbox"
          onChange={(event) => onChange({ ...form, installRequired: event.target.checked })}
        />
        Cần lắp đặt
      </label>

      <label>
        Ảnh chính nhanh
        <input
          value={form.imageUrl ?? ''}
          onChange={(event) => onChange({ ...form, imageUrl: event.target.value })}
        />
      </label>

      <div className="product-form-actions">
        <button disabled={saving}>{saving ? 'Đang lưu...' : editingId ? 'Cập nhật' : 'Thêm sản phẩm'}</button>
        {onCancel && <button type="button" onClick={onCancel}>{editingId ? 'Hủy sửa' : 'Hủy'}</button>}
      </div>
    </form>
  )
}

export function AdminProductsPage({ brands, categories, roles, token }: Props) {
  const [createForm, setCreateForm] = useState<AdminProductPayload>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState<AdminProductPayload>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [saving, setSaving] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const loadProducts = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const payload = await getAdminProducts(token)
      setProducts(payload.data)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không tải được sản phẩm.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (!token || !canManageProducts(roles)) return
    void loadProducts()
  }, [loadProducts, roles, token])

  const totalPages = Math.max(1, Math.ceil(products.length / pageSize))
  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * pageSize
    return products.slice(start, start + pageSize)
  }, [page, products])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      if (!editingId) return
      await updateAdminProduct(editingId, form, token)
      cancelEdit()
      await loadProducts()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không lưu được sản phẩm.')
    } finally {
      setSaving(false)
    }
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      await createAdminProduct(createForm, token)
      setCreateForm(emptyForm)
      setPage(1)
      await loadProducts()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không tạo được sản phẩm.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus(product: AdminProduct) {
    const nextStatus = product.status === 'Active' ? 'Inactive' : 'Active'
    await updateAdminProductStatus(product.productId, nextStatus, token)
    await loadProducts()
  }

  function startEdit(product: AdminProduct) {
    setEditingId(product.productId)
    setForm(toForm(product))
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(emptyForm)
  }

  if (!token) {
    return <div className="status-card error">Bạn cần đăng nhập trước khi quản lý sản phẩm.</div>
  }

  if (!canManageProducts(roles)) {
    return <div className="status-card error">Tài khoản hiện tại chưa có quyền SystemAdmin.</div>
  }

  return (
    <>
      <section className="section-heading">
        <div>
          <span className="eyebrow">Quản trị hệ thống</span>
          <h2>Quản lý sản phẩm</h2>
          <p>Thêm, sửa, bật/tắt sản phẩm, SKU bán chính và thư viện ảnh sản phẩm.</p>
        </div>
        <button
          className="primary-link"
          style={{ padding: '10px 20px', borderRadius: '999px', fontSize: '14px', height: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}
          onClick={() => setShowCreateModal(true)}
        >
          + Tạo sản phẩm mới
        </button>
      </section>

      {error && <div className="status-card error">{error}</div>}

      <section className="admin-products-layout">
        <div className="admin-products-list">
          {loading ? (
            <div className="status-card">Đang tải sản phẩm...</div>
          ) : products.length === 0 ? (
            <div className="status-card">Chưa có sản phẩm.</div>
          ) : (
            paginatedProducts.map((product) => (
              <article className="admin-product-row" key={product.productId}>
                <div>
                  <strong>{product.productName}</strong>
                  <small>{product.categoryName} · {product.brandName} · SKU {product.skuCode}</small>
                </div>
                <div>
                  <strong>{formatPrice(product.price ?? product.basePrice)}</strong>
                  <small>{product.status} · còn {product.availableQuantity}</small>
                </div>
                <div className="row-actions">
                  <button onClick={() => startEdit(product)}>Sửa</button>
                  <button onClick={() => void toggleStatus(product)}>
                    {product.status === 'Active' ? 'Ẩn' : 'Bật'}
                  </button>
                </div>
              </article>
            ))
          )}
          {!loading && products.length > 0 && (
            <div className="admin-pagination">
              <button disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                Trang trước
              </button>
              <span>Trang {page} / {totalPages} · {products.length} sản phẩm</span>
              <button disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>
                Trang sau
              </button>
            </div>
          )}
        </div>
      </section>

      {showCreateModal && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => { setShowCreateModal(false); setCreateForm(emptyForm); }}>
          <section
            aria-modal="true"
            className="admin-product-modal"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <span className="eyebrow">Thêm mới</span>
                <h3>Tạo sản phẩm mới</h3>
              </div>
              <button type="button" onClick={() => { setShowCreateModal(false); setCreateForm(emptyForm); }}>Đóng</button>
            </div>

            <div className="modal-scroll">
              <ProductForm
                brands={brands}
                categories={categories}
                editingId={null}
                form={createForm}
                saving={saving}
                onCancel={() => { setShowCreateModal(false); setCreateForm(emptyForm); }}
                onChange={setCreateForm}
                onSubmit={async (e) => {
                  await handleCreate(e);
                  setShowCreateModal(false);
                }}
              />

              <div className="admin-image-manager" style={{ alignSelf: 'start' }}>
                <h3 style={{ fontSize: '18px', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '14px' }}>Xem trước sản phẩm (Preview)</h3>
                <div className="product-card" style={{ maxWidth: '320px', margin: '0 auto', border: '1px solid rgba(125, 211, 252, 0.35)', boxShadow: '0 10px 30px rgba(14,165,233,0.06)' }}>
                  <div className="product-image" style={{ height: '180px' }}>
                    {createForm.imageUrl ? (
                      <img src={createForm.imageUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '48px', color: '#0ea5e9' }}>⌂</span>
                    )}
                  </div>
                  <div className="product-meta" style={{ fontSize: '11px', textTransform: 'uppercase', color: '#0284c7', fontWeight: '800', margin: '14px 6px 0' }}>
                    {categories.find(c => c.id === createForm.categoryId)?.name || 'DANH MỤC'} · {brands.find(b => b.id === createForm.brandId)?.name || 'THƯƠNG HIỆU'}
                  </div>
                  <h3 style={{ fontSize: '16px', margin: '8px 6px', color: '#0f172a' }}>{createForm.productName || 'Tên sản phẩm'}</h3>
                  <p style={{ fontSize: '12px', color: '#64748b', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', height: '36px', lineHeight: '1.5', margin: '0 6px' }}>
                    {createForm.description || 'Nhập mô tả sản phẩm ở bên trái để xem trước tại đây.'}
                  </p>
                  <div className="product-bottom" style={{ marginTop: '16px', padding: '0 6px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: '18px', color: '#0f172a' }}>{formatPrice(createForm.price || createForm.basePrice)}</strong>
                      <small style={{ fontSize: '11px', color: '#94a3b8' }}>SKU: {createForm.skuCode || 'chưa nhập'}</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {editingId && (
        <div className="modal-backdrop" role="presentation" onMouseDown={cancelEdit}>
          <section
            aria-modal="true"
            className="admin-product-modal"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <span className="eyebrow">Cập nhật</span>
                <h3>Sửa sản phẩm</h3>
              </div>
              <button type="button" onClick={cancelEdit}>Đóng</button>
            </div>

            <div className="modal-scroll">
              <ProductForm
                brands={brands}
                categories={categories}
                editingId={editingId}
                form={form}
                saving={saving}
                onCancel={cancelEdit}
                onChange={setForm}
                onSubmit={handleSubmit}
              />

              <AdminProductImages
                productId={editingId}
                token={token}
                onChanged={() => void loadProducts()}
              />
            </div>
          </section>
        </div>
      )}
    </>
  )
}
