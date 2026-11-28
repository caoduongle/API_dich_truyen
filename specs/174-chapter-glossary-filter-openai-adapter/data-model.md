# Data Model: Lọc Từ điển Chặt theo Chương & Cổng Kết nối Chuẩn OpenAI (/v1/chat/completions)

**Feature**: `174-chapter-glossary-filter-openai-adapter`  
**Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/174-chapter-glossary-filter-openai-adapter/spec.md)  
**Note**: Không thay đổi `src/types.ts` và schema IndexedDB (`src/services/db.ts`, `DB_VERSION = 5`). Toàn bộ cấu hình kết nối và tùy chọn lọc từ điển lưu ở client-side config/session storage tương thích ngược 100%.

---

## 1. Entities & Type Definitions

### 1.1 `AIProviderMode` & `OpenAICompatiblePresetId` (`src/types/aiProvider.ts`)

```ts
export type AIProviderMode = 'gemini' | 'openai-compatible';

export type OpenAICompatiblePresetId =
  | 'deepseek'
  | 'qwen'
  | 'groq'
  | 'nvidia-nim'
  | 'ollama'
  | 'lm-studio'
  | 'custom';

export type OpenAIResponseFormatTier = 'json_schema' | 'json_object' | 'prompt_only';
```

### 1.2 `OpenAICompatiblePreset` (`src/config/aiProviders.ts`)

| Field | Type | Description |
|-------|------|-------------|
| `id` | `OpenAICompatiblePresetId` | Mã preset chuẩn hóa |
| `label` | `string` | Tên hiển thị trên UI (vd: `DeepSeek`, `Ollama (Local)`) |
| `baseUrl` | `string` | URL gốc chuẩn kết thúc bằng `/v1` hoặc `/compatible-mode/v1` |
| `defaultModel` | `string` | Mã model gợi ý khi chọn preset |
| `suggestedModels` | `string[]` | Danh sách gợi ý nhanh khi chưa gọi `/v1/models` |
| `isLocal` | `boolean` | `true` cho `ollama`, `lm-studio` (cho phép bỏ trống API key & dùng HTTP trên `localhost`) |
| `requiresApiKey` | `boolean` | `false` cho preset local, `true` cho preset đám mây |
| `corsHint` | `string \| undefined` | Gợi ý bật CORS cho phần mềm local |

### 1.3 `OpenAICompatibleConfig` & `AIProviderConfig` (`src/types/aiProvider.ts`)

| Field | Type | Persistence Boundary | Description |
|-------|------|----------------------|-------------|
| `providerMode` | `AIProviderMode` | `localStorage` (`ai_provider_config_v1`) | Chế độ đang hoạt động (`'gemini'` mặc định \| `'openai-compatible'`) |
| `presetId` | `OpenAICompatiblePresetId` | `localStorage` (`ai_provider_config_v1`) | Preset OpenAI đang chọn |
| `baseUrl` | `string` | `localStorage` (`ai_provider_config_v1`) | Địa chỉ gốc chuẩn OpenAI của người dùng |
| `model` | `string` | `localStorage` (`ai_provider_config_v1`) | Mã mô hình OpenAI-compatible đang chọn |
| `openAIApiKeys` | `string[]` | `sessionStorage` (`openai_api_keys`) + opt-in `app_ui_prefs.savedOpenAIKeys` | Danh sách API key riêng cho cổng OpenAI (rỗng hợp lệ nếu local) |

### 1.4 `ChapterGlossaryFilterResult<T>` (`src/lib/glossaryMatch.ts`)

| Field | Type | Description |
|-------|------|-------------|
| `entries` | `T[]` | Danh sách mục từ điển đưa vào prompt (mặc định = `matchedInSource`) |
| `matchedInSource` | `T[]` | Tập con khớp trực tiếp với `sourceText` (giản/phồn + `variants`) |
| `conflicts` | `GlossaryConflictWarning[]` | Xung đột ánh xạ phát hiện khi giải quyết trùng lặp |
| `totalCount` | `number` | Tổng số mục hợp lệ trước khi lọc (ví dụ `577`) |
| `filteredCount` | `number` | Số mục thực tế sau khi lọc (`entries.length`, ví dụ `18`) |

---

## 2. State Transitions

### 2.1 OpenAI Structured Response-Format Fallback (`openaiClient.ts`)

| Current Tier (`baseUrl::model`) | Trigger Response | Next Tier | Behavior |
|---------------------------------|------------------|-----------|----------|
| `json_schema` | HTTP `200` valid JSON | `json_schema` | Giữ nguyên strict schema |
| `json_schema` | HTTP `400` / `422` từ chối `response_format` / `json_schema` | `json_object` | Tự động thử lại ngay bằng `{ type: 'json_object' }` + nhúng hướng dẫn schema vào `systemInstruction` |
| `json_object` | HTTP `400` / `422` từ chối `response_format` | `prompt_only` | Tự động thử lại ngay bằng text mode có chỉ dẫn JSON ở `systemInstruction` |
| `prompt_only` | Phản hồi chứa `<think>...</think>` hoặc ```` ```json ```` | `prompt_only` | Bóc tách sạch qua `stripModelThinkingBlocks` + `safeParseJson` |

### 2.2 Provider Mode & Local Key Validation

| `providerMode` | `isLocalProviderUrl(baseUrl)` | `openAIApiKeys.length` | Valid to Run? |
|----------------|-------------------------------|------------------------|---------------|
| `'gemini'` | N/A | `geminiApiKeys.length >= 1` | Yes (Gemini flow) |
| `'openai-compatible'` | `true` (`localhost` / `127.0.0.1` / `[::1]`) | `0` hoặc `>= 1` | Yes (omits `Authorization` if 0 keys) |
| `'openai-compatible'` | `false` (remote HTTPS host) | `0` | No — yêu cầu nhập ít nhất 1 API key |
| `'openai-compatible'` | `false` (`http://` remote host / invalid scheme) | Any | Blocked — URL không hợp lệ / không an toàn |
