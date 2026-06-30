export function formatPrice(value: number | null | undefined) {
  return new Intl.NumberFormat('vi-VN').format(value ?? 0) + 'đ'
}
