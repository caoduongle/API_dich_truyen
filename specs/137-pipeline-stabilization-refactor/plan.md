# Implementation Plan: Ổn Định Hóa Pipeline Dịch Thuật & Tái Cấu Trúc Toàn Diện (137-pipeline-stabilization-refactor)

**Branch**: `refactor/stabilization-2026-09` | **Date**: 2026-09-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/137-pipeline-stabilization-refactor/spec.md`

---

## Summary

Thực hiện ổn định hóa và tái cấu trúc toàn diện hệ thống theo kế hoạch ưu tiên 3 tầng (P0, P1, P2):
1. **P0 - Khắc phục sai lệch Quota & Lưu lượng**:
   - Sửa `localQuotaTracker`: Tách biệt `recentAttempts` (ghi nhận ngay tại `recordProviderAttempt` để tính RPM) và `recentTokens` (ghi nhận tại `recordSuccess` để tính TPM).
   - Chuẩn hóa thời gian Cooldown của `QuotaExhausted`: Tính chính xác thời điểm 00:00:00 PST (múi giờ `America/Los_Angeles`) kế tiếp thay vì gán cứng 4 giờ.
   - Phân loại lỗi API bền vững: Nhận diện lỗi dựa trên mã HTTP, RPC status và chi tiết cấu trúc (`QuotaFailure` / `ErrorInfo`) trước khi dùng fallback chuỗi thông báo.
   - Phân đoạn song ngữ đồng bộ: Xây dựng `splitBilingualAdaptively` ghép cặp 1:1 văn bản nguồn và văn bản thô theo ranh giới đoạn văn chung (`TranslationChunk`).
   - Kiểm soát tương tranh: Thay thế `Promise.all` không giới hạn bằng bộ điều phối `mapWithConcurrencyLimit` (mặc định giới hạn tối đa 2 tác vụ đồng thời).
2. **P1 - Tái cấu trúc mô-đun hóa & Tăng cường lưu trữ**:
   - Phân rã God Function `callGeminiDirect` thành các mô-đun độc lập trong `src/services/gemini/` (Request Builder, Transport, Error Classifier, Key Scheduler, Client Facade).
   - Phân rã God Service `directTranslationEngine` thành các mô-đun trong `src/services/translation/` (Raw, Polish, QA Critique, Sentence Rewrite, Bilingual Split, Validation).
   - Khắc phục xung đột Google Drive: Sử dụng single-flight promise lock và cơ chế đối soát sau tạo; gắn cache thư mục theo danh tính tài khoản người dùng.
   - Minh bạch hóa lỗi lưu trữ: Bổ sung `StorageResult<T>` trong `src/services/db.ts` để phân biệt rõ lỗi lưu trữ với trạng thái không có dữ liệu.
3. **P2 - Tăng cường an toàn & Tối ưu môi trường**:
   - Thay thế `dangerouslySetInnerHTML` trong `DiffModal.tsx` bằng kết xuất React nodes an toàn.
   - Rà soát và siết chặt danh sách cho phép kết nối CSP.
   - Chuẩn hóa tập lệnh `npm run clean` tương thích hoàn toàn trên Windows qua lệnh Node.js.
   - Loại bỏ gói phụ thuộc máy chủ không dùng (`dotenv`).

---

## Technical Context

**Language/Version**: TypeScript 5.8+, React 19  
**Primary Dependencies**: React 19, `clsx`, `tailwind-merge`, `lucide-react`, `motion` (tái sử dụng toàn bộ thư viện hiện có; không thêm thư viện mới; gỡ bỏ `dotenv`)  
**Storage**: IndexedDB (`src/services/db.ts`) với mô hình `StorageResult<T>`, Google Drive v3 REST API (kết nối trực tiếp từ trình duyệt)  
**Testing**: Vitest (`npm test`), TypeScript Compiler (`npm run lint`), Vite Build (`npm run build`)  
**Target Platform**: Pure Client-Side Web SPA (chạy trực tiếp trên trình duyệt hiện đại)  
**Project Type**: Web Application (Frontend SPA)  
**Performance Goals**:
- Tính toán RPM/TPM cửa sổ trượt 60 giây trong thời gian < 1ms.
- Phân đoạn song ngữ và ghép cặp đoạn văn bản chương 15,000 từ hoàn tất trong < 20ms.
- Giới hạn lưu lượng đồng thời không vượt quá ngưỡng an toàn cấu hình (tối đa 2 request đồng thời).
**Constraints**:
- Tuân thủ tuyệt đối 5 nguyên tắc hiến pháp dự án (`AGENTS.md` và `.specify/memory/constitution.md`).
- Bảo đảm 100% tương thích ngược cho mọi module gọi `callGeminiDirect` và `directTranslationEngine`.
- Duy trì trạng thái cộng tác thời gian thực (CRDT) là nguồn chân lý duy nhất của chương đang mở.
**Scale/Scope**: Áp dụng toàn diện cho toàn bộ luồng dịch thuật, kiểm toán hạn ngạch, đồng bộ đám mây và lưu trữ ngoại tuyến.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I: Strict Quality Gates & Verification**:
  - `npm run lint` (`tsc --noEmit`) sạch lỗi kiểu dữ liệu: PASS.
  - `npm test` (`vitest run`) toàn bộ test suite pass 100%: PASS.
  - `npm run build` (`tsc && vite build`) đóng gói thành công: PASS.
- **Principle II: Dependency Minimization & Existing Library Reuse**:
  - Tái sử dụng các tiện ích sẵn có (`Intl`, `crypto`, `clsx`, `tailwind-merge`).
  - Gỡ bỏ phụ thuộc thừa `dotenv`.
  - Không cài đặt thêm bất kỳ gói npm bên ngoài nào: PASS.
- **Principle III: Strict Concern Separation & MVC Domain Boundary Preservation**:
  - Tầng Service/Model: `src/services/gemini/`, `src/services/translation/`, `src/services/localQuotaTracker.ts`, `src/services/db.ts`.
  - Tầng View: `DiffModal.tsx` chuyển sang hiển thị React nodes an toàn.
  - Các service tuyệt đối không import ngược từ component/hook: PASS.
- **Principle IV: Immutable Core Schemas & Storage Stability**:
  - Không thay đổi các interface cốt lõi trong `src/types.ts`.
  - `StorageResult<T>` đóng vai trò vỏ bọc kết quả an toàn (safe wrapper), không phá vỡ cấu trúc bảng IndexedDB: PASS.
- **Principle V: Atomic Commits & Documentation Synchronization**:
  - `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/` đồng bộ 100%: PASS.

---

## Project Structure

### Documentation (this feature)

```text
specs/137-pipeline-stabilization-refactor/
├── spec.md              # Feature specification
├── plan.md              # This implementation plan
├── research.md          # Architecture & technical decisions
├── data-model.md        # Entities, state machine, and data flow
├── quickstart.md        # Manual & automated validation guide
├── contracts/           # TypeScript contract definitions
│   ├── quota-tracker.contract.ts
│   ├── bilingual-split.contract.ts
│   ├── gemini-client.contract.ts
│   └── storage-result.contract.ts
└── checklists/
    └── requirements.md  # Spec quality checklist (16/16 pass)
```

### Source Code (repository root)

```text
src/
├── services/
│   ├── localQuotaTracker.ts                     # [MODIFY] Tách recentAttempts/recentTokens, tính chuẩn 00:00 PST
│   ├── directGeminiClient.ts                    # [MODIFY] Facade mỏng chuyển tiếp lời gọi sang src/services/gemini/
│   ├── directTranslationEngine.ts              # [MODIFY] Facade mỏng chuyển tiếp lời gọi sang src/services/translation/
│   ├── googleDriveService.ts                    # [MODIFY] Single-flight lock cho ensureAppFolder, cache theo user
│   ├── db.ts                                    # [MODIFY] Bổ sung StorageResult<T>, phân biệt lỗi với mảng rỗng
│   ├── gemini/                                  # [NEW] Mô-đun hóa kết nối Gemini API
│   │   ├── types.ts                             # [NEW] Kiểu dữ liệu và hợp đồng giao tiếp Gemini
│   │   ├── geminiRequestBuilder.ts              # [NEW] Chuẩn hóa model, tạo URL và payload
│   │   ├── geminiTransport.ts                   # [NEW] Fetch mạng, timeout, signal abort
│   │   ├── geminiErrorClassifier.ts             # [NEW] Phân loại lỗi HTTP/RPC/details
│   │   ├── geminiKeyScheduler.ts                # [NEW] Điều phối và xoay vòng khóa API
│   │   ├── geminiClient.ts                      # [NEW] Bộ điều phối gọi API và xử lý thử lại
│   │   └── __tests__/                           # [NEW] Unit tests cho từng module
│   │       ├── geminiRequestBuilder.test.ts
│   │       ├── geminiErrorClassifier.test.ts
│   │       └── geminiClient.test.ts
│   ├── translation/                             # [NEW] Mô-đun hóa động cơ dịch thuật
│   │   ├── types.ts                             # [NEW] Kiểu dữ liệu tham số và kết quả dịch
│   │   ├── bilingualSplit.ts                    # [NEW] Phân đoạn song ngữ khớp ranh giới đoạn & concurrency limiter
│   │   ├── rawTranslation.ts                    # [NEW] Phase 1: Dịch thô & trích xuất thực thể
│   │   ├── polishTranslation.ts                 # [NEW] Phase 2: Chuốt văn ngữ cảnh
│   │   ├── qaCritique.ts                        # [NEW] Phase 3: Thẩm định QA
│   │   ├── sentenceRewrite.ts                   # [NEW] Viết lại câu đơn lẻ
│   │   ├── translationValidation.ts             # [NEW] Toàn vẹn cấu trúc & bảo tồn tiêu đề
│   │   ├── index.ts                             # [NEW] Điểm xuất khẩu thống nhất
│   │   └── __tests__/                           # [NEW] Unit tests cho bilingualSplit & pipeline
│   │       └── bilingualSplit.test.ts
│   └── __tests__/
│       ├── localQuotaTracker.test.ts            # [MODIFY] Thêm test cho RPM attempt & PST midnight
│       ├── directGeminiClient.test.ts           # [MODIFY] Duy trì test tương thích ngược
│       └── directTranslationEngine.test.ts      # [MODIFY] Duy trì test tương thích ngược
├── components/
│   └── auto-translator/
│       ├── DiffModal.tsx                        # [MODIFY] Chuyển dangerouslySetInnerHTML sang React mark nodes
│       └── __tests__/
│           └── DiffModal.test.tsx               # [NEW/MODIFY] Test an toàn bảo mật cho DiffModal
package.json                                     # [MODIFY] Sửa script clean đa nền tảng, xóa dotenv
```

**Structure Decision**: Giữ nguyên toàn bộ cấu trúc thư mục ứng dụng theo nguyên tắc MVC; việc phân rã các God modules được thực hiện dưới dạng các thư mục con chuyên trách (`src/services/gemini/` và `src/services/translation/`), đồng thời giữ các tệp gốc làm Facade công khai để đảm bảo 100% không làm gãy vỡ các mã nguồn hiện tại.

---

## Complexity Tracking

*Không có vi phạm hiến pháp nào cần giải trình (No constitution violations).*
- Toàn bộ thiết kế bám sát chặt chẽ các yêu cầu của người dùng, tuân thủ nguyên tắc Client-Side SPA, không bổ sung backend, không thêm dependency mới.
