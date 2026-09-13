# Data Model: EPUB Export Content Escaping, Dead Protocol Pruning & CSP Hardening

## 1. Entities & Type Definitions

### 1.1 `HtmlEscapedText`
```typescript
/**
 * Chuỗi văn bản đã được escape các ký tự đặc biệt HTML/XML
 */
export type HtmlEscapedText = string;

/**
 * Bảng ánh xạ escape 5 ký tự XML chuẩn
 */
export const XML_ENTITY_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
```

### 1.2 `EpubDocumentMetadata`
```typescript
export interface EpubDocumentMetadata {
  id: string; // Project UUID
  title: string; // Tên tác phẩm (cần escapeHtml)
  author?: string; // Tác giả (cần escapeHtml, mặc định "Khuyết Danh")
  genre?: string; // Thể loại (cần escapeHtml, mặc định "Chưa phân loại")
  tone?: string; // Tông giọng (cần escapeHtml, mặc định "Chuẩn")
  description?: string; // Giới thiệu tác phẩm (cần escapeHtml trước khi thay \n thành <br/>)
}
```

### 1.3 `EpubChapterItem`
```typescript
export interface EpubChapterItem {
  id: string; // chap_1, chap_2...
  title: string; // Tiêu đề chương (cần escapeHtml)
  paragraphs: string[]; // Mảng các đoạn văn bản (mỗi đoạn cần escapeHtml trước khi bọc <p>)
}
```

### 1.4 `SecurityHeadersPolicy`
```typescript
export interface SecurityHeadersPolicy {
  'Content-Security-Policy': string;
  'X-Content-Type-Options': 'nosniff';
  'X-Frame-Options': 'DENY';
  'Referrer-Policy': 'strict-origin-when-cross-origin';
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups';
  'Cross-Origin-Resource-Policy': 'same-origin';
  'Permissions-Policy': string;
  'Strict-Transport-Security': string;
}
```

---

## 2. Validation & Invariants

1. **Escaping Invariant**:
   - `escapeHtml("")` $\rightarrow$ `""`
   - `escapeHtml("A & B < C > D 'E' \"F\"")` $\rightarrow$ `"A &amp; B &lt; C &gt; D &#39;E&#39; &quot;F&quot;"`
   - `escapeHtml` does NOT double-escape if fed plain strings.
2. **EPUB Description Invariant**:
   - Raw description: `"Dòng 1 <tag>\nDòng 2 & test"`
   - `escapeHtml(desc)` $\rightarrow$ `"Dòng 1 &lt;tag&gt;\nDòng 2 &amp; test"`
   - `.replace(/\n+/g, '<br/>')` $\rightarrow$ `"Dòng 1 &lt;tag&gt;<br/>Dòng 2 &amp; test"`
   - Result: `<br/>` is preserved as a valid XHTML tag, and user-supplied content remains safely escaped.
3. **CSP Parity Invariant**:
   - `render.yaml` CSP == `vercel.json` CSP == `public/_headers` CSP (100% byte-for-byte equality).
