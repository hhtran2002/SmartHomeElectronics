import { useCallback, useEffect, useState } from 'react'
import {
  addAdminProductImage,
  deleteAdminProductImage,
  getAdminProductImages,
  setAdminProductPrimaryImage,
} from '../api'
import type { AdminProductImage } from '../types'

type Props = {
  productId: number
  token: string
  onChanged: () => void
}

export function AdminProductImages({ productId, token, onChanged }: Props) {
  const [error, setError] = useState('')
  const [imageUrls, setImageUrls] = useState('')
  const [images, setImages] = useState<AdminProductImage[]>([])
  const [loading, setLoading] = useState(true)

  const loadImages = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const payload = await getAdminProductImages(productId, token)
      setImages(payload.data)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không tải được ảnh sản phẩm.')
    } finally {
      setLoading(false)
    }
  }, [productId, token])

  useEffect(() => {
    void loadImages()
  }, [loadImages])

  async function addImages() {
    const urls = imageUrls
      .split('\n')
      .map((url) => url.trim())
      .filter(Boolean)

    if (urls.length === 0) return
    setError('')

    try {
      for (const url of urls) {
        await addAdminProductImage(productId, url, token)
      }
      setImageUrls('')
      await loadImages()
      onChanged()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không thêm được ảnh.')
    }
  }

  async function makePrimary(imageId: number) {
    setError('')
    try {
      await setAdminProductPrimaryImage(productId, imageId, token)
      await loadImages()
      onChanged()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không chọn được ảnh chính.')
    }
  }

  async function removeImage(imageId: number) {
    setError('')
    try {
      await deleteAdminProductImage(productId, imageId, token)
      await loadImages()
      onChanged()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không xóa được ảnh.')
    }
  }

  return (
    <section className="admin-image-manager">
      <span className="eyebrow">Thư viện ảnh</span>
      <h3>Ảnh sản phẩm</h3>
      <p className="form-hint">Có thể dán nhiều URL, mỗi dòng là một ảnh. Ảnh chính sẽ làm thumbnail.</p>

      <div className="image-add-row stacked">
        <textarea
          placeholder={'Dán URL ảnh mới\nMỗi dòng một ảnh'}
          value={imageUrls}
          onChange={(event) => setImageUrls(event.target.value)}
        />
        <button type="button" onClick={() => void addImages()}>Thêm ảnh</button>
      </div>

      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p className="form-hint">Đang tải ảnh...</p>
      ) : images.length === 0 ? (
        <p className="form-hint">Sản phẩm chưa có ảnh.</p>
      ) : (
        <div className="admin-image-list">
          {images.map((image) => (
            <div key={image.imageId}>
              <img src={image.imageUrl} alt={image.altText ?? 'Ảnh sản phẩm'} />
              <small>{image.isPrimary ? 'Ảnh chính' : `Thứ tự ${image.sortOrder}`}</small>
              <button type="button" disabled={image.isPrimary} onClick={() => void makePrimary(image.imageId)}>
                Làm chính
              </button>
              <button type="button" onClick={() => void removeImage(image.imageId)}>Xóa</button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
