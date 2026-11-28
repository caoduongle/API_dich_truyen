# Phase 0 Research: Lọc Từ điển Chặt theo Chương & Cổng Kết nối Chuẩn OpenAI (/v1/chat/completions)

**Feature**: `174-chapter-glossary-filter-openai-adapter`  
**Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/174-chapter-glossary-filter-openai-adapter/spec.md)  
**Date**: 2026-11-28

---

## D1 — Strict Chapter Glossary Filter (`filterGlossaryForChapter`, `FR-001`, `FR-002`, `FR-003`)

- **Decision**:  
  - Giữ nguyên hành vi mặc định (`maxPinned ?? 50`) của hàm cấp thấp `selectRelevantGlossary(sourceText, glossary, options?)` trong `src/lib/glossaryMatch.ts` để bảo đảm tương thích ngược 100% với các unit test hiện hành (`src/lib/__tests__/glossaryMatch.test.ts`).
  - Bổ sung hàm `filterGlossaryForChapter(sourceText, glossary, options?: { includePinned?: boolean; maxPinned?: number })` trong `src/lib/glossaryMatch.ts` với mặc định `includePinned = false` (`maxPinned: 0`), trả về `{ entries, matchedInSource, totalCount, filteredCount, conflicts }`.
  - Cập nhật `buildRawTranslationPayload`, `buildPolishTranslationPayload`, `buildQaCritiquePayload`, `buildAnalyzeGlossaryPayload` (`src/services/ai/prompts.ts`) và `targetedRepair.ts` để sử dụng bộ lọc chặt theo văn bản nguồn (đặc biệt `buildAnalyzeGlossaryPayload` lọc `knownGlossaryEntries` theo văn bản nguồn của chương trước khi giới hạn, thay vì `.slice(0, 150)` mù từ đầu mảng).
  - Thêm tùy chọn `includePinnedGlossary?: boolean` (mặc định `false`) đọc từ cấu hình chất lượng dịch và ghi log ngắn `[Lọc từ điển] Khớp X/Y mục trong chương hiện tại.` trong `src/services/chapterTranslationService.ts`.

- **Rationale**:  
  - Khi dự án tích lũy `577+` mục từ điển và có nhiều mục ghim (`isPinned`), việc nhồi thêm tới `50` mục không xuất hiện trong chương (hoặc `150` mục ở bước phân tích từ điển) làm phình prompt cho mọi request trên GĐ1/GĐ2/GĐ3, dễ làm model nhẹ (`gemini-3.5-flash-lite`, model local `7B–14B`) bị quá tải ngữ cảnh hoặc nhiễu định dạng JSON.
  - Bọc hàm `filterGlossaryForChapter` lên trên `selectRelevantGlossary` và giữ `selectRelevantGlossary` tương thích ngược giúp không phá vỡ test cũ mà vẫn giải quyết triệt để vấn đề.

- **Alternatives Considered**:  
  1. *Đổi mặc định `maxPinned = 0` trực tiếp trong `selectRelevantGlossary`*: Dễ làm hỏng các caller hoặc unit test kỳ vọng `selectRelevantGlossary` giữ hành vi ghim khi không truyền option.

---

## D2 — Single-Gateway OpenAI-Compatible Routing (`FR-004`, `FR-005`, `FR-006`)

- **Decision**:  
  Định tuyến tại cổng duy nhất `callGeminiDirect(options)` trong `src/services/directGeminiClient.ts`:
  - Khi `providerMode === 'gemini'` (mặc định ban đầu): gọi thẳng `callGemini(options)` hiện hành (`src/services/gemini/geminiClient.ts`), giữ nguyên 100% logic xoay vòng key và `localQuotaTracker` (`SC-005`).
  - Khi `providerMode === 'openai-compatible'`: chuyển tiếp sang `callOpenAICompatible(options)` trong `src/services/openai/openaiClient.ts`.
  - Cho phép nới lỏng điều kiện kiểm tra bắt buộc Gemini API key trong `chapterTranslationService.ts` (`executeSingleChapterTranslation`), `useTranslationProcess.ts` (`handleToggleProcessing`) và `directGlossaryEngine.ts` **chỉ khi** `providerMode === 'openai-compatible'` và `isLocalProviderUrl(config.baseUrl)` là `true`.

- **Rationale**:  
  - Toàn bộ GĐ1 (`rawTranslation.ts`), GĐ2 (`polishTranslation.ts`), GĐ3 (`qaCritique.ts`), `targetedRepair.ts`, `sentenceRewrite.ts`, `directGlossaryEngine.ts` và alignment đều đi qua `callGeminiDirect`. Cắm bộ chuyển mạch ngay tại `directGeminiClient.ts` giúp giữ nguyên 100% pipeline 3 giai đoạn mà không nhân bản code điều phối.

- **Alternatives Considered**:  
  1. *Nhánh hóa `if/else` ở từng service `rawTranslation` / `polishTranslation` / `qaCritique`*: Trùng lặp logic nặng nề và dễ lệch hành vi giữa 2 provider.

---

## D3 — Presets, URL Validation & Secure Credential Boundary (`FR-007`, `FR-008`, `FR-012`)

- **Decision**:  
  - Định nghĩa danh sách preset chuẩn `/v1/chat/completions` trong `src/config/aiProviders.ts`:
    - `deepseek`: `https://api.deepseek.com/v1`, model mẫu `deepseek-chat`
    - `qwen`: `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`, model mẫu `qwen-plus`
    - `groq`: `https://api.groq.com/openai/v1`, model mẫu `llama-3.3-70b-versatile`
    - `nvidia-nim`: `https://integrate.api.nvidia.com/v1`, model mẫu `meta/llama-3.3-70b-instruct`
    - `ollama`: `http://localhost:11434/v1`, model mẫu `qwen2.5:14b` (`allowEmptyKey: true`)
    - `lm-studio`: `http://localhost:1234/v1`, model mẫu `local-model` (`allowEmptyKey: true`)
    - `custom`: URL do người dùng tự nhập
  - Ràng buộc bảo mật URL qua `validateProviderBaseUrl(url)` & `isLocalProviderUrl(url)`: chấp nhận `https://` cho mọi host từ xa; chỉ cho phép `http://` với `localhost`, `127.0.0.1`, `[::1]`; từ chối scheme lạ (`javascript:`, `file:`, HTTP từ xa).
  - Lưu khóa API OpenAI trong `sessionStorage` (`openai_api_keys`), chỉ đồng bộ sang `app_ui_prefs.savedOpenAIKeys` khi người dùng bật `rememberKeys` (xóa sạch khi tắt), đồng nhất hoàn toàn với ranh giới bảo mật của `gemini_api_keys` trong `useAIConfig.ts`. Cấu hình không nhạy cảm (`providerMode`, `presetId`, `baseUrl`, `model`) lưu tách biệt dưới `ai_provider_config_v1` trong `localStorage`.

- **Rationale**:  
  Tuân thủ `AGENTS.md §12` và Constitution Principle IV: không ghi khóa plaintext lâu dài ngoài ý muốn và không sửa `src/types.ts` hoặc IndexedDB (`src/services/db.ts`).

- **Alternatives Considered**:  
  1. *Lưu chung `openaiKeys` vào `gemini_api_keys`*: Gây nhầm lẫn giữa khóa Google AI Studio (`AIza...`) và khóa DeepSeek/Groq (`sk-...`), phá vỡ bộ đếm quota Gemini.

---

## D4 — Multi-Key Rotation & Quota Isolation for Remote OpenAI Providers (`FR-009`)

- **Decision**:  
  - Khi chạy máy chủ cục bộ (`isLocalProviderUrl(baseUrl)` là `true`) và không có API key: gửi fetch không kèm header `Authorization` (hoặc bỏ qua key check), trả `successKeyIndex: 0`.
  - Khi chạy máy chủ từ xa có danh sách `apiKeys`: dùng `localQuotaTracker` với khóa ảo có tiền tố không gian tên (`openai:${host}:${rawKey}`) để xoay vòng khóa khi gặp `429`/`503` mà không bao giờ ghi đè hoặc lẫn vào trạng thái khóa Google Gemini.

- **Rationale**:  
  Tái sử dụng hoàn toàn hạ tầng `localQuotaTracker` và `waitWithAbort` đã ổn định thay vì viết bộ xoay vòng mới, đồng thời cách ly tuyệt đối theo namespace host.

- **Alternatives Considered**:  
  1. *Gọi tuần tự mảng key không qua tracker*: Mất tính năng bỏ qua khóa chết `401/403` và backoff `429` giữa các chương liên tiếp.

---

## D5 — Structured JSON Schema Translation, Graceful Fallback & `<think>` Stripping (`FR-010`, `SC-004`)

- **Decision**:  
  - Tạo `src/services/openai/openaiSchemaAdapter.ts` chuyển đổi đệ quy schema viết hoa kiểu Gemini (`OBJECT`, `ARRAY`, `STRING`, `NUMBER`, `INTEGER`, `BOOLEAN`) sang chuẩn JSON Schema viết thường (`object`, `array`, ...) kèm `additionalProperties: false` cho `response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } }`.
  - Hạ cấp tự động theo bậc khi gặp HTTP `400` / `422` liên quan đến tham số `response_format` / `json_schema`:
    `json_schema` → `json_object` (kèm mô tả trường JSON vào cuối `systemInstruction`) → `prompt_only` (chỉ dẫn JSON trong `systemInstruction`), đồng thời cache bậc tương thích cao nhất trong phiên theo khóa `(baseUrl, model)` để các chương sau không phải thử lỗi lặp lại.
  - Bổ sung `stripModelThinkingBlocks(text: string): string` trong `src/lib/text.ts` (loại bỏ `<think>[\s\S]*?</think>` và thẻ markdown code block) ngay trước bước `safeParseJson` trong `parseGeminiStructuredResponseWithState` và khi chuẩn hóa `content` từ `/v1/chat/completions`.

- **Rationale**:  
  DeepSeek R1, Qwen3 và nhiều mô hình GGUF chạy qua Ollama/LM Studio thường chèn `<think>...</think>` hoặc không hỗ trợ `json_schema` strict; lọc sớm ở tầng chung giúp GĐ1, GĐ2, GĐ3 và trích xuất từ điển đều hưởng lợi ngay.

- **Alternatives Considered**:  
  1. *Chỉ dùng `json_object` cho mọi provider*: Bỏ lỡ độ ổn định schema strict trên các model hỗ trợ tốt như `gpt-4o`/`deepseek`/`qwen-plus` mới.

---

## D6 — Error Classification & Local CORS Diagnostics (`FR-011`)

- **Decision**:  
  - Ánh xạ mã lỗi HTTP từ `/v1/chat/completions` về `GeminiRequestError` chuẩn của repo (`AUTH_FAILURE` cho `401/403`, `RESOURCE_NOT_FOUND` cho `404`, `RATE_LIMIT_RPM` cho `429` có hỗ trợ header `retry-after`, `SERVICE_OVERLOAD` cho `500/502/503`, `BAD_REQUEST` cho `400`).
  - Khi `fetch` ném lỗi mạng (`TypeError`) trên địa chỉ `isLocalProviderUrl(baseUrl)`, sinh thông báo tiếng Việt hướng dẫn chi tiết cách bật CORS cho Ollama (`OLLAMA_ORIGINS=*`) và LM Studio (`Enable CORS` trong Server Settings).

- **Rationale**:  
  Trình duyệt không cho đọc chi tiết phản hồi preflight CORS bị chặn (chỉ ném `TypeError: Failed to fetch`), nên phát hiện lỗi fetch trên host cục bộ giúp người dùng chẩn đoán trúng nguyên nhân ngay lập tức.

- **Alternatives Considered**:  
  1. *Hiển thị thông báo lỗi mạng chung chung*: Người dùng chạy Ollama/LM Studio local sẽ không biết cần bật `OLLAMA_ORIGINS` hoặc CORS toggle.
