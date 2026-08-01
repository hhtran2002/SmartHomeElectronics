# Module 09 - Admin quản lý kho

> Luồng phân công shipper, bàn giao xuất kho, giao thất bại và nhận lại hàng nằm tại `docs/23-warehouse-shipper-delivery-workflow.md`. Từ migration 025, kho không được xuất đơn `ReadyToShip` nếu chưa có `Shipment = Picking`, `DeliveryStaffId` và `VehicleId`.

Mục tiêu module này:

- Xem tồn kho.
- Xem kho hàng.
- Xem lịch sử nhập/xuất.
- Nhập kho thủ công.
- Xuất kho thủ công.
- Xem đơn sẵn sàng xuất.
- Nhân viên kho xác nhận xuất đơn.

Backend module này đã tách:

```txt
server.ts
↓
routes/adminInventory.ts
↓
controllers/adminInventoryController.ts
↓
services/adminInventoryService.ts
↓
database
```

---

## 1. Vào trang kho hàng

```txt
User bấm Kho hàng trong admin
↓
apps/web/src/admin/AdminLayout.tsx
↓
Route #/admin/inventory
↓
apps/web/src/admin/AdminInventoryPage.tsx
```

Yêu cầu quyền:

```txt
WarehouseStaff hoặc SystemAdmin
```

Backend route cũng chặn quyền:

```txt
apps/api/src/routes/adminInventory.ts
↓
adminInventoryRouter.use(requireAuth, requireRoles(['WarehouseStaff', 'SystemAdmin']))
```

---

## 2. Load dữ liệu kho

Frontend:

```txt
apps/web/src/admin/AdminInventoryPage.tsx
↓
loadData()
↓
apps/web/src/api.ts
```

Gọi các API:

```txt
GET /api/admin/inventory/warehouses
GET /api/admin/inventory
GET /api/admin/inventory/movements
```

### Load warehouses

```txt
apps/api/src/server.ts
↓
app.use('/api/admin/inventory', adminInventoryRouter)
↓
apps/api/src/routes/adminInventory.ts
↓
adminInventoryRouter.get('/warehouses', listWarehouses)
↓
apps/api/src/controllers/adminInventoryController.ts
↓
listWarehouses()
↓
apps/api/src/services/adminInventoryService.ts
↓
getWarehouses()
↓
DB: Warehouse
```

### Load inventory

```txt
routes/adminInventory.ts
↓
adminInventoryRouter.get('/', listInventoryItems)
↓
controllers/adminInventoryController.ts
↓
listInventoryItems()
↓
services/adminInventoryService.ts
↓
getInventoryItems()
```

DB liên quan:

```txt
Inventory
Warehouse
ProductSku
Product
Category
Brand
```

Trả về:

```txt
quantityOnHand
quantityReserved
availableQuantity = quantityOnHand - quantityReserved
reorderLevel
```

### Load movements

```txt
routes/adminInventory.ts
↓
adminInventoryRouter.get('/movements', listStockMovements)
↓
controllers/adminInventoryController.ts
↓
listStockMovements()
↓
services/adminInventoryService.ts
↓
getStockMovements()
```

DB liên quan:

```txt
StockMovement
Warehouse
ProductSku
Product
UserAccount
```

---

## 3. Nhập kho thủ công

### SKU mới chưa từng có tồn kho (cập nhật 2026-07-21)

Dropdown Nhập kho không được lấy từ `Inventory`, vì SKU mới chưa có record inventory sẽ bị kẹt không thể nhập lần đầu.

```text
Mode Nhập kho
↓
GET /api/admin/inventory/skus
↓
Tất cả ProductSku active
↓
Chọn SKU mới và kho
↓
createStockIn tạo Inventory nếu chưa có
```

Mode Xuất kho vẫn chỉ lấy SKU có tồn để tránh chọn SKU chưa từng nhập.

Frontend:

```txt
AdminInventoryPage
↓
User chọn mode nhập kho
↓
Nhập warehouseId, skuId, quantity, unitCost, note
↓
submit
↓
apps/web/src/api.ts
↓
POST /api/admin/inventory/stock-in
```

Backend route:

```txt
routes/adminInventory.ts
↓
adminInventoryRouter.post('/stock-in', createStockInReceipt)
```

Controller:

```txt
controllers/adminInventoryController.ts
↓
createStockInReceipt()
↓
Validate warehouseId, skuId, quantity, unitCost
↓
Gọi createStockIn(...)
```

Service:

```txt
services/adminInventoryService.ts
↓
createStockIn(input)
↓
BEGIN TRANSACTION
```

Service làm:

```txt
Tạo StockInReceipt
↓
Tạo StockInReceiptDetail
↓
Cập nhật Inventory (khóa dòng kho để tránh hai phiếu nhập cùng lúc)
  Nếu có dòng inventory: QuantityOnHand += quantity và tính lại AverageUnitCost
  Nếu chưa có: tạo dòng inventory mới, AverageUnitCost = UnitCost của phiếu nhập đầu tiên
↓
Tạo StockMovement IN
↓
COMMIT
```

Kết quả:

```txt
Tồn vật lý QuantityOnHand tăng
Lịch sử kho có movement IN
```

### Giá vốn bình quân gia quyền liên hoàn (cập nhật 2026-07-21)

`ProductSku.CostPrice` chỉ là giá vốn dự kiến/mở đầu khi tạo SKU. Giá vốn dùng cho kho và tính lãi thực tế nằm ở `Inventory.AverageUnitCost`, theo từng SKU và từng kho.

Khi nhập hàng, hệ thống tính:

```text
Giá vốn bình quân mới
= (tồn trước × giá vốn bình quân trước + lượng nhập × giá nhập thực tế)
  / (tồn trước + lượng nhập)
```

Khi xuất hàng, `AverageUnitCost` không đổi; nó được chốt vào `StockOutReceiptDetail.UnitCost`, `StockMovement.UnitCost` và (nếu xuất theo đơn) `SalesOrderDetail.CostOfGoodsSold`. Vì vậy các đơn đã xuất không bị thay đổi giá vốn khi nhập một đợt hàng mới.

Ví dụ:

```text
Nhập đợt 1: 10 × 16.000.000
Xuất bán: 7 × 16.000.000 (giá vốn của 7 chiếc đã chốt)
Còn: 3 chiếc, giá trị 48.000.000
Nhập đợt 2: 20 × 17.000.000

Giá vốn bình quân mới = (48.000.000 + 340.000.000) / 23
                        = 16.869.565đ/chiếc (làm tròn 2 chữ số trong DB)
```

Giá này chỉ áp dụng cho các lần xuất sau đó. Migration `022-inventory-moving-average-cost.sql` thêm các cột lưu giá vốn; tồn cũ được khởi tạo từ `ProductSku.CostPrice` như giá mở đầu.

Migration `024-backfill-order-cost-of-goods-sold.sql` bổ sung giá vốn cho các phiếu xuất và đơn hàng cũ được tạo trước migration 022. Vì dữ liệu cũ chưa chốt giá tại thời điểm xuất, migration dùng `ProductSku.CostPrice` làm giá vốn mở đầu gần đúng; các lần xuất mới vẫn dùng chính xác `Inventory.AverageUnitCost` tại thời điểm xuất.

---

## 4. Xuất kho thủ công

Frontend:

```txt
AdminInventoryPage
↓
User chọn mode xuất kho
↓
Nhập warehouseId, skuId, quantity, reason, note
↓
POST /api/admin/inventory/stock-out
```

Backend:

```txt
routes/adminInventory.ts
↓
adminInventoryRouter.post('/stock-out', createStockOutReceipt)
↓
controllers/adminInventoryController.ts
↓
createStockOutReceipt()
↓
services/adminInventoryService.ts
↓
createStockOut(input)
```

Controller validate:

```txt
warehouseId
skuId
quantity
reason nằm trong danh sách cho phép
```

Service kiểm tra:

```txt
Inventory.QuantityOnHand - Inventory.QuantityReserved >= quantity
```

Nếu đủ:

```txt
Tạo StockOutReceipt
↓
Tạo StockOutReceiptDetail
↓
Inventory.QuantityOnHand -= quantity
↓
Tạo StockMovement OUT
↓
COMMIT
```

Nếu không đủ:

```txt
ROLLBACK
↓
Trả lỗi "Không đủ tồn khả dụng để xuất kho."
```

---

## 5. Đơn sẵn sàng xuất kho

Frontend:

```txt
apps/web/src/admin/WarehouseReadyOrders.tsx
↓
getWarehouseReadyOrders(token)
↓
GET /api/admin/inventory/ready-orders
```

Backend:

```txt
routes/adminInventory.ts
↓
adminInventoryRouter.get('/ready-orders', listReadyOrdersForExport)
↓
controllers/adminInventoryController.ts
↓
listReadyOrdersForExport()
↓
services/adminInventoryService.ts
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

Service gom nhiều dòng item thành từng đơn:

```txt
order
↓
items[]
```

---

## 6. Kho xác nhận xuất đơn

Frontend:

```txt
WarehouseReadyOrders.tsx
↓
User bấm Xác nhận xuất
↓
confirmWarehouseOrderExport(orderId, token)
↓
POST /api/admin/inventory/ready-orders/:orderId/confirm-export
```

Backend:

```txt
routes/adminInventory.ts
↓
adminInventoryRouter.post('/ready-orders/:orderId/confirm-export', confirmReadyOrderExport)
↓
controllers/adminInventoryController.ts
↓
confirmReadyOrderExport()
↓
Validate orderId
↓
services/adminInventoryService.ts
↓
confirmOrderExport(orderId, userId)
```

Service mở transaction:

```txt
BEGIN TRANSACTION
```

Kiểm tra:

```txt
Đơn tồn tại
↓
OrderStatus phải là ReadyToShip
↓
Chưa có StockOutReceipt confirmed cho đơn này
↓
Còn hàng đang reserved để xuất
```

Với từng dòng giữ kho:

```txt
Tạo StockOutReceipt theo warehouse
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

Cuối cùng:

```txt
SalesOrder.OrderStatus = Shipping
↓
COMMIT
```

Ý nghĩa:

```txt
Hàng đã rời kho
Tồn vật lý giảm
Tồn reserved giảm
Đơn chuyển sang đang giao hàng
```
