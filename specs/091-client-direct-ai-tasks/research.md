# Technical Research: Client-Direct AI Tasks

**Feature**: Chuyển Đổi Thuần Client-Side Cho 4 Tác Vụ AI Còn Lại  
**Spec**: [spec.md](./spec.md)  
**Status**: Completed  

---

## 1. Schema Isomorphism & Dependency Decoupling

### Context
Trong kiến trúc ban đầu, các hàm sinh prompt và responseSchema (`glossaryPrompts.ts`) nằm ở `server/utils/` và phụ thuộc vào enum `Type` từ `@google/genai` (SDK Node.js). Khi chuyển sang gọi trực tiếp từ trình duyệt, client không thể và không nên đóng gói toàn bộ SDK server nặng nề, cũng như không được gây lỗi module resolution trong Vite.

### Research & Decisions
- **Decision**: Tạo module dùng chung `shared/glossaryPrompts.ts` sử dụng chuỗi literal `"OBJECT"` và `"STRING"` trực tiếp thay thế cho `Type.OBJECT` và `Type.STRING`.
- **Rationale**: Google Gemini REST API v1beta chấp nhận cấu trúc OpenAPI/JSON Schema chuẩn với các giá trị kiểu dạng chuỗi (`type: "OBJECT"`, `type: "STRING"`, v.v.). Điều này cho phép mã nguồn chạy đẳng cấu (isomorphic) hoàn toàn giữa trình duyệt (Vite) và server (Node.js/Express) mà không cần phụ thuộc gói `@google/genai`.
- **Alternatives considered**:
  - *Cài đặt `@google/genai` phía client*: Bị loại bỏ vì kích thước bundle lớn (>500KB), rủi ro không tương thích môi trường browser native.
  - *Viết 2 bộ schema riêng biệt cho client và server*: Bị loại bỏ vì vi phạm nguyên tắc DRY, dễ gây lệch pha khi cập nhật prompt/schema.

---

## 2. Direct Gemini Invocation & Key Rotation

### Context
Trước đây, client gửi mảng `apiKeys` lên endpoint server Express qua body (`/api/analyze-glossary`, `/api/align-chapter`, v.v.), server dùng `rotateApiKey` để gọi Gemini. Điều này vi phạm nguyên lý Zero-Knowledge Session Sync khi khóa cá nhân rời khỏi thiết bị người dùng.

### Research & Decisions
- **Decision**: Xây dựng `directGlossaryEngine.ts` sử dụng `callDirectGeminiWithRotation` từ `directGeminiClient.ts`.
- **Rationale**: `directGeminiClient.ts` đã được thiết kế sẵn sàng cho client-side với cơ chế xoay vòng key khi gặp lỗi quota (429), lỗi mạng, hoặc token limit, hỗ trợ timeout và `AbortSignal`. Trình duyệt sẽ gửi trực tiếp request tới `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}`.
- **Alternatives considered**:
  - *Sử dụng Web Worker cho các cuộc gọi AI*: Không cần thiết vì các cuộc gọi HTTP `fetch` vốn đã bất đồng bộ (non-blocking) và không gây giật lag giao diện.

---

## 3. Adaptive Chunking & Divide and Conquer

### Context
Đối với các chương truyện hoặc văn bản quá dài (>12.000 ký tự), một lượt gọi Gemini duy nhất có thể bị cắt bớt (output token limit) hoặc vượt quá ngân sách context, làm sót thuật ngữ quan trọng.

### Research & Decisions
- **Decision**: Đưa helper `splitTextIntoChunks` vào `shared/text.ts` và tích hợp chiến lược Divide & Conquer trong `analyzeGlossaryDirect`.
- **Rationale**: Cho phép chia văn bản theo ranh giới dòng hoặc đoạn văn hợp lý (chunk size ~10.000 - 12.000 ký tự), phân tích từng chunk rồi gộp và loại bỏ trùng lặp (`mergeSuggestions` kết hợp `isHanEquivalent`). Cả frontend và backend (`glossaryController.ts`) đều tái sử dụng chung một hàm chuẩn hóa.
- **Alternatives considered**:
  - *Chỉ phân tích cố định 10.000 ký tự đầu và bỏ qua phần còn lại*: Không đảm bảo trích xuất đầy đủ thuật ngữ cho các chương dài trên 3.000 chữ Hán.

---

## 4. Backward Compatibility & Server Route Preservation

### Context
Người dùng hoặc các công cụ tự động hóa ngoài có thể vẫn đang gọi các endpoint `/api/analyze-glossary`, `/api/analyze-guidelines`, `/api/extract-glossary`, `/api/align-chapter`, `/api/qa-critique` trên server backend.

### Research & Decisions
- **Decision**: Giữ nguyên toàn bộ các route và controller trên server. `server/utils/glossaryPrompts.ts` và `server/utils/parser.ts` trở thành các re-export shim (`export * from '@shared/...'`).
- **Rationale**: Đảm bảo 100% không phá vỡ API contract hiện tại của backend, tuân thủ nghiêm ngặt quy tắc trong `AGENTS.md` ("Không sửa logic dịch/gọi API Gemini trong server/ khi nhiệm vụ là UI/Client") và yêu cầu của người dùng.
- **Alternatives considered**:
  - *Xóa bỏ các server routes để dọn dẹp mã nguồn*: Bị nghiêm cấm theo spec và yêu cầu của người dùng.

---

## 5. QA Critique 400 Error Resolution

### Context
Trong `useWorkspaceState.ts`, lệnh gọi `apiFetch('/api/qa-critique', { method: 'POST', body: ... })` không truyền cờ `allowApiKeysInBody: true`. Server middleware kiểm tra và trả về HTTP 400 Bad Request, khiến chức năng kiểm duyệt AI bị tê liệt.

### Research & Decisions
- **Decision**: Thay thế toàn bộ lệnh gọi API server bằng hàm trực tiếp `qaCritiqueDirect({ sourceText, translatedText, apiKeys, model, startKeyIndex })` trong `directGlossaryEngine.ts`.
- **Rationale**: Khắc phục triệt để lỗi 400 vì request không còn đi qua server middleware; đồng thời khóa API được xoay vòng trực tiếp ngay trên client mà không rời khỏi trình duyệt.
