# Feature Specification: Hoàn Thiện Modal Chung & Minh Bạch Cấu Hình Bundle opencc-js

**Feature Branch**: `007-modal-migration-bundle-opt`

**Created**: 2026-08-19

**Status**: Draft

**Input**: User description: "Hoàn thiện 2 khoản nợ kỹ thuật đã được chính .agents/rules/design-system.md ghi nhận trước đó nhưng chưa xử lý xong, cộng 1 phát hiện mới về cấu hình build: Vấn đề A — Migrate nốt các modal còn lại sang src/components/ui/Modal.tsx; Vấn đề B — chunkSizeWarningLimit bị nâng lên để che cảnh báo bundle to (opencc-js)."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Chuẩn Hóa Toàn Diện Các Modal Còn Lại Sang `src/components/ui/Modal.tsx` & Chuẩn Hóa Thang Z-Index (Priority: P2) 🎯

Là người dùng và người phát triển hệ thống, tôi muốn tất cả các hộp thoại overlay (dialog modals) trong ứng dụng đều sử dụng component nguyên tử chuẩn hóa `src/components/ui/Modal.tsx`, đảm bảo trải nghiệm tương tác đồng nhất (backdrop blur, phím Escape, click ra ngoài để đóng, bẫy focus, khóa cuộn màn hình nền) và tuân thủ chặt chẽ thang phân tầng z-index của hệ thống thiết kế "Mực & Chu Sa".

**Why this priority**: Thiết kế hệ thống (`.agents/rules/design-system.md`) yêu cầu loại bỏ sự phân mảnh giữa các modal tự viết riêng lẻ để tránh xung đột z-index (ví dụ z-55, z-9999), loại bỏ lỗi rò rỉ cuộn (scroll leakage) và giúp mã nguồn dễ bảo trì, đúng chuẩn Accessibility (a11y).

**Independent Test**:
1. Mở tính năng "Đồng bộ hóa thuật ngữ từ Cẩm Nang Markdown" trong `GlossaryManager`, xác nhận modal hiển thị qua `ui/Modal.tsx` với backdrop phủ toàn màn hình, đóng được bằng phím Escape hoặc nhấp ra ngoài backdrop.
2. Mở tính năng "Tra cứu & Thêm nhanh" trong `BilingualEditor` khi bôi đen văn bản tiếng Trung, xác nhận giao diện popup chỉnh sửa thuật ngữ hiển thị chuẩn qua `ui/Modal.tsx`, các nút bấm lưu/hủy và thông báo hoạt động chính xác.
3. Rà soát `ProjectFormModal.tsx` trong `ProjectList.tsx`, xác nhận thành phần này là inline form trong luồng trang chứ không phải overlay dialog thật, giữ nguyên tính trực quan inline mà không ép sang modal sai ngữ cảnh.
4. Rà soát `LanguageSelector.tsx` và các component khác, xác nhận z-index được đưa về đúng thang quy định (`z-40` cho dropdown, `z-50` cho modal overlay, `z-[60]` cho toast).
5. Kiểm tra toàn bộ nội dung nhãn, văn phong tiếng Việt và logic nghiệp vụ bên trong các modal, xác minh không bị thay đổi.

**Acceptance Scenarios**:

1. **Given** người dùng đang ở tab Quản lý Thuật ngữ (`GlossaryManager`), **When** nhấp vào nút "Nhập cẩm nang (.md)", **Then** `ImportGuidelinesModal` hiển thị dưới dạng `Modal` chuẩn (`ui/Modal.tsx`) với tiêu đề, biểu tượng, backdrop mờ, đóng được bằng nút X, phím Escape hoặc nhấp backdrop.
2. **Given** người dùng đang bôi đen chữ Hán trong khung dịch thô (`BilingualEditor`), **When** kích hoạt "Tra cứu & Thêm nhanh", **Then** giao diện nhập liệu thuật ngữ mở trong `Modal` chuẩn, nạp gợi ý từ AI, hỗ trợ phím Escape và focus trap.
3. **Given** các modal đã migrate trước đó (`DiffModal`, `AuthModal`, `ProjectMetadataModal`, `ApiSettings`, `ReviewQueuePanel`), **When** kiểm tra cấu trúc, **Then** toàn bộ đều tuân thủ props chuẩn (`open`, `onClose`, `title`, `children`, `size`), không còn bất kỳ overlay nào tự chế backdrop hoặc z-index lệch chuẩn.
4. **Given** menu chọn ngôn ngữ `LanguageSelector`, **When** người dùng mở menu thả xuống, **Then** container sử dụng `z-40` (thang dropdown chuẩn theo `design-system.md`), không dùng `z-50` gây đè lớp sai lệch với modal.

---

### User Story 2 - Đánh Giá Khả Năng Lazy-Load & Minh Bạch Hóa Cấu Hình Bundle `opencc-js` trong `vite.config.ts` (Priority: P2) 🎯

Là kỹ sư phần mềm, tôi muốn phân tích chi tiết luồng sử dụng thư viện `opencc-js` trong toàn bộ ứng dụng, đánh giá khả năng chuyển sang dynamic import(), và nếu bắt buộc phải nạp đồng bộ (synchronous) phục vụ thuật toán chuẩn hóa ngôn ngữ Hán-Việt thì cấu hình `vite.config.ts` phải có phần chú thích kỹ thuật (code comments) giải thích tường minh lý do đặt `chunkSizeWarningLimit: 1200` và cách ly riêng chunk `vendor-opencc`.

**Why this priority**: Việc tùy tiện nâng `chunkSizeWarningLimit` mà không có giải thích kỹ thuật làm giảm tính minh bạch của dự án và che lấp các vấn đề phình to bundle (bundle bloat). Cần xác định rõ ràng liệu thư viện 1.12MB này có thể lazy-load hay là tài nguyên cốt lõi bắt buộc của hệ thống dịch thuật.

**Independent Test**:
1. Thực hiện rà soát toàn diện các điểm import `opencc-js` và `@shared/sinoNormalize` trên cả frontend và backend.
2. Đánh giá tính phụ thuộc đồng bộ: xác định các hàm `canonicalizeHan`, `isHanEquivalent`, `validateAndSnapBackEntities`, `findFuzzyCandidates` được gọi đồng bộ trong các React Hook (`useProjects`, `useTranslationProcess`, `useGlossaryDuplicates`, `useGlossaryScan`), `useMemo`, hàm lọc danh sách (`.filter`, `.find`, `.some`), và tiến trình dịch tự động.
3. Xác minh việc lazy-load bất đồng bộ sẽ phá vỡ tính đồng bộ của các bộ lọc giao diện và có nguy cơ gây sai lệch dữ liệu (false negative) khi so sánh chữ Hán Giản thể / Phồn thể.
4. Cập nhật `vite.config.ts` với tài liệu/comment chi tiết giải thích:
   - Bản chất của `vendor-opencc` (chứa toàn bộ từ điển ánh xạ Phồn-Giản ~1.12MB).
   - Lý do bắt buộc phải import đồng bộ để phục vụ các thuật toán chuẩn hóa thời gian thực.
   - Lý do duy trì `chunkSizeWarningLimit: 1200` và chiến lược tách `manualChunks` độc lập để không làm chậm luồng khởi tạo React bundle chính (`vendor-react`, `index.js`).
5. Chạy `npm run build` xác nhận cấu hình build thành công và xuất ra đúng các manual chunks độc lập.

**Acceptance Scenarios**:

1. **Given** cấu hình build trong `vite.config.ts`, **When** rà soát tham số `chunkSizeWarningLimit` và `manualChunks`, **Then** file chứa khối chú thích kỹ thuật chi tiết giải thích rõ lý do tồn tại của chunk `vendor-opencc` và giới hạn cảnh báo kích thước.
2. **Given** tiến trình build dự án (`npm run build`), **When** Vite đóng gói tài nguyên, **Then** `vendor-opencc` được tách thành một file chunk riêng biệt (`dist/assets/vendor-opencc-*.js`), không làm phình to `vendor-react` hay file entry chính.
3. **Given** toàn bộ các chức năng chuẩn hóa Hán-Việt (`sinoNormalize`), **When** chạy kiểm thử `npm test`, **Then** 100% các unit test liên quan đến `sinoNormalize` đều pass, đảm bảo tính toàn vẹn của nghiệp vụ dịch thuật.

---

### Edge Cases

- **Modal bên trong Modal (Nested Modals / Action Dialogs)**: Khi mở modal con từ một modal mẹ hoặc khi xuất hiện thông báo xác nhận (`confirmModal` trong `NotificationSystem`), `NotificationSystem` sử dụng `z-50` / `z-[60]` đúng quy cách để luôn nổi bật trên cùng.
- **Dữ liệu lớn trong modal body**: `ui/Modal.tsx` đã có sẵn cấu hình `max-h-[90vh]` và thanh cuộn `custom-scrollbar`, bảo đảm khi nội dung cẩm nang (.md) hoặc danh sách từ vựng dài không bị tràn khỏi khung nhìn trình duyệt.
- **Thao tác bàn phím nhanh (Escape spam)**: Đóng modal bằng phím Escape không gây lỗi trạng thái hoặc rò rỉ listener nhờ cleanup `useEffect`.
- **Chuyển đổi màn hình khi modal đang mở**: Bẫy cuộn `document.body.style.overflow = 'hidden'` trong `Modal.tsx` tự động hoàn nguyên về trạng thái ban đầu khi component unmount.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Chuyển đổi `src/components/glossary-manager/ImportGuidelinesModal.tsx` sang sử dụng component `src/components/ui/Modal.tsx` với đầy đủ props chuẩn: `open`, `onClose`, `title`, `description`, `icon`, `size="xl"`.
- **FR-002**: Chuyển đổi hộp thoại chỉnh sửa/tra cứu của `src/components/translator-workspace/QuickAddTermModal.tsx` sang sử dụng `src/components/ui/Modal.tsx` khi người dùng kích hoạt form thêm nhanh.
- **FR-003**: Giữ nguyên `src/components/project-list/ProjectFormModal.tsx` dưới dạng inline collapsible form trên trang `ProjectList.tsx`, không biến thành modal overlay do xung đột với thiết kế luồng trang hiện tại.
- **FR-004**: Chuẩn hóa toàn bộ z-index trong ứng dụng theo đúng thang chuẩn của `.agents/rules/design-system.md`:
  - `z-10`: nội bộ trong 1 component
  - `z-30`: sticky header / tab bar
  - `z-40`: dropdown menu / tooltip (sửa `LanguageSelector.tsx`)
  - `z-50`: modal / dialog overlay (`Modal.tsx`, `NotificationSystem.confirmModal`, widgets)
  - `z-[60]`: toast / notification container (`NotificationSystem.toast`)
- **FR-005**: Không thay đổi bất kỳ logic dịch thuật, prompt AI, circuit breaker, schema IndexedDB hay các nhãn tiếng Việt hiển thị trên giao diện người dùng.
- **FR-006**: Viết tài liệu và comment giải thích chi tiết trong `vite.config.ts` về kiến trúc chunking và lý do kỹ thuật của `chunkSizeWarningLimit: 1200` liên quan đến `opencc-js`.

### Non-Functional Requirements & Guardrails

- **NFR-001 (Zero Type Errors)**: Chạy `npm run lint` (`tsc --noEmit`) phải sạch 100%, không phát sinh bất kỳ lỗi kiểu dữ liệu nào.
- **NFR-002 (Zero Test Regressions)**: Chạy `npm test` (`vitest run`) phải pass 100% toàn bộ 31 test suites (210+ tests hiện có).
- **NFR-003 (Clean Production Build)**: Chạy `npm run build` phải biên dịch thành công cả frontend (Vite) và backend (esbuild).
- **NFR-004 (Design System Fidelity)**: Tuân thủ nghiêm ngặt bảng màu "Mực & Chu Sa" (`bg-ink`, `bg-parchment`, `text-polish`, `border-parchment-2`), font chữ, bo góc `rounded-[2px]`/`rounded-md`, không thêm icon/emoji lạ.

---

## Constitution & Design System Compliance

- **No Unauthorized Dependencies**: Không cài thêm package ngoài những gì đã có (`clsx`, `tailwind-merge`, `motion`, `lucide-react`).
- **Atomic Primitives Reuse**: Tái sử dụng `src/components/ui/Modal.tsx`, `src/components/ui/Button.tsx`, `src/components/ui/Badge.tsx`.
- **Phased Implementation**: Migrate từng modal một cách độc lập, kiểm tra chặt chẽ trước khi chuyển sang component tiếp theo.
