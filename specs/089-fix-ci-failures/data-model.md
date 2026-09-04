# Data & Configuration Model: CI Workflow & File Validation

**Feature**: `089-fix-ci-failures`  
**Date**: 2026-09-05  

---

## 1. File Validation Model

### 1.1. `FileValidationResult`
Interface cấu trúc kết quả thẩm định tệp tin tải lên:

```typescript
export interface FileValidationResult {
  valid: boolean;
  error?: string;
  sanitizedFilename?: string;
}
```

- **`valid`** (`boolean`): Trạng thái tệp tin có hợp lệ và an toàn hay không.
- **`error`** (`string`, optional): Thông điệp báo lỗi chi tiết khi tệp không hợp lệ (vượt kích thước, sai định dạng, sai Magic Header).
- **`sanitizedFilename`** (`string`, optional): Tên tệp tin sau khi đã được chuẩn hóa đường dẫn và khử trùng toàn bộ ký tự nguy hiểm.

### 1.2. Đường Dẫn & Quy Tắc Chuẩn Hóa
- **Input Path**: `rawFilename` (chuỗi bất kỳ chứa ký tự gạch chéo ngược `\` hoặc gạch chéo xuôi `/`).
- **Normalized Path**: `rawFilename.replace(/\\/g, "/")`.
- **Safe Characters Whitelist**: `a-zA-Z0-9_\-\. ` kèm ký tự tiếng Việt Unicode (`\u00C0-\u024F\u1EA0-\u1EF9`) và ký tự chữ Hán (`\u4E00-\u9FFF`).
- **Fallback Rule**: Nếu chuỗi sau xử lý rỗng hoặc input không hợp lệ, sinh tên định dạng: `upload_${Date.now()}`.

---

## 2. GitHub Actions Workflow Configuration Model

### 2.1. Cấu Trúc Pipeline Job `build-and-test`
Mô hình tuần tự của các bước thực thi trên `ubuntu-latest`:

```text
+------------------------------------+
| 1. Checkout repository             |
+------------------------------------+
                  |
+------------------------------------+
| 2. Set up Node.js (v20, cache npm) |
+------------------------------------+
                  |
+------------------------------------+
| 3. Install dependencies (npm ci)   |
+------------------------------------+
                  |
+------------------------------------+
| 4. Security audit (npm audit)      |
+------------------------------------+
                  |
+------------------------------------+
| 5. Secret leak pattern detection   |
+------------------------------------+
                  |
+------------------------------------+
| 6. Type check (npm run lint)       |
+------------------------------------+
                  |
+------------------------------------+
| 7. Build (npm run build)           |  <--- Chuyển lên trước test
+------------------------------------+
                  |
+------------------------------------+
| 8. Run tests (npm test)            |  <--- Chạy sau khi đã có dist/
+------------------------------------+
```

### 2.2. Trạng Thái Môi Trường Kiểm Thử (Build Artifacts Dependency)
- **`dist/client`**: Chứa bundle frontend cùng các tài nguyên tĩnh (`robots.txt`, `sitemap.xml`, `llms.txt`).
- **`dist/server/server.cjs`**: Bundle mã nguồn backend phục vụ triển khai production.
- **Điều kiện tiên quyết của `npm test`**: Toàn bộ tài nguyên tĩnh và thư mục `dist/` phải sẵn sàng trước khi bộ test tích hợp `quickstartVerification.test.ts` khởi động.
