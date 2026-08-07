# AA Smart – Website thương mại điện tử thiết bị nhà thông minh

> Một cửa hàng trực tuyến không chỉ cần bán được hàng, mà còn phải vận hành trọn vẹn từ lúc khách tìm kiếm đến khi đơn hàng được giao và đối soát.

## Tên đề tài

**Xây dựng website thương mại điện tử kinh doanh thiết bị điện tử gia dụng và nhà thông minh – AA Smart.**

## Thành viên và phân công

| Thành viên | Nhiệm vụ |
| --- | --- |
| **Đinh Văn Hưng** | **Trưởng nhóm:** phân tích yêu cầu, thiết kế kiến trúc và cơ sở dữ liệu, phát triển các chức năng chính, tích hợp và kiểm thử tổng thể. |
| Hứa Trung Kiên | Phát triển giao diện và hoàn thiện trải nghiệm, luồng mua hàng của khách hàng. |
| Nguyễn Đức Lộc | Xây dựng dữ liệu sản phẩm, tham gia phát triển chức năng giỏ hàng và đơn hàng. |
| Mai Vũ Tuấn Minh | Phân tích nghiệp vụ, xây dựng tài liệu và tổng hợp báo cáo của dự án. |
| Nguyễn Huỳnh Đăng Nguyên | Phụ trách các kịch bản phân quyền, quản lý kho và quy trình giao nhận. |
| Nguyễn Văn Hiệu | Rà soát dữ liệu, kiểm thử hệ thống và xây dựng nội dung thuyết trình. |

## Dự án là gì?

AA Smart là nền tảng thương mại điện tử tập trung vào việc **kinh doanh thiết bị điện tử gia dụng và sản phẩm nhà thông minh**. Khách hàng có thể khám phá sản phẩm, xem thông số, thêm vào giỏ hàng, áp dụng ưu đãi, đặt hàng, theo dõi giao hàng và đánh giá sau mua.

Phía sau trải nghiệm đó là hệ thống vận hành dành cho quản trị viên, nhân viên kho và nhân viên giao hàng. Đơn hàng được quản lý xuyên suốt từ xác nhận, giữ tồn kho, xuất kho, phân công giao nhận cho đến thu và đối soát COD.

## Bài toán và hướng giải quyết

### Pain – Vấn đề thực tế

- Quy trình bán hàng, quản lý tồn kho và giao nhận dễ bị rời rạc nếu xử lý thủ công.
- Khách hàng khó lựa chọn giữa nhiều sản phẩm có thông số và mức giá gần giống nhau.
- Nhân viên hỗ trợ phải trả lời lặp lại nhiều câu hỏi và không thể phản hồi liên tục.

### Solution – Hướng giải quyết

AA Smart kết nối toàn bộ quy trình bán hàng trong một hệ thống thống nhất: quản lý sản phẩm, khuyến mãi, giỏ hàng, đơn hàng, kho, vận chuyển, COD, đánh giá và báo cáo. Dữ liệu được cập nhật tập trung, đồng thời mỗi nhóm người dùng chỉ được truy cập đúng chức năng theo vai trò.

## Điểm nổi bật

- Quy trình thương mại điện tử tương đối đầy đủ cho cả khách hàng và bộ phận vận hành.
- Quản lý tồn kho, giữ hàng và xuất kho gắn trực tiếp với vòng đời đơn hàng.
- Theo dõi giao nhận, phương tiện, công nợ shipper và đối soát COD.
- Quản lý khuyến mãi, mã giảm giá, đánh giá và báo cáo kinh doanh.
- Phân quyền rõ ràng giữa khách hàng, quản trị viên, nhân viên kho và nhân viên giao hàng.

### Điểm nhấn: trợ lý AI

AI là tính năng hỗ trợ nổi bật, không thay thế nghiệp vụ bán hàng cốt lõi. Trợ lý sử dụng **Gemini AI kết hợp RAG và Qdrant** để hiểu nhu cầu bằng ngôn ngữ tự nhiên, tìm kiếm theo ngữ nghĩa, so sánh và tư vấn dựa trên dữ liệu sản phẩm thực tế của cửa hàng. Người dùng còn có thể gửi hình ảnh để tìm sản phẩm tương tự.

Nhờ đó, khách hàng đưa ra quyết định nhanh hơn, còn nhân viên support giảm được các câu hỏi lặp lại nhưng vẫn giữ quyền kiểm soát quy trình bán hàng.

## Đặc trưng của hệ thống

- Giao diện tiếng Việt, responsive và hướng đến trải nghiệm mua sắm dễ sử dụng.
- Kiến trúc tách biệt Web, API và cơ sở dữ liệu, thuận tiện bảo trì và mở rộng.
- Dữ liệu sản phẩm, tồn kho và trạng thái đơn hàng được quản lý tập trung.
- AI chỉ hoạt động trong phạm vi catalog, có giới hạn sử dụng, retry và model dự phòng.

## Công nghệ sử dụng

**React, TypeScript, Vite, Node.js/Express, SQL Server, Gemini AI và Qdrant.**
