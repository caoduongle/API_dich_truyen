# Feature Specification: Sửa Lỗi CI/CD (Windows Path Handling & Build-Before-Test Ordering)

**Feature Branch**: `089-fix-ci-failures`  
**Created**: 2026-09-05  
**Status**: Ready for Implementation  
**Input**: Sửa 2 lỗi làm CI/CD fail trong workflow `.github/workflows/ci.yml`: (1) sanitizeFilename không xử lý đúng đường dẫn Windows trên POSIX/Linux; (2) Quickstart verification test fail vì CI chạy test trước khi build.

---

## 1. User Scenarios & Testing *(mandatory)*

### User Story 1 - Khử Trùng Đường Dẫn Tệp Tin Nhất Quán Trên Đa Nền Tảng (Priority: P1)

Là một kỹ sư phần mềm và người vận hành hệ thống, tôi muốn hàm `sanitizeFilename` tách và khử trùng đúng tên tệp tin đối với cả định dạng đường dẫn Windows (`\`) và Unix/POSIX (`/`) trên bất kỳ môi trường chạy nào (Linux CI runner cũng như Windows máy trạm), ngăn chặn triệt để lỗ hổng Directory Traversal và đảm bảo test suite chạy nhất quán.

**Why this priority**: Trên môi trường CI Linux, `path.basename` (POSIX) không coi ký tự `\` là dấu phân tách đường dẫn, khiến chuỗi đường dẫn kiểu Windows chứa directory traversal (ví dụ: `..\..\windows\system32\cmd.exe`) không bị cắt thư mục cha mà bị thay thế thành `.._.._windows_system32_cmd.exe`, làm fail bài test bảo mật và tiềm ẩn rủi ro xử lý tệp tin.

**Independent Test**: Chạy `npx vitest run server/utils/__tests__/fileValidation.test.ts` trên môi trường POSIX/Linux hoặc giả lập POSIX path; xác nhận 7/7 bài kiểm thử của `fileValidation Utility` đều vượt qua, trong đó `sanitizeFilename("..\\..\\windows\\system32\\cmd.exe")` trả về chính xác `"cmd.exe"`.

**Acceptance Scenarios**:
1. **Given** tên tệp đầu vào chứa đường dẫn phân cấp kiểu Windows với dấu gạch chéo ngược (`..\\..\\windows\\system32\\cmd.exe`), **When** gọi hàm `sanitizeFilename()`, **Then** kết quả trả về là `"cmd.exe"`.
2. **Given** tên tệp đầu vào chứa đường dẫn phân cấp kiểu POSIX với dấu gạch chéo xuôi (`../../../etc/passwd`), **When** gọi hàm `sanitizeFilename()`, **Then** kết quả trả về là `"passwd"`.
3. **Given** tên tệp đầu vào chứa khoảng trắng hoặc ký tự tiếng Việt hợp lệ (`my novel.txt`, `truyện_tiên_hiệp_123.epub`), **When** gọi hàm `sanitizeFilename()`, **Then** tên tệp được giữ nguyên vẹn.

---

### User Story 2 - Đảm Bảo Thứ Tự Build Trước Test Trong Quy Trình CI (Priority: P2)

Là một kỹ sư DevOps và thành viên đội ngũ phát triển, tôi muốn quy trình CI (`.github/workflows/ci.yml`) thực hiện công đoạn đóng gói ứng dụng (`npm run build`) TRƯỚC KHI thực thi bộ kiểm thử tự động (`npm test`), đảm bảo thư mục sản phẩm build (`dist/client`) và các tài nguyên tĩnh (`robots.txt`, `sitemap.xml`, `llms.txt`) đã sẵn sàng phục vụ cho các bài test tích hợp / verification.

**Why this priority**: Bài kiểm thử `server/__tests__/quickstartVerification.test.ts` khởi tạo một máy chủ Express để kiểm chứng phân phối tài nguyên tĩnh thực tế từ `dist/client` và kiểm tra sự vắng mặt của file `.map` (sourcemap leak). Nếu CI chạy test trước khi build, thư mục `dist/client` chưa tồn tại dẫn tới 4/5 scenario thất bại (lỗi HTTP 404 và `ENOENT`).

**Independent Test**: Kiểm tra tệp workflow `.github/workflows/ci.yml`, đảm bảo step `Build` đứng trước step `Run tests`. Chạy mô phỏng quy trình: `npm run build` rồi `npx vitest run`; xác nhận 100% test suites (toàn bộ 803 tests) đều pass.

**Acceptance Scenarios**:
1. **Given** workflow CI được kích hoạt khi push hoặc pull request vào nhánh `main`, **When** đến bước kiểm thử, **Then** step `Build` (`npm run build`) đã hoàn tất thành công trước step `Run tests` (`npm test`).
2. **Given** thư mục `dist/client` đã được tạo ra từ lệnh `npm run build`, **When** bài test `quickstartVerification.test.ts` truy vấn `/robots.txt`, `/sitemap.xml`, `/llms.txt`, **Then** máy chủ phản hồi mã trạng thái 200 kèm nội dung hợp lệ.
3. **Given** bản build production trong thư mục `dist/`, **When** kịch bản kiểm thử rà soát tệp sourcemap `.map`, **Then** không phát hiện bất kỳ tệp `.map` nào.

---

### Edge Cases

- **Tên tệp chứa hỗn hợp cả hai loại dấu gạch chéo**: Ví dụ `folder\\subfolder/file.txt` -> hàm phải chuẩn hóa toàn bộ `\` thành `/` trước khi lấy base name để trả về `"file.txt"`.
- **Tên tệp rỗng, null hoặc chỉ gồm khoảng trắng**: Hàm tự động sinh tên tệp dự phòng theo quy cách `upload_${Date.now()}`.
- **Thư mục `dist/client` khi chạy test cục bộ**: Lệnh `npm test` cục bộ khi chưa build có thể gặp lỗi nếu developer không build trước; quy trình CI chuẩn hóa việc build trước khi test sẽ bảo đảm môi trường kiểm thử tương đồng với môi trường triển khai thực tế.

---

## 2. Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hàm `sanitizeFilename` trong `server/utils/fileValidation.ts` PHẢI chuẩn hóa tất cả các ký tự gạch chéo ngược (`\`) thành gạch chéo xuôi (`/`) trước khi gọi hàm lấy tên cơ bản `path.basename()`.
- **FR-002**: Hàm `sanitizeFilename` PHẢI loại bỏ hoàn toàn các phân đoạn điều hướng thư mục cha (`..`) và các ký tự không nằm trong danh sách ký tự an toàn được phép.
- **FR-003**: Workflow CI tại `.github/workflows/ci.yml` PHẢI định nghĩa step `Build` (`npm run build`) ngay trước step `Run tests` (`npm test`).
- **FR-004**: Quy trình xác minh chất lượng PHẢI đảm bảo toàn bộ 803 bài kiểm thử tự động của vitest đều pass mà không được loại bỏ, vô hiệu hóa (skip), hay sửa đổi assertion của bất kỳ bài test nào.
- **FR-005**: Mã nguồn sau khi sửa đổi PHẢI tuân thủ nghiêm ngặt kiểm tra kiểu dữ liệu TypeScript (`npm run lint` / `tsc --noEmit`) và tạo bản build production thành công (`npm run build`).

---

## 3. Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Bài test `server/utils/__tests__/fileValidation.test.ts` đạt tỷ lệ pass 100% (7/7 tests) trên cả hệ điều hành Windows và Linux/POSIX.
- **SC-002**: Toàn bộ test suite của dự án đạt 100% pass (803/803 tests, 0 fail).
- **SC-003**: Lệnh `npm run build` thực thi thành công không có lỗi, sinh ra `dist/client` và `dist/server/server.cjs`.
- **SC-004**: Workflow GitHub Actions CI trên nhánh `main` vượt qua 100% các jobs (`Type check`, `Build`, `Run tests`).

---

## 4. Assumptions & Constraints

- Sourcemap trong `vite.config.ts` và lệnh `esbuild` đã được tắt sẵn theo cấu hình mặc định của dự án, do đó bản build production đảm bảo không sinh tệp `.map`.
- Không có thay đổi nào đối với logic gọi API AI Gemini hay lược đồ cơ sở dữ liệu IndexedDB, tuân thủ nguyên tắc bảo toàn kiến trúc trong `AGENTS.md` và Constitution.
