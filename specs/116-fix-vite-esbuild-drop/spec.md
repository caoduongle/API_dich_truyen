# Feature Specification: Sửa Lỗi Kiểu Dữ Liệu Vite Esbuild Drop Khi Kiểm Tra Mã Nguồn (npm run lint)

**Feature Branch**: `116-fix-vite-esbuild-drop`  
**Created**: 2026-09-12  
**Status**: Ready for Planning  
**Input**: Sửa lỗi TypeScript TS2769 khi chạy `npm run lint` (`tsc --noEmit`): trong `vite.config.ts`, thuộc tính `esbuild.drop` được gán mảng chuỗi `string[]` từ biểu thức tam nguyên (`process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : []`), không tương thích với kiểu dữ liệu `Drop[]` (`('console' | 'debugger')[]`) yêu cầu bởi `ESBuildOptions` trong Vite configuration.

---

## 1. User Scenarios & Testing *(mandatory)*

### User Story 1 - Kiểm Tra Kiểu Dữ Liệu Thành Công Không Lỗi Cú Pháp Cấu Hình (Priority: P1)

Là một lập trình viên và người bảo trì dự án, tôi muốn lệnh kiểm tra kiểu tĩnh `npm run lint` (`tsc --noEmit`) hoàn thành thành công mà không gặp bất kỳ lỗi không tương thích overload nào tại tệp `vite.config.ts`, đảm bảo toàn bộ mã nguồn và cấu hình công cụ build đều an toàn về kiểu dữ liệu.

**Why this priority**: Lỗi kiểm tra kiểu tĩnh chặn đứng quy trình phát triển và làm thất bại bước `Type check` trên CI/CD GitHub Actions, khiến mọi commit và pull request không thể hoàn thành kiểm thử chất lượng tự động theo Principle I của Constitution.

**Independent Test**: Chạy `npm run lint` (`tsc --noEmit`) trên toàn bộ kho mã nguồn; xác nhận quá trình kiểm tra kiểu kết thúc với mã thoát 0 (exit code 0) và không có bất kỳ thông báo lỗi TS2769 nào liên quan đến `vite.config.ts`.

**Acceptance Scenarios**:

1. **Given** cấu hình Vite trong `vite.config.ts` có thuộc tính `esbuild.drop`, **When** thực thi lệnh `npm run lint` (`tsc --noEmit`), **Then** trình biên dịch TypeScript xác thực kiểu dữ liệu của `drop` hoàn toàn tương thích với định nghĩa `Drop[]` (`('console' | 'debugger')[]`) của esbuild/vite và không báo lỗi `TS2769`.
2. **Given** môi trường chạy ở chế độ production (`NODE_ENV === 'production'`), **When** cấu hình được nạp, **Then** giá trị của `drop` trả về mảng chứa chính xác `['console', 'debugger']`.
3. **Given** môi trường chạy không phải production (ví dụ `development` hoặc `test`), **When** cấu hình được nạp, **Then** giá trị của `drop` trả về mảng rỗng `[]`.

---

### User Story 2 - Đảm Bảo Quy Trình Build Production Giữ Nguyên Tính Năng Tối Ưu Hóa (Priority: P2)

Là một người dùng cuối và kỹ sư vận hành, tôi muốn lệnh đóng gói `npm run build` tiếp tục loại bỏ các câu lệnh `console` và `debugger` ở bản dựng production nhưng vẫn giữ nguyên trải nghiệm gỡ lỗi ở môi trường phát triển, đồng thời toàn bộ bài kiểm thử tự động `npm test` đều vượt qua.

**Why this priority**: Việc sửa kiểu dữ liệu của `esbuild.drop` không được làm mất đi tính năng loại bỏ log và breakpoint bảo mật ở bản dựng production, đồng thời không gây ảnh hưởng tiêu cực đến hiệu năng và cấu trúc bundle của ứng dụng.

**Independent Test**: Chạy `npm run build` và kiểm tra bundle sinh ra trong thư mục `dist/`; xác nhận không có cảnh báo hay lỗi biên dịch mới, và chạy `npm test` xác nhận 100% test suites vượt qua.

**Acceptance Scenarios**:

1. **Given** bản sửa lỗi kiểu dữ liệu đã được áp dụng vào `vite.config.ts`, **When** chạy lệnh `npm run build`, **Then** quá trình biên dịch Vite hoàn tất thành công và tạo thư mục `dist/`.
2. **Given** dự án được cập nhật cấu hình, **When** chạy `npm test`, **Then** toàn bộ bộ kiểm thử tự động của vitest đều đạt kết quả pass mà không có bài kiểm thử nào bị lỗi hay bỏ qua.

---

### Edge Cases

- **Môi trường `process.env.NODE_ENV` không xác định (undefined)**: Biểu thức điều kiện phải đối xử an toàn như môi trường non-production, trả về mảng rỗng `[]` thay vì gây lỗi runtime.
- **Tương thích kiểu dữ liệu giữa các phiên bản Vite / esbuild**: Kiểu dữ liệu ép kiểu (`type assertion` hoặc `const assertion` hợp lệ) phải tương thích với cả Vite hiện tại lẫn các bản nâng cấp phụ thuộc tiếp theo của esbuild.

---

## 2. Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Thuộc tính `esbuild.drop` trong `vite.config.ts` PHẢI được định kiểu tường minh hoặc ép kiểu phù hợp với định dạng `('console' | 'debugger')[]` (hoặc `Drop[]` từ `esbuild`/`vite`), ngăn ngừa TypeScript tự suy luận thành kiểu nới lỏng `string[]`.
- **FR-002**: Biểu thức logic gán giá trị cho `drop` PHẢI duy trì hành vi hiện tại: trả về `['console', 'debugger']` khi `process.env.NODE_ENV === 'production'`, và trả về mảng rỗng `[]` trong các trường hợp còn lại.
- **FR-003**: Cấu hình xuất `defineConfig` trong `vite.config.ts` PHẢI khớp chính xác với một trong các overload hợp lệ của Vite (`UserConfigExport` / `UserConfigFnObject`).
- **FR-004**: Quy trình kiểm tra chất lượng PHẢI xác nhận `npm run lint` (`tsc --noEmit`) thoát với mã 0 sạch lỗi.
- **FR-005**: Quy trình đóng gói `npm run build` và kiểm thử `npm test` PHẢI vượt qua 100% mà không sửa đổi bất kỳ logic dịch thuật, schema cơ sở dữ liệu IndexedDB hay nhãn giao diện tiếng Việt nào.

---

## 3. Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Lệnh `npm run lint` (`tsc --noEmit`) vượt qua với 0 lỗi cảnh báo hay lỗi kiểu dữ liệu (tỷ lệ thành công 100%).
- **SC-002**: Lệnh `npm run build` hoàn thành thành công và đóng gói toàn bộ ứng dụng vào thư mục `dist/` mà không phát sinh lỗi biên dịch.
- **SC-003**: Bộ kiểm thử tự động `npm test` (`vitest run`) đạt tỷ lệ pass 100% (tất cả các bài kiểm thử hiện có đều pass).
- **SC-004**: Không có bất kỳ thay đổi nào làm ảnh hưởng đến cấu hình chunking (`vendor-opencc`, `vendor-react`, v.v.) hay các thiết lập máy chủ phát triển trong `vite.config.ts`.

---

## 4. Assumptions & Constraints

- Việc điều chỉnh chỉ tập trung vào việc chuẩn hóa kiểu dữ liệu cho `esbuild.drop` trong `vite.config.ts`.
- Không bổ sung thêm bất kỳ dependency bên ngoài nào mới, tuân thủ nguyên tắc Dependency Minimization (Principle II) trong Constitution.
- Không thay đổi schema cơ sở dữ liệu `db.ts`, logic gọi Gemini API hay giao diện người dùng tiếng Việt theo quy định nghiêm ngặt tại `AGENTS.md`.
