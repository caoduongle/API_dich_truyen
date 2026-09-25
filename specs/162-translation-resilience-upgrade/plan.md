# Implementation Plan: Translation Resilience Upgrade (Spec 162)

**Branch**: `162-translation-resilience-upgrade` | **Date**: 2026-09-26 | **Spec**: [specs/162-translation-resilience-upgrade/spec.md](./spec.md)

**Input**: Feature specification from `specs/162-translation-resilience-upgrade/spec.md`

---

## Summary

Nâng cấp cơ chế phân đoạn thích ứng đệ quy (Adaptive Recursive Splitting) và khả năng chịu lỗi (Resilience) trong pipeline dịch thuật tiểu thuyết Trung - Việt phía trình duyệt (Phase 1: Dịch thô & Phase 2: Chuốt văn phong).

**Giải pháp kỹ thuật chính**:
1. Phân loại kết quả và lỗi có cấu trúc (`TranslationOutcomeType`: `SUCCESS | PARTIAL | RETRYABLE | TERMINAL`) thay thế việc dò tìm chuỗi string thô sơ.
2. Tiêm cấu hình an toàn cho phép tối đa (`getPermissiveSafetySettings()` với `HarmBlockThreshold.BLOCK_NONE` cho 4 danh mục vi phạm) vào `geminiRequestBuilder.ts` để hạn chế chặn nhầm văn cảnh kiếm hiệp.
3. Không xoay vòng API key và không thử lại cùng một prompt khi lỗi là `CONTENT_BLOCKED`.
4. Thuật toán phân đoạn đơn điệu (monotonic non-overlapping partitioning) bảo đảm tính toàn vẹn và bao phủ 100% văn bản nguồn, bảo vệ các thực thể trong ngoặc `[...]`.
5. Đệ quy độc lập chỉ trên nhánh lỗi; bảo toàn kết quả các nhánh anh em đã thành công.
6. Cứu nguy tất định không mất mát (Deterministic Lossless Fallback): Hán-Việt cho Phase 1, giữ nguyên dịch thô cho Phase 2; gắn cờ `isPartial: true`.
7. Kiểm soát đồng thời có giới hạn (`mapWithConcurrencyLimit` $\le 2$) cho cả Phase 1 và Phase 2.
8. Đồng bộ hóa thời hạn tích lũy (`cumulativeTimeoutMs`) và phản hồi tức thời với `AbortSignal`.
9. Thu thập và trả về thống kê phân nhánh vi mô (`SplitBranchTelemetry`).

---

## Technical Context

**Language/Version**: TypeScript 5.8 / Node.js 20+  
**Primary Dependencies**: React 19, Vite, Tailwind CSS v4, `@google/genai` (không thêm bất kỳ thư viện NPM mới nào).  
**Storage**: IndexedDB (`db.ts`, Dexie) — **Giữ nguyên 100% schema và types, không thay đổi core storage**.  
**Testing**: Vitest (`npm test`), TypeScript compiler (`npm run lint`), Vite build (`npm run build`).  
**Target Platform**: Pure Client-Side SPA (Web Browser, Chrome/Firefox/Safari/Edge, Static Hosting).  
**Project Type**: Client-Side Single Page Application (Zero Backend).  
**Performance Goals**:
- Thuật toán phân đoạn và kiểm định bao phủ nguồn đạt độ phức tạp $O(N)$ theo độ dài văn bản.
- Tối đa 2 cuộc gọi API đồng thời cho mỗi tác vụ phân đoạn.
- Thời gian trễ phân rã và kiểm tra tính toàn vẹn $\le 5$ms cho văn bản 10.000 ký tự.  
**Constraints**:
- Tuân thủ nghiêm ngặt Hiến pháp (Constitution v2.0.0) và `AGENTS.md`.
- Tuyệt đối KHÔNG tạo Gemini client thứ hai hay backend proxy. Mọi request đi qua `callGeminiDirect()`.
- Tuyệt đối KHÔNG dùng kỹ thuật jailbreak / prompt reframing né filter trái quyết định an toàn của provider.
- Tuyệt đối KHÔNG xoay API key khi gặp lỗi `CONTENT_BLOCKED`.
- Bảo toàn 100% bao phủ nguồn (0% mất mát câu chữ).  
**Scale/Scope**: Tác vụ dịch chương truyện từ 500 đến 15.000 ký tự tiếng Trung, độ sâu phân rã tối đa $K \le 3$ (tối đa 4).

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Nguyên tắc Hiến pháp (Constitution Principle) | Đánh giá trước Phase 0 | Đánh giá sau Phase 1 | Kết luận & Biện minh |
| :--- | :--- | :--- | :--- |
| **I. Strict Quality Gates & Verification** | **PASS** | **PASS** | Mọi thay đổi đều được kiểm chứng qua `npm run lint`, `npm test`, `npm run build`. Không có test nào bị skip, mute hay làm yếu assertion. |
| **II. Dependency Minimization & Existing Library Reuse** | **PASS** | **PASS** | **0 NPM packages mới**. Tái sử dụng `mapWithConcurrencyLimit` từ `src/lib/concurrency.ts`, các tiện ích chuỗi trong `src/lib/text.ts` và bộ điều phối hiện có. |
| **III. Strict Concern Separation & MVC Domain Preservation** | **PASS** | **PASS** | Toàn bộ thay đổi nằm trong tầng Model/Service (`src/services/translation/`, `src/services/gemini/`, `src/lib/`). View và Hooks không bị can thiệp. |
| **IV. Immutable Core Schemas & Storage Stability** | **PASS** | **PASS** | `src/types.ts` và IndexedDB schema giữ nguyên 100%. Các kiểu dữ liệu nâng cấp nằm cục bộ tại `src/services/translation/types.ts`. |
| **V. Atomic Commits & Documentation Synchronization** | **PASS** | **PASS** | Tài liệu đặc tả (`specs/162-translation-resilience-upgrade/`) đồng bộ 1:1 với kế hoạch kỹ thuật, data model, contracts và quickstart. |

---

## Project Structure

### Documentation (this feature)

```text
specs/162-translation-resilience-upgrade/
├── spec.md              # Feature specification
├── checklists/
│   └── requirements.md  # Requirements quality checklist (100% pass)
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0: Technical decisions & rationale
├── data-model.md        # Phase 1: Entities, state machine & invariants
├── quickstart.md        # Phase 1: Runnable verification guide
├── contracts/           # Phase 1: Interface & data contracts
│   ├── translation-resilience.contract.ts
│   └── gemini-safety.contract.ts
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── concurrency.ts                 # [EXISTING] mapWithConcurrencyLimit
│   └── text.ts                        # [MODIFY] splitTextAdaptively, monotonic bounds & coverage checks
├── services/
│   ├── directGeminiClient.ts          # [EXISTING] callGeminiDirect facade
│   ├── gemini/
│   │   ├── types.ts                   # [MODIFY] HarmCategory, HarmBlockThreshold, GeminiSafetySetting
│   │   ├── geminiRequestBuilder.ts    # [MODIFY] getPermissiveSafetySettings & payload safety injection
│   │   ├── geminiClient.ts            # [EXISTING] Halt on CONTENT_BLOCKED, cumulative logical deadline
│   │   └── geminiErrorClassifier.ts   # [EXISTING] Classify CONTENT_BLOCKED, 429, 503
│   └── translation/
│       ├── types.ts                   # [MODIFY] TranslationOutcomeType, SplitBranchTelemetry, expanded params/results
│       ├── translationValidation.ts   # [MODIFY] classifyTranslationOutcome replaces string matching
│       ├── bilingualSplit.ts          # [MODIFY] Monotonic 100% source coverage partitioning
│       ├── rawTranslation.ts          # [MODIFY] mapWithConcurrencyLimit, fault-only retry, telemetry, AbortSignal
│       └── polishTranslation.ts       # [MODIFY] Cumulative timeout sync, telemetry, fast abort propagation
└── tests/
    └── (test suites in src/services/__tests__, src/services/translation/__tests__, src/lib/__tests__)
```

---

## Complexity Tracking

> Không có vi phạm Hiến pháp nào cần giải trình. Mọi thay đổi đều tuân thủ kiến trúc Pure Client-Side SPA, không thêm dependency và tái sử dụng module có sẵn.
