# Feature Specification: Khắc Phục Lỗ Hổng Bảo Mật Dependency & Đảm Bảo Cổng Kiểm Duyệt CI (`npm audit`)

**Feature Branch**: `[164-npm-audit-remediation]`

**Created**: 2026-11-15

**Status**: Draft

**Input**: User description: "Run npm audit --audit-level=high
# npm audit report
@vitest/mocker <=4.1.11 (Severity: moderate), vitest 2.1.0-beta.1 - 4.1.11 (Severity: moderate), undici 7.0.0 - 7.30.0 (Severity: high), vite <=6.4.3 (Severity: high)
4 vulnerabilities (2 moderate, 2 high)
Error: Process completed with exit code 1.
sau khi sửa xong thì tôi gặp lỗi này"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Vượt Qua Cổng Kiểm Duyệt Bảo Mật Tự Động Trên CI (Priority: P1)

Khi nhà phát triển hoặc hệ thống tích hợp liên tục (CI) chạy bước kiểm tra an toàn bảo mật phụ thuộc (`Security audit`), toàn bộ các lỗ hổng mức độ nghiêm trọng cao (`high`) và tới hạn (`critical`) trong cây phụ thuộc của dự án phải được xử lý triệt để để quy trình kiểm tra tự động hoàn tất với mã thoát `0` thay vì dừng lỗi ở bước kiểm tra bảo mật.

**Why this priority**: Đường ống kiểm thử tự động hiện tại chặn toàn bộ quá trình xác nhận mã nguồn ngay tại bước kiểm tra bảo mật trước khi chạy kiểm tra kiểu dữ liệu, đóng gói và kiểm thử đơn vị. Nếu không khắc phục các lỗ hổng mức độ cao, mọi bản cập nhật tính năng đều bị đánh dấu thất bại trên CI.

**Independent Test**: Có thể kiểm thử độc lập bằng cách cài đặt sạch phụ thuộc từ tệp khóa phiên bản và thực thi lệnh kiểm tra bảo mật ở ngưỡng nghiêm trọng cao; kết quả phải trả về `0` lỗ hổng mức cao/nghiêm trọng và mã thoát `0`.

**Acceptance Scenarios**:

1. **Given** kho mã nguồn được cài đặt từ tệp khóa phụ thuộc chuẩn, **When** hệ thống thực thi kiểm tra bảo mật với ngưỡng mức độ cao (`high`), **Then** trình kiểm tra báo cáo `0` lỗ hổng mức độ cao hoặc nghiêm trọng và kết thúc thành công với mã thoát `0`.
2. **Given** các gói phụ thuộc liên quan đến công cụ đóng gói và thư viện mạng nội bộ từng bị cảnh báo mức độ cao (`undici`, `vite`), **When** kiểm tra phiên bản đã khóa trong cây phụ thuộc, **Then** tất cả các gói này đều nằm ở phiên bản đã được vá lỗi bảo mật chính thức.

---

### User Story 2 - Làm Sạch Toàn Bộ Cảnh Báo Bảo Mật Trung Bình Của Bộ Công Cụ Kiểm Thử (Priority: P2)

Khi nhà phát triển kiểm tra tổng thể sức khỏe phụ thuộc của dự án, các cảnh báo bảo mật mức độ trung bình (`moderate`) trong bộ khung kiểm thử (`vitest`, `@vitest/mocker`) cũng được nâng cấp lên bản vá an toàn tương thích, giúp báo cáo bảo mật sạch hoàn toàn (`0 vulnerabilities`) và loại bỏ nguy cơ lỗ hổng tiêm mã hoặc vượt đường dẫn trên môi trường phát triển cục bộ.

**Why this priority**: Dù cổng CI mặc định chặn từ ngưỡng `high`, việc xử lý đồng thời các lỗ hổng `moderate` đã có sẵn bản vá tương thích giúp bảo vệ máy trạm của nhà phát triển (đặc biệt trên môi trường Windows) và giữ báo cáo kiểm toán phụ thuộc ở trạng thái sạch tuyệt đối.

**Independent Test**: Có thể kiểm thử độc lập bằng cách chạy kiểm tra bảo mật toàn diện ở mọi mức độ nghiêm trọng và xác nhận báo cáo trả về `0 vulnerabilities`.

**Acceptance Scenarios**:

1. **Given** kho mã nguồn sau khi cập nhật tệp khóa phụ thuộc, **When** chạy kiểm tra bảo mật toàn diện không giới hạn ngưỡng, **Then** báo cáo hiển thị `0 vulnerabilities` (không còn cảnh báo ở cả mức `moderate`, `high` hay `critical`).
2. **Given** môi trường phát triển trên hệ điều hành Windows hoặc Linux, **When** khởi chạy bộ kiểm thử tự động của dự án, **Then** các bài kiểm thử có sử dụng cơ chế giả lập mô-đun (`mock`) vẫn vận hành chính xác và an toàn.

---

### User Story 3 - Bảo Toàn Tính Tương Thích & Độ Ổn Định Của Ứng Dụng Sau Khi Vá Bảo Mật (Priority: P1)

Sau khi cập nhật các bản vá bảo mật cho cây phụ thuộc, toàn bộ chức năng biên dịch, kiểm tra kiểu dữ liệu, chạy bộ kiểm thử tự động và đóng gói sản phẩm của ứng dụng dịch tiểu thuyết vẫn phải hoạt động ổn định 100%, không phát sinh lỗi hồi quy hoặc thay đổi hành vi nghiệp vụ.

**Why this priority**: Việc nâng cấp các gói nền tảng phục vụ đóng gói và kiểm thử có thể gây xung đột phiên bản hoặc thay đổi hành vi nếu không được xác minh toàn diện; đảm bảo không đứt gãy luồng làm việc hiện có là yêu cầu bắt buộc.

**Independent Test**: Có thể kiểm thử độc lập bằng cách thực thi tuần tự toàn bộ các cổng chất lượng của dự án (kiểm tra kiểu tĩnh, chạy toàn bộ bài kiểm thử tự động, đóng gói bản phân phối) và xác nhận tất cả hoàn tất không lỗi.

**Acceptance Scenarios**:

1. **Given** tệp khai báo và tệp khóa phụ thuộc đã được cập nhật bản vá bảo mật, **When** chạy kiểm tra kiểu tĩnh, toàn bộ bộ kiểm thử tự động và quy trình đóng gói bản dựng sản phẩm, **Then** cả ba quy trình đều vượt qua 100% mà không cần xóa, bỏ qua hay làm yếu bất kỳ bài kiểm thử nào.
2. **Given** kho mã nguồn sạch cài đặt lại từ tệp khóa phụ thuộc, **When** đối chiếu danh sách phụ thuộc trực tiếp của ứng dụng, **Then** không có bất kỳ thư viện chức năng mới nào bị thêm thừa vào dự án ngoài các cập nhật bản vá bảo mật cần thiết.

---

### Edge Cases

- **Xung đột phụ thuộc bắc cầu (Transitive dependency pinning)**: Điều gì xảy ra nếu một gói phụ thuộc cấp cha ghim dải phiên bản cũ khiến công cụ tự động không thể nâng cấp gói con bị lỗi (`undici`, `@vitest/mocker`, `vite`)? Hệ thống phải sử dụng cơ chế nâng cấp tương thích hoặc ghi đè phiên bản an toàn trong cấu hình phụ thuộc để ép toàn bộ cây phụ thuộc dùng bản đã vá lỗi mà không phá vỡ tương thích.
- **Đồng bộ giữa tệp khai báo và tệp khóa**: Điều gì xảy ra khi cài đặt phụ thuộc bằng chế độ nghiêm ngặt trên CI (`clean install`)? Tệp khai báo phụ thuộc và tệp khóa phiên bản phải đồng bộ tuyệt đối để lệnh cài đặt sạch không báo lỗi lệch phiên bản.
- **Tương thích môi trường Node và hệ điều hành Windows/Linux**: Các bản vá liên quan đến xử lý đường dẫn trên Windows và trình chạy kiểm thử phải hoạt động đồng nhất trên cả máy trạm Windows của người dùng lẫn máy chủ Linux của CI.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Dự án PHẢI cập nhật các gói phụ thuộc bị ảnh hưởng trong tệp khóa phiên bản (và tệp khai báo phụ thuộc nếu cần thiết) để khắc phục triệt để các lỗ hổng bảo mật mức độ `high` trong `undici` và `vite`.
- **FR-002**: Dự án PHẢI cập nhật các gói phụ thuộc phục vụ kiểm thử (`vitest`, `@vitest/mocker`) lên phiên bản đã vá để khắc phục các lỗ hổng bảo mật mức độ `moderate`.
- **FR-003**: Tệp khai báo phụ thuộc và tệp khóa phiên bản PHẢI hoàn toàn đồng bộ sao cho quy trình cài đặt phụ thuộc sạch (`clean install`) thực thi thành công mà không phát sinh cảnh báo lệch khóa hay thay đổi ngoài ý muốn.
- **FR-004**: Sau khi áp dụng bản vá, lệnh kiểm tra bảo mật ở ngưỡng nghiêm trọng cao (`audit-level=high`) và kiểm tra bảo mật tiêu chuẩn PHẢI kết thúc với mã thoát `0`.
- **FR-005**: Việc khắc phục lỗ hổng bảo mật KHÔNG ĐƯỢC thêm bất kỳ gói phụ thuộc tính năng mới nào vào dự án, tuân thủ nghiêm ngặt nguyên tắc tối giản phụ thuộc của dự án.
- **FR-006**: Toàn bộ mã nguồn ứng dụng, cấu trúc dữ liệu lưu trữ cục bộ và giao diện người dùng tiếng Việt PHẢI giữ nguyên 100% tính tương thích; toàn bộ các cổng kiểm tra chất lượng (kiểm tra kiểu dữ liệu, bộ kiểm thử tự động, đóng gói sản phẩm) PHẢI vượt qua hoàn toàn sau khi cập nhật.

### Key Entities *(include if feature involves data)*

- **Dependency Manifest (`package.json`)**: Tệp khai báo danh sách các gói phụ thuộc trực tiếp, phụ thuộc phát triển và các quy tắc ghi đè phiên bản (`overrides`) của dự án.
- **Dependency Lockfile (`package-lock.json`)**: Tệp khóa chính xác phiên bản và mã băm toàn vẹn của toàn bộ cây phụ thuộc trực tiếp và bắc cầu phục vụ cài đặt tái lập trên CI.
- **Security Audit Report**: Báo cáo kiểm toán lỗ hổng bảo mật đối chiếu cây phụ thuộc hiện tại với cơ sở dữ liệu cảnh báo bảo mật chính thức.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Lệnh kiểm tra bảo mật phụ thuộc ở ngưỡng cao (`audit-level=high`) trả về `0` lỗ hổng mức độ `high` hoặc `critical` và kết thúc với mã thoát `0` trong 100% lần chạy.
- **SC-002**: Báo cáo kiểm tra bảo mật tổng thể ghi nhận `0` lỗ hổng tồn đọng trên toàn bộ cây phụ thuộc (`0 moderate`, `0 high`, `0 critical`).
- **SC-003**: 100% bộ kiểm thử hiện có của dự án (toàn bộ các tệp kiểm thử và kịch bản kiểm thử) chạy thành công mà không có bất kỳ bài kiểm thử nào bị xóa, tắt hoặc bỏ qua.
- **SC-004**: Quá trình cài đặt phụ thuộc sạch, kiểm tra kiểu dữ liệu và đóng gói bản dựng phân phối hoàn tất với `0` lỗi phát sinh.

## Assumptions

- Các bản vá bảo mật chính thức cho tất cả các gói bị cảnh báo (`vite`, `undici`, `vitest`, `@vitest/mocker`) đã được phát hành trên kho lưu trữ gói công cộng và tương thích ngược với cấu hình hiện tại của dự án.
- Phạm vi của đặc tả này chỉ tập trung vào việc xử lý dứt điểm các lỗ hổng bảo mật phụ thuộc khiến bước kiểm tra an toàn thất bại và xác minh tính ổn định của hệ thống xây dựng/kiểm thử, không thay đổi bất kỳ tính năng nghiệp vụ dịch thuật nào.
