# 22. AI tìm sản phẩm bằng hình ảnh

## Mục tiêu

Flow này mở rộng module RAG catalog ở `docs/21-ai-rag-catalog-indexing-module.md` cho tình huống:

> Khách nhìn thấy một thiết bị đẹp ở nơi khác, chụp ảnh và muốn biết shop có đúng mẫu hoặc mẫu tương tự hay không.

Hệ thống không được khẳng định đúng model chỉ vì hình dáng gần giống. Nếu ảnh thiếu logo, tem model hoặc đặc điểm phân biệt, AI phải:

- nói rõ chưa xác định chính xác;
- trả các sản phẩm tương tự trong shop; hoặc
- hỏi thêm đúng một đặc điểm giúp phân biệt các ứng viên.

## Kiến trúc

```text
dbo.ProductImage + Product + Category + Brand
        ↓
Node API tải và chuẩn hóa ảnh catalog
        ↓
Gemini gemini-embedding-2 tạo vector ảnh 768 chiều
        ↓
Qdrant collection product_images
        ↓
Khách upload ảnh JPEG/PNG
        ↓
Chuẩn hóa ảnh, xóa metadata và tạo query image embedding
        ↓
Qdrant trả các ảnh catalog gần nhất
        ↓
Gộp theo ProductId, đọc dữ liệu thật từ SQL Server
        ↓
Gemini Vision phân tích + trả structured JSON
        ↓
exact_match / similar_matches / need_clarification / no_match
```

SQL Server vẫn là nguồn dữ liệu thật của tên, giá, tồn kho, bảo hành và thông số. Qdrant chỉ giữ vector cùng các khóa tra cứu.

Model sinh câu trả lời và phân tích ảnh mặc định là `gemini-3.5-flash-lite`.
Model embedding vẫn là `gemini-embedding-2`; đổi chat model không yêu cầu index
lại catalog.

Ngày 2026-07-30, project đã thử `gemini-2.5-flash` nhưng Gemini API trả `404`
vì model này không còn cấp cho project/người dùng mới. `gemini-3.5-flash-lite`
đã được kiểm thử thành công với cả structured text response và image response:
câu hỏi đổi thương hiệu vẫn trả đúng nhóm tủ lạnh, còn ảnh catalog Toshiba trả
`exact_match` cho ProductId 43.

## Collection ảnh

Collection mới:

```text
product_images
```

Mỗi point ứng với một dòng `dbo.ProductImage`:

```json
{
  "id": 32,
  "vector": [0.012, -0.034],
  "payload": {
    "imageId": 32,
    "productId": 29,
    "slug": "samsung-inverter-236l-rt22m4032by",
    "category": "tu-lanh",
    "brand": "Samsung",
    "imageUrl": "https://..."
  }
}
```

Một sản phẩm có nhiều ảnh thì có nhiều point. Khi tìm kiếm, backend lấy điểm cao nhất của từng `ProductId` rồi mới chọn tối đa 6 ứng viên.

## Index ảnh catalog

Lệnh:

```text
npm run rag:index-images -w api
```

Index lại ảnh của riêng một sản phẩm:

```text
npm run rag:index-images -w api -- <productId>
```

Luồng:

```text
Đọc ảnh của Product active từ SQL Server
↓
Chỉ cho phép URL HTTPS từ host đã cấu hình
↓
Tải ảnh với giới hạn 8 MB và timeout
↓
Sharp xoay đúng chiều, resize tối đa 1600 x 1600, bỏ metadata, đổi sang JPEG
↓
Gemini tạo embedding 768 chiều
↓
Tạo lại collection product_images
↓
Tạo payload index kiểu integer cho productId
↓
Upsert các ảnh thành công
```

Nếu không ảnh nào tạo được embedding, collection cũ được giữ nguyên. Nếu chỉ một số ảnh lỗi, kết quả trả danh sách `failedImages`.

Kết quả index ngày 2026-07-30:

```json
{
  "collectionName": "product_images",
  "totalImages": 46,
  "indexedImages": 46,
  "indexedProducts": 17,
  "failedImages": [],
  "vectorSize": 768
}
```

Biến môi trường giới hạn nguồn ảnh catalog:

```env
CATALOG_IMAGE_ALLOWED_HOSTS=cdn.tgdd.vn,cdnv2.tgdd.vn,img.tgdd.vn,res.cloudinary.com
```

Không đưa host do người dùng nhập trực tiếp vào danh sách này.

## Đồng bộ khi admin sửa ảnh

Các thao tác sau tự đồng bộ lại image index của riêng sản phẩm:

```text
Admin tạo/sửa sản phẩm có URL ảnh
Admin thêm ảnh vào thư viện
Admin xóa ảnh
Admin chuyển Product Active/Inactive
```

Nếu Gemini, host ảnh hoặc Qdrant lỗi sau khi SQL Server đã commit, dữ liệu sản phẩm vẫn được giữ. API ghi lỗi và trả `imageRagIndexed: false`. Admin có thể chạy lại index toàn bộ.

Collection phải có payload index kiểu `integer` cho trường `productId`. Index này được
tự động kiểm tra và tạo khi đồng bộ một sản phẩm, đồng thời được tạo lại sau thao tác
recreate collection. Nhờ đó các thao tác xóa vector cũ theo `productId` hoạt động trên
Qdrant Cloud có bật strict mode.

## API quản trị

Yêu cầu JWT có role `SystemAdmin`:

```text
GET  /api/admin/ai/catalog-image-index
POST /api/admin/ai/catalog-image-index
```

`GET` trả trạng thái collection. `POST` index lại toàn bộ ảnh catalog.

## API khách hàng

Endpoint:

```text
POST /api/ai/image-search
Content-Type: multipart/form-data
Authorization: Bearer <JWT>
```

Fields:

```text
image               JPEG hoặc PNG, bắt buộc, tối đa 8 MB
clarification       Câu trả lời bổ sung, tối đa 300 ký tự
contextProductIds   JSON array, tối đa 5 ProductId
```

Ảnh được kiểm tra bằng magic bytes, không chỉ tin vào MIME do browser gửi. Backend dùng Sharp để giới hạn kích thước ảnh giải nén, resize và bỏ EXIF trước khi gửi Gemini. Ảnh khách chỉ nằm trong bộ nhớ của request, không được ghi vào SQL Server hoặc filesystem.

Endpoint dùng chung:

- rate limit 12 request/phút/IP;
- quota 4 lượt AI/người dùng/ngày đối với tài khoản thông thường;
- không giới hạn quota hằng ngày đối với role `SystemAdmin` để kiểm thử;
- xác thực JWT.

## Hai bước phân tích để tránh AI tự suy diễn model

### Bước 1 - Quan sát độc lập

Gemini chỉ nhận ảnh, chưa nhận danh sách ứng viên. Prompt bắt buộc:

- chỉ ghi thông tin nhìn thấy;
- `brand` để rỗng nếu logo không đọc rõ;
- `modelText` để rỗng nếu mã model không xuất hiện rõ trong ảnh;
- ghi lý do ảnh mờ, bị che hoặc thiếu góc nhận dạng.

Việc tách bước này ngăn model nhìn thấy tên ứng viên rồi khai nhầm rằng mã model đó có trong ảnh.

### Bước 2 - Đối chiếu catalog

Gemini nhận:

- đặc điểm đã trích xuất độc lập;
- câu trả lời bổ sung của khách;
- tối đa 6 ứng viên từ Qdrant;
- tên, giá, tồn kho, bảo hành và thuộc tính đọc lại từ SQL Server.

ProductId do Gemini trả về tiếp tục được backend lọc bằng tập ứng viên hợp lệ.

## Quy tắc quyết định

```text
exact_match
```

Chỉ dùng khi mã model đọc được và khớp dữ liệu sản phẩm, hoặc ảnh gần như trùng chính ảnh catalog với điểm vector rất cao và cách biệt rõ.

```text
similar_matches
```

Loại thiết bị, màu sắc hoặc hình dáng giống nhưng chưa đủ bằng chứng xác nhận model.

```text
need_clarification
```

Nhiều ứng viên khó phân biệt hoặc thiếu logo/tem/đặc điểm quan trọng. Response phải có `clarifyingQuestion`.

```text
no_match
```

Không có ứng viên hợp lý trong catalog.

Hệ thống không hiển thị phần trăm chắc chắn do model tự sinh. Thay vào đó, response giải thích quan sát nào có thật và lý do chưa chắc chắn.

Ví dụ response:

```json
{
  "decision": "similar_matches",
  "observed": {
    "category": "Tủ lạnh",
    "brand": "",
    "modelText": "",
    "color": "Đen",
    "visibleFeatures": [
      "Hai cửa",
      "Ngăn đá trên",
      "Tay cầm ẩn"
    ]
  },
  "answer": "Chưa đủ thông tin để xác định chính xác model. Shop có một số mẫu tương tự.",
  "clarifyingQuestion": "",
  "productIds": [29, 32],
  "uncertaintyReasons": [
    "Không đọc được logo",
    "Không nhìn thấy tem model"
  ],
  "products": [
    {
      "productId": 29,
      "slug": "samsung-inverter-236l-rt22m4032by"
    }
  ],
  "quota": {
    "limit": 4,
    "remaining": 3,
    "unlimited": false
  }
}
```

Với `SystemAdmin`, quota trả về:

```json
{
  "limit": null,
  "remaining": null,
  "unlimited": true
}
```

## Hội thoại hỏi lại

Frontend giữ `File` ảnh trong state. Khi API trả `need_clarification`:

```text
AI hỏi một đặc điểm
↓
Khách nhập câu trả lời
↓
Frontend gửi lại cùng ảnh + clarification + contextProductIds
↓
Backend tạo lại embedding, giữ các ứng viên trước và đối chiếu thêm thông tin mới
```

Không tạo bảng lưu ảnh hoặc phiên tìm kiếm cho phạm vi đồ án.

## Giao diện và hội thoại đa phương thức

Trang Sản phẩm dùng chung một khu vực **Tìm kiếm và tư vấn bằng AI** cho cả text
và hình ảnh:

- nút camera nằm ngay trong thanh nhập;
- trên thiết bị hỗ trợ, nút camera có thể mở camera sau; trên desktop, nút mở
  trình chọn file;
- preview ảnh đính kèm trước khi gửi;
- có thể gửi riêng ảnh hoặc gửi ảnh kèm mô tả;
- kiểm tra JPEG/PNG và giới hạn 8 MB ở client;
- kết quả nhận diện, đặc điểm nhìn thấy và lý do chưa chắc chắn được hiển thị
  thành một tin nhắn AI trong cùng lịch sử hội thoại;
- dùng chung `ProductGrid` để hiển thị sản phẩm AI đang tư vấn.

Sau khi image search trả về `productIds`, frontend chuyển các ID này sang
`contextProductIds` của text chat. Người dùng có thể bỏ ảnh và hỏi tiếp:

```text
Người dùng gửi ảnh
→ image-search nhận diện ProductId 43
→ frontend lưu contextProductIds: [43]
→ người dùng hỏi "Mẫu này còn hàng không?"
→ text chat đọc ProductId 43 từ SQL và trả lời theo tồn kho hiện tại
```

Ảnh không cần gửi lại ở các câu text sau. Nếu image search trả
`need_clarification`, frontend giữ ảnh đính kèm và dùng câu trả lời tiếp theo làm
`clarification`; khi đã xác định xong, ảnh được gỡ khỏi ô nhập để tiếp tục chat
text bình thường.

## Kiểm thử thực tế

### Ảnh catalog rõ

Input là ảnh chính của:

```text
Tủ lạnh Samsung Inverter 236 lít RT22M4032BY/SV
```

Kết quả:

```text
decision: exact_match
productIds: [29]
modelText: ""
```

Ảnh được xác nhận bằng nhánh “gần như trùng ảnh catalog” với ngưỡng rất cao; hệ thống không khai rằng đã đọc được mã model trên ảnh.

### Ảnh bị giảm chất lượng, không đọc được logo/model

Ảnh trên được giảm mạnh độ phân giải và làm mờ để mô phỏng ảnh thiếu chi tiết.

Kết quả:

```text
decision: similar_matches
brand: ""
modelText: ""
productIds: [29, 32, 31]
```

Response nói rõ ảnh mờ, không đọc được logo và mã model, không khẳng định chính xác.

## File mã nguồn liên quan

```text
apps/api/src/services/imageSearchService.ts
apps/api/src/controllers/aiAssistantController.ts
apps/api/src/routes/aiAssistant.ts
apps/api/src/controllers/adminAiController.ts
apps/api/src/routes/adminAi.ts
apps/api/src/scripts/indexCatalogImages.ts
apps/api/src/controllers/adminProductController.ts
apps/web/src/pages/ProductsPage.tsx
apps/web/src/api.ts
apps/web/src/types.ts
apps/web/src/App.css
```

## Hạn chế và bước tiếp theo

- Bốn sản phẩm Tivi active chưa có ảnh nên chưa xuất hiện trong image index.
- Độ chính xác phụ thuộc trực tiếp vào chất lượng và tính đúng đắn của ảnh catalog.
- Cần rà lại ảnh của sản phẩm Aqua AQR-T410FA vì một số URL hiện có tên file của model LG LTB31BLM.
- Nên tạo tập đánh giá gồm ảnh chính diện, góc nghiêng, ảnh tại nhà, ảnh mờ và ảnh không thuộc catalog.
- Sau khi có tập đánh giá, điều chỉnh ngưỡng exact-match dựa trên top-1 accuracy và false-positive thay vì chọn ngưỡng cảm tính.
