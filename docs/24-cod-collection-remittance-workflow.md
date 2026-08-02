# Module 24 - Thu hộ và đối soát tiền COD của shipper

Tài liệu này giải thích đầy đủ đường đi từ thao tác trên giao diện đến API, service và các bảng database. Mục tiêu là có thể đọc tài liệu rồi tự lần theo code mà không cần đoán file nằm ở đâu.

---

## 1. Bài toán nghiệp vụ

Shipper của shop là nhân viên giao hàng hưởng lương/KPI. Hệ thống không dùng mô hình ví tài xế, ứng tiền trước hoặc trả hoa hồng theo giá trị đơn.

Hai dòng tiền cần phân biệt:

```txt
Khách → Shipper
COD Collection: shipper đã thu hộ

Shipper → Shop
COD Remittance: shipper nộp tiền đã thu về shop
```

Không dùng tên `CODPayout`, vì payout thường là hệ thống trả tiền cho đối tác. Trong dự án này, tiền đi theo chiều ngược lại.

---

## 2. Quy tắc cốt lõi

```txt
Đơn thanh toán trước giao thành công
→ không tạo công nợ COD
```

```txt
Đơn COD giao thành công
→ hệ thống mặc định shipper đã thu đủ Payment.Amount
→ tạo CodCollection = Outstanding
```

```txt
Shipper gửi phiếu nộp
→ CodRemittance = Submitted
→ công nợ chưa giảm
```

```txt
SystemAdmin kiểm đếm và xác nhận
→ CodRemittance = Confirmed
→ công nợ mới giảm
```

Shipper không có API tự xác nhận tiền đã về shop.

---

## 3. Các bảng database

Migration tạo schema:

```txt
database/026-cod-remittance-workflow.sql
```

### 3.1. `CodCollection`

Một dòng tương ứng một khoản tiền COD phát sinh từ một lần giao thành công.

| Cột | Ý nghĩa |
|---|---|
| `CodCollectionId` | Khóa chính |
| `PaymentId` | Payment COD đã Success |
| `ShipmentId` | Chuyến giao đã Delivered |
| `OrderId` | Đơn hàng liên quan |
| `DeliveryStaffId` | Shipper chịu trách nhiệm nộp |
| `CollectedAmount` | Số tiền đóng băng từ `Payment.Amount` |
| `CollectedAt` | Bằng thời điểm giao thành công |
| `Status` | Outstanding, PartiallyRemitted hoặc Settled |

Hai unique constraint:

```txt
UNIQUE(PaymentId)
UNIQUE(ShipmentId)
```

ngăn cùng một đơn/chuyến phát sinh công nợ hai lần.

### 3.2. `CodRemittance`

Đây là phần đầu phiếu nộp tiền.

| Cột | Ý nghĩa |
|---|---|
| `RemittanceCode` | Mã phiếu duy nhất |
| `DeliveryStaffId` | Người nộp |
| `DeclaredAmount` | Tổng tiền các item |
| `Method` | Cash hoặc BankTransfer |
| `Status` | Submitted, Confirmed, Rejected, Cancelled |
| `SubmittedByUserId/SubmittedAt` | Ai gửi và khi nào |
| `ReviewedByUserId/ReviewedAt` | Ai kiểm tra và khi nào |
| `ReferenceCode` | Mã giao dịch nếu chuyển khoản |
| `Note` | Ghi chú của shipper |
| `ReviewNote` | Ghi chú đối soát của admin |

### 3.3. `CodRemittanceItem`

Nối một phiếu với một hoặc nhiều khoản COD:

```txt
CodRemittance
├── CodCollection của đơn A: 14.000.000đ
├── CodCollection của đơn B: 8.000.000đ
└── CodCollection của đơn C: 6.000.000đ
```

Primary key kép:

```txt
(CodRemittanceId, CodCollectionId)
```

### 3.4. `CodRemittanceStatusHistory`

Mỗi lần submit, cancel, reject hoặc confirm đều thêm một dòng mới. Không ghi đè lịch sử cũ.

---

## 4. Công thức số dư

```txt
Đã thu
= SUM(CodCollection.CollectedAmount)
```

```txt
Shop đã nhận
= SUM(CodRemittanceItem.Amount)
   chỉ với CodRemittance.Status = Confirmed
```

```txt
Chờ xác nhận
= SUM(CodRemittanceItem.Amount)
   chỉ với CodRemittance.Status = Submitted
```

```txt
Còn phải nộp
= Đã thu - Shop đã nhận
```

```txt
Có thể tạo phiếu mới
= Đã thu - Shop đã nhận - Đang chờ xác nhận
```

Tiền trong phiếu `Submitted` vẫn nằm trong “Còn phải nộp”. Nó chỉ bị tạm loại khỏi “Có thể tạo phiếu mới” để chống gửi trùng.

---

## 5. Phát sinh công nợ khi giao COD

### Frontend

```txt
apps/web/src/shipper/ShipperPage.tsx
→ nút "Đã giao thành công"
→ completeShipperDelivery(shipmentId, token)
```

### HTTP client

```txt
apps/web/src/api.ts
→ POST /api/shipper/shipments/:shipmentId/delivered
```

### Backend

```txt
apps/api/src/server.ts
→ app.use('/api/shipper', shipperRouter)

apps/api/src/routes/shipper.ts
→ completeDelivery

apps/api/src/controllers/shipperController.ts
→ completeShipmentDelivery

apps/api/src/services/shipperService.ts
```

`completeShipmentDelivery` dùng một transaction để:

```txt
1. Khóa Shipment + SalesOrder + Payment
2. Kiểm tra shipper được phân công
3. Chuyển Shipment thành Delivered
4. Chuyển Payment COD thành Success
5. INSERT CodCollection = Outstanding
6. Chuyển SalesOrder thành Completed
7. Ghi ShipmentStatusHistory và OrderStatusHistory
8. Commit
```

Nếu bước 5 thất bại thì các bước trước cũng rollback, tránh đơn hoàn thành nhưng không có người chịu trách nhiệm tiền.

---

## 6. Trang tiền COD của shipper

URL:

```txt
#/shipper/cod
```

Component và layout:

```txt
apps/web/src/App.tsx
→ ShipperLayout active="cod"
→ apps/web/src/shipper/ShipperCodPage.tsx
```

### Load dữ liệu

```txt
ShipperCodPage.tsx
→ getShipperCodAccount(token)

apps/web/src/api.ts
→ GET /api/shipper/cod

apps/api/src/routes/shipper.ts
→ getMyCodSummary

apps/api/src/controllers/shipperController.ts
→ getMyCodAccount(userId)

apps/api/src/services/codRemittanceService.ts
→ query summary + collections + remittances
```

Shipper chỉ nhìn thấy dữ liệu có:

```txt
CodCollection.DeliveryStaffId = token.userId
```

### Tạo phiếu

```txt
Shipper chọn các đơn còn availableToSubmit > 0
→ chọn Tiền mặt hoặc Chuyển khoản
→ POST /api/shipper/cod/remittances
```

Service chạy transaction mức `SERIALIZABLE`, khóa collection và item rồi tính lại số dư. Không tin số tiền do frontend gửi lên; backend tự tính số tiền từ database.

Với chuyển khoản, `ReferenceCode` là bắt buộc.

### Hủy phiếu

```txt
POST /api/shipper/cod/remittances/:id/cancel
```

Chỉ phiếu của chính shipper và đang `Submitted` mới hủy được. Sau khi hủy, số tiền trở lại danh sách có thể tạo phiếu.

---

## 7. Trang đối soát của admin

URL:

```txt
#/admin/cod-remittances
```

Chỉ `SystemAdmin` được truy cập API.

```txt
apps/web/src/App.tsx
→ AdminLayout active="cod"
→ apps/web/src/admin/AdminCodRemittancesPage.tsx
```

### Load tổng quan

```txt
AdminCodRemittancesPage.tsx
→ getAdminCodOverview(filters, token)

apps/web/src/api.ts
→ GET /api/admin/cod-remittances

apps/api/src/server.ts
→ /api/admin/cod-remittances

apps/api/src/routes/adminCodRemittances.ts
→ requireRoles(['SystemAdmin'])

apps/api/src/controllers/adminCodRemittanceController.ts
→ getAdminCodOverview(filters)

apps/api/src/services/codRemittanceService.ts
```

Bộ lọc hỗ trợ shipper, trạng thái phiếu, từ ngày và đến ngày.

### Xác nhận

```txt
POST /api/admin/cod-remittances/:id/confirm
```

Transaction:

```txt
1. Khóa phiếu và bắt buộc Status = Submitted
2. Kiểm tra tổng item = DeclaredAmount
3. Kiểm tra tổng confirmed không vượt CollectedAmount
4. Phiếu → Confirmed
5. Ghi reviewer + ReviewedAt
6. Cập nhật collection → PartiallyRemitted hoặc Settled
7. Ghi status history
8. Commit
```

### Từ chối

```txt
POST /api/admin/cod-remittances/:id/reject
```

Lý do là bắt buộc. Phiếu thành `Rejected`, nhưng công nợ không giảm và shipper có thể tạo phiếu mới.

---

## 8. Trạng thái và chuyển trạng thái

```txt
CodRemittance = Submitted
        ├── shipper hủy → Cancelled
        ├── admin từ chối → Rejected
        └── admin xác nhận → Confirmed
```

`Confirmed`, `Rejected` và `Cancelled` là trạng thái cuối. API không cho xác nhận lại hoặc thay đổi lần hai.

---

## 9. Bảo vệ dữ liệu tiền

- Frontend không gửi số tiền khai báo tùy ý; service tự tính.
- `SERIALIZABLE` cùng `UPDLOCK/HOLDLOCK` chặn hai request tạo phiếu đồng thời cho cùng một số dư.
- Shipper không truy cập được endpoint confirm/reject của admin.
- Phiếu `Submitted` không giảm công nợ.
- Unique `PaymentId` và `ShipmentId` chặn tạo collection hai lần.
- Mọi thay đổi phiếu có audit user, thời gian và ghi chú.
- Tiền COD đóng băng theo `Payment.Amount`; sửa giá đơn về sau không đổi trách nhiệm đã phát sinh.

---

## 10. Dữ liệu cũ

Các shipment cũ được backfill ở migration 025 không có `DeliveryStaffId`. Migration 026 không tự đoán shipper và không tạo công nợ giả.

Luồng đối soát áp dụng cho đơn COD được giao thành công sau khi chức năng này được triển khai.

---

## 11. Danh sách file

```txt
database/026-cod-remittance-workflow.sql

apps/api/src/services/codRemittanceService.ts
apps/api/src/controllers/adminCodRemittanceController.ts
apps/api/src/routes/adminCodRemittances.ts
apps/api/src/services/shipperService.ts
apps/api/src/controllers/shipperController.ts
apps/api/src/routes/shipper.ts
apps/api/src/server.ts

apps/web/src/shipper/ShipperCodPage.tsx
apps/web/src/shipper/ShipperLayout.tsx
apps/web/src/admin/AdminCodRemittancesPage.tsx
apps/web/src/admin/AdminLayout.tsx
apps/web/src/api.ts
apps/web/src/types.ts
apps/web/src/App.tsx
apps/web/src/App.css
```

---

## 12. Checklist kiểm thử

### COD giao thành công

```txt
1. Payment trước giao = Pending
2. Shipper bấm giao thành công
3. Payment = Success
4. Shipment = Delivered
5. SalesOrder = Completed
6. Có một CodCollection = Outstanding
7. CollectedAmount = Payment.Amount
8. DeliveryStaffId đúng shipper được phân công
```

### Phiếu nộp

```txt
1. Shipper chọn collection
2. Tạo phiếu Submitted
3. Kiểm tra outstanding chưa giảm
4. Kiểm tra không thể submit trùng
5. Admin xác nhận
6. Kiểm tra remitted tăng và outstanding giảm
7. Kiểm tra collection Settled khi đủ tiền
8. Kiểm tra history có Submitted + Confirmed
```

### Hủy và từ chối

```txt
1. Shipper hủy phiếu Submitted
2. Collection chọn lại được
3. Admin từ chối phiếu khác với lý do
4. Công nợ vẫn giữ nguyên
5. Collection chọn lại được
```

### Thanh toán trước

```txt
1. Payment online đã Success
2. Giao thành công
3. Shipment Delivered, SalesOrder Completed
4. Không tạo CodCollection
```
