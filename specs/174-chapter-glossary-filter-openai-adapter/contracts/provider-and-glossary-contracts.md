# Interface Contracts: Feature 174 Glossary Filtering & OpenAI-Compatible Adapter

**Feature**: `174-chapter-glossary-filter-openai-adapter`  
**Date**: 2026-11-28

---

## 1. Domain Helpers & Prompt Builders

### 1.1 `filterGlossaryForChapter` (`src/lib/glossaryMatch.ts`)

```ts
export interface ChapterGlossaryFilterOptions {
  includePinned?: boolean; // mặc định false (tắt nhồi mục ghim không xuất hiện trong chương)
  maxPinned?: number;      // chỉ áp dụng khi includePinned === true (mặc định 15)
}

export interface ChapterGlossaryFilterResult<T extends GlossaryEntryLike>
  extends RelevantGlossarySelection<T> {
  totalCount: number;
  filteredCount: number;
}

export function filterGlossaryForChapter<T extends GlossaryEntryLike>(
  sourceText: string,
  glossary: T[],
  options?: ChapterGlossaryFilterOptions
): ChapterGlossaryFilterResult<T>;
```

- Khi `options?.includePinned !== true`: gọi `selectRelevantGlossary(sourceText, glossary, { maxPinned: 0 })` nên `entries` chứa **duy nhất** các mục xuất hiện trong `sourceText` (hỗ trợ giản thể/phồn thể & `variants`).
- Giữ nguyên chữ ký và mặc định `maxPinned = 50` trên `selectRelevantGlossary(...)` cho các caller/unit test cấp thấp cũ.

### 1.2 `stripModelThinkingBlocks` (`src/lib/text.ts`)

```ts
export function stripModelThinkingBlocks(rawText: string): string;
```

- Loại bỏ toàn bộ khối `<think>[\s\S]*?</think>` (case-insensitive) do các mô hình reasoning trả về, giữ nguyên phần JSON/nội dung thực tế; tích hợp trực tiếp trong `safeParseJson` (`src/lib/text.ts`) và bước nhận kết quả của `openaiClient.ts`.

### 1.3 Prompt Builders (`src/services/ai/prompts.ts`) & Repair (`src/services/translation/targetedRepair.ts`)

- `BuildRawTranslationPromptParams`, `BuildPolishTranslationPromptParams`, `BuildQaCritiquePromptParams`: thêm `includePinnedGlossary?: boolean`.
- `buildRawTranslationPayload`, `buildPolishTranslationPayload`, `buildQaCritiquePayload` và `targetedRepair.ts` dùng `filterGlossaryForChapter(..., { includePinned: Boolean(includePinnedGlossary) })` (tắt nhồi mục ghim theo mặc định `includePinnedGlossary = false`).
- `buildAnalyzeGlossaryPayload`: lọc `knownGlossaryEntries` và `knownChineseTerms` theo văn bản nguồn chương hiện tại qua `filterGlossaryForChapter` / `prioritizeKnownTermsForChapter` (chỉ giữ thuật ngữ khớp trong đoạn nguồn chương, không nhồi 150 mục ngoài chương).

---

## 2. OpenAI-Compatible Provider Configuration & Gateway

### 2.1 URL Validation & Presets (`src/config/aiProviders.ts`)

```ts
export const OPENAI_COMPATIBLE_PRESETS: Record<OpenAICompatiblePresetId, OpenAICompatiblePreset>;
export function isLocalProviderUrl(rawUrl: string): boolean;
export function validateProviderBaseUrl(rawUrl: string): { valid: boolean; normalizedUrl?: string; isLocal?: boolean; error?: string };
export function buildOpenAICompatibleEndpoint(baseUrl: string, path: '/chat/completions' | '/models'): string;
```

- `buildOpenAICompatibleEndpoint('http://localhost:11434/v1', '/chat/completions')` -> `'http://localhost:11434/v1/chat/completions'` (tránh lặp `/v1/v1`).
- `validateProviderBaseUrl` từ chối mọi URL không hợp lệ hoặc dùng `http://` cho host không phải `localhost`/`127.0.0.1`/`[::1]`.

### 2.2 Schema Adapter (`src/services/openai/openaiSchemaAdapter.ts`)

```ts
export function convertGeminiSchemaToJsonSchema(geminiSchema: Record<string, any>): Record<string, any>;
export function buildJsonInstructionHint(geminiSchema?: Record<string, any>): string;
```

- Chuyển đệ quy `OBJECT` -> `'object'`, `ARRAY` -> `'array'`, `STRING` -> `'string'`, `NUMBER` -> `'number'`, `INTEGER` -> `'integer'`, `BOOLEAN` -> `'boolean'`, giữ `enum`, `required`, `items`, `properties`, gắn `additionalProperties: false` trên mỗi `object` cho OpenAI strict JSON schema.

### 2.3 OpenAI Client (`src/services/openai/openaiClient.ts`)

```ts
export interface OpenAIConnectionTestResult {
  ok: boolean;
  latencyMs: number;
  modelCount?: number;
  message: string;
  isCorsSuspected?: boolean;
}

export async function callOpenAICompatible(
  options: DirectGeminiRequestOptions & { schema?: Record<string, any> },
  overrideConfig?: Partial<OpenAICompatibleConfig> & { apiKeys?: string[] }
): Promise<DirectGeminiResponse>;

export async function listOpenAIModels(
  baseUrl: string,
  apiKey?: string,
  options?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<ModelInfoItem[]>;

export async function testOpenAIConnection(
  baseUrl: string,
  model: string,
  apiKey?: string,
  options?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<OpenAIConnectionTestResult>;
```

- `callOpenAICompatible` dùng cùng hợp đồng `DirectGeminiRequestOptions` & `DirectGeminiResponse` (`{ text, successKeyIndex }`), hỗ trợ `signal` (`AbortSignal`), `timeoutMs`, xoay vòng nhiều key từ xa qua `localQuotaTracker` với prefix `openai:${host}:`, bỏ trống key cho local, tự hạ cấp `response_format`, lọc `<think>...</think>`, và trả `GeminiRequestError` chuẩn kèm gợi ý CORS khi `TypeError` trên host local.

### 2.4 Gateway Switch (`src/services/directGeminiClient.ts`)

- `callGeminiDirect(options)`: đọc cấu hình provider hiện hành (`getStoredAIProviderConfig()`):
  - `'gemini'` -> `callGemini(options)` (giữ nguyên 100% đường đi cũ).
  - `'openai-compatible'` -> `callOpenAICompatible(options)`.

---

## 3. Storage, Controller Hook & UI View Contracts

### 3.1 Storage Helper (`src/utils/aiProviderStorage.ts`)

- `getStoredAIProviderConfig()` / `saveStoredAIProviderConfig()` (`ai_provider_config_v1`).
- `loadOpenAIApiKeys()` / `saveOpenAIApiKeys(keys, rememberKeys)` (`sessionStorage['openai_api_keys']` + opt-in `app_ui_prefs.savedOpenAIKeys`, scrub khi `rememberKeys = false`).
- `getIncludePinnedGlossaryPreference()` / `setIncludePinnedGlossaryPreference(enabled: boolean)` (`include_pinned_glossary_in_prompt`, mặc định `false`).
- `maskSecretKey(key)` để hiển thị/log an toàn (`SC-006`).

### 3.2 Hook (`src/hooks/useAIConfig.ts`) & Context (`src/context/AIConfigContext.tsx`)

Bổ sung vào `useAIConfig` (giữ nguyên toàn bộ trường Gemini cũ):
- `providerMode`, `setProviderMode`
- `openAIConfig` (`presetId`, `baseUrl`, `model`), `updateOpenAIConfig`, `selectOpenAIPreset`
- `openAIApiKeys`, `addOpenAIKey`, `updateOpenAIKey`, `deleteOpenAIKey`
- `includePinnedGlossary`, `setIncludePinnedGlossary`

### 3.3 UI Components (`src/components/ApiSettings.tsx`, `src/components/api-settings/OpenAIProviderSection.tsx`, `src/components/api-settings/TranslationQualitySection.tsx`)

- **Design System ("Mực & Chu Sa")**: Dùng `Button`, `Badge`, `cn()`, bảng màu `bg-ink`, `bg-parchment-2`, `text-polish` (`#B8402C`), `amber-950/amber-300` cho cảnh báo CORS/lỗi, `rounded-[2px]`, `lucide-react`, không emoji.
- Trong `ApiSettings.tsx`: thanh chuyển đổi chế độ **Google Gemini** | **OpenAI-compatible (`/v1/chat/completions`)** ngay đầu tab Cấu hình AI; ẩn phần quản lý khóa Google khi chọn chế độ OpenAI-compatible và hiển thị `OpenAIProviderSection` (preset chips, Base URL input, danh sách khóa API cho phép rỗng với local + mask/ẩn hiện, Model selector kết hợp nút **Tải danh sách Model** `/v1/models` và nhập tay, nút **Kiểm tra kết nối**).
- Trong `TranslationQualitySection.tsx`: bổ sung toggle opt-in **"Đính kèm cả từ điển ghim ngoài chương"** (tắt mặc định) kèm mô tả ngắn về lọc chặt từ điển theo chương (`filter_glossary`).
- Trong `chapterTranslationService.ts`: ghi log `[Lọc từ điển] Khớp ${matchedCount}/${totalCount} mục trong chương hiện tại.` (với `totalCount > 0`) và ghi nhận chế độ nhà cung cấp đang chạy.
