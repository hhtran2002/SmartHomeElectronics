import { GoogleGenAI } from '@google/genai'
import { getPool, sql } from '../config/database.js'
import { runWithChatModelFallback } from './geminiResilience.js'
import { findCatalogCandidates } from './ragIndexService.js'

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY')
  return new GoogleGenAI({ apiKey })
}

export type ExtractedQueryAttributes = {
  category: string | null
  brand: string | null
  minPrice: number | null
  maxPrice: number | null
  attributes: Array<{
    attributeName: string
    value: string
  }>
  semanticIntent: string
  detectedKeywords: string[]
}

export type HybridSearchResult = {
  extracted: ExtractedQueryAttributes
  products: Array<{
    id: number
    productId: number
    name: string
    slug: string
    basePrice: number
    price: number | null
    finalPrice: number | null
    categoryName: string
    brandName: string
    imageUrl: string | null
    availableQuantity: number
    matchType: 'structured' | 'semantic' | 'hybrid'
    score?: number
  }>
}

export async function parseNaturalLanguageQuery(query: string): Promise<ExtractedQueryAttributes> {
  const gemini = getGeminiClient()

  const systemPrompt = `Bạn là chuyên gia phân tích truy vấn mua sắm điện máy gia dụng thông minh (Smart Home Electronics).
Nhiệm vụ của bạn là phân tích câu hỏi tự nhiên của khách hàng và trích xuất các thuộc tính có cấu trúc (category, brand, khoảng giá VND, và các thông số kỹ thuật).

Các danh mục sản phẩm tiêu biểu:
- Máy giặt, Tủ lạnh, Tivi, Robot hút bụi, Máy lọc không khí, Nồi chiên không dầu, Quạt, Máy sấy thông hơi, Bếp điện.

Các thương hiệu tiêu biểu:
- Samsung, LG, Sony, TCL, Toshiba, Panasonic, Aqua, Xiaomi, Dreame, Philips, Senko, Tefal, Sunhouse, v.v.

Quy đổi giá nếu khách nói:
- "10 triệu" -> 10000000
- "tầm 5 đến 8 củ/triệu" -> minPrice: 5000000, maxPrice: 8000000
- "dưới 15tr" -> maxPrice: 15000000

Chỉ trả về JSON đúng cấu trúc yêu cầu.`

  try {
    const response = await runWithChatModelFallback((model) => gemini.models.generateContent({
      model,
      contents: `Phân tích câu truy vấn sau: "${query}"`,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseJsonSchema: {
          type: 'object',
          required: ['category', 'brand', 'minPrice', 'maxPrice', 'attributes', 'semanticIntent', 'detectedKeywords'],
          properties: {
            category: { type: 'string', nullable: true },
            brand: { type: 'string', nullable: true },
            minPrice: { type: 'number', nullable: true },
            maxPrice: { type: 'number', nullable: true },
            attributes: {
              type: 'array',
              items: {
                type: 'object',
                required: ['attributeName', 'value'],
                properties: {
                  attributeName: { type: 'string' },
                  value: { type: 'string' },
                },
              },
            },
            semanticIntent: { type: 'string' },
            detectedKeywords: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
    }))

    const parsed = JSON.parse(response.text || '{}')
    return {
      category: parsed.category || null,
      brand: parsed.brand || null,
      minPrice: typeof parsed.minPrice === 'number' ? parsed.minPrice : null,
      maxPrice: typeof parsed.maxPrice === 'number' ? parsed.maxPrice : null,
      attributes: Array.isArray(parsed.attributes) ? parsed.attributes : [],
      semanticIntent: String(parsed.semanticIntent || query),
      detectedKeywords: Array.isArray(parsed.detectedKeywords) ? parsed.detectedKeywords : [],
    }
  } catch (err) {
    console.warn('Fallback regex query parsing:', err)
    return {
      category: null,
      brand: null,
      minPrice: null,
      maxPrice: null,
      attributes: [],
      semanticIntent: query,
      detectedKeywords: [query],
    }
  }
}

export async function hybridProductSearch(query: string, limit = 8): Promise<HybridSearchResult> {
  const extracted = await parseNaturalLanguageQuery(query)
  const pool = await getPool()

  // 1. Tìm ứng viên qua Vector Semantic Search (Qdrant)
  let vectorCandidates: Array<{ productId: number; score: number }> = []
  try {
    const candidates = await findCatalogCandidates(query, limit * 2)
    vectorCandidates = candidates.map((c) => ({ productId: c.productId, score: c.score }))
  } catch (err) {
    console.warn('Vector search not ready or failed:', err)
  }

  const vectorCandidateIds = new Set(vectorCandidates.map((c) => c.productId))

  // 2. Query SQL lọc theo thuộc tính cứng nếu có trích xuất được
  const req = pool.request()
    .input('search', sql.NVarChar(255), `%${query}%`)
    .input('category', sql.NVarChar(150), extracted.category ? `%${extracted.category}%` : null)
    .input('brand', sql.NVarChar(150), extracted.brand ? `%${extracted.brand}%` : null)
    .input('minPrice', sql.Decimal(18, 2), extracted.minPrice)
    .input('maxPrice', sql.Decimal(18, 2), extracted.maxPrice)

  const sqlResult = await req.query(`
    SELECT TOP (${limit * 2})
      p.ProductId AS id,
      p.ProductId AS productId,
      p.ProductName AS name,
      p.Slug AS slug,
      p.BasePrice AS basePrice,
      c.CategoryName AS categoryName,
      b.BrandName AS brandName,
      image.ImageUrl AS imageUrl,
      sku.Price AS price,
      ISNULL(inventory.AvailableQuantity, 0) AS availableQuantity
    FROM dbo.Product p
    INNER JOIN dbo.Category c ON c.CategoryId = p.CategoryId
    INNER JOIN dbo.Brand b ON b.BrandId = p.BrandId
    OUTER APPLY (
      SELECT TOP (1) pi.ImageUrl FROM dbo.ProductImage pi WHERE pi.ProductId = p.ProductId ORDER BY pi.IsPrimary DESC, pi.SortOrder
    ) image
    OUTER APPLY (
      SELECT TOP (1) ps.Price FROM dbo.ProductSku ps WHERE ps.ProductId = p.ProductId AND ps.Status = 'Active' ORDER BY ps.Price
    ) sku
    OUTER APPLY (
      SELECT SUM(QuantityOnHand - QuantityReserved) AS AvailableQuantity FROM dbo.Inventory i INNER JOIN dbo.ProductSku ps ON ps.SkuId = i.SkuId WHERE ps.ProductId = p.ProductId AND ps.Status = 'Active'
    ) inventory
    WHERE p.Status = 'Active'
      AND (@category IS NULL OR c.CategoryName LIKE @category)
      AND (@brand IS NULL OR b.BrandName LIKE @brand)
      AND (@minPrice IS NULL OR p.BasePrice >= @minPrice)
      AND (@maxPrice IS NULL OR p.BasePrice <= @maxPrice)
  `)

  // 3. Kết hợp kết quả (Hybrid Fusion)
  const productsMap = new Map<number, any>()

  for (const row of sqlResult.recordset) {
    const id = Number(row.id)
    const isSemantic = vectorCandidateIds.has(id)
    productsMap.set(id, {
      id,
      productId: id,
      name: String(row.name),
      slug: String(row.slug),
      basePrice: Number(row.basePrice),
      price: row.price !== null ? Number(row.price) : null,
      finalPrice: row.price !== null ? Number(row.price) : null,
      categoryName: String(row.categoryName),
      brandName: String(row.brandName),
      imageUrl: row.imageUrl ? String(row.imageUrl) : null,
      availableQuantity: Number(row.availableQuantity),
      matchType: isSemantic ? 'hybrid' : 'structured',
    })
  }

  // Nếu SQL lọc ít hơn limit, bổ sung thêm các ứng viên vector
  if (productsMap.size < limit && vectorCandidates.length > 0) {
    const missingIds = vectorCandidates
      .map((c) => c.productId)
      .filter((id) => !productsMap.has(id))
      .slice(0, limit - productsMap.size)

    if (missingIds.length > 0) {
      const extraRes = await pool.request().query(`
        SELECT
          p.ProductId AS id, p.ProductName AS name, p.Slug AS slug, p.BasePrice AS basePrice,
          c.CategoryName AS categoryName, b.BrandName AS brandName, image.ImageUrl AS imageUrl,
          sku.Price AS price, ISNULL(inventory.AvailableQuantity, 0) AS availableQuantity
        FROM dbo.Product p
        INNER JOIN dbo.Category c ON c.CategoryId = p.CategoryId
        INNER JOIN dbo.Brand b ON b.BrandId = p.BrandId
        OUTER APPLY (SELECT TOP (1) ImageUrl FROM dbo.ProductImage WHERE ProductId = p.ProductId ORDER BY IsPrimary DESC, SortOrder) image
        OUTER APPLY (SELECT TOP (1) Price FROM dbo.ProductSku WHERE ProductId = p.ProductId AND Status = 'Active' ORDER BY Price) sku
        OUTER APPLY (SELECT SUM(QuantityOnHand - QuantityReserved) AS AvailableQuantity FROM dbo.Inventory i INNER JOIN dbo.ProductSku ps ON ps.SkuId = i.SkuId WHERE ps.ProductId = p.ProductId AND ps.Status = 'Active') inventory
        WHERE p.ProductId IN (${missingIds.join(',')}) AND p.Status = 'Active'
      `)
      for (const row of extraRes.recordset) {
        const id = Number(row.id)
        productsMap.set(id, {
          id,
          productId: id,
          name: String(row.name),
          slug: String(row.slug),
          basePrice: Number(row.basePrice),
          price: row.price !== null ? Number(row.price) : null,
          finalPrice: row.price !== null ? Number(row.price) : null,
          categoryName: String(row.categoryName),
          brandName: String(row.brandName),
          imageUrl: row.imageUrl ? String(row.imageUrl) : null,
          availableQuantity: Number(row.availableQuantity),
          matchType: 'semantic',
        })
      }
    }
  }

  return {
    extracted,
    products: Array.from(productsMap.values()).slice(0, limit),
  }
}
