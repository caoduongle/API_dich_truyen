# Interface Contract: Technical SEO, Indexing & Fallback Endpoints

**Feature**: `087-technical-seo-devibecode`  
**Date**: 2026-09-05  

---

## 1. Endpoints Phục Vụ Crawler & AI Agents

### 1.1. `GET /robots.txt`
Chỉ dẫn thu thập dữ liệu cho Search Engines.
- **Request**: `GET /robots.txt`
- **Response**:
  - Status: `200 OK`
  - Content-Type: `text/plain; charset=utf-8`
  - Cache-Control: `public, max-age=86400`
- **Body Sample**:
  ```text
  User-agent: *
  Allow: /
  Disallow: /api/
  Disallow: /ws/
  Sitemap: https://dich-truyen.example.com/sitemap.xml
  ```

---

### 1.2. `GET /sitemap.xml`
Sơ đồ trang web liệt kê các route công khai.
- **Request**: `GET /sitemap.xml`
- **Response**:
  - Status: `200 OK`
  - Content-Type: `application/xml; charset=utf-8`
  - Cache-Control: `public, max-age=86400`
- **Body Sample**:
  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
      <loc>https://dich-truyen.example.com/</loc>
      <lastmod>2026-09-05</lastmod>
      <changefreq>daily</changefreq>
      <priority>1.0</priority>
    </url>
  </urlset>
  ```

---

### 1.3. `GET /llms.txt`
Ngữ cảnh dành cho các mô hình ngôn ngữ lớn (LLM/AI crawler).
- **Request**: `GET /llms.txt`
- **Response**:
  - Status: `200 OK`
  - Content-Type: `text/markdown; charset=utf-8`
  - Cache-Control: `public, max-age=86400`
- **Body**: Markdown tóm lược dự án.

---

### 1.4. `GET /site.webmanifest`
Web App Manifest chuẩn hóa PWA metadata.
- **Request**: `GET /site.webmanifest`
- **Response**:
  - Status: `200 OK`
  - Content-Type: `application/manifest+json; charset=utf-8`
  - Cache-Control: `public, max-age=604800`

---

## 2. API Unmatched 404 Fallback Contract

### `ALL /api/*` (Bất kỳ endpoint API nào không khớp)
- **Request**: Bất kỳ phương thức (`GET`, `POST`, `PUT`, `DELETE`) tới route không tồn tại dưới `/api/`
- **Response**:
  - Status: `404 Not Found`
  - Content-Type: `application/json; charset=utf-8`
  - Body:
    ```json
    {
      "error": "Not Found",
      "message": "Đường dẫn API '/api/v1/unknown' không tồn tại trên hệ thống.",
      "statusCode": 404,
      "timestamp": "2026-09-05T03:15:00.000Z"
    }
    ```

