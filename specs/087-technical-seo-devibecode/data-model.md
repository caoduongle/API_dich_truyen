# Data Model: Technical SEO, Metadata & Structured Data

**Feature**: `087-technical-seo-devibecode`  
**Date**: 2026-09-05  

---

## 1. Entities & TypeScript Interfaces

### Entity 1: `SeoMetadataOptions`
Cấu trúc tham số điều khiển thẻ meta trang trong React client:

```typescript
export interface SeoMetadataOptions {
  /** Tiêu đề trang (chưa kèm hậu tố thương hiệu) */
  title: string;
  /** Thẻ mô tả tóm tắt nội dung phục vụ kết quả tìm kiếm Google (120-160 ký tự) */
  description?: string;
  /** Đường dẫn tương đối phục vụ sinh thẻ Canonical URL */
  canonicalPath?: string;
  /** Loại đối tượng Open Graph */
  ogType?: 'website' | 'article';
  /** Ảnh xem trước khi chia sẻ mạng xã hội */
  ogImage?: string;
}
```

### Entity 2: `BreadcrumbItem`
Cấu trúc thành phần phân cấp điều hướng kèm Microdata:

```typescript
export interface BreadcrumbItem {
  /** Nhãn hiển thị của nấc điều hướng */
  label: string;
  /** Hành động khi click (chuyển tab hoặc chuyển trang) */
  onClick?: () => void;
  /** Đường dẫn href nếu có */
  href?: string;
  /** Nấc hiện tại (cuối cùng) đang đứng */
  current?: boolean;
}
```

### Entity 3: `ApiErrorResponse`
Cấu trúc phản hồi lỗi JSON chuẩn hóa khi gọi API lỗi hoặc sai route:

```typescript
export interface ApiErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  path: string;
  timestamp: string;
}
```

---

## 2. Structured Data Schema (JSON-LD)

Mô hình dữ liệu có cấu trúc nhúng trong thẻ `<script type="application/ld+json">`:

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "@id": "https://dich-truyen.example.com/#webapp",
      "name": "AI Dịch Truyện Trung - Việt",
      "alternateName": "Bàn Biên Tập Bản Thảo Chu Sa",
      "applicationCategory": "MultimediaApplication",
      "operatingSystem": "Web Browser",
      "description": "Ứng dụng dịch thuật tiểu thuyết Trung - Việt chuyên sâu bằng AI với bộ nhớ ngữ cảnh và quản lý thuật ngữ.",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "VND"
      },
      "featureList": [
        "Dịch thuật song ngữ gióng hàng thời gian thực",
        "Dịch tự động hàng loạt 2 pha",
        "Quản lý từ điển nhân vật và thuật ngữ Glossary",
        "Kiểm định chất lượng văn phong Hako",
        "Đồng bộ Google Drive và lưu trữ ngoại tuyến IndexedDB"
      ]
    },
    {
      "@type": "WebSite",
      "@id": "https://dich-truyen.example.com/#website",
      "name": "Bàn Biên Tập Bản Thảo Chu Sa",
      "url": "https://dich-truyen.example.com/",
      "inLanguage": "vi-VN"
    }
  ]
}
```

