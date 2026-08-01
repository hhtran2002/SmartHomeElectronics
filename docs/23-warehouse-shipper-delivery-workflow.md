# Module 23 - Phân công shipper, bàn giao kho và giao hàng

Tài liệu này dùng để học luồng chạy thật của chức năng. Mỗi phần đều trả lời bốn câu hỏi:

1. Người dùng thao tác ở component nào?
2. Hàm frontend nào gửi HTTP request?
3. Route, controller và service backend nào nhận request?
4. Transaction thay đổi bảng và trạng thái nào?

---

## 1. Phạm vi và trách nhiệm

Đây là cửa hàng tự quản lý kho và tự giao hàng, không phải hệ thống logistics nhiều hub.

| Vai trò | Trách nhiệm |
|---|---|
| `OrderAdmin` | Xử lý đơn tới `ReadyToShip` |
| `WarehouseStaff` | Phân công shipper/xe, kiểm hàng, bàn giao, trừ tồn |
| `DeliveryStaff` | Nhận kiện đã được kho bàn giao, giao cho khách |
| `WarehouseStaff` | Kiểm nhận hàng giao thất bại trả về rồi mới cộng tồn |
| `SystemAdmin` | Kiểm tra và xử lý ngoại lệ |

Shipper không quét SKU. Kho chịu trách nhiệm xác nhận đúng SKU và số lượng.

---

## 2. Bức tranh toàn bộ luồng

```txt
SalesOrder = ReadyToShip
Inventory vẫn giữ hàng bằng QuantityReserved
        ↓
Kho phân công shipper + xe
Shipment = Picking
Tồn chưa bị trừ
        ↓
Shipper đến kho
Kho bấm "Bàn giao & xuất kho"
        ↓
StockOutReceipt được tạo
Inventory.QuantityOnHand bị trừ
CostOfGoodsSold được chốt
Shipment = Shipping
SalesOrder = Shipping
        ↓
Shipper giao hàng
        ├── Thành công
        │     Shipment = Delivered
        │     SalesOrder = Completed
        │     COD → PaymentStatus = Success
        │
        └── Thất bại
              Shipment = Failed
              SalesOrder vẫn = Shipping
                    ├── giao lại → Rescheduled → Shipping
                    └── trả kho → ReturnPending
                                      ↓
                               Kho nhận hàng thật
                                      ↓
                               StockInReceipt được tạo
                               tồn được cộng lại
                               Shipment = Cancelled
                               SalesOrder = Cancelled
```

`OrderStatus` mô tả trạng thái tổng quát của đơn. `Shipment.ShippingStatus` mô tả chi tiết trách nhiệm giao nhận. Giao thất bại không tự cộng tồn vì hàng vẫn ở chỗ shipper.

---

## 3. Database và migration

Migration của module:

```txt
database/025-delivery-workflow.sql
```

### Shipment

`Shipment` đồng thời là bản ghi phân công:

```txt
OrderId          → đơn nào
WarehouseId      → rời từ kho nào
DeliveryStaffId  → shipper chịu trách nhiệm
VehicleId        → xe được sử dụng
AssignedAt       → lúc phân công
HandedOverAt     → lúc shipper nhận hàng từ kho
DeliveredAt      → lúc khách nhận hàng
ShippingStatus   → trạng thái giao nhận
```

### ShipmentItem

```txt
ShipmentId
OrderDetailId
Quantity
```

`ShipmentItem` chỉ được tạo lúc bàn giao xuất kho. Phân công trước đó chưa làm hàng rời kho.

### ShipmentStatusHistory

Mỗi thay đổi trạng thái lưu:

```txt
ShipmentId
Status
ChangedByUserId
Note
ChangedAt
```

Ví dụ note cho biết ai được phân công, xe nào được dùng, ai bàn giao và lý do giao thất bại.

### DeliveryVehicle

Migration 025 bổ sung:

```txt
DeliveryVehicle
├── VehicleId
├── VehicleCode
├── LicensePlate
├── VehicleType
├── Status: Active | Maintenance | Inactive
├── Note
├── CreatedAt
└── UpdatedAt
```

Một xe có thể chở nhiều đơn. Không có trip, hub hoặc tối ưu tuyến đường.

### Dữ liệu đơn cũ

Các `StockOutReceipt` cũ được backfill:

```txt
StockOutReceipt cũ
↓
Shipment có mã LEGACY-{orderId}-{warehouseId}
↓
ShipmentItem từ StockOutReceiptDetail
↓
ShipmentStatusHistory đầu tiên
```

Shipper và xe của dữ liệu cũ để `NULL` vì không thể đoán chính xác lịch sử.

---

## 4. Giao diện và phân quyền

Frontend vẫn là một ứng dụng React/Vite, dùng chung port:

```txt
#/warehouse
→ apps/web/src/warehouse/WarehouseLayout.tsx
→ apps/web/src/admin/AdminInventoryPage.tsx

#/warehouse/deliveries
→ apps/web/src/warehouse/WarehouseLayout.tsx
→ apps/web/src/warehouse/WarehouseDeliveriesPage.tsx

#/shipper
→ apps/web/src/shipper/ShipperLayout.tsx
→ apps/web/src/shipper/ShipperPage.tsx
```

`apps/web/src/App.tsx` chứa `defaultAuthenticatedRoute(roles)`:

```txt
SystemAdmin     → #/admin/dashboard
WarehouseStaff → #/warehouse
DeliveryStaff  → #/shipper
Customer       → #/profile
```

Frontend chỉ điều hướng. Backend mới là lớp bảo mật thật:

```txt
warehouseDeliveriesRouter
→ requireAuth
→ requireRoles(['WarehouseStaff', 'SystemAdmin'])

shipperRouter
→ requireAuth
→ requireRoles(['DeliveryStaff', 'SystemAdmin'])
```

---

## 5. Luồng tạo xe

Frontend:

```txt
apps/web/src/warehouse/WarehouseVehicleManager.tsx
→ submit(event)
→ apps/web/src/api.ts
→ createDeliveryVehicle(payload, token)
→ POST /api/warehouse/deliveries/vehicles
```

Backend:

```txt
apps/api/src/server.ts
→ mount warehouseDeliveriesRouter tại /api/warehouse/deliveries

apps/api/src/routes/warehouseDeliveries.ts
→ POST /vehicles
→ createVehicle

apps/api/src/controllers/warehouseDeliveryController.ts
→ đọc và kiểm tra mã xe, biển số, loại xe

apps/api/src/services/warehouseDeliveryService.ts
→ createDeliveryVehicle(input)
→ INSERT dbo.DeliveryVehicle
```

Chỉ xe `Active` xuất hiện trong form phân công.

---

## 6. Luồng phân công shipper và xe

Component thực hiện:

```txt
apps/web/src/warehouse/WarehouseReadyOrders.tsx
```

`loadData()` gọi:

```txt
getWarehouseReadyOrders(token)
→ GET /api/admin/inventory/ready-orders
→ đơn ReadyToShip và SKU kho phải chuẩn bị

getWarehouseDeliveryOptions(token)
→ GET /api/warehouse/deliveries/options
→ UserAccount Active có role DeliveryStaff
→ DeliveryVehicle
```

Khi bấm `Phân công`:

```txt
WarehouseReadyOrders.assign(order)
↓
apps/web/src/api.ts
↓
assignWarehouseDelivery(orderId, payload, token)
↓
POST /api/warehouse/deliveries/orders/:orderId/assign
```

Backend đi tiếp:

```txt
apps/api/src/routes/warehouseDeliveries.ts
→ assignDelivery

apps/api/src/controllers/warehouseDeliveryController.ts
→ validate orderId, deliveryStaffId, vehicleId

apps/api/src/services/warehouseDeliveryService.ts
→ assignOrderShipment(input)
```

Transaction kiểm tra:

1. Đơn đang `ReadyToShip`.
2. Hàng của đơn nằm ở đúng một kho, phù hợp mô hình cửa hàng đơn giản.
3. User được chọn đang Active và có role `DeliveryStaff`.
4. Xe đang `Active`.
5. Shipment cũ chỉ được phép là `Pending` hoặc `Picking`.

Sau đó:

```txt
INSERT/UPDATE Shipment
ShippingStatus = Picking
DeliveryStaffId = shipper
VehicleId = xe
AssignedAt = hiện tại
INSERT ShipmentStatusHistory
```

Chưa có thay đổi kho:

```txt
SalesOrder vẫn ReadyToShip
QuantityOnHand chưa giảm
QuantityReserved vẫn giữ hàng
CostOfGoodsSold chưa chốt
```

---

## 7. Luồng bàn giao và xuất kho

Frontend:

```txt
WarehouseReadyOrders.handOver(order)
↓
handOverWarehouseDelivery(orderId, token)
↓
POST /api/warehouse/deliveries/orders/:orderId/handover
```

Backend:

```txt
apps/api/src/routes/warehouseDeliveries.ts
→ handOverDelivery

apps/api/src/controllers/warehouseDeliveryController.ts
→ confirmOrderExport(orderId, warehouseUserId)

apps/api/src/services/adminInventoryService.ts
→ confirmOrderExport(...)
```

Một SQL transaction thực hiện toàn bộ:

```txt
1. Lock SalesOrder, yêu cầu ReadyToShip
2. Lock OrderInventoryReservation và Inventory
3. Yêu cầu Shipment = Picking, có shipper và xe
4. Tạo StockOutReceipt
5. Tạo StockOutReceiptDetail, chốt UnitCost
6. Cộng CostOfGoodsSold vào SalesOrderDetail
7. Tạo ShipmentItem
8. Trừ QuantityOnHand và QuantityReserved
9. Cập nhật QuantityFulfilled
10. Tạo StockMovement OUT
11. Shipment → Shipping, ghi HandedOverAt
12. SalesOrder → Shipping
13. Ghi lịch sử shipment và đơn
14. COMMIT
```

Nếu một bước lỗi, tất cả rollback. Không có trạng thái đơn đã giao nhưng tồn chưa trừ.

Giá vốn:

```txt
UnitCost = Inventory.AverageUnitCost tại lúc bàn giao
CostOfGoodsSold += UnitCost × Quantity
```

Giá nhập mới sau đó không thay đổi giá vốn đơn cũ.

---

## 8. Shipper tải nhiệm vụ

```txt
apps/web/src/shipper/ShipperPage.tsx
→ useEffect
→ getShipperShipments(token)
→ GET /api/shipper/shipments
```

Backend:

```txt
apps/api/src/routes/shipper.ts
→ listMyShipments

apps/api/src/controllers/shipperController.ts
→ lấy userId từ JWT

apps/api/src/services/shipperService.ts
→ getShipperShipments(userId, isSystemAdmin)
```

Shipper thường chỉ thấy:

```sql
Shipment.DeliveryStaffId = userId trong JWT
```

Trang chia danh sách:

```txt
Picking → Chờ nhận tại kho
Shipping / Failed / Rescheduled / ReturnPending → Đang xử lý
Delivered / Cancelled → Lịch sử
```

---

## 9. Giao thành công và COD

Frontend:

```txt
ShipperPage
→ nút Đã giao thành công
→ completeShipperDelivery(shipmentId, token)
→ POST /api/shipper/shipments/:shipmentId/delivered
```

Backend service:

```txt
apps/api/src/services/shipperService.ts
→ completeShipmentDelivery(...)
```

Service kiểm tra shipment thuộc shipper hiện tại, shipment và đơn đều `Shipping`. Đơn online phải thanh toán thành công trước.

Nếu COD:

```txt
PaymentStatus → Success
TransactionCode → COD-{orderCode}
PaidAt → hiện tại
SalesOrder.PaymentStatus → Success
```

Sau đó:

```txt
Shipment → Delivered
DeliveredAt → hiện tại
SalesOrder → Completed
ghi hai bảng lịch sử
```

`OrderAdmin` không còn tự chuyển `Shipping → Completed`; kết quả giao thuộc shipper được phân công.

---

## 10. Giao thất bại, giao lại và trả kho

### Thất bại

```txt
Shipper nhập lý do
→ POST /api/shipper/shipments/:id/failed
→ Shipment: Shipping → Failed
→ SalesOrder vẫn Shipping
→ Inventory không đổi
```

### Giao lại

```txt
Failed
→ POST /reschedule
→ Rescheduled + EstimatedDeliveryAt
→ POST /retry
→ Shipping
```

Không xuất kho lần hai vì kiện vẫn do shipper giữ.

### Yêu cầu trả kho

```txt
Failed hoặc Rescheduled
→ POST /request-return
→ Shipment = ReturnPending
```

Kho tải danh sách bằng:

```txt
apps/web/src/warehouse/WarehouseReturns.tsx
→ getWarehousePendingReturns(token)
→ GET /api/warehouse/deliveries/returns
```

Kho chỉ bấm xác nhận sau khi đã nhận và kiểm hàng thật:

```txt
WarehouseReturns.confirmReturn(shipment)
↓
POST /api/warehouse/deliveries/shipments/:id/confirm-return
↓
warehouseDeliveryController.confirmReturnedDelivery
↓
warehouseDeliveryService.confirmShipmentReturn
```

Transaction trả kho:

```txt
1. Lock Shipment và SalesOrder, yêu cầu ReturnPending
2. Lấy UnitCost lịch sử từ StockOutReceiptDetail
3. Tạo StockInReceipt liên kết ShipmentId
4. Tạo StockInReceiptDetail
5. Cộng QuantityOnHand
6. Tính lại AverageUnitCost
7. Tạo StockMovement IN
8. Giảm CostOfGoodsSold đã hoàn về
9. Shipment → Cancelled
10. SalesOrder → Cancelled
11. Đơn trả online → RefundPending
12. Ghi lịch sử và COMMIT
```

Giá bình quân khi nhận lại:

```txt
(tồn hiện tại × giá bình quân hiện tại + hàng trả × giá vốn đã chốt lúc xuất)
÷ (tồn hiện tại + hàng trả)
```

---

## 11. Danh sách endpoint

### Kho

| Method | Endpoint | Công dụng |
|---|---|---|
| GET | `/api/warehouse/deliveries/options` | Lấy shipper và xe |
| POST | `/api/warehouse/deliveries/vehicles` | Thêm xe |
| PATCH | `/api/warehouse/deliveries/vehicles/:id/status` | Đổi trạng thái xe |
| POST | `/api/warehouse/deliveries/orders/:id/assign` | Phân công |
| POST | `/api/warehouse/deliveries/orders/:id/handover` | Bàn giao và xuất kho |
| GET | `/api/warehouse/deliveries/returns` | Hàng chờ trả kho |
| POST | `/api/warehouse/deliveries/shipments/:id/confirm-return` | Nhận lại và cộng tồn |

### Shipper

| Method | Endpoint | Công dụng |
|---|---|---|
| GET | `/api/shipper/shipments` | Chuyến của shipper |
| POST | `/api/shipper/shipments/:id/delivered` | Giao thành công |
| POST | `/api/shipper/shipments/:id/failed` | Giao thất bại |
| POST | `/api/shipper/shipments/:id/reschedule` | Hẹn giao lại |
| POST | `/api/shipper/shipments/:id/retry` | Bắt đầu giao lại |
| POST | `/api/shipper/shipments/:id/request-return` | Đề nghị trả kho |

---

## 12. Bản đồ file và trách nhiệm

### Frontend

```txt
apps/web/src/App.tsx
→ route và điều hướng theo role

apps/web/src/api.ts
→ tạo HTTP request

apps/web/src/types.ts
→ kiểu dữ liệu delivery

apps/web/src/warehouse/WarehouseLayout.tsx
→ sidebar WarehouseStaff

apps/web/src/warehouse/WarehouseDeliveriesPage.tsx
→ ghép phân công, hàng trả và xe

apps/web/src/warehouse/WarehouseReadyOrders.tsx
→ phân công và bàn giao

apps/web/src/warehouse/WarehouseReturns.tsx
→ nhận hàng trả

apps/web/src/warehouse/WarehouseVehicleManager.tsx
→ quản lý xe

apps/web/src/shipper/ShipperLayout.tsx
→ layout DeliveryStaff

apps/web/src/shipper/ShipperPage.tsx
→ thao tác giao hàng
```

### Backend

```txt
apps/api/src/server.ts
→ mount router

apps/api/src/routes/warehouseDeliveries.ts
→ URL và quyền kho

apps/api/src/controllers/warehouseDeliveryController.ts
→ validate request kho

apps/api/src/services/warehouseDeliveryService.ts
→ transaction phân công, xe, trả kho

apps/api/src/routes/shipper.ts
→ URL và quyền shipper

apps/api/src/controllers/shipperController.ts
→ validate request shipper

apps/api/src/services/shipperService.ts
→ query và transaction giao hàng

apps/api/src/services/adminInventoryService.ts
→ bàn giao, trừ tồn và chốt giá vốn
```

---

## 13. Checklist kiểm thử

### Chuẩn bị

```txt
1. SystemAdmin tạo user có role DeliveryStaff
2. WarehouseStaff tạo DeliveryVehicle Active
3. Có đơn ReadyToShip với inventory reservation
```

### Giao thành công

```txt
1. Kho phân công shipper + xe
2. Shipper thấy đơn Chờ nhận tại kho
3. Xác nhận tồn chưa giảm
4. Kho bàn giao & xuất kho
5. Xác nhận tồn giảm và COGS được chốt
6. Shipper thấy Đang giao
7. Shipper xác nhận thành công
8. Kiểm tra Shipment Delivered và Order Completed
9. Nếu COD, kiểm tra Payment Success và PaidAt
```

### Thất bại và trả kho

```txt
1. Shipper ghi nhận thất bại
2. Xác nhận tồn chưa cộng lại
3. Shipper yêu cầu trả kho
4. Kho thấy hàng ReturnPending
5. Kho xác nhận đã nhận hàng
6. Kiểm tra tồn được cộng theo giá vốn lịch sử
7. Kiểm tra Shipment và Order đã hủy
8. Nếu trả online, kiểm tra RefundPending
```
