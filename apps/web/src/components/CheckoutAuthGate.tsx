type Props = {
  selectedItemCount: number
}

export function CheckoutAuthGate({ selectedItemCount }: Props) {
  return (
    <main className="checkout-auth-page">
      <section className="checkout-auth-card">
        <span className="eyebrow">02 — Xác nhận tài khoản</span>
        <div className="checkout-auth-icon" aria-hidden="true">✓</div>
        <h1>Giỏ hàng của bạn đã sẵn sàng.</h1>
        <p>
          Để tiếp tục quá trình mua hàng, vui lòng đăng nhập hoặc tạo tài khoản.
          Các sản phẩm bạn đã chọn vẫn được giữ nguyên trong giỏ hàng.
        </p>
        <div className="checkout-auth-summary">
          <span>Sản phẩm đã chọn</span>
          <strong>{selectedItemCount}</strong>
        </div>
        <div className="checkout-auth-actions">
          <a className="checkout-auth-primary" href="#/checkout/login">Đăng nhập để tiếp tục</a>
          <a className="checkout-auth-secondary" href="#/checkout/register">Tạo tài khoản mới</a>
        </div>
        <a className="checkout-auth-back" href="#/cart">← Quay lại giỏ hàng</a>
      </section>
    </main>
  )
}
