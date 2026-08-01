# 15. Module hoàn tất đơn hàng và đối soát COD

> Cập nhật module 23: `OrderAdmin` không còn xác nhận `Shipping → Completed`. Shipper được phân công xác nhận tại `#/shipper`; transaction đồng thời chuyển shipment sang `Delivered`, đơn sang `Completed` và COD sang `Success`. Xem `docs/23-warehouse-shipper-delivery-workflow.md`.

Mục tiêu module này:

- Đơn chỉ được hoàn thành khi đang ở trạng thái giao hàng.
- COD khi giao thành công thì mới ghi nhận đã thanh toán.
- Thanh toán online phải thành công trước thì đơn mới được hoàn thành.

---

## 1. Trạng thái liên quan

```txt
OrderStatus
↓
Shipping = Đang giao hàng
Completed = Hoàn thành
```

```txt
PaymentStatus
↓
Pending = Chờ thanh toán
Success = Thanh toán thành công
```

```txt
PaymentMethod
↓
COD = Thanh toán khi nhận hàng
BANK_TRANSFER / CREDIT_CARD / VNPAY / MOMO = thanh toán trước / online
```

---

## 2. Luồng hoàn tất đơn COD

```txt
Admin mở trang Đơn hàng
↓
apps/web/src/pages/AdminOrdersPage.tsx
```

Admin chọn đơn đang giao:

```txt
OrderStatus = Shipping
PaymentMethod = COD
PaymentStatus = Pending
```

Admin đổi trạng thái sang Hoàn thành:

```txt
AdminOrdersPage.tsx
↓
changeStatus(orderStatusId)
↓
apps/web/src/api.ts
↓
updateAdminOrderStatus(orderId, orderStatusId, token)
↓
PATCH /api/admin/orders/:orderId/status
```

Backend nhận request:

```txt
apps/api/src/server.ts
↓
app.use('/api/admin/orders', adminOrdersRouter)
↓
apps/api/src/routes/adminOrders.ts
↓
adminOrdersRouter.patch('/:orderId/status', changeAdminOrderStatus)
↓
apps/api/src/controllers/adminOrderController.ts
↓
changeAdminOrderStatus()
↓
apps/api/src/services/adminOrderService.ts
↓
updateAdminOrderStatus({ orderId, orderStatusId })
```

Backend hỏi DB:

```txt
SalesOrder
↓
OrderStatus hiện tại là gì?
PaymentStatus hiện tại là gì?
```

```txt
Payment
↓
Đơn dùng phương thức thanh toán nào?
```

```txt
PaymentMethod
↓
MethodCode có phải COD không?
```

Điều kiện hợp lệ:

```txt
Current OrderStatus phải là Shipping
Target OrderStatus phải là Completed
PaymentMethod phải là COD
```

Backend cập nhật:

```txt
Payment
↓
PaymentStatusId = Success
TransactionCode = COD-{OrderCode}
PaidAt = thời gian hiện tại
```

Sau đó cập nhật:

```txt
SalesOrder
↓
OrderStatusId = Completed
PaymentStatusId = Success
UpdatedAt = thời gian hiện tại
```

Kết quả:

```txt
Đơn từ:
Shipping · COD · Pending

thành:
Completed · COD · Success
```

---

## 3. Vì sao COD không Success ngay từ lúc đặt hàng?

Vì COD là trả tiền sau:

```txt
Khách đặt hàng
↓
Chưa trả tiền
↓
PaymentStatus = Pending
```

Khi kho xuất hàng:

```txt
Hàng rời kho
↓
OrderStatus = Shipping
↓
Vẫn chưa chắc thu được tiền
```

Khi giao thành công:

```txt
Shipper thu tiền từ khách
↓
Admin xác nhận hoàn thành
↓
PaymentStatus = Success
```

Nói ngắn:

```txt
COD chỉ được tính là đã thanh toán khi giao hàng thành công.
```

---

## 4. Luồng hoàn tất đơn thanh toán online

Ví dụ:

```txt
BANK_TRANSFER
CREDIT_CARD
VNPAY
MOMO
```

Đơn online phải có tiền trước:

```txt
PaymentStatus = Success
```

Nếu admin cố hoàn tất khi chưa thanh toán:

```txt
AdminOrdersPage.tsx
↓
PATCH /api/admin/orders/:orderId/status
↓
adminOrders.ts kiểm tra
↓
PaymentMethod không phải COD
PaymentStatus chưa Success
↓
Backend từ chối
```

Lý do:

```txt
Không thể hoàn thành đơn thanh toán trước nếu cổng thanh toán/ngân hàng chưa xác nhận tiền về.
```

Luồng đúng:

```txt
Khách đặt đơn online
↓
OrderStatus = PendingPayment
PaymentStatus = Pending
↓
Webhook ngân hàng/cổng thanh toán xác nhận
↓
OrderStatus = Paid
PaymentStatus = Success
↓
Admin xử lý đơn
↓
ReadyToShip
↓
Kho xác nhận xuất
↓
Shipping
↓
Admin xác nhận giao thành công
↓
Completed
```

---

## 5. Điều kiện chặn sai nghiệp vụ

### Không cho hoàn tất nếu đơn chưa giao

```txt
Nếu CurrentStatus != Shipping
↓
Backend báo lỗi:
"Chỉ đơn đang giao hàng mới được xác nhận hoàn thành."
```

Vì:

```txt
PendingConfirmation / Processing / ReadyToShip
↓
Hàng chưa giao tới khách
↓
Không thể coi là hoàn thành
```

### Không cho hoàn tất đơn online nếu chưa paid

```txt
PaymentMethod != COD
PaymentStatus != Success
↓
Backend báo lỗi
```

Vì:

```txt
Online payment phải có xác nhận từ ngân hàng/cổng thanh toán trước.
```

### Không cho admin chuyển thẳng sang Shipping

Luồng này vẫn giữ nguyên:

```txt
AdminOrdersPage.tsx
↓
Nếu chọn Shipping thì backend chặn
```

Vì:

```txt
Shipping phải do nhân viên kho xác nhận xuất kho
↓
apps/web/src/admin/WarehouseReadyOrders.tsx
↓
apps/api/src/routes/adminInventory.ts
```

---

## 6. Tóm tắt toàn bộ vòng đời COD

```txt
Khách đặt COD
↓
PendingConfirmation · Payment Pending
↓
Admin xác nhận đơn
↓
ReadyToShip · Payment Pending
↓
Kho xuất hàng
↓
Shipping · Payment Pending
↓
Giao thành công
↓
Admin chuyển Completed
↓
Completed · Payment Success
```

---

## 7. Tóm tắt toàn bộ vòng đời online/QR/thẻ

```txt
Khách đặt online
↓
PendingPayment · Payment Pending
↓
Ngân hàng/cổng thanh toán xác nhận
↓
Paid · Payment Success
↓
Admin xử lý
↓
ReadyToShip
↓
Kho xuất hàng
↓
Shipping
↓
Giao thành công
↓
Completed · Payment Success
```
