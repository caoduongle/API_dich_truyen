# Implementation Plan: Tìm và Thay Thế Văn Bản Trong Bàn Dịch (136-find-and-replace)

**Branch**: `136-find-and-replace` | **Date**: 2026-09-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/136-find-and-replace/spec.md`

---

## Summary

Bổ sung tính năng **"Tìm và Thay thế"** (Find and Replace) trực tiếp vào khung soạn thảo của Bàn Dịch theo đúng thiết kế người dùng cung cấp trong ảnh chụp màn hình:
1. Xây dựng bộ tiện ích thuật toán tìm kiếm và thay thế an toàn `src/utils/textSearch.ts` hỗ trợ tìm kiếm không dấu/có dấu, phân biệt chữ hoa/thường, thoát ký tự đặc biệt Regex và thay thế hàng loạt nguyên tử.
2. Xây dựng component `FindReplaceModal.tsx` với đầy đủ các trường nhập, bộ đếm kết quả, các nút Trước, Sau, Đóng, Thay thế, Thay tất cả, tuân thủ bảng màu "Mực & Chu Sa".
3. Tích hợp phím tắt `Ctrl+H` và nút bấm trên thanh công cụ ô soạn thảo trong `BilingualEditor.tsx`, tự động điền sẵn chuỗi đang được bôi chọn trong textarea.
4. Điều khiển cuộn mượt và bôi chọn vùng văn bản trong textarea khi duyệt kết quả.

---

## Technical Context

**Language/Version**: TypeScript 5.8+, React 19  
**Primary Dependencies**: React 19, `clsx`, `tailwind-merge`, `lucide-react` (tái sử dụng toàn bộ thư viện hiện có, không cài thêm bất kỳ package nào)  
**Storage**: IndexedDB (lưu trữ chương cục bộ qua `useWorkspaceState`)  
**Testing**: Vitest (`vitest run`)  
**Target Platform**: Pure Client-Side Web SPA (Chrome, Edge, Firefox, Safari)  
**Project Type**: Web Application (Frontend SPA)  
**Performance Goals**: Tìm kiếm và thay thế tất cả trên chương 10,000 từ hoàn tất dưới 50ms  
**Constraints**: Tuân thủ tuyệt đối 5 nguyên tắc hiến pháp dự án (`AGENTS.md` và `.specify/memory/constitution.md`); không thay đổi schema IndexedDB; không sửa đổi pipeline dịch trong `src/services/`  
**Scale/Scope**: Áp dụng cho mọi chương truyện và phân vùng dịch (`raw` hoặc `polished`) trong Bàn Dịch  

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I: Strict Quality Gates & Verification**:
  - `npm run lint` (`tsc --noEmit`) sạch lỗi: PASS.
  - `npm test` (`vitest run`) toàn bộ pass 100%: PASS.
  - `npm run build` (`tsc && vite build`) thành công: PASS.
- **Principle II: Dependency Minimization & Existing Library Reuse**:
  - Sử dụng các primitive sẵn có (`Button`, `Kbd`, `cn`, biểu tượng `lucide-react`).
  - Không cài thêm bất kỳ dependency nào: PASS.
- **Principle III: Strict Concern Separation & MVC Domain Boundary Preservation**:
  - View: `FindReplaceModal.tsx`, `BilingualEditor.tsx`.
  - Service / Utility: `src/utils/textSearch.ts`.
  - Không vi phạm ranh giới MVC: PASS.
- **Principle IV: Immutable Core Schemas & Storage Stability**:
  - Không thay đổi `src/types.ts` hay schema IndexedDB: PASS.
  - Giữ nguyên tiếng Việt nhãn giao diện: PASS.
- **Principle V: Atomic Commits & Documentation Synchronization**:
  - Spec, plan, contracts, data-model, quickstart đồng bộ 100%: PASS.

---

## Project Structure

### Documentation (this feature)

```text
specs/136-find-and-replace/
├── spec.md              # Feature specification
├── plan.md              # This implementation plan
├── research.md          # Architecture & technical decisions
├── data-model.md        # Entities, state machine, and data flow
├── quickstart.md        # Manual & automated test scenarios
├── contracts/           # TypeScript contract definitions
│   └── find-and-replace.contract.ts
└── checklists/
    └── requirements.md  # Spec quality checklist (16/16 pass)
```

### Source Code (repository root)

```text
src/
├── utils/
│   ├── textSearch.ts                                   # [NEW] Thuật toán tìm kiếm, escape Regex, replaceSingle, replaceAll
│   └── __tests__/
│       └── textSearch.test.ts                          # [NEW] Unit test cho thuật toán tìm và thay thế
├── components/
│   └── translator-workspace/
│       ├── FindReplaceModal.tsx                        # [NEW] Hộp thoại Tìm và Thay thế (UI đúng theo mockup)
│       ├── BilingualEditor.tsx                         # [MODIFY] Tích hợp nút mở trên toolbar, hotkey Ctrl+H, gắn modal
│       └── __tests__/
│           └── FindReplaceModal.test.tsx               # [NEW] Unit test cho giao diện và luồng điều khiển
```

**Structure Decision**: Ứng dụng tuân thủ kiến trúc Pure Client-Side MVC: thuật toán xử lý chuỗi đặt trong `src/utils/textSearch.ts`, giao diện hộp thoại đặt trong `src/components/translator-workspace/FindReplaceModal.tsx`.

---

## Complexity Tracking

*Không có vi phạm hiến pháp nào cần giải trình (No constitution violations).*
