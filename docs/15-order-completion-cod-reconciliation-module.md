# 15. Hoàn tất đơn hàng và ý nghĩa thanh toán COD

> Tài liệu này mô tả trạng thái đơn/thanh toán. Phần tiền COD shipper phải nộp được trình bày đầy đủ tại `docs/24-cod-collection-remittance-workflow.md`.

## 1. Ba trạng thái không được trộn lẫn

Một đơn COD giao thành công liên quan đến ba sự kiện khác nhau:

```txt
Shipment = Delivered
→ Khách đã nhận kiện

Payment = Success
→ Khách đã trả tiền cho shipper

CodCollection = Settled
→ Shop đã xác nhận nhận lại đủ tiền từ shipper
```

`Payment = Success` không có nghĩa là tiền mặt đã nằm trong quỹ của shop.

---

## 2. Ai được hoàn tất đơn?

`OrderAdmin` không được chuyển trực tiếp `Shipping → Completed`.

Người được phân công trên `Shipment.DeliveryStaffId` đăng nhập trang:

```txt
#/shipper
```

và bấm:

```txt
Đã giao thành công
```

Frontend:

```txt
apps/web/src/shipper/ShipperPage.tsx
→ completeShipperDelivery(shipmentId, token)
```

HTTP client:

```txt
apps/web/src/api.ts
→ POST /api/shipper/shipments/:shipmentId/delivered
```

Backend:

```txt
apps/api/src/server.ts
→ app.use('/api/shipper', shipperRouter)

apps/api/src/routes/shipper.ts
→ POST /shipments/:shipmentId/delivered

apps/api/src/controllers/shipperController.ts
→ completeDelivery(...)

apps/api/src/services/shipperService.ts
→ completeShipmentDelivery(...)
```

---

## 3. Điều kiện trước khi hoàn tất

Transaction khóa `Shipment`, `SalesOrder` và `Payment`, sau đó kiểm tra:

```txt
Shipment.ShippingStatus = Shipping
SalesOrder.OrderStatus = Shipping
Shipment.DeliveryStaffId = user đang thao tác
```

Riêng đơn thanh toán trước:

```txt
Payment.MethodCode != COD
Payment.StatusCode bắt buộc = Success
```

Nếu thanh toán online chưa thành công thì shipper không thể hoàn tất đơn.

---

## 4. Transaction của đơn COD

Khi đơn COD hợp lệ được đánh dấu giao thành công:

```txt
Shipment
  ShippingStatus = Delivered
  DeliveredAt = thời điểm hiện tại

Payment
  PaymentStatus = Success
  PaidAt = Shipment.DeliveredAt
  TransactionCode = COD-{OrderCode}

CodCollection
  PaymentId = payment vừa thành công
  ShipmentId = chuyến vừa giao
  DeliveryStaffId = shipper được phân công
  CollectedAmount = Payment.Amount
  Status = Outstanding

SalesOrder
  OrderStatus = Completed
  PaymentStatus = Success
```

Tất cả nằm trong một database transaction. Nếu không tạo được `CodCollection`, toàn bộ việc hoàn tất đơn cũng rollback.

---

## 5. Transaction của đơn thanh toán trước

```txt
Payment đã Success từ trước
        ↓
Shipper giao thành công
        ↓
Shipment = Delivered
SalesOrder = Completed
        ↓
Không tạo CodCollection
```

Shipper không thu và không phải nộp tiền cho đơn này.

---

## 6. Vì sao COD tạo công nợ ngay?

Theo quy tắc nghiệp vụ của dự án:

```txt
Shipper bấm giao thành công
→ hệ thống mặc định khách đã trả đủ Payment.Amount
```

Hệ thống không cố đoán shipper có quên thu, thu thiếu hay làm rơi tiền hay không. Shipper đã xác nhận giao thành công thì chịu trách nhiệm nộp đủ số được chụp trong `CodCollection.CollectedAmount`.

---

## 7. Trường tiền dùng để làm gì?

| Trường | Ý nghĩa |
|---|---|
| `Payment.Amount` | Tổng khách phải trả, bao gồm phí giao nếu có |
| `Payment.PaidAt` | Lúc khách trả cho shipper đối với COD |
| `CodCollection.CollectedAmount` | Số tiền đóng băng thành trách nhiệm của shipper |
| Tổng remittance `Confirmed` | Tiền shop đã thực nhận |
| Công nợ COD | CollectedAmount trừ tổng đã Confirmed |

---

## 8. Checklist

### COD

```txt
1. Payment đang Pending
2. Shipment đang Shipping và có DeliveryStaffId
3. Shipper bấm giao thành công
4. Payment thành Success
5. Shipment thành Delivered
6. SalesOrder thành Completed
7. Có đúng một CodCollection
8. CodCollection đúng Payment.Amount và đúng DeliveryStaffId
```

### Thanh toán trước

```txt
1. Payment đã Success
2. Shipper bấm giao thành công
3. Shipment thành Delivered
4. SalesOrder thành Completed
5. Không có CodCollection
```
