# Feature Specification: Tối Giản Xuất Tệp .TXT và Chuẩn Hóa Tên File Dễ Hiểu

**Feature Branch**: `112-simplify-txt-export`

**Created**: 2026-09-12

**Status**: Ready for Planning

**Input**: User description: "phần xuất file hãy bỏ xuất file gióng hàng đi; còn đối với 2 mục còn lại; khi xuất file thay vì để tên file xuất là tên chương gốc thì hãy để là số thứ tự hoặc là để tên chương sau khi dịch sang tiếng việt để đảm bảo dễ hiểu"

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tối giản giao diện và quy trình xuất file (Priority: P1) 🎯 MVP

Là một người dùng dịch truyện muốn xuất kết quả bản dịch để đọc hoặc làm tư liệu audio, tôi muốn giao diện phần "Sản xuất tập tin kết quả sau dịch" chỉ tập trung vào 2 mục đích sử dụng thực tế ("Web Truyện" và "Làm Audio"), loại bỏ hoàn toàn tùy chọn "Gióng hàng FT", để bảng điều khiển gọn gàng, trực quan và không gây bối rối bởi các tính năng kỹ thuật nâng cao.

**Why this priority**: Chế độ gióng hàng song ngữ FT là tính năng đặc thù huấn luyện AI không phục vụ số đông độc giả hay biên tập viên thông thường, làm phân tán sự chú ý và tăng độ phức tạp giao diện bảng xuất tệp.

**Independent Test**: Mở bảng điều khiển "Sản xuất tập tin kết quả sau dịch", kiểm tra xem giao diện có hiển thị trực quan 2 chế độ "Web Truyện" và "Làm Audio", và nút bấm hành động luôn là xuất tải tệp văn bản (.TXT) sạch mà không còn bất kỳ nút bấm hoặc thông báo nào liên quan đến gióng hàng JSONL song ngữ.

**Acceptance Scenarios**:

1. **Given** người dùng đang ở giao diện xuất tệp, **When** quan sát thanh chọn chế độ xuất, **Then** hệ thống chỉ hiển thị đúng 2 tùy chọn là "Web Truyện" (giữ tiêu đề) và "Làm Audio" (loại bỏ tiêu đề), hoàn toàn không còn nút "Gióng hàng FT".
2. **Given** một trong hai chế độ ("Web Truyện" hoặc "Làm Audio") được chọn, **When** người dùng cấu hình số chương mỗi tệp, phạm vi lọc (đã dịch / toàn bộ) và giới hạn khoảng chương, **Then** nút hành động chính luôn hiển thị nhãn tải tệp văn bản .TXT và tiến hành đóng gói tải xuống các tệp .TXT.
3. **Given** người dùng đang xuất tệp, **When** quá trình diễn ra, **Then** hệ thống hiển thị trạng thái đang xử lý kết xuất một cách nhất quán cho cả hai chế độ.

---

### User Story 2 - Đặt tên file xuất thân thiện và dễ hiểu (Priority: P1) 🎯 MVP

Là một người dùng tải về các tệp chương truyện (.TXT trong gói .ZIP), tôi muốn tên của từng tệp văn bản xuất ra thể hiện rõ số thứ tự chương bằng tiếng Việt có từ nối `_den_` (ví dụ: thay vì `[第一章_恐怖广播]_den_[第二十章_为什么]`, tên file sẽ là `Chuong_001_den_Chuong_020` hoặc `Chuong_001`), để tôi có thể dễ dàng quản lý, nhận biết thứ tự và tìm kiếm trên máy tính cá nhân.

**Why this priority**: Hiện tại tên file xuất sử dụng tiêu đề gốc tiếng Trung khiến người dùng Việt Nam không thể phân biệt nội dung các tệp trong thư mục tải về nếu không biết tiếng Trung, làm giảm đáng kể trải nghiệm quản lý tập tin.

**Independent Test**: Xuất một bộ truyện gồm nhiều chương đã dịch tiếng Việt với cấu hình gom 10 hoặc 20 chương/file. Mở tệp nén .ZIP và kiểm tra tên các file .TXT bên trong: tên file phải chứa tiền tố tên truyện, khoảng số thứ tự chương chuẩn 3 chữ số (ví dụ: `{Tên_truyện}_Chuong_001_den_Chuong_020_WEB.txt`), và hậu tố chế độ (`_WEB.txt` hoặc `_AUDIO.txt`), không còn xuất hiện bất kỳ ký tự chữ Hán gốc nào.

**Acceptance Scenarios**:

1. **Given** một tệp gom nhiều chương (ví dụ từ chương 1 đến chương 20), **When** xuất file ở chế độ Web hoặc Audio, **Then** tên tệp tuân thủ cấu trúc `{Tên_truyện}_Chuong_{startNum}_den_Chuong_{endNum}_{CHẾ_ĐỘ}.txt` với số thứ tự được đệm số 0 (3 chữ số, ví dụ `001`, `020`).
2. **Given** người dùng cấu hình gom 1 chương mỗi tệp (hoặc phân đoạn chỉ có duy nhất 1 chương), **When** xuất file, **Then** tên tệp chỉ thể hiện thông tin của 1 chương duy nhất `{Tên_truyện}_Chuong_{num}_{CHẾ_ĐỘ}.txt` (ví dụ `..._Chuong_001_WEB.txt`), không bị lặp dạng `..._den_...`.
3. **Given** các chương bất kỳ được chọn xuất, **When** xuất tệp, **Then** tên file luôn sử dụng số thứ tự chương được chuẩn hóa tuyệt đối không rò rỉ ký tự chữ Hán vào tên file.
4. **Given** người dùng chọn lọc khoảng chương xuất (ví dụ từ chương 21 đến chương 40), **When** tên file được tạo ra, **Then** số thứ tự chương trên tên file phải giữ đúng số thứ tự tuyệt đối của chương trong bộ truyện (bắt đầu từ `021`, kết thúc `040`, không bị đánh số lại từ `001`).

---

### Edge Cases

- **Tên truyện chứa ký tự đặc biệt của hệ điều hành (`\ / : * ? " < > |`)**: Hệ thống phải tự động chuẩn hóa/làm sạch các ký tự không hợp lệ thành ký tự an toàn (`_`) để tránh lỗi khi giải nén trên Windows/macOS.
- **Tên truyện quá dài**: Hệ thống cắt gọn độ dài tên truyện trong tên file ở mức an toàn (tối đa 30 ký tự) để tổng chiều dài tên file không vượt quá giới hạn đường dẫn hệ thống (đặc biệt là Windows MAX_PATH 260 ký tự).
- **Xuất tệp đơn lẻ (1 chương/file) so với tệp gộp nhiều chương**: Khi một tệp chỉ chứa 1 chương, hệ thống không dùng từ nối khoảng cách `_den_` mà sử dụng cú pháp tên đơn lẻ.
- **Dự án chưa dịch tiêu đề hoặc tiêu đề gốc không có số**: Hệ thống luôn đảm bảo số thứ tự được lấy từ vị trí thực tế của chương trong danh mục truyện (1-indexed), đảm bảo luôn có số thứ tự chương rõ ràng `Chuong_{pad(index)}`.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI loại bỏ hoàn toàn tùy chọn chế độ "Gióng hàng FT" khỏi giao diện xuất tệp kết quả.
- **FR-002**: Giao diện chọn chế độ xuất tệp PHẢI chỉ hiển thị 2 tùy chọn: "Web Truyện" (≤20 ch./file) và "Làm Audio" (≤10 ch./file).
- **FR-003**: Hệ thống PHẢI dọn dẹp sạch mã lệnh/hành động xuất gióng hàng song ngữ FT trong module xuất file (`useExportFiles.ts`, `ExportFilesPanel.tsx`), chuẩn hóa `exportMode` thành `'web' | 'audio'`.
- **FR-004**: Hệ thống PHẢI thay thế hoàn toàn việc sử dụng tên chương tiếng Trung gốc trong tên file xuất (.TXT) bằng định dạng số thứ tự chuẩn hóa `Chuong_{padIndex}`.
- **FR-005**: Số thứ tự chương trên tên file xuất PHẢI phản ánh chính xác số thứ tự của chương trong toàn bộ danh sách chương của dự án (1-indexed, có đệm 3 chữ số như `001`, `020` để sắp xếp tự nhiên trên hệ điều hành).
- **FR-006**: Khi một tệp chỉ chứa 1 chương, tên file PHẢI có cấu trúc `{cleanTitle}_Chuong_{pad(index)}{suffix}.txt` (không chứa từ nối `_den_`).
- **FR-007**: Khi một tệp chứa từ 2 chương trở lên, tên file PHẢI có cấu trúc `{cleanTitle}_Chuong_{pad(startIndex)}_den_Chuong_{pad(endIndex)}{suffix}.txt`.
- **FR-008**: Tên file xuất PHẢI luôn giữ lại hậu tố phân loại chế độ (`_WEB.txt` cho Web Truyện và `_AUDIO.txt` cho Làm Audio) cùng định dạng nén `.zip` cho gói tổng thể (`{cleanTitle}_TXT_EXPORT.zip`).
- **FR-009**: Toàn bộ tên file và tên gói nén PHẢI được làm sạch các ký tự đặc biệt, đảm bảo tính hợp lệ trên mọi hệ điều hành phổ biến.

---

### Key Entities

- **Chế độ xuất tệp (ExportMode)**: Chỉ còn 2 giá trị hợp lệ là `'web'` (giữ tiêu đề, chuẩn hóa định dạng bài đăng web) và `'audio'` (loại bỏ tiêu đề lặp, tối ưu cho máy đọc sách/audio).
- **Quy tắc định danh tệp xuất (ExportFileNameRule)**: Công thức sinh tên file .TXT:
  - Đa chương: `${cleanTitle}_Chuong_${pad3(startIndex)}_den_Chuong_${pad3(endIndex)}${suffix}.txt`
  - Đơn chương: `${cleanTitle}_Chuong_${pad3(chapterIndex)}${suffix}.txt`

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% các file .TXT được xuất ra ở chế độ Web và Audio không còn chứa bất kỳ ký tự tiếng Trung gốc nào trong tên file.
- **SC-002**: Bảng điều khiển xuất file giảm từ 3 cột lựa chọn xuống 2 cột cân đối, không còn bất kỳ thành phần hiển thị hay logic dư thừa nào của chế độ gióng hàng FT.
- **SC-003**: 100% các file xuất được sắp xếp thứ tự hoàn hảo theo thứ tự bảng chữ cái trên Windows Explorer / macOS Finder nhờ định dạng số thứ tự chuẩn `Chuong_001`, `Chuong_002`...
- **SC-004**: Khi gom 1 chương/file, 100% tên file không bị dư thừa từ nối `_den_`.
- **SC-005**: Toàn bộ hệ thống vượt qua tất cả các cổng kiểm tra chất lượng tự động (`npm run lint`, `npm test`, `npm run build`) với 0 lỗi phát sinh.

---

## Assumptions

- Người dùng đã lựa chọn quy ước định dạng tên file số thứ tự tiếng Việt đầy đủ với từ nối `_den_` (Option C) và dọn dẹp triệt để mã gióng hàng FT trong module xuất file (Option A).
- Hai chế độ "Web Truyện" và "Làm Audio" giữ nguyên toàn bộ logic xử lý nội dung thân chương (tiền tố `*** ` cho Web, làm sạch nội dung cho Audio) như quy cách hiện tại, chỉ thay đổi tên file xuất ra và bỏ chế độ thứ 3.
- Số thứ tự chương được xác định dựa trên vị trí của chương trong danh mục chương của dự án truyện đang mở (chương đầu tiên là 1, chương thứ 2 là 2,...).
