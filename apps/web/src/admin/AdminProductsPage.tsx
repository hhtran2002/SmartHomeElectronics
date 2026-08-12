import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  createAdminProduct,
  getAdminProducts,
  updateAdminProduct,
  updateAdminProductStatus,
  createCategory,
  createBrand,
  getProduct,
} from '../api'
import type { AdminProduct, AdminProductPayload, Brand, Category, AdminVariantPayload } from '../types'
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
  onCreateCategory: (name: string) => Promise<Category>
  onCreateBrand: (name: string, country: string | null) => Promise<Brand>
}

const pageSize = 10

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
}

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
  onCreateCategory,
  onCreateBrand,
}: ProductFormProps) {
  const [categorySearch, setCategorySearch] = useState('')
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)
  const [brandSearch, setBrandSearch] = useState('')
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false)
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [creatingBrand, setCreatingBrand] = useState(false)
  const [hasVariants, setHasVariants] = useState(false)

  const selectedCategoryObj = useMemo(() => categories.find(c => c.id === form.categoryId), [categories, form.categoryId])
  const selectedBrandObj = useMemo(() => brands.find(b => b.id === form.brandId), [brands, form.brandId])

  const catName = selectedCategoryObj ? selectedCategoryObj.name : ''
  const brandName = selectedBrandObj ? selectedBrandObj.name : ''

  useEffect(() => {
    if (selectedCategoryObj) {
      setCategorySearch(selectedCategoryObj.name)
    } else {
      setCategorySearch('')
    }
  }, [form.categoryId, selectedCategoryObj])

  useEffect(() => {
    if (selectedBrandObj) {
      setBrandSearch(selectedBrandObj.name)
    } else {
      setBrandSearch('')
    }
  }, [form.brandId, selectedBrandObj])

  useEffect(() => {
    if (form.variants && form.variants.length > 0) {
      setHasVariants(true)
    } else {
      setHasVariants(false)
    }
  }, [form.variants])

  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim() || catName === categorySearch) return categories
    const query = categorySearch.toLowerCase()
    return categories.filter(c => c.name.toLowerCase().includes(query))
  }, [categories, categorySearch, catName])

  const filteredBrands = useMemo(() => {
    if (!brandSearch.trim() || brandName === brandSearch) return brands
    const query = brandSearch.toLowerCase()
    return brands.filter(b => b.name.toLowerCase().includes(query))
  }, [brands, brandSearch, brandName])

  const getGeneratedSku = useCallback((vName?: string) => {
    if (!form.productName || !catName || !brandName) return ''
    
    const catPrefix = catName
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'D');

    const brandPrefix = brandName
      .toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'D')
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 3);

    const nameWords = form.productName.split(' ').map(w => w.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'D').replace(/[^A-Z0-9]/g, ''));
    const modelWord = nameWords.find(w => /\d/.test(w)) || nameWords[nameWords.length - 1] || '';

    let base = [catPrefix, brandPrefix, modelWord].filter(Boolean).join('-');
    
    if (vName && vName.trim() && vName.trim() !== 'Mặc định') {
      const variantSuffix = vName
        .toUpperCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'D')
        .replace(/[^A-Z0-9.]/g, '');
      base = `${base}-${variantSuffix}`;
    }
    return base;
  }, [form.productName, catName, brandName])

  useEffect(() => {
    if (!hasVariants) {
      const generated = getGeneratedSku()
      if (generated && form.skuCode !== generated) {
        onChange({
          ...form,
          skuCode: generated,
          price: form.basePrice,
          costPrice: form.costPrice || Math.round(form.basePrice * 0.7)
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasVariants, form.productName, form.categoryId, form.brandId, form.basePrice])

  const handleCreateCategoryInline = async () => {
    if (!categorySearch.trim()) return
    setCreatingCategory(true)
    try {
      const newCat = await onCreateCategory(categorySearch.trim())
      onChange({ ...form, categoryId: newCat.id })
      setCategoryDropdownOpen(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Lỗi khi tạo danh mục.')
    } finally {
      setCreatingCategory(false)
    }
  }

  const handleCreateBrandInline = async () => {
    if (!brandSearch.trim()) return
    setCreatingBrand(true)
    try {
      const newBrand = await onCreateBrand(brandSearch.trim(), null)
      onChange({ ...form, brandId: newBrand.id })
      setBrandDropdownOpen(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Lỗi khi tạo thương hiệu.')
    } finally {
      setCreatingBrand(false)
    }
  }

  const handleVariantChange = (index: number, patch: Partial<AdminVariantPayload>) => {
    const list = [...(form.variants || [])]
    const updatedVariant = { ...list[index], ...patch }
    
    if (patch.variantName !== undefined) {
      updatedVariant.skuCode = getGeneratedSku(patch.variantName)
    }
    
    list[index] = updatedVariant
    
    const validPrices = list.map(v => v.price).filter(p => p > 0)
    const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : form.basePrice

    onChange({
      ...form,
      variants: list,
      basePrice: minPrice
    })
  }

  const addVariant = () => {
    const list = [...(form.variants || [])]
    list.push({
      skuCode: '',
      variantName: '',
      price: form.basePrice,
      costPrice: form.costPrice || Math.round(form.basePrice * 0.7)
    })
    onChange({ ...form, variants: list })
  }

  const removeVariant = (index: number) => {
    const list = (form.variants || []).filter((_, i) => i !== index)
    
    const validPrices = list.map(v => v.price).filter(p => p > 0)
    const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : form.basePrice

    onChange({
      ...form,
      variants: list,
      basePrice: minPrice
    })
  }

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
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            required
            placeholder="Tìm danh mục hoặc tạo mới..."
            value={categorySearch}
            onFocus={() => setCategoryDropdownOpen(true)}
            onBlur={() => setTimeout(() => setCategoryDropdownOpen(false), 250)}
            onChange={(e) => {
              setCategorySearch(e.target.value)
              setCategoryDropdownOpen(true)
            }}
            style={{ width: '100%', padding: '12px 14px', borderRadius: '14px', border: '1px solid var(--blue-100)', outline: 'none' }}
          />
          {categoryDropdownOpen && (
            <div
              onMouseDown={(e) => e.preventDefault()}
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 100,
                maxHeight: '220px',
                overflowY: 'auto',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '12px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
                marginTop: '4px'
              }}
            >
              {filteredCategories.length === 0 ? (
                <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>Không tìm thấy danh mục nào</span>
                  <button
                    type="button"
                    disabled={creatingCategory}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      void handleCreateCategoryInline()
                    }}
                    style={{
                      background: 'var(--blue-600)',
                      color: 'white',
                      border: 0,
                      borderRadius: '8px',
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '700'
                    }}
                  >
                    {creatingCategory ? 'Đang tạo...' : `+ Tạo mới danh mục "${categorySearch}"`}
                  </button>
                </div>
              ) : (
                filteredCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      onChange({ ...form, categoryId: cat.id })
                      setCategoryDropdownOpen(false)
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 14px',
                      border: 0,
                      background: form.categoryId === cat.id ? '#e0f2fe' : 'transparent',
                      cursor: 'pointer',
                      fontSize: '13px',
                      color: '#0f172a',
                      borderBottom: '1px solid #f1f5f9'
                    }}
                  >
                    {cat.name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </label>

      <label>
        Thương hiệu
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            required
            placeholder="Tìm thương hiệu hoặc tạo mới..."
            value={brandSearch}
            onFocus={() => setBrandDropdownOpen(true)}
            onBlur={() => setTimeout(() => setBrandDropdownOpen(false), 250)}
            onChange={(e) => {
              setBrandSearch(e.target.value)
              setBrandDropdownOpen(true)
            }}
            style={{ width: '100%', padding: '12px 14px', borderRadius: '14px', border: '1px solid var(--blue-100)', outline: 'none' }}
          />
          {brandDropdownOpen && (
            <div
              onMouseDown={(e) => e.preventDefault()}
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 100,
                maxHeight: '220px',
                overflowY: 'auto',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '12px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
                marginTop: '4px'
              }}
            >
              {filteredBrands.length === 0 ? (
                <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>Không tìm thấy thương hiệu nào</span>
                  <button
                    type="button"
                    disabled={creatingBrand}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      void handleCreateBrandInline()
                    }}
                    style={{
                      background: 'var(--blue-600)',
                      color: 'white',
                      border: 0,
                      borderRadius: '8px',
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '700'
                    }}
                  >
                    {creatingBrand ? 'Đang tạo...' : `+ Tạo mới thương hiệu "${brandSearch}"`}
                  </button>
                </div>
              ) : (
                filteredBrands.map((brand) => (
                  <button
                    key={brand.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      onChange({ ...form, brandId: brand.id })
                      setBrandDropdownOpen(false)
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 14px',
                      border: 0,
                      background: form.brandId === brand.id ? '#e0f2fe' : 'transparent',
                      cursor: 'pointer',
                      fontSize: '13px',
                      color: '#0f172a',
                      borderBottom: '1px solid #f1f5f9'
                    }}
                  >
                    {brand.name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
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

      <div style={{ marginTop: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
        <label className="checkbox-label" style={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={hasVariants}
            onChange={(e) => {
              const checked = e.target.checked
              setHasVariants(checked)
              if (checked) {
                if (!form.variants || form.variants.length === 0) {
                  onChange({
                    ...form,
                    variants: [{ variantName: '', skuCode: '', price: form.basePrice, costPrice: form.costPrice ?? null }]
                  })
                }
              } else {
                onChange({ ...form, variants: [] })
              }
            }}
          />
          Sản phẩm có nhiều biến thể (ví dụ: công suất 1 HP / 1.5 HP, màu sắc...)
        </label>
      </div>

      {!hasVariants ? (
        <div className="checkout-grid" style={{ marginTop: '12px' }}>
          <label>
            Giá bán sản phẩm
            <input
              required
              type="number"
              value={form.basePrice}
              onChange={(event) => onChange({ ...form, basePrice: Number(event.target.value), price: Number(event.target.value) })}
            />
          </label>
          <label>
            Mã SKU (Tự động khóa)
            <input
              disabled
              value={form.skuCode}
              placeholder="Nhập tên, danh mục và thương hiệu..."
              style={{ background: '#f1f5f9', cursor: 'not-allowed', color: '#475569', fontWeight: '700' }}
            />
          </label>
          <label>
            Giá vốn SKU (Không bắt buộc)
            <input
              type="number"
              placeholder="Mặc định = 70% giá bán"
              value={form.costPrice ?? ''}
              onChange={(event) => onChange({
                ...form,
                costPrice: event.target.value ? Number(event.target.value) : null,
              })}
            />
          </label>
          <label>
            Bảo hành (Tháng)
            <input
              required
              type="number"
              value={form.warrantyMonths}
              onChange={(event) => onChange({ ...form, warrantyMonths: Number(event.target.value) })}
            />
          </label>
        </div>
      ) : (
        <div style={{ marginTop: '16px', background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <h4 style={{ fontSize: '14px', color: '#0f172a', marginBottom: '12px', fontWeight: '800' }}>Danh sách các biến thể</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(form.variants || []).map((v, index) => (
              <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 3fr 2fr 1fr', gap: '10px', alignItems: 'center' }}>
                <input
                  required
                  placeholder="Tên biến thể (e.g. 1 HP)"
                  value={v.variantName}
                  onChange={(e) => handleVariantChange(index, { variantName: e.target.value })}
                  style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
                <input
                  disabled
                  placeholder="Mã SKU (Tự động)"
                  value={v.skuCode}
                  style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f1f5f9', cursor: 'not-allowed', fontSize: '11px', fontWeight: '700' }}
                />
                <input
                  required
                  type="number"
                  placeholder="Giá bán"
                  value={v.price || ''}
                  onChange={(e) => handleVariantChange(index, { price: Number(e.target.value), costPrice: v.costPrice || Math.round(Number(e.target.value) * 0.7) })}
                  style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
                <button
                  type="button"
                  onClick={() => removeVariant(index)}
                  style={{ padding: '8px', borderRadius: '8px', background: '#ef4444', color: 'white', border: 0, cursor: 'pointer', fontWeight: '700' }}
                >
                  Xóa
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addVariant}
            style={{
              marginTop: '12px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #0ea5e9',
              color: '#0ea5e9',
              background: 'transparent',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '12px'
            }}
          >
            + Thêm biến thể
          </button>
        </div>
      )}

      <p className="form-hint">Giá bán trên website và đơn hàng lấy theo SKU.</p>

      <label className="checkbox-label">
        <input
          checked={form.installRequired}
          type="checkbox"
          onChange={(event) => onChange({ ...form, installRequired: event.target.checked })}
        />
        Cần lắp đặt
      </label>

      {!editingId && (
        <label>
          Ảnh chính
          <input
            value={form.imageUrl ?? ''}
            onChange={(event) => onChange({ ...form, imageUrl: event.target.value })}
          />
        </label>
      )}

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
  const [productSearch, setProductSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [brandFilter, setBrandFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')

  const [localBrands, setLocalBrands] = useState<Brand[]>(brands)
  const [localCategories, setLocalCategories] = useState<Category[]>(categories)

  useEffect(() => {
    setLocalBrands(brands)
  }, [brands])

  useEffect(() => {
    setLocalCategories(categories)
  }, [categories])

  const handleCreateCategory = async (name: string) => {
    const res = await createCategory(name, token)
    setLocalCategories(current => [...current, res.data])
    return res.data
  }

  const handleCreateBrand = async (name: string, country: string | null) => {
    const res = await createBrand(name, country, token)
    setLocalBrands(current => [...current, res.data])
    return res.data
  }

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

  const filteredProducts = useMemo(() => {
    const query = normalizeSearchText(productSearch.trim())
    return products.filter((product) => {
      const matchesSearch = !query || normalizeSearchText([
        product.productName,
        product.skuCode ?? '',
        product.categoryName,
        product.brandName,
      ].join(' ')).includes(query)
      const matchesCategory = categoryFilter === 'All' || Number(product.categoryId) === Number(categoryFilter)
      const matchesBrand = brandFilter === 'All' || Number(product.brandId) === Number(brandFilter)
      const matchesStatus = statusFilter === 'All' || product.status === statusFilter
      return matchesSearch && matchesCategory && matchesBrand && matchesStatus
    })
  }, [brandFilter, categoryFilter, productSearch, products, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize))
  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredProducts.slice(start, start + pageSize)
  }, [filteredProducts, page])

  useEffect(() => {
    setPage(1)
  }, [brandFilter, categoryFilter, productSearch, statusFilter])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      if (!editingId) return
      // Product images are managed separately below. The URL captured when
      // opening this modal may be stale after choosing another primary image.
      await updateAdminProduct(editingId, { ...form, imageUrl: undefined }, token)
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

  async function startEdit(product: AdminProduct) {
    setEditingId(product.productId)
    setForm(toForm(product))
    try {
      const res = await getProduct(product.slug)
      const detail = res.data
      if (detail && detail.skus && detail.skus.length > 0) {
        setForm({
          ...toForm(product),
          variants: detail.skus.map(s => ({
            skuId: s.skuId,
            skuCode: s.skuCode,
            variantName: s.variantName,
            price: s.price,
            costPrice: s.costPrice,
          }))
        })
      }
    } catch (e) {
      console.error('Không tải được danh sách biến thể:', e)
    }
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

      <section className="admin-product-filters" aria-label="Tìm kiếm và lọc sản phẩm">
        <label className="admin-product-search">
          <span>Tìm kiếm</span>
          <input
            onChange={(event) => setProductSearch(event.target.value)}
            placeholder="Tên sản phẩm, mã SKU, thương hiệu..."
            type="search"
            value={productSearch}
          />
        </label>
        <label>
          <span>Danh mục</span>
          <select onChange={(event) => setCategoryFilter(event.target.value)} value={categoryFilter}>
            <option value="All">Tất cả danh mục</option>
            {localCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <label>
          <span>Thương hiệu</span>
          <select onChange={(event) => setBrandFilter(event.target.value)} value={brandFilter}>
            <option value="All">Tất cả thương hiệu</option>
            {localBrands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
          </select>
        </label>
        <label>
          <span>Trạng thái</span>
          <select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
            <option value="All">Tất cả trạng thái</option>
            <option value="Active">Đang hiển thị</option>
            <option value="Inactive">Đang ẩn</option>
          </select>
        </label>
        <div className="admin-product-filter-result">
          <strong>{filteredProducts.length}</strong>
          <span>/ {products.length} sản phẩm</span>
          {(productSearch || categoryFilter !== 'All' || brandFilter !== 'All' || statusFilter !== 'All') && (
            <button onClick={() => {
              setProductSearch('')
              setCategoryFilter('All')
              setBrandFilter('All')
              setStatusFilter('All')
            }} type="button">Xóa lọc</button>
          )}
        </div>
      </section>

      <section className="admin-products-layout">
        <div className="admin-products-list">
          {loading ? (
            <div className="status-card">Đang tải sản phẩm...</div>
          ) : products.length === 0 ? (
            <div className="status-card">Chưa có sản phẩm.</div>
          ) : filteredProducts.length === 0 ? (
            <div className="status-card">Không tìm thấy sản phẩm phù hợp với bộ lọc.</div>
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
          {!loading && filteredProducts.length > 0 && (
            <div className="admin-pagination">
              <button disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                Trang trước
              </button>
              <span>Trang {page} / {totalPages} · {filteredProducts.length} sản phẩm</span>
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
                brands={localBrands}
                categories={localCategories}
                editingId={null}
                form={createForm}
                saving={saving}
                onCancel={() => { setShowCreateModal(false); setCreateForm(emptyForm); }}
                onChange={setCreateForm}
                onSubmit={async (e) => {
                  await handleCreate(e);
                  setShowCreateModal(false);
                }}
                onCreateCategory={handleCreateCategory}
                onCreateBrand={handleCreateBrand}
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
                    {localCategories.find(c => c.id === createForm.categoryId)?.name || 'DANH MỤC'} · {localBrands.find(b => b.id === createForm.brandId)?.name || 'THƯƠNG HIỆU'}
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
                brands={localBrands}
                categories={localCategories}
                editingId={editingId}
                form={form}
                saving={saving}
                onCancel={cancelEdit}
                onChange={setForm}
                onSubmit={handleSubmit}
                onCreateCategory={handleCreateCategory}
                onCreateBrand={handleCreateBrand}
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
