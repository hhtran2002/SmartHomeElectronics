import { ProductDetail } from '../components/ProductDetail'
import type { Product } from '../types'

type Props = {
  error: string
  loading: boolean
  product: Product | null
  onAddToCart: (product: Product) => void
  token: string
  onReviewSubmitted: () => void
}

export function ProductDetailPage({ error, loading, product, onAddToCart, token, onReviewSubmitted }: Props) {
  return (
    <ProductDetail
      error={error}
      loading={loading}
      product={product}
      onAddToCart={onAddToCart}
      token={token}
      onReviewSubmitted={onReviewSubmitted}
      onBack={() => {
        window.location.hash = '#/products'
      }}
    />
  )
}
