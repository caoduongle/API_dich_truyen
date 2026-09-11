# Implementation Plan: Khắc Phục Hiển Thị Nút Kiểm Định Hako

**Branch**: `108-fix-hako-nav-button` | **Date**: 2026-09-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/108-fix-hako-nav-button/spec.md`

## Summary

Khắc phục triệt để tình trạng nút tab **Kiểm Định Hako** (`#tab-hako-checker`) bị đẩy ra ngoài biên màn hình và bị che khuất trên thanh điều hướng chính. Giải pháp thực hiện:
1. Tối ưu mật độ hiển thị dải tab bằng kỹ thuật nhãn co giãn thích ứng (adaptive labels) và tinh chỉnh khoảng đệm (`px-2 lg:px-2.5 2xl:px-3`), tiết kiệm ~275px chiều ngang.
2. Thu gọn linh hoạt độ rộng chiếm dụng của khối thông tin "Bộ đang dịch: [Tên Truyện]" ở góc phải (`max-w-[140px] md:max-w-[180px] lg:max-w-[220px] 2xl:max-w-[300px]`), nhường thêm ~160px cho dải tab.
3. Mở rộng phạm vi xuất hiện của menu xổ xuống "Thêm ▾" (`hidden sm:flex 2xl:hidden`) để loại bỏ hoàn toàn điểm mù tại breakpoint `xl` (1280px - 1535px).
4. Tăng cường khả năng nhận diện tràn của hook `useScrollOverflow` khi các dữ liệu huy hiệu đếm được tải bất đồng bộ từ IndexedDB.

## Technical Context

**Language/Version**: TypeScript 5.8+ (Strict Mode) / React 19
**Primary Dependencies**: Tailwind CSS v4, `lucide-react`, `clsx`, `tailwind-merge`
**Storage**: N/A (Không thay đổi schema IndexedDB)
**Testing**: Vitest (`npm test`), TypeScript Compiler (`npm run lint`), Vite Production Build (`npm run build`)
**Target Platform**: Trình duyệt Web Desktop/Laptop (đặc biệt các độ phân giải từ 1024px, 1280px, 1366px đến 1920px+) và Mobile/Tablet
**Project Type**: Single Page Application (Client-side React with Express background server)
**Performance Goals**: Không gây reflow/jank, thời gian phản hồi cuộn/chuyển tab < 16ms (60fps)
**Constraints**: Tuân thủ tuyệt đối Design System "Mực & Chu Sa" (`z-30`, token màu ink/parchment/polish), không thay đổi logic dịch thuật hoặc API backend

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Nguyên tắc | Đánh giá tuân thủ | Trạng thái |
| :--- | :--- | :---: |
| **I. Strict Quality Gates** | Bắt buộc chạy và pass 100% `npm run lint`, `npm test`, `npm run build` | ✅ PASS |
| **II. Dependency Minimization** | Tái sử dụng `useScrollOverflow`, `lucide-react`, Tailwind class có sẵn. Không thêm package mới | ✅ PASS |
| **III. Concern Separation** | Chỉ can thiệp tầng giao diện trình diễn (`src/App.tsx`, `src/hooks/useScrollOverflow.ts`). Không đụng chạm logic dịch/Gemini | ✅ PASS |
| **IV. Immutable Core Schemas** | Không sửa đổi `types.ts`, không sửa đổi schema cơ sở dữ liệu IndexedDB | ✅ PASS |
| **V. Atomic Commits & Sync** | Tạo commit độc lập, cập nhật chính xác tài liệu đặc tả và thiết kế | ✅ PASS |

## Project Structure

### Documentation (this feature)

```text
specs/108-fix-hako-nav-button/
├── plan.md              # Kế hoạch triển khai kỹ thuật (File này)
├── research.md          # Phân tích nguyên nhân gốc & Quyết định kiến trúc (Phase 0)
├── data-model.md        # Cấu trúc dữ liệu & máy trạng thái UI (Phase 1)
├── quickstart.md        # Hướng dẫn & kịch bản kiểm thử trực quan (Phase 1)
├── contracts/           # Đặc tả giao diện DOM, ARIA & breakpoint (Phase 1)
│   └── nav-tab-bar.contract.md
├── checklists/          # Bảng kiểm tra chất lượng đặc tả
│   └── requirements.md
└── spec.md              # Đặc tả yêu cầu người dùng
```

### Source Code (repository root)

```text
src/
├── App.tsx                                    # Cập nhật layout thanh tab, responsive density, và More menu
├── hooks/
│   ├── useScrollOverflow.ts                   # Tăng cường khả năng nhận diện tràn với child observer
│   └── __tests__/
│       └── useScrollOverflow.test.ts          # Bổ sung/cập nhật unit test cho hook
└── components/
    └── ui/                                    # Tái sử dụng Button, Badge, Kbd
```

**Structure Decision**: Cấu trúc ứng dụng đơn lẻ (Single project React frontend trong `src/`). Các thay đổi tập trung vào `src/App.tsx` và `src/hooks/useScrollOverflow.ts` cùng test suite đi kèm.

## Complexity Tracking

> Không có vi phạm Hiến pháp (Constitution). Thiết kế tuân thủ nguyên tắc tối giản và tái sử dụng component hiện có.
