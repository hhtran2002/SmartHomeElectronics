import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { createOrder, getBrands, getCategories, getPaymentMethods, getProduct, getProducts } from './api'
import './App.css'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { useAuth } from './hooks/useAuth'
import { useCart } from './hooks/useCart'
import { AdminDashboardPage } from './admin/AdminDashboardPage'
import { AdminInventoryPage } from './admin/AdminInventoryPage'
import { AdminLayout } from './admin/AdminLayout'
import { AdminProductsPage } from './admin/AdminProductsPage'
import { AdminPromotionsPage } from './admin/AdminPromotionsPage'
import { AdminReportsPage } from './admin/AdminReportsPage'
import { AdminReviewsPage } from './admin/AdminReviewsPage'
import { AdminUsersPage } from './admin/AdminUsersPage'
import { CartPage } from './components/CartPage'
import { CheckoutPage } from './components/CheckoutPage'
import { HomePage } from './pages/HomePage'
import { AdminOrdersPage } from './pages/AdminOrdersPage'
import { LoginPage } from './pages/LoginPage'
import { ProductDetailPage } from './pages/ProductDetailPage'
import { ProductsPage } from './pages/ProductsPage'
import { ProfilePage } from './pages/ProfilePage'
import { RegisterPage } from './pages/RegisterPage'
import { ShipperLayout } from './shipper/ShipperLayout'
import { ShipperPage } from './shipper/ShipperPage'
import { WarehouseDeliveriesPage } from './warehouse/WarehouseDeliveriesPage'
import { WarehouseLayout } from './warehouse/WarehouseLayout'
import type {
  Brand,
  Category,
  CheckoutPayload,
  OrderResponse,
  PaymentMethod,
  Product,
  ProductFilters as Filters,
} from './types'

const initialFilters: Filters = {
  search: '',
  category: '',
  brand: '',
  minPrice: '',
  maxPrice: '',
  page: 1,
}

const initialCheckoutForm = {
  customerName: '',
  phone: '',
  email: '',
  province: '',
  district: '',
  ward: '',
  streetAddress: '',
  note: '',
  couponCode: '',
}

function defaultAuthenticatedRoute(roles: string[]) {
  if (roles.includes('SystemAdmin')) return '#/admin/dashboard'
  if (roles.includes('WarehouseStaff')) return '#/warehouse'
  if (roles.includes('DeliveryStaff')) return '#/shipper'
  return '#/profile'
}

function App() {
  const auth = useAuth()
  const cart = useCart()
  const [brands, setBrands] = useState<Brand[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [checkoutError, setCheckoutError] = useState('')
  const [checkoutForm, setCheckoutForm] = useState(initialCheckoutForm)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [createdOrder, setCreatedOrder] = useState<OrderResponse['data'] | null>(null)
  const [detail, setDetail] = useState<Product | null>(null)
  const [detailError, setDetailError] = useState('')
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState<Filters>(initialFilters)
  const [hash, setHash] = useState(window.location.hash || '#/')
  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState(1)
  const [total, setTotal] = useState(0)

  const selectedSlug = useMemo(() => {
    const match = hash.match(/^#\/products\/(.+)$/)
    return match ? decodeURIComponent(match[1]) : ''
  }, [hash])

  const needsCatalogData = hash === '#/products' || hash === '#/admin/products' || selectedSlug !== ''

  useEffect(() => {
    const handleHashChange = () => setHash(window.location.hash || '#/')
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    if (!needsCatalogData) return

    void Promise.all([getCategories(), getBrands()])
      .then(([categoryPayload, brandPayload]) => {
        setCategories(categoryPayload.data)
        setBrands(brandPayload.data)
      })
      .catch(() => setError('Chưa tải được danh mục và thương hiệu.'))
  }, [needsCatalogData])

  useEffect(() => {
    if (hash !== '#/checkout') return

    void getPaymentMethods()
      .then((payload) => {
        setPaymentMethods(payload.data)
        const cod = payload.data.find((method) => method.methodCode === 'COD')
        setSelectedPaymentMethodId((current) => {
          if (payload.data.some((method) => method.paymentMethodId === current)) return current
          return cod?.paymentMethodId ?? payload.data[0]?.paymentMethodId ?? 1
        })
      })
      .catch(() => setPaymentMethods([]))
  }, [hash])

  useEffect(() => {
    if (hash !== '#/products') return

    setLoading(true)
    setError('')
    void getProducts(filters)
      .then((payload) => {
        setProducts(payload.data)
        setTotal(payload.total)
      })
      .catch(() => setError('Chưa kết nối được API sản phẩm.'))
      .finally(() => setLoading(false))
  }, [filters, hash])

  useEffect(() => {
    if (!selectedSlug) return

    setDetailLoading(true)
    setDetailError('')
    setDetail(null)
    void getProduct(selectedSlug)
      .then((payload) => setDetail(payload.data))
      .catch(() => setDetailError('Không tải được chi tiết sản phẩm.'))
      .finally(() => setDetailLoading(false))
  }, [selectedSlug])

  function addToCart(product: Product) {
    setCreatedOrder(null)
    cart.addToCart(product)
  }

  async function handleCheckoutSubmit(event: FormEvent) {
    event.preventDefault()
    setCheckoutError('')
    setCheckoutLoading(true)

    const payload: CheckoutPayload = {
      ...checkoutForm,
      paymentMethodId: selectedPaymentMethodId,
      items: cart.cartItems.map((item) => ({
        skuId: Number(item.skuId),
        quantity: Number(item.quantity),
      })),
    }

    try {
      const order = await createOrder(payload, auth.token)
      setCreatedOrder(order.data)
      cart.clearCart()
      setCheckoutForm(initialCheckoutForm)
      setSelectedPaymentMethodId(1)
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Không tạo được đơn hàng.')
    } finally {
      setCheckoutLoading(false)
    }
  }

  function handleHomeSearch(event: FormEvent) {
    event.preventDefault()
    setFilters((current) => ({ ...current, page: 1 }))
    window.location.hash = '#/products'
  }

  function handleViewDetail(slug: string) {
    window.location.hash = `#/products/${encodeURIComponent(slug)}`
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function reloadDetail() {
    if (!selectedSlug) return
    void getProduct(selectedSlug)
      .then((payload) => setDetail(payload.data))
      .catch(() => setDetailError('Không tải được chi tiết sản phẩm.'))
  }

  let activePage: 'home' | 'products' | 'cart' | 'auth' | 'admin' = 'home'
  let page = (
    <HomePage
      search={filters.search}
      onSearchChange={(search) => setFilters((current) => ({ ...current, search }))}
      onSubmit={handleHomeSearch}
    />
  )

  if (selectedSlug) {
    activePage = 'products'
    page = (
      <ProductDetailPage
        error={detailError}
        loading={detailLoading}
        product={detail}
        onAddToCart={addToCart}
        token={auth.token}
        onReviewSubmitted={reloadDetail}
      />
    )
  } else if (hash === '#/products') {
    activePage = 'products'
    page = (
      <ProductsPage
        brands={brands}
        categories={categories}
        error={error}
        filters={filters}
        loading={loading}
        products={products}
        total={total}
        onAddToCart={addToCart}
        onFiltersChange={setFilters}
        onResetFilters={() => setFilters(initialFilters)}
        onViewDetail={handleViewDetail}
        roles={auth.user?.roles ?? []}
        token={auth.token}
      />
    )
  } else if (hash === '#/cart') {
    activePage = 'cart'
    page = (
      <CartPage
        items={cart.cartItems}
        onBackToProducts={() => {
          window.location.hash = '#/products'
        }}
        onClearCart={cart.clearCart}
        onGoToCheckout={() => {
          window.location.hash = '#/checkout'
        }}
        onRemoveItem={cart.removeItem}
        onUpdateQuantity={cart.updateQuantity}
      />
    )
  } else if (hash === '#/checkout') {
    activePage = 'cart'
    page = (
      <CheckoutPage
        checkoutError={checkoutError}
        checkoutForm={checkoutForm}
        checkoutLoading={checkoutLoading}
        createdOrder={createdOrder}
        items={cart.cartItems}
        paymentMethods={paymentMethods}
        selectedPaymentMethodId={selectedPaymentMethodId}
        onBackToCart={() => {
          window.location.hash = '#/cart'
        }}
        onBackToProducts={() => {
          window.location.hash = '#/products'
        }}
        onCheckoutChange={(patch) => setCheckoutForm((current) => ({ ...current, ...patch }))}
        onCheckoutSubmit={handleCheckoutSubmit}
        onPaymentMethodChange={setSelectedPaymentMethodId}
        token={auth.token}
      />
    )
  } else if (hash === '#/login') {
    activePage = 'auth'
    page = (
      <LoginPage
        onLoginSuccess={(user, token) => {
          auth.signIn(user, token)
          window.location.hash = defaultAuthenticatedRoute(user.roles)
        }}
      />
    )
  } else if (hash === '#/register') {
    activePage = 'auth'
    page = (
      <RegisterPage
        onRegisterSuccess={(user, token) => {
          auth.signIn(user, token)
        }}
      />
    )
  } else if (hash === '#/profile') {
    activePage = 'auth'
    page = (
      <ProfilePage
        token={auth.token}
        onNameChanged={(fullName, email) => auth.updateUser({ fullName, email })}
      />
    )
  } else if (hash === '#/admin' || hash === '#/admin/dashboard') {
    activePage = 'admin'
    page = (
      <AdminLayout active="dashboard" user={auth.user}>
        <AdminDashboardPage roles={auth.user?.roles ?? []} token={auth.token} />
      </AdminLayout>
    )
  } else if (hash === '#/admin/orders') {
    activePage = 'admin'
    page = (
      <AdminLayout active="orders" user={auth.user}>
        <AdminOrdersPage roles={auth.user?.roles ?? []} token={auth.token} />
      </AdminLayout>
    )
  } else if (hash === '#/admin/products') {
    activePage = 'admin'
    page = (
      <AdminLayout active="products" user={auth.user}>
        <AdminProductsPage
          brands={brands}
          categories={categories}
          roles={auth.user?.roles ?? []}
          token={auth.token}
        />
      </AdminLayout>
    )
  } else if (hash === '#/admin/inventory' || hash === '#/warehouse' || hash === '#/warehouse/inventory') {
    activePage = 'admin'
    page = (
      <WarehouseLayout active="inventory" user={auth.user}>
        <AdminInventoryPage roles={auth.user?.roles ?? []} token={auth.token} />
      </WarehouseLayout>
    )
  } else if (hash === '#/warehouse/deliveries') {
    activePage = 'admin'
    page = (
      <WarehouseLayout active="deliveries" user={auth.user}>
        <WarehouseDeliveriesPage roles={auth.user?.roles ?? []} token={auth.token} />
      </WarehouseLayout>
    )
  } else if (hash === '#/shipper') {
    activePage = 'admin'
    page = (
      <ShipperLayout user={auth.user}>
        <ShipperPage roles={auth.user?.roles ?? []} token={auth.token} />
      </ShipperLayout>
    )
  } else if (hash === '#/admin/promotions') {
    activePage = 'admin'
    page = (
      <AdminLayout active="promotions" user={auth.user}>
        <AdminPromotionsPage roles={auth.user?.roles ?? []} token={auth.token} />
      </AdminLayout>
    )
  } else if (hash === '#/admin/users') {
    activePage = 'admin'
    page = (
      <AdminLayout active="users" user={auth.user}>
        <AdminUsersPage
          currentUserId={auth.user?.userId ?? null}
          roles={auth.user?.roles ?? []}
          token={auth.token}
        />
      </AdminLayout>
    )
  } else if (hash === '#/admin/reports') {
    activePage = 'admin'
    page = (
      <AdminLayout active="reports" user={auth.user}>
        <AdminReportsPage roles={auth.user?.roles ?? []} token={auth.token} />
      </AdminLayout>
    )
  } else if (hash === '#/admin/reviews') {
    activePage = 'admin'
    page = (
      <AdminLayout active="reviews" user={auth.user}>
        <AdminReviewsPage roles={auth.user?.roles ?? []} token={auth.token} />
      </AdminLayout>
    )
  }

  return (
    <div className="site-shell">
      <Header
        activePage={activePage}
        cartCount={cart.cartCount}
        user={auth.user}
        onLogout={() => {
          auth.signOut()
          window.location.hash = '#/'
        }}
      />
      {page}
      <Footer />
    </div>
  )
}

export default App
