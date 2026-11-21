# Feature Specification: Cải tiến Xuất & Nhập File Cẩm Nang Từ Điển

**Feature Branch**: `165-glossary-import-export-upgrade`

**Created**: 2026-11-22

**Status**: Draft

**Input**: User description: "cải tiến chức năng xuất file và nhập file cẩm nang từ điển; bổ sung ngày thêm cho file từ điển được xuất ra"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Xuất file từ điển kèm Ngày thêm và thông tin đầy đủ (Priority: P1)

Người dùng mở màn hình quản lý từ điển dự án và chọn xuất từ điển ra tệp tin. Tệp được xuất ra bao gồm đầy đủ các thuật ngữ theo nhóm loại, bổ sung cột/trường **Ngày thêm** cho từng mục từ, cùng thông tin tổng quan của dự án (tên dự án, thời gian xuất, tổng số thuật ngữ) để người dùng dễ dàng lưu trữ, chia sẻ, tra cứu lịch sử thêm từ hoặc nhập lại vào dự án khác.

**Why this priority**: Đây là yêu cầu trực tiếp cốt lõi của người dùng ("bổ sung ngày thêm cho file từ điển được xuất ra") và là nền tảng để dữ liệu xuất ra có giá trị lưu trữ, đối chiếu theo thời gian.

**Independent Test**: Có thể kiểm thử độc lập bằng cách tạo hoặc mở một dự án có ít nhất 2 mục từ điển (có ngày thêm và có mục cũ chưa có ngày thêm), thực hiện xuất file từ điển và mở file kết quả để xác nhận cột/trường Ngày thêm hiển thị đúng định dạng cho từng mục.

**Acceptance Scenarios**:

1. **Given** dự án có các mục từ điển đã được ghi nhận thời gian tạo, **When** người dùng xuất từ điển ra tệp Markdown (`.md`), **Then** mỗi dòng trong bảng từ điển đều có cột **Ngày thêm** hiển thị ngày (hoặc ngày giờ) tương ứng của mục từ đó, bên cạnh các cột hiện có (Tiếng Trung, Phiên âm, Tiếng Việt, Ghi chú).
2. **Given** dự án có mục từ điển cũ chưa có dữ liệu ngày thêm, **When** người dùng xuất từ điển, **Then** hệ thống vẫn xuất thành công mà không lỗi, hiển thị giá trị mặc định rõ ràng (ví dụ `—`) tại cột Ngày thêm của mục đó.
3. **Given** người dùng đang lọc từ điển trên giao diện (theo nhóm loại, từ khóa, hoặc ngày thêm) hoặc muốn xuất toàn bộ, **When** người dùng thực hiện thao tác xuất, **Then** người dùng có thể xuất toàn bộ từ điển hoặc phạm vi đang lọc, với tên tệp phản ánh rõ tên dự án và thời điểm xuất.

---

### User Story 2 - Nhập trực tiếp tệp từ điển có cấu trúc không cần tốn lượt AI và giữ nguyên Ngày thêm (Priority: P1)

Khi người dùng nhập lại tệp từ điển đã xuất từ ứng dụng (hoặc tệp bảng Markdown / CSV / JSON đúng cấu trúc chuẩn), hệ thống nhận diện và phân tích trực tiếp nội dung tệp ngay lập tức, hoàn toàn ngoại tuyến, không bị cắt bớt do giới hạn độ dài và không tiêu tốn hạn mức AI. Nếu tệp nhập có sẵn thông tin **Ngày thêm**, giá trị này được giữ nguyên thay vì ghi đè bằng thời điểm nhập.

**Why this priority**: Hiện tại mọi tệp `.md` khi nhập đều phải gửi qua AI để phân tích, dẫn đến chậm, tốn quota, có thể bị cắt bớt nếu từ điển dài, và làm mất dữ liệu gốc (như Ngày thêm) khi người dùng xuất ra rồi nhập lại.

**Independent Test**: Có thể kiểm thử độc lập bằng cách xuất từ điển của dự án A ra tệp `.md` (hoặc `.json`/`.csv`), sau đó nhập tệp đó vào dự án B (thậm chí khi không có kết nối AI) và xác nhận toàn bộ thuật ngữ cùng Ngày thêm được khôi phục chính xác 100%.

**Acceptance Scenarios**:

1. **Given** người dùng tải lên một tệp Markdown có cấu trúc bảng từ điển chuẩn (bao gồm tệp vừa xuất từ ứng dụng), **When** hệ thống xử lý tệp, **Then** hệ thống trích xuất trực tiếp toàn bộ các hàng trong bảng mà không gọi AI, không cắt ngắn dữ liệu dù tệp có hàng nghìn mục từ.
2. **Given** tệp từ điển nhập vào có cột/trường **Ngày thêm** hợp lệ, **When** các mục từ được thêm vào từ điển, **Then** thời gian tạo của mỗi mục được bảo toàn theo giá trị trong tệp (nếu thiếu hoặc không hợp lệ mới dùng thời điểm nhập hiện tại).
3. **Given** tệp người dùng tải lên là tệp cẩm nang văn xuôi tự do (không có cấu trúc bảng/dữ liệu chuẩn), **When** hệ thống kiểm tra định dạng, **Then** hệ thống tự động chuyển sang chế độ phân tích thông minh bằng AI (hoặc cho phép người dùng xác nhận phân tích bằng AI) để trích xuất thuật ngữ như trước đây.

---

### User Story 3 - Kéo-thả, xem trước và xử lý xung đột linh hoạt khi nhập cẩm nang (Priority: P2)

Trong hộp thoại nhập cẩm nang từ điển, người dùng có thể kéo-thả tệp trực tiếp vào vùng tải lên (hoặc chọn tệp từ máy), xem trước tóm tắt số lượng thuật ngữ hợp lệ và số lượng mục trùng lặp phát hiện được, đồng thời chọn cách xử lý trùng lặp (bỏ qua mục trùng, ghi đè mục cũ, hoặc đưa vào hàng chờ rà soát) trước khi áp dụng vào từ điển.

**Why this priority**: Nâng cao đáng kể trải nghiệm nhập liệu thực tế: sửa lỗi vùng kéo-thả chưa hoạt động, giúp người dùng kiểm soát dữ liệu trước khi ghi vào từ điển và tránh phải rà soát thủ công từng mục khi nhập cập nhật từ điển lớn.

**Independent Test**: Có thể kiểm thử độc lập bằng cách kéo-thả một tệp từ điển có cả từ mới và từ trùng với từ điển hiện tại vào hộp thoại nhập, xem bản xem trước thống kê, chọn một phương án xử lý trùng lặp và xác nhận kết quả lưu đúng theo lựa chọn.

**Acceptance Scenarios**:

1. **Given** người dùng mở hộp thoại nhập cẩm nang từ điển, **When** người dùng kéo và thả một tệp hợp lệ (`.md`, `.txt`, `.csv`, `.json`) vào vùng tải lên, **Then** hệ thống tiếp nhận tệp và hiển thị phản hồi trực quan khi kéo qua vùng thả.
2. **Given** tệp đã được phân tích và có chứa mục trùng lặp với từ điển hiện có, **When** màn hình xem trước hiển thị, **Then** người dùng thấy rõ số lượng từ mới, số lượng từ trùng và có thể chọn: chỉ thêm từ mới (bỏ qua từ trùng), cập nhật/ghi đè mục trùng, hoặc chuyển mục trùng sang hàng chờ "Rà soát trùng lặp".
3. **Given** người dùng tải lên tệp không đúng định dạng hỗ trợ hoặc tệp rỗng/lỗi cấu trúc, **When** hệ thống kiểm tra tệp, **Then** hệ thống hiển thị thông báo lỗi tiếng Việt rõ ràng và cho phép chọn lại tệp khác mà không làm mất trạng thái hiện tại.

---

### User Story 4 - Hỗ trợ đa định dạng xuất/nhập phổ biến (Markdown, JSON, CSV) (Priority: P3)

Ngoài định dạng Markdown (`.md`) mặc định thân thiện cho việc đọc và chỉnh sửa bằng văn bản, người dùng có thể chọn xuất hoặc nhập từ điển ở định dạng dữ liệu có cấu trúc (`.json` để sao lưu trọn vẹn cả biến thể, ghi chú, hồ sơ nhân vật và ngày thêm; hoặc `.csv` để mở và chỉnh sửa hàng loạt trên bảng tính như Excel/Google Sheets).

**Why this priority**: Đáp ứng nhu cầu thực tế của dịch giả thường quản lý bảng thuật ngữ lớn bằng Excel/Sheets hoặc muốn sao lưu trọn vẹn dữ liệu từ điển giữa các dự án.

**Independent Test**: Có thể kiểm thử độc lập bằng cách chọn định dạng CSV hoặc JSON khi xuất, mở kiểm tra nội dung có đủ cột Ngày thêm, sau đó nhập lại tệp đó vào ứng dụng và xác nhận dữ liệu khớp hoàn toàn.

**Acceptance Scenarios**:

1. **Given** người dùng nhấn nút Xuất từ điển, **When** người dùng chọn định dạng `.md`, `.csv` hoặc `.json`, **Then** hệ thống tạo tệp tải xuống đúng định dạng với đầy đủ cột/trường **Ngày thêm** (tệp `.csv` hiển thị đúng tiếng Việt có dấu khi mở bằng phần mềm bảng tính).
2. **Given** người dùng nhập tệp `.csv` hoặc `.json` xuất ra từ ứng dụng hoặc tạo theo mẫu chuẩn, **When** người dùng tải lên, **Then** hệ thống đọc trực tiếp và nhập chính xác các trường dữ liệu tương ứng.

---

### Edge Cases

- Tệp nhập vào có bảng Markdown nhưng thứ tự cột khác nhau, thiếu cột `Phiên âm` hoặc thiếu cột `Ngày thêm`, hoặc có thêm ký tự `|` được escape (`\|`) trong ghi chú.
- Giá trị `Ngày thêm` trong tệp nhập có nhiều định dạng phổ biến (ví dụ `DD/MM/YYYY`, `DD/MM/YYYY HH:mm`, `YYYY-MM-DD`, hoặc ISO timestamp) — hệ thống phải chuẩn hóa an toàn hoặc fallback về thời điểm hiện tại nếu không hợp lệ.
- Tệp `.md` vừa có các đoạn văn bản hướng dẫn tự do, vừa có bảng Markdown chuẩn — hệ thống ưu tiên đọc bảng chuẩn và thông báo rõ nếu cần dùng AI cho phần văn xuôi còn lại.
- Tệp `.md` văn xuôi quá dài vượt ngưỡng một lần phân tích AI — hệ thống cảnh báo rõ tỷ lệ nội dung được xử lý hoặc chia nhỏ để tránh mất dữ liệu âm thầm.
- Tệp có kích thước rỗng, chỉ có tiêu đề bảng không có dữ liệu, hoặc sai mã hóa/định dạng không hỗ trợ.
- Thao tác kéo-thả nhiều tệp cùng lúc hoặc kéo-thả tệp khi hệ thống đang xử lý tệp trước đó (phải chặn trùng lặp thao tác và thông báo hợp lý).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI bổ sung thông tin **Ngày thêm** cho từng mục từ trong mọi tệp từ điển được xuất ra (hiển thị dạng đọc được cho người dùng ở bảng Markdown/CSV và dạng chuẩn thời gian ở JSON; hiển thị ký hiệu mặc định rõ ràng cho các mục cũ chưa có ngày thêm).
- **FR-002**: Hệ thống PHẢI hỗ trợ xuất từ điển kèm thông tin ngữ cảnh dự án (tên dự án, thời điểm xuất, tổng số mục từ, phân nhóm theo loại thuật ngữ) và đặt tên tệp xuất rõ ràng, dễ phân biệt.
- **FR-003**: Hệ thống PHẢI cho phép người dùng lựa chọn phạm vi xuất (toàn bộ từ điển hoặc theo bộ lọc hiện tại) và định dạng xuất (`.md` mặc định, cùng tùy chọn `.csv` và `.json`).
- **FR-004**: Khi nhập tệp từ điển, hệ thống PHẢI tự động nhận diện tệp có cấu trúc chuẩn (bảng Markdown chuẩn, `.csv`, `.json`) để phân tích trực tiếp cục bộ mà không gọi AI và không cắt ngắn số lượng mục từ.
- **FR-005**: Khi nhập tệp có sẵn thông tin **Ngày thêm** hợp lệ, hệ thống PHẢI bảo toàn ngày thêm đó cho mục từ được nhập; nếu không có hoặc không hợp lệ mới gán thời điểm nhập hiện tại.
- **FR-006**: Hệ thống PHẢI giữ nguyên khả năng phân tích bằng AI cho các tệp cẩm nang dạng văn xuôi tự do (`.md`, `.txt`) không chứa cấu trúc bảng/dữ liệu chuẩn, đồng thời hiển thị rõ trạng thái đang dùng AI hay đọc trực tiếp.
- **FR-007**: Hộp thoại nhập cẩm nang PHẢI hỗ trợ thao tác kéo-thả tệp thực tế (drag & drop) bên cạnh thao tác nhấp chọn tệp, với phản hồi trạng thái kéo-thả rõ ràng.
- **FR-008**: Trước khi ghi vào từ điển (hoặc khi phát hiện trùng lặp), hệ thống PHẢI hiển thị tóm tắt kết quả phân tích (số từ mới, số từ trùng, số dòng lỗi/bỏ qua nếu có) và cho phép người dùng chọn chiến lược xử lý trùng lặp (bỏ qua, ghi đè/cập nhật, hoặc chuyển sang hàng chờ rà soát).
- **FR-009**: Hệ thống PHẢI kiểm tra tính hợp lệ của tệp tải lên (định dạng cho phép, tệp không rỗng, cấu trúc đọc được) và thông báo lỗi cụ thể bằng tiếng Việt cùng hướng dẫn khắc phục khi thất bại.
- **FR-010**: Với tệp `.csv` được xuất ra, hệ thống PHẢI đảm bảo tương thích mã hóa Unicode (UTF-8 có BOM) để phần mềm bảng tính phổ biến mở lên không bị lỗi font tiếng Việt.

### Key Entities *(include if feature involves data)*

- **Mục từ điển (Glossary Entry)**: Đại diện cho một thuật ngữ dịch thuật gồm từ gốc tiếng Trung, phiên âm/Hán-Việt, nghĩa tiếng Việt, phân loại, ghi chú, các biến thể (nếu có), nguồn gốc và **Ngày thêm**.
- **Tệp cẩm nang / Từ điển xuất (Exported Glossary Artifact)**: Tài liệu xuất ra ở định dạng `.md`, `.csv` hoặc `.json` chứa thông tin tổng hợp dự án và danh sách mục từ kèm Ngày thêm.
- **Kết quả phân tích nhập liệu (Import Analysis Result)**: Tập hợp các mục từ hợp lệ đọc được từ tệp, danh sách mục xung đột/trùng lặp với lý do cụ thể, thống kê dòng bỏ qua và phương thức phân tích đã sử dụng (đọc trực tiếp hoặc trích xuất AI).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% mục từ trong tệp từ điển xuất ra ở mọi định dạng được hỗ trợ đều có cột/trường **Ngày thêm** (hiển thị ngày hợp lệ hoặc ký hiệu mặc định cho mục cũ chưa có ngày).
- **SC-002**: Người dùng có thể xuất từ điển ra tệp có cấu trúc và nhập lại sang dự án khác mà bảo toàn 100% số lượng từ, nghĩa tiếng Việt, ghi chú và Ngày thêm trong dưới 2 giây đối với từ điển lên tới 1.000 mục từ, không cần kết nối AI.
- **SC-003**: Tỷ lệ nhập thành công các tệp cẩm nang văn xuôi tự do (không có bảng chuẩn) vẫn được duy trì thông qua luồng trích xuất AI hiện có.
- **SC-004**: Người dùng có thể kéo-thả tệp trực tiếp vào vùng nhập liệu và chọn cách xử lý trùng lặp hàng loạt thay vì phải xác nhận thủ công từng từ khi không cần thiết.

## Assumptions

- Định dạng xuất mặc định khi người dùng thao tác nhanh vẫn là Markdown (`.md`) để giữ thói quen sử dụng hiện tại; các định dạng bổ sung (`.csv`, `.json`) và tùy chọn phạm vi xuất được cung cấp gọn gàng mà không làm phức tạp hóa thao tác cơ bản.
- Với các mục từ điển cũ được tạo trước khi hệ thống lưu thời gian tạo (chưa có `createdAt`), khi xuất ra sẽ hiển thị giá trị trung tính (như `—`) thay vì bịa đặt ngày hiện tại.
- Giao diện vẫn giữ ngôn ngữ tiếng Việt nhất quán với toàn bộ hệ thống hiện tại.
