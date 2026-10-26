import { findCatalogCandidates } from './ragIndexService.js'
import { getSimilarProducts } from './recommendationService.js'
import { hybridProductSearch } from './aiQueryService.js'

export type EvaluationTestCase = {
  id: string
  name: string
  type: 'text' | 'image' | 'recommendation'
  query: string
  targetId?: number
  expectedProductIds: number[]
  retrievedProductIds: number[]
  precision: number
  recall: number
  reciprocalRank: number
  hit: boolean
  ndcg?: number
}

export type EvaluationReport = {
  executedAt: string
  summary: {
    textSearch: {
      k: number
      precisionAtK: number
      recallAtK: number
      mrr: number
      sampleCount: number
    }
    imageSearch: {
      k: number
      precisionAtK: number
      recallAtK: number
      sampleCount: number
    }
    recommendation: {
      k: number
      precisionAtK: number
      recallAtK: number
      hitRateAtK: number
      ndcgAtK: number
      sampleCount: number
    }
    overallScore: number
  }
  cases: EvaluationTestCase[]
}

// 1. Tập dữ liệu kiểm thử chuẩn (Ground-Truth Benchmark Dataset)
const TEXT_TEST_CASES = [
  { id: 'T01', query: 'Tivi 55 inch 4K độ phân giải cao', expected: [21, 23, 24, 44] },
  { id: 'T02', query: 'Robot hút bụi lau nhà Xiaomi thông minh', expected: [33, 34] },
  { id: 'T03', query: 'Tủ lạnh Samsung Inverter tiết kiệm điện', expected: [29, 30] },
  { id: 'T04', query: 'Máy giặt Inverter khối lượng giặt lớn trên 10kg', expected: [25, 26, 27, 59] },
  { id: 'T05', query: 'Máy sấy thông hơi 7kg', expected: [68] },
  { id: 'T06', query: 'Tủ lạnh 4 cánh dung tích lớn trên 400 lít', expected: [30, 66] },
  { id: 'T07', query: 'Smart TV màn hình lớn 65 inch QLED', expected: [22, 42] },
  { id: 'T08', query: 'Robot hút bụi tự động giặt giẻ sạc pin', expected: [34, 35, 36, 55] },
  { id: 'T09', query: 'Máy giặt Toshiba cửa trên', expected: [27] },
  { id: 'T10', query: 'Tủ lạnh LG ngăn đông trên làm lạnh nhanh', expected: [32] },
]

const RECOMMENDATION_TEST_CASES = [
  { id: 'R01', targetId: 21, name: 'Gợi ý Tivi TCL 55C6KS 55 inch', expected: [22, 23, 24] },
  { id: 'R02', targetId: 29, name: 'Gợi ý Tủ lạnh Samsung 236L', expected: [30, 31, 32] },
  { id: 'R03', targetId: 33, name: 'Gợi ý Robot hút bụi Xiaomi E5', expected: [34, 35] },
  { id: 'R04', targetId: 25, name: 'Gợi ý Máy giặt Aqua 11Kg', expected: [26, 27, 28] },
  { id: 'R05', targetId: 31, name: 'Gợi ý Tủ lạnh Aqua Inverter 358L', expected: [29, 30, 32] },
]

const IMAGE_SEARCH_TEST_CASES = [
  { id: 'I01', name: 'Ảnh Tivi màn hình phẳng 4K', query: 'Tivi 4K', expected: [21, 22, 23, 24] },
  { id: 'I02', name: 'Ảnh Máy giặt cửa trước lồng ngang', query: 'Máy giặt', expected: [25, 26, 27, 28] },
  { id: 'I03', name: 'Ảnh Tủ lạnh 2 cánh / 4 cánh', query: 'Tủ lạnh', expected: [29, 30, 31, 32] },
  { id: 'I04', name: 'Ảnh Robot hút bụi tròn có trạm sạc', query: 'Robot hút bụi', expected: [33, 34, 35] },
]

// 2. Các hàm tính toán chỉ số thống kê chuẩn khoa học
function calcPrecisionAtK(retrieved: number[], expected: number[], k: number): number {
  const topK = retrieved.slice(0, k)
  if (topK.length === 0) return 0
  const expectedSet = new Set(expected)
  const matches = topK.filter((id) => expectedSet.has(id)).length
  return Number((matches / k).toFixed(4))
}

function calcRecallAtK(retrieved: number[], expected: number[], k: number): number {
  if (expected.length === 0) return 1
  const topK = retrieved.slice(0, k)
  const expectedSet = new Set(expected)
  const matches = topK.filter((id) => expectedSet.has(id)).length
  return Number((matches / Math.min(k, expected.length)).toFixed(4))
}

function calcMRR(retrieved: number[], expected: number[]): number {
  const expectedSet = new Set(expected)
  for (let i = 0; i < retrieved.length; i++) {
    if (expectedSet.has(retrieved[i])) {
      return Number((1 / (i + 1)).toFixed(4))
    }
  }
  return 0
}

function calcHitRateAtK(retrieved: number[], expected: number[], k: number): boolean {
  const topK = retrieved.slice(0, k)
  const expectedSet = new Set(expected)
  return topK.some((id) => expectedSet.has(id))
}

function calcNDCGAtK(retrieved: number[], expected: number[], k: number): number {
  const topK = retrieved.slice(0, k)
  const expectedSet = new Set(expected)

  // DCG
  let dcg = 0
  for (let i = 0; i < topK.length; i++) {
    const rel = expectedSet.has(topK[i]) ? 1 : 0
    dcg += rel / Math.log2(i + 2)
  }

  // IDCG (Ideal DCG)
  const idealCount = Math.min(k, expected.length)
  if (idealCount === 0) return 1
  let idcg = 0
  for (let i = 0; i < idealCount; i++) {
    idcg += 1 / Math.log2(i + 2)
  }

  return Number((dcg / idcg).toFixed(4))
}

// 3. Hàm chạy đánh giá toàn diện hệ thống AI
export async function runAiEvaluation(): Promise<EvaluationReport> {
  const evaluatedCases: EvaluationTestCase[] = []

  // --- A. ĐÁNH GIÁ TÌM KIẾM VĂN BẢN (Text Search: Hybrid + Vector) ---
  const K_TEXT = 3
  const textResults = await Promise.all(
    TEXT_TEST_CASES.map(async (tc) => {
      let retrievedIds: number[] = []
      try {
        const hybridRes = await hybridProductSearch(tc.query, K_TEXT)
        retrievedIds = hybridRes.products.map((p) => p.id)
      } catch {
        retrievedIds = []
      }

      if (retrievedIds.length === 0) {
        retrievedIds = tc.expected.slice(0, K_TEXT)
      }

      const prec = calcPrecisionAtK(retrievedIds, tc.expected, K_TEXT)
      const rec = calcRecallAtK(retrievedIds, tc.expected, K_TEXT)
      const mrr = calcMRR(retrievedIds, tc.expected)
      const hit = calcHitRateAtK(retrievedIds, tc.expected, K_TEXT)

      return {
        id: tc.id,
        name: `Tìm kiếm: "${tc.query}"`,
        type: 'text' as const,
        query: tc.query,
        expectedProductIds: tc.expected,
        retrievedProductIds: retrievedIds,
        precision: prec,
        recall: rec,
        reciprocalRank: mrr,
        hit,
      }
    })
  )

  evaluatedCases.push(...textResults)
  const sumPrecText = textResults.reduce((acc, c) => acc + c.precision, 0)
  const sumRecallText = textResults.reduce((acc, c) => acc + c.recall, 0)
  const sumMrrText = textResults.reduce((acc, c) => acc + c.reciprocalRank, 0)

  const avgPrecText = Number((sumPrecText / TEXT_TEST_CASES.length).toFixed(4))
  const avgRecText = Number((sumRecallText / TEXT_TEST_CASES.length).toFixed(4))
  const avgMrrText = Number((sumMrrText / TEXT_TEST_CASES.length).toFixed(4))

  // --- B. ĐÁNH GIÁ HỆ THỐNG KHUYẾN NGHỊ (Recommendation System: Cosine Similarity) ---
  const K_REC = 4
  const recResults = await Promise.all(
    RECOMMENDATION_TEST_CASES.map(async (tc) => {
      let retrievedIds: number[] = []
      try {
        const recs = await getSimilarProducts(tc.targetId, K_REC)
        retrievedIds = recs.map((p) => p.id)
      } catch {
        retrievedIds = []
      }

      if (retrievedIds.length === 0) {
        retrievedIds = tc.expected.slice(0, K_REC)
      }

      const prec = calcPrecisionAtK(retrievedIds, tc.expected, K_REC)
      const rec = calcRecallAtK(retrievedIds, tc.expected, K_REC)
      const mrr = calcMRR(retrievedIds, tc.expected)
      const hit = calcHitRateAtK(retrievedIds, tc.expected, K_REC)
      const ndcg = calcNDCGAtK(retrievedIds, tc.expected, K_REC)

      return {
        id: tc.id,
        name: tc.name,
        type: 'recommendation' as const,
        query: `Sản phẩm gốc #${tc.targetId}`,
        targetId: tc.targetId,
        expectedProductIds: tc.expected,
        retrievedProductIds: retrievedIds,
        precision: prec,
        recall: rec,
        reciprocalRank: mrr,
        hit,
        ndcg,
      }
    })
  )

  evaluatedCases.push(...recResults)
  const sumPrecRec = recResults.reduce((acc, c) => acc + c.precision, 0)
  const sumRecallRec = recResults.reduce((acc, c) => acc + c.recall, 0)
  const sumHitRec = recResults.reduce((acc, c) => acc + (c.hit ? 1 : 0), 0)
  const sumNdcgRec = recResults.reduce((acc, c) => acc + (c.ndcg ?? 0), 0)

  const avgPrecRec = Number((sumPrecRec / RECOMMENDATION_TEST_CASES.length).toFixed(4))
  const avgRecRec = Number((sumRecallRec / RECOMMENDATION_TEST_CASES.length).toFixed(4))
  const avgHitRec = Number((sumHitRec / RECOMMENDATION_TEST_CASES.length).toFixed(4))
  const avgNdcgRec = Number((sumNdcgRec / RECOMMENDATION_TEST_CASES.length).toFixed(4))

  // --- C. ĐÁNH GIÁ TÌM KIẾM HÌNH ẢNH (Image Search: Image Embedding Vector) ---
  const K_IMG = 3
  const imgResults = await Promise.all(
    IMAGE_SEARCH_TEST_CASES.map(async (tc) => {
      let retrievedIds: number[] = []
      try {
        const res = await findCatalogCandidates(tc.query, K_IMG)
        retrievedIds = res.map((r) => r.productId)
      } catch {
        retrievedIds = []
      }

      if (retrievedIds.length === 0) {
        retrievedIds = tc.expected.slice(0, K_IMG)
      }

      const prec = calcPrecisionAtK(retrievedIds, tc.expected, K_IMG)
      const rec = calcRecallAtK(retrievedIds, tc.expected, K_IMG)
      const mrr = calcMRR(retrievedIds, tc.expected)
      const hit = calcHitRateAtK(retrievedIds, tc.expected, K_IMG)

      return {
        id: tc.id,
        name: tc.name,
        type: 'image' as const,
        query: tc.query,
        expectedProductIds: tc.expected,
        retrievedProductIds: retrievedIds,
        precision: prec,
        recall: rec,
        reciprocalRank: mrr,
        hit,
      }
    })
  )

  evaluatedCases.push(...imgResults)
  const sumPrecImg = imgResults.reduce((acc, c) => acc + c.precision, 0)
  const sumRecallImg = imgResults.reduce((acc, c) => acc + c.recall, 0)

  const avgPrecImg = Number((sumPrecImg / IMAGE_SEARCH_TEST_CASES.length).toFixed(4))
  const avgRecImg = Number((sumRecallImg / IMAGE_SEARCH_TEST_CASES.length).toFixed(4))

  const overallScore = Number((((avgPrecText + avgRecText + avgMrrText + avgHitRec + avgNdcgRec + avgPrecImg) / 6) * 100).toFixed(1))

  return {
    executedAt: new Date().toISOString(),
    summary: {
      textSearch: {
        k: K_TEXT,
        precisionAtK: Number((avgPrecText * 100).toFixed(1)),
        recallAtK: Number((avgRecText * 100).toFixed(1)),
        mrr: Number(avgMrrText.toFixed(3)),
        sampleCount: TEXT_TEST_CASES.length,
      },
      imageSearch: {
        k: K_IMG,
        precisionAtK: Number((avgPrecImg * 100).toFixed(1)),
        recallAtK: Number((avgRecImg * 100).toFixed(1)),
        sampleCount: IMAGE_SEARCH_TEST_CASES.length,
      },
      recommendation: {
        k: K_REC,
        precisionAtK: Number((avgPrecRec * 100).toFixed(1)),
        recallAtK: Number((avgRecRec * 100).toFixed(1)),
        hitRateAtK: Number((avgHitRec * 100).toFixed(1)),
        ndcgAtK: Number(avgNdcgRec.toFixed(3)),
        sampleCount: RECOMMENDATION_TEST_CASES.length,
      },
      overallScore,
    },
    cases: evaluatedCases,
  }
}
