from io import BytesIO
from typing import List, Optional
import base64
import math
import re

import numpy as np
import requests
from fastapi import FastAPI
from pydantic import BaseModel
from PIL import Image
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

app = FastAPI(title="SmartHomeElectronics AI Search")

VIETNAMESE_HINTS = {
    "tivi": ["tv", "television", "màn hình", "4k", "qled", "google tv", "smart tv"],
    "máy giặt": ["giặt", "quần áo", "inverter", "kg", "lồng giặt", "cửa trên", "cửa trước"],
    "tủ lạnh": ["lạnh", "ngăn đông", "inverter", "lít", "bảo quản", "thực phẩm"],
    "robot hút bụi": ["robot", "hút bụi", "lau nhà", "deebot", "vacuum", "trạm sạc"],
    "máy lọc không khí": ["lọc", "không khí", "phòng ngủ", "bụi mịn", "purifier", "hepa"],
}

SYNONYMS = {
    "tv": "tivi television màn hình smart tv google tv qled oled 4k",
    "television": "tivi tv màn hình",

    "may giat": "máy giặt giặt quần áo lồng giặt inverter kg",
    "máy giặt": "máy giặt giặt quần áo lồng giặt inverter kg",

    "tu lanh": "tủ lạnh lạnh ngăn đông dung tích lít bảo quản thực phẩm",
    "tủ lạnh": "tủ lạnh lạnh ngăn đông dung tích lít bảo quản thực phẩm",

    "robot": "robot hút bụi lau nhà vacuum deebot dreame xiaomi",
    "hut bui": "hút bụi lau nhà robot vacuum",
    "hút bụi": "hút bụi lau nhà robot vacuum",

    "loc khong khi": "lọc không khí purifier hepa bụi mịn phòng ngủ",
    "lọc không khí": "lọc không khí purifier hepa bụi mịn phòng ngủ",

    "phong ngu": "phòng ngủ nhỏ yên tĩnh lọc không khí",
    "phòng ngủ": "phòng ngủ nhỏ yên tĩnh lọc không khí",

    "gia dinh dong nguoi": "gia đình đông người dung tích lớn 10kg 11kg 12kg 488 lít 65 inch",
    "gia đình đông người": "gia đình đông người dung tích lớn 10kg 11kg 12kg 488 lít 65 inch",
}


class ProductDoc(BaseModel):
    id: int
    name: str
    slug: str
    brandName: Optional[str] = ""
    categoryName: Optional[str] = ""
    description: Optional[str] = ""
    searchText: Optional[str] = ""
    imageUrls: List[str] = []


class SemanticRequest(BaseModel):
    query: str
    products: List[ProductDoc]
    limit: int = 12


class ImageRequest(BaseModel):
    imageBase64: str
    products: List[ProductDoc]
    limit: int = 12


class SearchItem(BaseModel):
    productId: int
    score: float
    keywordScore: Optional[float] = None
    semanticScore: Optional[float] = None
    imageScore: Optional[float] = None
    reason: str


class SearchResponse(BaseModel):
    data: List[SearchItem]


def normalize_text(value: str) -> str:
    value = (value or "").lower()
    value = re.sub(r"[^\w\s\.\-/+]+", " ", value, flags=re.UNICODE)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def expand_query(query: str) -> str:
    text = normalize_text(query)
    extra = []

    for key, value in SYNONYMS.items():
        if key in text:
            extra.append(value)

    for category, hints in VIETNAMESE_HINTS.items():
        if category in text or any(hint in text for hint in hints):
            extra.append(category)
            extra.extend(hints)

    return normalize_text(text + " " + " ".join(extra))


def keyword_score(query: str, document: str) -> float:
    query_terms = [term for term in normalize_text(query).split() if len(term) >= 2]

    if not query_terms:
        return 0.0

    document = normalize_text(document)
    hits = sum(1 for term in query_terms if term in document)

    return hits / max(len(set(query_terms)), 1)


def build_doc(product: ProductDoc) -> str:
    return normalize_text(" ".join([
        product.name or "",
        product.brandName or "",
        product.categoryName or "",
        product.description or "",
        product.searchText or "",
    ]))


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "ai-search",
    }


@app.post("/semantic", response_model=SearchResponse)
def semantic_search(payload: SemanticRequest):
    products = payload.products
    query = expand_query(payload.query)

    if not query or not products:
        return {"data": []}

    docs = [build_doc(product) for product in products]
    corpus = docs + [query]

    vectorizer = TfidfVectorizer(
        ngram_range=(1, 2),
        min_df=1,
    )

    matrix = vectorizer.fit_transform(corpus)
    semantic_scores = cosine_similarity(matrix[-1], matrix[:-1]).flatten()

    results = []

    for index, product in enumerate(products):
        k_score = keyword_score(query, docs[index])
        s_score = float(semantic_scores[index])
        hybrid = 0.4 * k_score + 0.6 * s_score

        if hybrid <= 0:
            continue

        results.append(SearchItem(
            productId=product.id,
            score=round(float(hybrid), 4),
            keywordScore=round(float(k_score), 4),
            semanticScore=round(float(s_score), 4),
            reason=f"Phù hợp với truy vấn '{payload.query}' theo tên, mô tả, danh mục, thương hiệu và thuộc tính sản phẩm.",
        ))

    results.sort(key=lambda item: item.score, reverse=True)

    return {
        "data": results[: max(1, min(payload.limit, 50))]
    }


def decode_image_base64(image_base64: str) -> Optional[Image.Image]:
    try:
        if "," in image_base64:
            image_base64 = image_base64.split(",", 1)[1]

        raw = base64.b64decode(image_base64)

        return Image.open(BytesIO(raw)).convert("RGB")
    except Exception:
        return None


def load_image_from_url(url: str) -> Optional[Image.Image]:
    try:
        if not url or not url.startswith(("http://", "https://")):
            return None

        response = requests.get(url, timeout=6)
        response.raise_for_status()

        return Image.open(BytesIO(response.content)).convert("RGB")
    except Exception:
        return None


def image_feature(image: Image.Image) -> np.ndarray:
    image = image.resize((128, 128))
    arr = np.asarray(image).astype("float32") / 255.0

    hist_parts = []

    for channel in range(3):
        hist, _ = np.histogram(
            arr[:, :, channel],
            bins=16,
            range=(0, 1),
            density=True,
        )
        hist_parts.append(hist)

    mean = arr.mean(axis=(0, 1))
    std = arr.std(axis=(0, 1))

    feature = np.concatenate(hist_parts + [mean, std])
    norm = np.linalg.norm(feature)

    if norm == 0 or math.isnan(norm):
        return feature

    return feature / norm


def cosine(a: np.ndarray, b: np.ndarray) -> float:
    denom = np.linalg.norm(a) * np.linalg.norm(b)

    if denom == 0:
        return 0.0

    return float(np.dot(a, b) / denom)


@app.post("/image", response_model=SearchResponse)
def image_search(payload: ImageRequest):
    query_image = decode_image_base64(payload.imageBase64)

    if query_image is None:
        return {"data": []}

    query_feature = image_feature(query_image)
    results = []

    for product in payload.products:
        best_score = 0.0

        for url in product.imageUrls:
            product_image = load_image_from_url(url)

            if product_image is None:
                continue

            score = cosine(query_feature, image_feature(product_image))
            best_score = max(best_score, score)

        if best_score > 0:
            results.append(SearchItem(
                productId=product.id,
                score=round(best_score, 4),
                imageScore=round(best_score, 4),
                reason="Ảnh tải lên có đặc trưng màu sắc/bố cục gần với ảnh sản phẩm trong hệ thống.",
            ))

    results.sort(key=lambda item: item.score, reverse=True)

    return {
        "data": results[: max(1, min(payload.limit, 50))]
    }