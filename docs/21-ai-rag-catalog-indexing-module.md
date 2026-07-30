# 21. AI RAG - index catalog sản phẩm

## Mục tiêu của flow này

- Không dùng Python, tokenizer tự viết hoặc embedding tự huấn luyện.
- Gemini tạo embedding cloud cho dữ liệu sản phẩm.
- Qdrant Cloud lưu vector để sau này tìm sản phẩm theo nghĩa.
- SQL Server vẫn là nguồn dữ liệu thật cho giá, tồn kho, khuyến mãi và SKU.
- Chỉ index catalog sản phẩm của shop; chatbot tương lai không được dùng dữ liệu ngoài catalog làm nguồn tư vấn.

## Các thành phần

```text
SQL Server
  └─ Product + Category + Brand + ProductAttributeValue
       ↓
Node API
  └─ ragIndexService.ts
       ├─ Gemini: tạo embedding 768 chiều
       └─ Qdrant Cloud: lưu/search vector
```

Qdrant chỉ là chỉ mục tìm kiếm theo nghĩa. Nó không giữ vai trò nguồn thật của giá hoặc tồn kho.

## Biến môi trường

Các key chỉ được dùng tại backend, nằm trong `.env` và không được đưa xuống React hoặc commit Git:

```env
GEMINI_API_KEY=
QDRANT_URL=
QDRANT_API_KEY=
```

Mẫu biến được ghi ở `.env.example`.

## Product document được index

Mỗi `Product` active được chuyển thành một đoạn text có cấu trúc:

```text
Tên sản phẩm
Danh mục
Thương hiệu
Bảo hành
Yêu cầu lắp đặt
Mô tả
Thông số từ ProductAttributeValue
```

Gemini biến đoạn text thành vector 768 chiều. Qdrant lưu vector cùng `productId`, `slug`, `category`, `brand` và bản document dùng để index.

## Luồng index toàn bộ catalog

```text
npm run rag:index -w api
↓
apps/api/src/scripts/indexCatalog.ts
↓
indexProductCatalog()
↓
Đọc toàn bộ Product active + Category + Brand + attributes từ SQL Server
↓
Tạo collection `products` trên Qdrant nếu chưa có
↓
Gemini tạo embedding `gemini-embedding-2`, 768 chiều, task RETRIEVAL_DOCUMENT
↓
Qdrant upsert point với id = ProductId
```

Kết quả đã kiểm tra ngày 2026-07-21:

```text
Indexed 20 products into products.
```

## Đồng bộ khi admin sửa catalog

```text
Admin thêm sản phẩm
↓
SQL Server commit thành công
↓
indexProduct(productId)
↓
Gemini tạo lại embedding riêng sản phẩm đó
↓
Qdrant upsert point có id = ProductId
```

```text
Admin sửa sản phẩm
↓
SQL Server commit thành công
↓
indexProduct(productId)
```

```text
Admin chuyển sản phẩm Inactive
↓
SQL Server cập nhật Status
↓
removeProductFromIndex(productId)
↓
Qdrant xóa point đó
```

Nếu Gemini hoặc Qdrant tạm lỗi sau khi SQL Server đã commit, sản phẩm vẫn được lưu đúng trong SQL Server. API ghi lỗi log và trả `ragIndexed: false`; admin có thể chạy lại lệnh index toàn catalog.

## API admin hỗ trợ vận hành

Các endpoint dưới đây yêu cầu JWT có role `SystemAdmin`:

```text
GET  /api/admin/ai/catalog-index
POST /api/admin/ai/catalog-index
```

`POST` index lại toàn bộ catalog. Chưa có UI admin riêng; endpoint và lệnh `rag:index` được tạo trước để kiểm tra phần hạ tầng.

## File mã nguồn liên quan

```text
apps/api/src/services/ragIndexService.ts
apps/api/src/scripts/indexCatalog.ts
apps/api/src/controllers/adminAiController.ts
apps/api/src/routes/adminAi.ts
apps/api/src/controllers/adminProductController.ts
apps/api/src/server.ts
apps/api/package.json
```

## Bước tiếp theo của cùng flow

## Semantic retrieval API

Endpoint public đầu tiên của RAG:

```text
POST /api/ai/search
```

Body:

```json
{
  "query": "tủ lạnh tiết kiệm điện cho gia đình 4 người",
  "limit": 5
}
```

Luồng xử lý:

```text
Request
↓
aiRateLimit: tối đa 12 request/phút/IP
↓
Controller chặn query rỗng hoặc dài quá 400 ký tự
↓
Gemini tạo query vector 768 chiều, task RETRIEVAL_QUERY
↓
Qdrant search collection `products`
↓
Trả productId + score + slug + category + brand
```

Kết quả kiểm thử ngày 2026-07-21 với câu hỏi về tủ lạnh gia đình 4 người:

```text
LG Inverter 315L
Samsung Inverter 236L
Samsung Inverter 488L
```

Đây mới là retrieval candidate, chưa phải lời tư vấn cuối cùng. Bước chatbot sau sẽ đọc thông số/giá/tồn kho thật từ SQL Server cho các ứng viên này rồi mới trả lời khách.

## Chatbot RAG

Endpoint:

```text
POST /api/ai/chat
```

Luồng:

```text
Câu hỏi khách
↓
Chặn input rỗng, >400 ký tự, code/toán/prompt-injection phổ biến
↓
Qdrant tìm tối đa 5 ProductId theo nghĩa
↓
SQL Server đọc lại tên, mô tả, giá, tồn kho, bảo hành, thông số thật
↓
Gemini 3.5 Flash chỉ nhận danh sách tối đa 5 sản phẩm này làm context
↓
Gemini trả JSON: decision + answer + productIds
↓
Backend loại productId không thuộc context trước khi trả về client
```

`decision` chỉ có 4 trạng thái:

```text
recommend
need_clarification
no_match
out_of_scope
```

Các câu rõ ràng ngoài phạm vi như yêu cầu viết code, giải phương trình, hỏi system prompt bị trả lời cố định ngay tại backend và không gọi Gemini.

Kiểm thử ngày 2026-07-21:

```text
Tư vấn tủ lạnh tiết kiệm điện cho gia đình 4 người
↓
recommend
↓
LG Inverter 315L + Aqua Inverter 358L
```

## Giao diện tìm kiếm AI

Thanh tìm kiếm cũ ở home/catalog vẫn là SQL keyword search, nên không hiểu câu nhu cầu tự nhiên dài. Để tránh gọi AI theo từng lần gõ và tốn token, UI dùng ô riêng **Tư vấn bằng AI** tại trang Sản phẩm.

```text
User nhập nhu cầu và bấm Hỏi AI
↓
apps/web/src/pages/ProductsPage.tsx
↓
apps/web/src/api.ts: askAiAboutProducts()
↓
POST /api/ai/chat
↓
Nhận answer + slug các sản phẩm đã được backend xác thực
↓
Frontend gọi GET /api/products/:slug để lấy Product đầy đủ
↓
Hiển thị card sản phẩm chuẩn của shop
```

Ví dụ nên nhập:

```text
Máy lọc không khí cho nhà 1 người, giá dưới 10 triệu
```

## Hội thoại nhiều lượt

UI hiện giữ history trên browser, không tạo bảng chat DB cho phạm vi đồ án.

### Trình bày hội thoại (cập nhật 2026-07-21)

Lịch sử chat hiển thị theo chiều dọc, mỗi lượt là một bong bóng riêng: tin khách ở bên phải, tin AI ở bên trái. CSS chỉ áp dụng hàng ngang cho vùng ô nhập và nút gửi, không áp dụng lên toàn bộ `div` con của khối chatbot để tránh các tin nhắn bị dàn thành nhiều cột hẹp.

Khung lịch sử có chiều cao giới hạn tương đương khoảng ba tin nhắn thông thường và có thanh cuộn; khi có phản hồi mới, khung cuộn xuống lượt mới nhất.

### Quota tư vấn theo tài khoản (cập nhật 2026-07-21)

`POST /api/ai/chat` bắt buộc đăng nhập. Backend giới hạn mỗi `UserAccount` tối đa 4 câu hỏi hợp lệ mỗi ngày theo múi giờ `Asia/Ho_Chi_Minh`.

```text
Client gửi Bearer token
↓
aiRateLimit chặn spam nhanh theo IP (12 request/phút)
↓
requireAuth xác thực tài khoản
↓
Kiểm tra câu hỏi hợp lệ, không phải prompt injection/code/toán
↓
AiDailyUsage khóa theo UserId + UsageDate, tăng MessageCount nếu còn dưới 4
↓
RAG + Gemini
```

Quota được lưu trong SQL Server (`dbo.AiDailyUsage`), nên không mất khi API restart. `database/023-ai-daily-message-quota.sql` tạo bảng này. Sau này có thể thêm `UserTier`/bảng quyền hạn để thay số 4 bằng quota theo hạng tài khoản.

```text
User hỏi lượt 1
↓
Backend trả answer + productIds
↓
Frontend lưu tin nhắn và productIds
↓
User hỏi lượt 2, ví dụ: “Mẫu thứ hai bảo hành bao lâu?”
↓
POST /api/ai/chat gửi tối đa 4 tin gần nhất + tối đa 5 productIds context
↓
Backend vẫn RAG lại câu mới và SQL Server đọc dữ liệu hiện hành
↓
Gemini trả lời dựa trên context sản phẩm thật
```

Giới hạn history và context giúp không gửi toàn bộ cuộc hội thoại lên Gemini, tránh tăng token cost theo thời gian.

File bổ sung cho phần này:

```text
apps/api/src/routes/aiAssistant.ts
apps/api/src/controllers/aiAssistantController.ts
apps/api/src/middleware/aiRateLimit.ts
```

## Bước tiếp theo

Flow này sẽ tiếp tục được cập nhật tại chính file này khi thêm chatbot:

```text
Câu hỏi khách
↓
Gemini tạo query embedding (RETRIEVAL_QUERY)
↓
Qdrant trả top-k ProductId gần nghĩa
↓
SQL Server lấy giá/tồn kho thật
↓
Chatbot chỉ nhận top-k sản phẩm làm context
```

Phần tìm kiếm đa phương thức bằng ảnh đã được tách thành module kế tiếp:

```text
docs/22-ai-image-search-module.md
```

Module 22 dùng cùng `gemini-embedding-2` nhưng tạo collection `product_images`, nhận ảnh khách hàng, tìm ảnh catalog tương tự và áp dụng cơ chế `exact_match / similar_matches / need_clarification / no_match`.
