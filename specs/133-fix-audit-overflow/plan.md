# Implementation Plan: Khắc Phục Lỗi Bị Che Chữ & Cho Phép Cuộn Xem Đầy Đủ Thẻ Lỗi Thẩm Định Chất Lượng (133-fix-audit-overflow)

**Branch**: `133-fix-audit-overflow` | **Date**: 2026-09-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/133-fix-audit-overflow/spec.md`

## Summary

Khắc phục hoàn toàn lỗi bị che chữ và không kéo cuộn được trong thẻ lỗi thẩm định chất lượng tại tab Dịch Thuật (`UnifiedAuditPanel.tsx`).
- **Nguyên nhân gốc rễ**: Lớp CSS `line-clamp-2` áp dụng `overflow: hidden`, cắt ngang chữ ở dòng 2 và khóa toàn bộ khả năng cuộn của người dùng.
- **Giải pháp kỹ thuật**:
  1. Loại bỏ `line-clamp-2`, thay thế bằng container cuộn độc lập `max-h-28 overflow-y-auto break-words whitespace-pre-wrap select-text cursor-text` kèm thanh cuộn mượt mà.
  2. Bổ sung nút bấm `"Xem thêm"` / `"Thu gọn"` đối với các trích đoạn văn bản dài (>120 ký tự hoặc có dấu ngắt dòng `\n`) cho phép mở rộng toàn văn bản (`max-h-none`).
  3. Ngăn ngừa sự kiện click nổi bọt (`e.stopPropagation()`) khi người dùng nhấp hoặc bôi đen chọn chữ bên trong vùng trích đoạn.
  4. Tối ưu ngắt từ và cuộn cho phần tin nhắn giải thích (`message`) và khung xem trước viết lại câu từ AI (`pendingPreviews`).
  5. Nâng chiều cao tối đa của danh sách thẻ lỗi lên `max-h-[28rem]` với thanh cuộn tinh gọn.

---

## Technical Context

**Language/Version**: TypeScript 5.8+, React 19

**Primary Dependencies**: Tailwind CSS v4, `clsx`, `tailwind-merge`, `lucide-react` (có sẵn `ChevronDown`, `ChevronUp`, `Zap`, `Wand2`, `Sparkles`, `Check`, `X`)

**Storage**: N/A (Thuần túy UI / Presentation Layer, không thay đổi IndexedDB)

**Testing**: Vitest (`npm test`), TypeScript Compiler (`npm run lint`), Vite Build (`npm run build`)

**Target Platform**: Modern Desktop & Mobile Browsers (Chrome, Edge, Firefox, Safari)

**Project Type**: Pure Client-Side SPA

**Performance Goals**: Tốc độ render thẻ lỗi < 16ms (60 fps), chuyển đổi mở rộng/thu gọn tức thì, cuộn mượt mà không giật lag.

**Constraints**:
- Tuân thủ nghiêm ngặt Hiến pháp dự án (0 dependencies mới, giữ vững kiến trúc MVC, 100% test pass).
- Không làm thay đổi interface `UnifiedAuditIssue` hoặc các logic dịch thuật/AI trong `src/services/`.

**Scale/Scope**: Hỗ trợ danh sách lên đến 100+ thẻ lỗi và các đoạn trích dẫn dài tới 5.000 ký tự mà không gây tràn lề hay vỡ giao diện.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Principle I: Strict Quality Gates & Verification**: `npm run lint`, `npm test`, và `npm run build` bắt buộc phải pass 100% trước khi hoàn thành.
- [x] **Principle II: Dependency Minimization**: Không thêm bất kỳ package nào; tận dụng `cn`, Tailwind v4 và các icons có sẵn.
- [x] **Principle III: Strict Concern Separation & MVC Domain Boundary**: Toàn bộ thay đổi nằm trong View component `src/components/translator-workspace/UnifiedAuditPanel.tsx`. Không động chạm tới `src/services/`.
- [x] **Principle IV: Immutable Core Schemas & Storage Stability**: Giữ nguyên cấu trúc `UnifiedAuditIssue` và `QualityIssue`. Không đổi nhãn hiển thị tiếng Việt hiện có.
- [x] **Principle V: Atomic Commits & Documentation**: Diff tinh gọn, tập trung đúng vào component bị lỗi và bộ test tương ứng.

---

## Project Structure

### Documentation (this feature)

```text
specs/133-fix-audit-overflow/
├── plan.md              # Kế hoạch triển khai kỹ thuật
├── research.md          # Phân tích nguyên nhân & các quyết định kiến trúc
├── data-model.md        # Mô hình UI state & token CSS
├── quickstart.md        # Hướng dẫn kiểm thử xác minh
├── contracts/
│   └── audit-card-ui.md # Hợp đồng giao diện & tương tác thẻ lỗi
└── checklists/
    └── requirements.md  # Danh mục kiểm định chất lượng đặc tả
```

### Source Code (repository root)

```text
src/
├── components/
│   └── translator-workspace/
│       ├── UnifiedAuditPanel.tsx              # [MODIFY] Thay thế line-clamp-2, thêm scroll & Xem thêm/Thu gọn
│       └── __tests__/
│           └── UnifiedAuditPanel.test.tsx      # [MODIFY] Thêm test cases cho scroll, expand/collapse, break-words
```

**Structure Decision**: Sửa đổi trực tiếp tại Presentation component `UnifiedAuditPanel.tsx` và mở rộng suite kiểm thử `UnifiedAuditPanel.test.tsx`.

---

## Complexity Tracking

> Không có vi phạm Hiến pháp. Giải pháp đạt mức tối giản cao nhất (zero dependencies, minimal diff, pure CSS & local state).
