# Module 12 - Nhân viên kho xác nhận xuất đơn hàng

> Đây là nền tảng xuất kho ban đầu. Luồng hiện hành đã có bước phân công shipper/xe tại `docs/23-warehouse-shipper-delivery-workflow.md`; nút bàn giao đồng thời cập nhật phiếu xuất, tồn kho, giá vốn, shipment và order trong cùng transaction.

Module này tách trách nhiệm giữa bộ phận đơn hàng và bộ phận kho.

```txt
OrderAdmin
↓
Xử lý đơn và đưa đơn tới ReadyToShip
```

```txt
WarehouseStaff
↓
Kiểm hàng, xác nhận hàng rời kho, tạo phiếu xuất
```

---

## 1. Luồng chuẩn trước khi kho xuất

```txt
OrderAdmin mở trang Đơn hàng
↓
apps/web/src/pages/AdminOrdersPage.tsx
↓
Chuyển đơn sang "Sẵn sàng giao/xuất kho"
StatusCode = ReadyToShip
↓
PATCH /api/admin/orders/:orderId/status
↓
apps/api/src/routes/adminOrders.ts
↓
apps/api/src/controllers/adminOrderController.ts
↓
apps/api/src/services/adminOrderService.ts
↓
Chỉ đổi trạng thái đơn
Chưa trừ kho
```

Lý do chưa trừ kho:

```txt
ReadyToShip = đơn đã sẵn sàng để kho xử lý
Nhưng hàng chưa rời kho
```

---

## 2. Kho load danh sách đơn chờ xuất

Frontend:

```txt
WarehouseStaff mở trang Kho hàng
↓
apps/web/src/admin/AdminInventoryPage.tsx
↓
apps/web/src/admin/WarehouseReadyOrders.tsx
↓
getWarehouseReadyOrders(token)
↓
GET /api/admin/inventory/ready-orders
```

Backend:

```txt
apps/api/src/server.ts
↓
app.use('/api/admin/inventory', adminInventoryRouter)
↓
apps/api/src/routes/adminInventory.ts
↓
adminInventoryRouter.get('/ready-orders', listReadyOrdersForExport)
↓
apps/api/src/controllers/adminInventoryController.ts
↓
listReadyOrdersForExport()
↓
apps/api/src/services/adminInventoryService.ts
↓
getReadyOrdersForExport()
```

Service hỏi DB:

```txt
SalesOrder
OrderStatus
SalesOrderDetail
OrderInventoryReservation
Inventory
Warehouse
```

Điều kiện:

```txt
OrderStatus = ReadyToShip
OrderInventoryReservation.QuantityReserved > QuantityFulfilled
```

Frontend hiển thị:

```txt
Đơn nào cần xuất
SKU nào cần lấy
Số lượng bao nhiêu
Lấy ở kho nào
```

---

## 3. Kho xác nhận xuất

```txt
Nhân viên kho bấm "Xác nhận xuất kho"
↓
apps/web/src/admin/WarehouseReadyOrders.tsx
↓
confirmExport(orderId)
↓
apps/web/src/api.ts
↓
confirmWarehouseOrderExport(orderId, token)
↓
POST /api/admin/inventory/ready-orders/:orderId/confirm-export
```

Backend:

```txt
apps/api/src/routes/adminInventory.ts
↓
adminInventoryRouter.post('/ready-orders/:orderId/confirm-export', confirmReadyOrderExport)
↓
apps/api/src/controllers/adminInventoryController.ts
↓
confirmReadyOrderExport()
↓
Validate orderId
↓
apps/api/src/services/adminInventoryService.ts
↓
confirmOrderExport(orderId, userId)
```

Service mở transaction:

```txt
BEGIN TRANSACTION
```

Service kiểm tra:

```txt
Đơn tồn tại
↓
OrderStatus phải là ReadyToShip
↓
Chưa có StockOutReceipt Confirmed cho đơn này
↓
Còn OrderInventoryReservation đang giữ hàng
```

Nếu không hợp lệ:

```txt
ROLLBACK
↓
Trả lỗi
```

---

## 4. Service trừ kho như thế nào?

Với từng dòng hàng đang giữ:

```txt
OrderInventoryReservation
↓
Tìm InventoryId đã giữ từ lúc checkout
```

Sau đó:

```txt
Tạo StockOutReceipt theo từng Warehouse
↓
Tạo StockOutReceiptDetail
↓
Inventory.QuantityOnHand -= quantity
↓
Inventory.QuantityReserved -= quantity
↓
OrderInventoryReservation.QuantityFulfilled += quantity
↓
Tạo StockMovement OUT
```

Ý nghĩa:

```txt
QuantityOnHand giảm vì hàng đã rời kho thật
QuantityReserved giảm vì hàng không còn chỉ là "đang giữ"
QuantityFulfilled tăng để biết reservation này đã được xử lý
```

---

## 5. Sau khi xuất thành công

Service cập nhật đơn:

```txt
SalesOrder.OrderStatus = Shipping
SalesOrder.UpdatedAt = now
```

Commit:

```txt
COMMIT
```

Backend trả:

```txt
{
  orderId,
  orderCode,
  receiptIds
}
```

Frontend:

```txt
WarehouseReadyOrders reload danh sách
↓
Đơn vừa xuất không còn trong danh sách ReadyToShip
```

---

## 6. Vì sao OrderAdmin không được chọn Shipping?

Trong frontend:

```txt
apps/web/src/pages/AdminOrdersPage.tsx
↓
Option Shipping bị disable
```

Trong backend:

```txt
apps/api/src/services/adminOrderService.ts
↓
Nếu targetStatusCode = Shipping
↓
Throw error
```

Lý do:

```txt
Shipping nghĩa là hàng đã rời kho
↓
Chỉ kho mới được xác nhận điều này
↓
Vì kho phải tạo phiếu xuất và trừ tồn vật lý
```

---

## 7. Tóm tắt nhanh

```txt
OrderAdmin
↓
ReadyToShip
↓
WarehouseStaff
↓
GET /api/admin/inventory/ready-orders
↓
routes/adminInventory.ts
↓
controllers/adminInventoryController.ts
↓
services/adminInventoryService.ts
↓
confirmOrderExport()
↓
StockOutReceipt
↓
StockOutReceiptDetail
↓
Inventory trừ QuantityOnHand và QuantityReserved
↓
OrderInventoryReservation tăng QuantityFulfilled
↓
StockMovement OUT
↓
SalesOrder chuyển Shipping
```
