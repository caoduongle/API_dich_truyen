# Implementation Plan: Lọc Từ điển Chặt theo Chương & Cổng Kết nối Chuẩn OpenAI (/v1/chat/completions)

**Branch**: `174-chapter-glossary-filter-openai-adapter` | **Date**: 2026-11-28 | **Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/174-chapter-glossary-filter-openai-adapter/spec.md)  
**Input**: Feature specification from `/specs/174-chapter-glossary-filter-openai-adapter/spec.md`

## Summary

Feature `174-chapter-glossary-filter-openai-adapter` bổ sung hai nâng cấp độc lập nhưng cộng hưởng trực tiếp trong kiến trúc Client-Side SPA hiện có:
1. **Lọc từ điển chặt theo văn bản nguồn từng chương (`filter_glossary`)**: Bổ sung `filterGlossaryForChapter` trong `src/lib/glossaryMatch.ts` (mặc định `includePinned: false`, `maxPinned: 0`, giữ nguyên `selectRelevantGlossary` cho tương thích ngược), áp dụng đồng bộ cho GĐ1 Dịch thô, GĐ2 Chuốt văn, GĐ3 QA Critique, `targetedRepair`, và `buildAnalyzeGlossaryPayload` (`src/services/ai/prompts.ts`) để loại bỏ toàn bộ hàng trăm mục không xuất hiện trong chương (ví dụ rút từ `577` mục xuống chỉ còn các mục khớp chương) kèm log tỷ lệ lọc và tùy chọn opt-in trong `TranslationQualitySection.tsx`.
2. **Cổng Adapter chuẩn `/v1/chat/completions`**: Mở rộng cổng điều phối `callGeminiDirect` (`src/services/directGeminiClient.ts`) chuyển mạch an toàn giữa **Google Gemini** (mặc định, giữ nguyên 100% logic xoay vòng & quota) và **OpenAI-compatible** (`src/services/openai/openaiClient.ts` + `openaiSchemaAdapter.ts`), hỗ trợ sẵn các preset **DeepSeek, Qwen, Groq, NVIDIA NIM, Ollama (Local), LM Studio (Local), Tùy chỉnh**, bỏ trống API key cho `localhost`/`127.0.0.1`, nạp danh sách `/v1/models`, kiểm tra kết nối, tự hạ cấp `response_format` (`json_schema` -> `json_object` -> `prompt_only`), lọc sạch `<think>...</think>` trong `safeParseJson`, và cảnh báo hướng dẫn CORS khi chạy local.

## Technical Context

**Language/Version**: TypeScript ~5.8.2 (`strict` mode) + React 19.0.1 + Vite 6.4.6  
**Primary Dependencies**: Native Browser `fetch`, `@google/genai` (giữ nguyên đường Gemini), `lucide-react`, `clsx`, `tailwind-merge` (zero new npm dependencies)  
**Storage**: Client-side `localStorage` (`ai_provider_config_v1`, `include_pinned_glossary_in_prompt`) cho cấu hình không nhạy cảm; `sessionStorage` (`openai_api_keys`) + opt-in `app_ui_prefs.savedOpenAIKeys` (scrub khi tắt `rememberKeys`) cho khóa API OpenAI; IndexedDB (`src/services/db.ts`) & `src/types.ts` untouched  
**Testing**: Vitest 4.1.12 (`vitest run`) with `jsdom` 29.1.1  
**Target Platform**: Pure Client-Side Web SPA (browsers calling remote HTTPS OpenAI-compatible APIs or local Ollama/LM Studio with CORS enabled)  
**Project Type**: Pure Client-Side Web Application (React + TypeScript SPA)  
**Performance Goals**: Giảm > 90% token từ điển thừa trên chương mẫu 577 mục, lọc O(G * text) chạy < 5ms mỗi chương, giữ nguyên cache `response_format` tương thích theo `(baseUrl, model)` trong phiên  
**Constraints**: Strict MVC (`Services/Lib/Utils -> Hooks -> Components`); tuyệt đối giữ nguyên hành vi mặc định Gemini khi chưa chuyển chế độ; chặn URL `http://` từ xa và không bao giờ lộ API key thô trong log/UI; thiết kế UI chuẩn "Mực & Chu Sa" (`rounded-[2px]`, không emoji)  
**Scale/Scope**: Hỗ trợ từ điển 500–2000+ mục mỗi dự án; 7 preset chuẩn `/v1/chat/completions` + custom URL; giữ nguyên toàn bộ 3 giai đoạn dịch + sửa cục bộ + phân tích từ điển

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Pre-Design | Post-Design | Verification Notes |
|-----------|------------|-------------|-------------------|
| **I. Strict Quality Gates & Verification** | PASS | PASS | Bắt buộc chạy `npm run lint`, `npm test`, `npm run build` sạch lỗi; giữ nguyên test cũ của `selectRelevantGlossary` & Gemini. |
| **II. Dependency Minimization & Existing Library Reuse** | PASS | PASS | Dùng native `fetch`, tái sử dụng `localQuotaTracker`, `GeminiRequestError`, `safeParseJson`, `Button`/`Badge`/`cn()`. Zero packages added. |
| **III. Strict Concern Separation & MVC** | PASS | PASS | Logic lọc từ điển & OpenAI adapter ở `src/lib/`, `src/services/`, `src/config/`, `src/utils/`; điều phối state ở `src/hooks/useAIConfig.ts` & `useTranslationProcess.ts`; UI ở `src/components/api-settings/`. |
| **IV. Immutable Core Schemas & Storage Stability** | PASS | PASS | `src/types.ts` và IndexedDB (`src/services/db.ts`, `DB_VERSION = 5`) không thay đổi; key bảo mật tuân thủ `sessionStorage` boundary. |
| **V. Atomic Commits & Documentation Synchronization** | PASS | PASS | Tài liệu đặc tả đồng bộ trong `specs/174-chapter-glossary-filter-openai-adapter/`; không mở rộng ngoài `FR-001`–`FR-012`. |

## Project Structure

### Documentation (this feature)

```text
specs/174-chapter-glossary-filter-openai-adapter/
├── spec.md                                      # Feature specification
├── checklists/
│   └── requirements.md                          # Spec quality checklist (16/16 pass)
├── plan.md                                      # This implementation plan
├── research.md                                  # Phase 0 design decisions (D1–D6)
├── data-model.md                                # Phase 1 entities & state transitions
├── quickstart.md                                # Phase 1 end-to-end validation guide
└── contracts/
    └── provider-and-glossary-contracts.md       # Interfaces for glossary filter & OpenAI adapter
```

### Source Code (repository root)

```text
src/
├── types/
│   └── aiProvider.ts                            # AIProviderMode, OpenAICompatiblePresetId, OpenAICompatibleConfig
├── config/
│   └── aiProviders.ts                           # Presets (DeepSeek, Qwen, Groq, NIM, Ollama, LM Studio, Custom) & URL/CORS validator
├── utils/
│   └── aiProviderStorage.ts                     # Storage helpers for provider config, session openai_api_keys, includePinnedGlossary
├── lib/
│   ├── glossaryMatch.ts                         # filterGlossaryForChapter() (strict default maxPinned: 0)
│   └── text.ts                                  # stripModelThinkingBlocks() integrated with safeParseJson
├── services/
│   ├── directGeminiClient.ts                    # Single gateway routing Gemini <-> OpenAI-compatible
│   ├── chapterTranslationService.ts             # Allow local keyless OpenAI runs + log [Lọc từ điển] X/Y
│   ├── ai/
│   │   └── prompts.ts                           # Wire filterGlossaryForChapter into GĐ1, GĐ2, GĐ3 & analyzeGlossary
│   ├── openai/
│   │   ├── openaiSchemaAdapter.ts               # Gemini uppercase schema -> JSON Schema & prompt instruction hint
│   │   └── openaiClient.ts                      # callOpenAICompatible, listOpenAIModels, testOpenAIConnection, schema fallback & CORS diagnostics
│   └── translation/
│       └── targetedRepair.ts                    # Use filterGlossaryForChapter in repair prompts
├── hooks/
│   ├── useAIConfig.ts                           # Manage providerMode, openAIConfig, openAIApiKeys, includePinnedGlossary
│   └── useTranslationProcess.ts                 # Support local keyless validation when OpenAI-compatible local URL is active
└── components/
    ├── ApiSettings.tsx                          # Provider mode switcher & OpenAIProviderSection integration
    └── api-settings/
        ├── OpenAIProviderSection.tsx            # Presets, Base URL, local keyless notice, /v1/models fetch, connection test
        └── TranslationQualitySection.tsx        # Opt-in toggle for includePinnedGlossary (default OFF)
```

**Structure Decision**: Pure Client-Side React + TypeScript SPA layout preserving existing MVC boundaries (`src/lib` / `src/services` -> `src/hooks` -> `src/components`).

## Complexity Tracking

> No Constitution violations; no complexity exceptions required.
