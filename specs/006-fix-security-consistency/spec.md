# Feature Specification: Vá Lỗ Hổng Nhất Quán Bảo Mật (Redact API Key & Khớp Tuyệt Đối Route Public)

**Feature Branch**: `006-fix-security-consistency`

**Created**: 2026-08-19

**Status**: Draft

**Input**: User description: "Vá 2 lỗ hổng nhất quán bảo mật đã phát hiện qua audit thủ công, không phải tính năng mới: Vấn đề A — Log không đi qua cơ chế redact API key trong luồng lỗi tổng hợp (throw ALL_KEYS_EXHAUSTED và console.* trong server/controllers/**); Vấn đề B — authMiddleware dùng endsWith() để nhận diện route public."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Khử Khóa Bí Mật Toàn Diện Trong Ngoại Lệ Tổng Hợp & Chuẩn Hóa Logger Cho Controller (Priority: P1) 🎯 MVP

Là quản trị viên vận hành hệ thống, tôi muốn khi dịch vụ gặp sự cố cạn kiệt toàn bộ các khóa API hoặc xảy ra lỗi xử lý trong các bộ điều khiển (controllers), mọi thông điệp ngoại lệ và nhật ký hệ thống đều được tự động làm sạch và che giấu (redact) toàn bộ các khóa API/thông tin nhạy cảm, đồng thời toàn bộ luồng ghi log trong tầng controller được chuyển hướng qua bộ ghi nhật ký tập trung (structured logger) có cơ chế làm sạch tự động, thay vì in trực tiếp ra console ở dạng dữ liệu thô.

**Why this priority**: Cam kết an toàn thông tin trong `SECURITY.md` khẳng định hệ thống tự động lọc và thay thế chuỗi API key Gemini bằng `[REDACTED]`. Nếu thông điệp lỗi tổng hợp cuối cùng `ALL_KEYS_EXHAUSTED` hoặc các lệnh in thô trong controller để lọt API key (ví dụ từ URL lỗi mạng hoặc query parameters), thông tin nhạy cảm sẽ bị rò rỉ vào hệ thống log công khai hoặc giám sát tập trung.

**Independent Test**:
1. Giả lập tình huống toàn bộ khóa API đều gặp lỗi và ném ra ngoại lệ `ALL_KEYS_EXHAUSTED` chứa chuỗi khóa nhạy cảm trong `lastError.message`, kiểm tra chuỗi thông điệp trả về xác nhận 100% khóa API đã được thay thế bằng chuỗi đã che `***REDACTED***` hoặc `[REDACTED]`.
2. Kiểm tra toàn bộ mã nguồn tầng controller (`server/controllers/**`), xác nhận không còn bất kỳ lệnh `console.log`, `console.warn`, `console.error` trực tiếp nào, tất cả đều ghi nhận qua `Logger` có cơ chế khử bí mật tự động.
3. Kích hoạt các luồng xử lý controller (dịch thô, chuốt văn, QA critique, glossary, session, quota, auth) và kiểm tra log output, xác minh giữ nguyên vẹn 100% nội dung thông điệp tiếng Việt và phong cách log.

**Acceptance Scenarios**:

1. **Given** toàn bộ các khóa API Gemini đều thất bại và ném ra lỗi tổng hợp `ALL_KEYS_EXHAUSTED`, **When** ngoại lệ được tạo và throw ra ngoài, **Then** thông điệp lỗi cuối (`lastError.message`) được xử lý qua hàm khử chuỗi nhạy cảm (`redactApiKey`), đảm bảo không chứa chuỗi API key thô.
2. **Given** một sự cố hoặc lỗi nghiệp vụ xảy ra tại bất kỳ controller nào trong `server/controllers/**`, **When** controller thực hiện ghi nhận nhật ký (log error, warn, info), **Then** thông tin được ghi qua module `Logger` (với context tương ứng) và tự động làm sạch các tham số bí mật trong message và metadata.
3. **Given** các tiến trình log hiện tại trong hệ thống controller, **When** chuyển đổi từ `console.*` sang `Logger`, **Then** nội dung văn phong, câu chữ tiếng Việt và các mức độ log (`error`, `warn`, `info`, `debug`) được bảo toàn nguyên vẹn.

---

### User Story 2 - So Khớp Tuyệt Đối Đường Dẫn Công Khai Ngăn Chặn Bypass Xác Thực (Priority: P1) 🎯 MVP

Là một quản trị viên bảo mật, tôi muốn cơ chế kiểm tra xác thực trung gian (`authMiddleware`) chỉ cho phép bỏ qua xác thực đối với các đường dẫn API công khai nằm chính xác trong danh sách trắng định sẵn (`PUBLIC_API_PATHS`), không chấp nhận so khớp lỏng lẻo theo hậu tố chuỗi (`endsWith`), nhằm ngăn chặn kẻ tấn công lợi dụng việc đặt tên đường dẫn giả mạo để vượt qua lớp bảo vệ mật khẩu máy chủ.

**Why this priority**: Việc sử dụng so khớp hậu tố (`requestPath.endsWith(...)`) tạo ra nguy cơ nghiêm trọng khi kẻ tấn công có thể truy cập các endpoint nhạy cảm trong tương lai nếu đường dẫn tình cờ hoặc cố ý kết thúc bằng chuỗi public (như `/api/fake/health`, `/x/auth/login`, `/service/something/auth/status`), dẫn đến bypass xác thực ngoài ý muốn.

**Independent Test**:
1. Gửi request không kèm token xác thực tới các đường dẫn công khai hợp lệ (`/api/auth/login`, `/api/auth/status`, `/api/health`, `/auth/login`, `/auth/status`, `/health`), xác minh request được cho phép đi qua (`next()`).
2. Gửi request không kèm token xác thực tới các đường dẫn giả mạo có hậu tố trùng khớp (ví dụ `/api/fake/health`, `/x/auth/login`, `/something/auth/status`, `/api/unauthorized/auth/login`), xác minh request bị chặn lại với mã lỗi HTTP 401 Unauthorized và yêu cầu đăng nhập.
3. Chạy bộ kiểm thử tự động `server/controllers/__tests__/authController.test.ts` và các test suite liên quan để xác nhận các trường hợp biên được kiểm chứng đầy đủ.

**Acceptance Scenarios**:

1. **Given** hệ thống đang bật chế độ bảo vệ mật khẩu truy cập máy chủ (`ACCESS_PASSWORD`), **When** một request không có token gọi đến đường dẫn có hậu tố trùng nhưng không nằm trong danh sách trắng chính xác (ví dụ `/api/fake/health` hoặc `/x/auth/login`), **Then** `authMiddleware` từ chối request với mã HTTP 401 và thông báo yêu cầu mật khẩu.
2. **Given** hệ thống đang bật chế độ bảo vệ mật khẩu truy cập máy chủ (`ACCESS_PASSWORD`), **When** một request không có token gọi đến đúng đường dẫn thuộc danh sách trắng (`PUBLIC_API_PATHS`), **Then** `authMiddleware` cho phép request tiếp tục xử lý bình thường.
3. **Given** bộ test của `authMiddleware`, **When** chạy kiểm thử, **Then** test suite chứa các test case tường minh mô tả rõ TẠI SAO việc chặn các route giả mạo hậu tố là cần thiết để bảo vệ hệ thống khỏi lỗ hổng path confusion/bypass xác thực.

---

### Edge Cases

- **Lỗi lồng nhau chứa API Key trong Error Cause hoặc Stack Trace**: Khi Google Generative AI SDK hoặc mạng bị lỗi ném ra ngoại lệ có URL chứa query param dạng `?key=AIza...`, toàn bộ chuỗi này phải được lọc sạch khi tạo thông điệp tổng hợp.
- **Đường dẫn có khoảng trắng hoặc ký tự đặc biệt**: Đường dẫn gửi vào middleware xác thực được chuẩn hóa và so khớp chính xác với `PUBLIC_API_PATHS`.
- **Cấu hình không bật mật khẩu (`ACCESS_PASSWORD` trống)**: Khi máy chủ chạy ở chế độ mở không yêu cầu mật khẩu, middleware vẫn hoạt động trơn tru và cho phép mọi request đi tiếp.
- **Log với metadata là object phức tạp**: Khi controller truyền thêm thông tin ngữ cảnh dạng object hoặc error instance vào `logger`, các trường chứa khóa bí mật bên trong object phải được lọc đệ quy theo cơ chế của `sanitizeValue`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI đảm bảo ngoại lệ tổng hợp `ALL_KEYS_EXHAUSTED` tại `server/services/geminiService.ts` thực hiện lọc và che giấu toàn bộ API key thông qua hàm `redactApiKey()` trước khi đưa vào thuộc tính thông điệp lỗi (message).
- **FR-002**: Toàn bộ các lệnh gọi `console.log`, `console.warn`, `console.error` trong thư mục `server/controllers/**` (bao gồm `rawController.ts`, `polishController.ts`, `qaController.ts`, `glossaryController.ts`, `alignmentController.ts`, `authController.ts`, `sessionController.ts`, `quotaController.ts`...) PHẢI được thay thế bằng module `Logger` từ `server/utils/logger.ts`.
- **FR-003**: Hệ thống PHẢI giữ nguyên 100% nội dung thông điệp tiếng Việt, ý nghĩa ngữ cảnh và cấp độ ghi log (`info`, `warn`, `error`, `debug`) của các thông báo hiện có trong các controller.
- **FR-004**: Quá trình chuẩn hóa log và xử lý thông điệp ngoại lệ TUYỆT ĐỐI KHÔNG làm thay đổi logic dịch thuật, thuật toán xoay tua khóa (key rotation), chiến lược Circuit Breaker hay cơ chế chia nhỏ thích ứng (Adaptive Split).
- **FR-005**: `server/middleware/authMiddleware.ts` PHẢI loại bỏ hoàn toàn các điều kiện kiểm tra hậu tố chuỗi `endsWith("/auth/login")`, `endsWith("/auth/status")`, `endsWith("/health")`, và CHỈ cho phép bypass xác thực nếu đường dẫn thuộc tập hợp `PUBLIC_API_PATHS`.
- **FR-006**: Tập hợp `PUBLIC_API_PATHS` PHẢI duy trì danh sách trắng đầy đủ các route công khai hợp lệ cho cả hai định dạng có và không có tiền tố `/api` (`/auth/login`, `/auth/status`, `/health`, `/api/auth/login`, `/api/auth/status`, `/api/health`).
- **FR-007**: Dự án PHẢI cập nhật và bổ sung các ca kiểm thử tự động trong bộ test xác thực để chứng minh các đường dẫn giả mạo hậu tố (như `/api/fake/health`, `/x/auth/login`, `/custom/auth/status`) bị từ chối truy cập 401 khi chưa đăng nhập. Test case phải giải thích rõ ràng mục đích an toàn theo nguyên tắc kiểm thử định hướng mục đích.

### Key Entities

- **Redacted Error Exception**: Đối tượng ngoại lệ mang thông điệp báo cạn kiệt khóa (`ALL_KEYS_EXHAUSTED`) mà trong đó toàn bộ khóa bí mật đã được thay thế bằng chuỗi an toàn.
- **Controller Structured Logger**: Thực thể ghi nhật ký (`Logger`) được gán ngữ cảnh theo từng controller, tự động chạy qua lớp lọc `sanitizeSecretString` và `sanitizeValue` trước khi xuất log ra luồng chuẩn.
- **Exact-Match Public Path Set**: Tập hợp chuỗi bất biến đại diện cho danh sách các đường dẫn API công khai duy nhất được phép truy cập không cần token phiên.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% thông điệp lỗi từ ngoại lệ `ALL_KEYS_EXHAUSTED` không chứa bất kỳ chuỗi API key thô nào, được xác thực qua bài kiểm tra tự động.
- **SC-002**: 0 lệnh `console.log`, `console.warn`, `console.error` tồn tại trực tiếp trong mã nguồn của tất cả các controller thuộc `server/controllers/**`.
- **SC-003**: 100% các request không xác thực đến các đường dẫn chứa hậu tố trùng lặp giả mạo (không nằm trong `PUBLIC_API_PATHS`) đều bị từ chối với mã HTTP 401 khi `ACCESS_PASSWORD` được thiết lập.
- **SC-004**: 100% các ca kiểm thử hiện có và mới bổ sung trong hệ thống đều vượt qua thành công (`npm test`), kiểu dữ liệu TypeScript sạch (`npm run lint`), và build thành công (`npm run build`).

## Assumptions

- Module `server/utils/logger.ts` đã được thiết kế sẵn và hoạt động ổn định với các phương thức `sanitizeSecretString` và `sanitizeValue`.
- Các route công khai cần thiết của hệ thống hiện tại chỉ bao gồm các route login, status, và healthcheck đã được khai báo trong `PUBLIC_API_PATHS`.
- Việc thay thế phương thức ghi log không làm thay đổi định dạng dữ liệu trả về cho client ở tầng HTTP response.
