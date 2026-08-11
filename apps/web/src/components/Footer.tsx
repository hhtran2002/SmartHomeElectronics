// export function Footer() {
//   return (
//     <footer>
//       <div className="brand">
//         <span className="brand-mark">⚡</span>
//         <span><strong>AA Smart</strong><small>Smart Home Electronics</small></span>
//       </div>
//       <p>Đồ án thương mại điện tử hàng điện tử gia dụng thông minh.</p>
//     </footer>
//   )
// }
const logoUrl =
  'https://res.cloudinary.com/dywqgsjss/image/upload/e_trim:10,f_auto,q_auto/v1783623432/2f7cba59-c005-42fd-813f-3efef503409a_tdqvk7.png'

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-about">
          <a className="footer-logo" href="#/">
            <img src={logoUrl} alt="AA Smart" />
          </a>
          <p>
            Cửa hàng thiết bị điện tử gia dụng thông minh, mang đến trải nghiệm tiện lợi,
            nhanh chóng và an toàn.
          </p>
        </div>

        <div className="footer-column footer-home-link">
          <a href="#/">Trang chủ</a>
        </div>

        <div className="footer-column">
          <h4>Liên hệ</h4>
          <p>Hotline: 1900 8888</p>
          <p>Email: support@aasmart.vn</p>
          <p>Thời gian: 8:00 - 21:00</p>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© 2026 AA Smart. </span>
      </div>
    </footer>
  )
}
