# Quickstart & Verification Scenarios: Technical SEO & De-Vibecode

**Feature**: `087-technical-seo-devibecode`  
**Date**: 2026-09-05  

Tài liệu này chứa các kịch bản chạy thử (runnable scenarios) độc lập để kiểm chứng toàn diện các tiêu chuẩn Technical SEO, Indexing và De-vibecode trước khi bàn giao production.

---

## Kịch Bản 1: Kiểm Tra Robots.txt

Kiểm chứng các công cụ tìm kiếm được phân quyền đúng đắn và nhận được vị trí sitemap.

```bash
curl -i http://localhost:3000/robots.txt
```

**Kỳ vọng**:
- HTTP Status: `200 OK`
- Header: `Content-Type: text/plain`
- Body chứa:
  ```text
  User-agent: *
  Allow: /
  Disallow: /api/
  Sitemap: https://dich-truyen.example.com/sitemap.xml
  ```

---

## Kịch Bản 2: Kiểm Tra Sitemap.xml

Kiểm chứng file sơ đồ website XML hợp lệ cho Googlebot.

```bash
curl -i http://localhost:3000/sitemap.xml
```

**Kỳ vọng**:
- HTTP Status: `200 OK`
- Header: `Content-Type: application/xml` (hoặc `text/xml`)
- Body chứa thẻ `<urlset>` và các thẻ `<url>` chứa đường dẫn tới các phân vùng chính.

---

## Kịch Bản 3: Kiểm Tra LLMs.txt

Kiểm chứng ngữ cảnh tóm lược Markdown cho các AI Crawler.

```bash
curl -i http://localhost:3000/llms.txt
```

**Kỳ vọng**:
- HTTP Status: `200 OK`
- Header: `Content-Type: text/markdown` hoặc `text/plain`
- Body chứa tiêu đề `# AI Dịch Truyện Trung - Việt` và danh sách tính năng chính.

---

## Kịch Bản 4: Kiểm Tra API 404 Handler (JSON Fallback)

Kiểm chứng máy chủ không trả về tài liệu HTML khi gọi nhầm endpoint API.

```bash
curl -i http://localhost:3000/api/v1/invalid-route
```

**Kỳ vọng**:
- HTTP Status: `404 Not Found`
- Header: `Content-Type: application/json`
- Body chứa:
  ```json
  {
    "error": "Not Found",
    "statusCode": 404
  }
  ```

---

## Kịch Bản 5: Kiểm Tra Loại Bỏ Hoàn Toàn Production Sourcemaps

Kiểm chứng không có file `.map` nào bị lộ trong bản build sản xuất.

```bash
# Kiểm tra trong thư mục client
ls dist/client/assets/*.map
# Kết quả mong đợi: File not found

# Kiểm tra trong thư mục server
ls dist/server/*.map
# Kết quả mong đợi: File not found
```

