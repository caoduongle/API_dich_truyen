# Data Model: Client-Direct AI Tasks

**Feature**: Chuyển Đổi Thuần Client-Side Cho 4 Tác Vụ AI Còn Lại  
**Spec**: [spec.md](./spec.md)  
**Status**: Completed  

---

## 1. Core Entities & Interfaces

### 1.1 `GlossarySuggestion`
Thực thể gợi ý thuật ngữ được AI trích xuất từ văn bản gốc.

| Thuộc tính | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `chinese` | `string` | Có | Cụm từ tiếng Trung gốc trong ngữ cảnh. |
| `vietnamese` | `string` | Có | Dịch nghĩa Hán Việt hoặc thuần Việt được đề xuất. |
| `explanation` | `string` | Không | Giải thích ngữ cảnh, danh xưng, chiêu thức, v.v. |
| `sourceChapterId` | `string` | Không | ID chương nguồn phát hiện thuật ngữ. |

### 1.2 `GlossaryAnalysisResult`
Kết quả phân tích thuật ngữ trả về cho client.

| Thuộc tính | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `suggestions` | `GlossarySuggestion[]` | Có | Danh sách các thuật ngữ đã lọc trùng lặp. |
| `truncated` | `boolean` | Không | Cờ thông báo nếu văn bản bị cắt tỉa do vượt quá ngưỡng an toàn. |
| `analyzedLength` | `number` | Không | Độ dài ký tự thực tế đã phân tích. |
| `originalLength` | `number` | Không | Tổng độ dài ký tự của văn bản gốc. |

### 1.3 `GuidelinesAnalysisResult`
Kết quả phân tích cẩm nang hướng dẫn dịch từ tệp Markdown.

| Thuộc tính | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `genre` | `string` | Có | Thể loại truyện (tiên hiệp, kiếm hiệp, đô thị, v.v.). |
| `tone` | `string` | Có | Tông giọng dịch thuật (hào sảng, cổ phong, hài hước, v.v.). |
| `description` | `string` | Có | Tóm tắt quy chuẩn dịch và phong cách ngôn từ. |
| `suggestions` | `GlossarySuggestion[]` | Có | Danh sách thuật ngữ bóc tách được từ bảng/danh sách trong markdown. |

### 1.4 `AlignChapterResult`
Kết quả gióng hàng song ngữ Trung - Việt phục vụ xuất học liệu / fine-tuning.

| Thuộc tính | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `jsonlLines` | `string[]` | Có | Mảng các dòng định dạng JSONL `{"source": "...", "target": "..."}`. |

### 1.5 `QaCritiqueResult` & `QaIssue`
Kết quả kiểm duyệt và đánh giá chất lượng bản dịch mài giũa.

```typescript
export interface QaIssue {
  type: 'omission' | 'addition' | 'repetition' | 'terminology' | 'other';
  snippet: string;       // Đoạn trích văn bản nghi vấn
  description: string;   // Mô tả lỗi và khuyến nghị chỉnh sửa
}

export interface QaCritiqueResult {
  isValid: boolean;      // True nếu bản dịch đạt chuẩn, không có lỗi nghiêm trọng
  issues: QaIssue[];     // Danh sách các vấn đề phát hiện
}
```

---

## 2. Input Parameter Contracts

### 2.1 `DirectCallCommonParams`
Các tham số cơ bản cho mọi cuộc gọi trực tiếp tới Gemini:

| Tham số | Kiểu dữ liệu | Bắt buộc | Mặc định | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `apiKeys` | `string[]` | Có | - | Danh sách Google Gemini API keys của người dùng. |
| `model` | `string` | Không | `'gemini-2.5-flash'` | Tên model Gemini chỉ định. |
| `startKeyIndex` | `number` | Không | `0` | Vị trí key bắt đầu xoay vòng. |
| `signal` | `AbortSignal` | Không | `undefined` | Tín hiệu hủy bỏ thao tác khi component unmount hoặc user bấm dừng. |

### 2.2 Task-Specific Inputs

- `AnalyzeGlossaryDirectParams`: Kế thừa `DirectCallCommonParams` + `{ text: string, sourceChapterId?: string, isFullScan?: boolean }`
- `AnalyzeGuidelinesDirectParams`: Kế thừa `DirectCallCommonParams` + `{ markdownContent: string }`
- `ExtractGlossaryDirectParams`: Kế thừa `DirectCallCommonParams` + `{ text: string, sourceChapterId?: string }`
- `AlignChapterDirectParams`: Kế thừa `DirectCallCommonParams` + `{ sourceText: string, translatedText: string }`
- `QaCritiqueDirectParams`: Kế thừa `DirectCallCommonParams` + `{ sourceText: string, translatedText: string }`

---

## 3. Data Transformations & Pipelines

```
[Văn bản Tiếng Trung]
         │
         ▼
[splitTextIntoChunks] (shared/text.ts)
  - Chunk size: ~10,000 - 12,000 chars
  - Split by newline / paragraph boundaries
         │
         ▼
[callDirectGeminiWithRotation] (directGeminiClient.ts)
  - JSON schema: GLOSSARY_ANALYSIS_SCHEMA (shared/glossaryPrompts.ts)
  - Literal types: "OBJECT", "STRING"
         │
         ▼
[mergeSuggestions & isHanEquivalent]
  - Chuẩn hóa chữ Hán tương đương
  - Loại bỏ các thuật ngữ trùng lặp
         │
         ▼
[GlossaryAnalysisResult] (Client UI State / IndexedDB)
```
