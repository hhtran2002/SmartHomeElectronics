import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { getCustomerAddresses, getProvinces, getWards } from '../api'
import type {
  AdministrativeProvince,
  AdministrativeWard,
  CartItem,
  CustomerAddress,
  OrderResponse,
  PaymentMethod,
} from '../types'
import { formatPrice } from '../utils'
import '../pages/CommerceFlow.css'

type CheckoutForm = {
  customerName: string
  phone: string
  email: string
  province: string
  district: string
  ward: string
  streetAddress: string
  note: string
  couponCode: string
}

type Props = {
  checkoutError: string
  checkoutForm: CheckoutForm
  checkoutLoading: boolean
  createdOrder: OrderResponse['data'] | null
  items: CartItem[]
  paymentMethods: PaymentMethod[]
  selectedPaymentMethodId: number
  token: string
  onBackToCart: () => void
  onBackToProducts: () => void
  onCheckoutChange: (patch: Partial<CheckoutForm>) => void
  onCheckoutSubmit: (event: FormEvent) => void
  onPaymentMethodChange: (paymentMethodId: number) => void
}

export function CheckoutPage(props: Props) {
  const {
    checkoutError,
    checkoutForm,
    checkoutLoading,
    createdOrder,
    items,
    paymentMethods,
    selectedPaymentMethodId,
    token,
    onBackToCart,
    onBackToProducts,
    onCheckoutChange,
    onCheckoutSubmit,
    onPaymentMethodChange,
  } = props

  const [addresses, setAddresses] = useState<CustomerAddress[]>([])
  const [provinces, setProvinces] = useState<AdministrativeProvince[]>([])
  const [wards, setWards] = useState<AdministrativeWard[]>([])
  const [selectedProvinceCode, setSelectedProvinceCode] = useState('')
  const [selectedWardCode, setSelectedWardCode] = useState('')
  const [selectedAddressId, setSelectedAddressId] = useState(0)
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const shippingFee = subtotal >= 5_000_000 || subtotal === 0 ? 0 : 40_000
  const selectedPaymentMethod = paymentMethods.find((method) => method.paymentMethodId === selectedPaymentMethodId)

  useEffect(() => {
    void getProvinces().then((payload) => setProvinces(payload.data)).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!selectedProvinceCode) {
      setWards([])
      return
    }

    void getWards(selectedProvinceCode).then((payload) => setWards(payload.data)).catch(() => setWards([]))
  }, [selectedProvinceCode])

  useEffect(() => {
    if (!token) return

    void getCustomerAddresses(token).then(({ data }) => {
      setAddresses(data)
      const selected = data.find((address) => address.isDefault) ?? data[0]
      if (selected) {
        setSelectedProvinceCode(selected.provinceCode ?? '')
        setSelectedWardCode(selected.wardCode ?? '')
        chooseAddress(selected, onCheckoutChange, setSelectedAddressId)
      }
    }).catch(() => undefined)
    // Loading saved addresses only needs to rerun when the authenticated account changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  function chooseProvince(provinceCode: string) {
    const province = provinces.find((item) => item.provinceCode === provinceCode)
    setSelectedProvinceCode(provinceCode)
    setSelectedWardCode('')
    onCheckoutChange({ province: province?.provinceName ?? '', district: '', ward: '' })
  }

  function chooseWard(wardCode: string) {
    const ward = wards.find((item) => item.wardCode === wardCode)
    setSelectedWardCode(wardCode)
    onCheckoutChange({ ward: ward?.wardName ?? '', district: '' })
  }

  return (
    <main className="checkout-page commerce-flow-page">
      <section className="section-heading flow-intro checkout-intro">
        <div>
          <span className="eyebrow">02 — Thanh toán</span>
          <h1>Giao hàng<br />đến đâu?</h1>
          <p>Xác nhận người nhận, địa chỉ và phương thức thanh toán phù hợp.</p>
        </div>
        {!createdOrder && <button className="flow-text-button" onClick={onBackToCart}>← Quay lại giỏ hàng</button>}
      </section>

      {createdOrder ? (
        <div className="status-card success-card">
          <h3>Đặt hàng thành công</h3>
          <p>Mã đơn: {createdOrder.orderCode} · Tổng tiền: {formatPrice(createdOrder.totalAmount)}</p>
          <p>{createdOrder.paymentInstruction}</p>
          {createdOrder.paymentQrUrl && (
            <div className="bank-payment-result">
              <img src={createdOrder.paymentQrUrl} alt={`QR chuyển khoản đơn ${createdOrder.orderCode}`} />
              <strong>Quét QR đúng số tiền và giữ nguyên nội dung {createdOrder.orderCode}</strong>
              <small>Đơn hàng sẽ ở trạng thái chờ thanh toán cho tới khi admin kiểm tra tài khoản ngân hàng.</small>
            </div>
          )}
          {createdOrder.paymentMethodCode === 'BANK_TRANSFER' && !createdOrder.paymentQrUrl && (
            <p className="form-error">Chưa cấu hình tài khoản nhận tiền. Admin cần điền BANK_CODE, BANK_ACCOUNT_NUMBER và BANK_ACCOUNT_NAME trong file .env.</p>
          )}
          <button onClick={onBackToProducts}>Tiếp tục mua sắm</button>
        </div>
      ) : items.length === 0 ? (
        <div className="status-card cart-empty">
          <h3>Chưa có sản phẩm trong giỏ</h3>
          <button onClick={onBackToProducts}>Xem sản phẩm</button>
        </div>
      ) : (
        <section className="checkout-layout">
          <form className="checkout-form" onSubmit={onCheckoutSubmit}>
            <div className="checkout-form-heading"><span>01</span><div><small>Thông tin nhận hàng</small><h3>Người nhận</h3></div></div>

            {addresses.length > 0 && (
              <label>Chọn địa chỉ đã lưu
                <select value={selectedAddressId} onChange={(event) => {
                  const address = addresses.find((item) => item.addressId === Number(event.target.value))
                  if (address) {
                    setSelectedProvinceCode(address.provinceCode ?? '')
                    setSelectedWardCode(address.wardCode ?? '')
                    chooseAddress(address, onCheckoutChange, setSelectedAddressId)
                  }
                }}>
                  {addresses.map((address) => (
                    <option key={address.addressId} value={address.addressId}>
                      {address.isDefault ? '[Mặc định] ' : ''}{address.receiverName} — {address.streetAddress}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {token && addresses.length === 0 && (
              <p className="form-hint">Bạn chưa lưu địa chỉ. Có thể nhập bên dưới hoặc thêm tại trang Hồ sơ.</p>
            )}

            <div className="checkout-grid">
              <Field label="Họ tên người nhận" value={checkoutForm.customerName} onChange={(customerName) => onCheckoutChange({ customerName })} />
              <Field label="Số điện thoại" value={checkoutForm.phone} onChange={(phone) => onCheckoutChange({ phone })} />
              <Field label="Email" type="email" value={checkoutForm.email} required={false} onChange={(email) => onCheckoutChange({ email })} />
              <label>Tỉnh / Thành phố
                <select required value={selectedProvinceCode} onChange={(event) => chooseProvince(event.target.value)}>
                  <option value="">Chọn tỉnh/thành</option>
                  {provinces.map((province) => <option key={province.provinceCode} value={province.provinceCode}>{province.provinceName}</option>)}
                </select>
              </label>
              <label>Xã / Phường
                <select required disabled={!selectedProvinceCode} value={selectedWardCode} onChange={(event) => chooseWard(event.target.value)}>
                  <option value="">Chọn xã/phường</option>
                  {wards.map((ward) => <option key={ward.wardCode} value={ward.wardCode}>{ward.wardName}</option>)}
                </select>
              </label>
            </div>

            <Field label="Địa chỉ cụ thể" value={checkoutForm.streetAddress} onChange={(streetAddress) => onCheckoutChange({ streetAddress })} />
            <label>Ghi chú<textarea value={checkoutForm.note} onChange={(event) => onCheckoutChange({ note: event.target.value })} /></label>

            <section className="payment-methods">
              <div className="checkout-form-heading"><span>02</span><div><small>Ưu đãi</small><h3>Mã giảm giá</h3></div></div>
              <Field
                label="Mã coupon"
                required={false}
                value={checkoutForm.couponCode}
                onChange={(couponCode) => onCheckoutChange({ couponCode: couponCode.toUpperCase() })}
              />
              <p className="form-hint">Backend sẽ kiểm tra thời hạn, lượt dùng, đơn tối thiểu và sản phẩm áp dụng khi bấm đặt hàng.</p>
            </section>

            <section className="payment-methods">
              <div className="checkout-form-heading"><span>03</span><div><small>Thanh toán</small><h3>Phương thức thanh toán</h3></div></div>
              <div className="payment-method-list">
                {paymentMethods.map((method) => (
                  <label className={method.paymentMethodId === selectedPaymentMethodId ? 'active' : ''} key={method.paymentMethodId}>
                    <input
                      checked={method.paymentMethodId === selectedPaymentMethodId}
                      name="paymentMethod"
                      type="radio"
                      value={method.paymentMethodId}
                      onChange={() => onPaymentMethodChange(method.paymentMethodId)}
                    />
                    <span>
                      <strong>{method.methodName}</strong>
                      <small>{describePaymentMethod(method.methodCode)}</small>
                    </span>
                  </label>
                ))}
              </div>
              {selectedPaymentMethod && (
                <p className="form-hint">{describeSelectedPayment(selectedPaymentMethod.methodCode)}</p>
              )}
            </section>

            {checkoutError && <p className="form-error">{checkoutError}</p>}
            <button disabled={checkoutLoading}>{checkoutLoading ? 'Đang tạo đơn...' : 'Đặt hàng'}</button>
          </form>

          <aside className="cart-summary">
            <span className="summary-kicker">Đơn hàng của bạn</span>
            <h3>Tóm tắt</h3>
            {items.map((item) => <div key={item.skuId}><span>{item.skuCode} × {item.quantity}</span><strong>{formatPrice(item.price * item.quantity)}</strong></div>)}
            <div><span>Tạm tính</span><strong>{formatPrice(subtotal)}</strong></div>
            <div><span>Phí giao hàng</span><strong>{formatPrice(shippingFee)}</strong></div>
            <div><span>Thanh toán</span><strong>{selectedPaymentMethod?.methodName ?? 'Đang tải'}</strong></div>
            <div><span>Tổng thanh toán</span><strong>{formatPrice(subtotal + shippingFee)}</strong></div>
          </aside>
        </section>
      )}
    </main>
  )
}

function chooseAddress(address: CustomerAddress, change: Props['onCheckoutChange'], select: (id: number) => void) {
  select(address.addressId)
  change({
    customerName: address.receiverName,
    phone: address.receiverPhone,
    province: address.province,
    district: address.district,
    ward: address.ward,
    streetAddress: address.streetAddress,
  })
}

function describePaymentMethod(methodCode: string) {
  if (methodCode === 'COD') return 'Thanh toán tiền mặt khi nhận hàng.'
  if (methodCode === 'BANK_TRANSFER') return 'Quét VietQR để chuyển khoản, sau đó admin kiểm tra tài khoản và xác nhận.'
  return 'Phương thức thanh toán không được hỗ trợ.'
}

function describeSelectedPayment(methodCode: string) {
  if (methodCode === 'COD') return 'Đơn được xử lý ngay. Khi giao xong, admin xác nhận đơn hoàn thành và đã thu tiền.'
  if (methodCode === 'BANK_TRANSFER') return 'Đơn ở trạng thái chờ thanh toán. Admin đối chiếu đúng số tiền và nội dung rồi xác nhận thủ công.'
  return 'Phương thức thanh toán không được hỗ trợ.'
}

function Field({ label, value, onChange, type = 'text', required = true }: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  required?: boolean
}) {
  return <label>{label}<input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>
}
