# Feature Specification: Tìm và Thay Thế Văn Bản Trong Bàn Dịch (136-find-and-replace)

**Feature Branch**: `136-find-and-replace`

**Created**: 2026-09-14

**Status**: Draft

**Input**: User description: "tôi muốn thêm cái này vào để đỡ phải thay từng từ" kèm ảnh chụp màn hình thiết kế hộp thoại "Tìm và Thay thế" gồm ô Tìm kiếm, Thay thế bằng, tùy chọn Phân biệt chữ hoa/thường, các nút Trước, Sau, Đóng, Thay thế, Thay tất cả.

---

## Bối Cảnh & Mục Tiêu (Context & Goals)

Trong quá trình dịch và hiệu đính tiểu thuyết, dịch giả thường xuyên gặp các từ ngữ, danh xưng, đại từ nhân xưng hoặc lỗi chính tả lặp đi lặp lại nhiều lần trong toàn bộ chương (ví dụ: tên nhân vật bị AI dịch nhầm thành nghĩa đen, xưng hô không đồng nhất).

Hiện tại, người dùng phải đọc dò và sửa từng từ thủ công hoặc sử dụng phím tắt tìm kiếm mặc định của trình duyệt (vốn không hỗ trợ thay thế hàng loạt vào ô soạn thảo). Người dùng mong muốn có một hộp thoại **"Tìm và Thay thế"** trực quan, mạnh mẽ và tiện lợi ngay trên giao diện soạn thảo của Bàn Dịch để:
1. Nhanh chóng tìm kiếm và duyệt qua từng vị trí xuất hiện của từ/cụm từ trong bản dịch.
2. Thay thế từng vị trí hoặc thay thế tất cả cùng một lúc trên toàn bộ văn bản chương đang mở.
3. Hỗ trợ tùy chọn phân biệt chữ hoa/chữ thường để tránh thay thế nhầm lẫn.
4. Điều hướng thuận tiện bằng phím tắt (`Ctrl+H` / `Ctrl+F`) hoặc nút bấm trên thanh công cụ.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tìm kiếm và duyệt qua các vị trí xuất hiện của từ khóa (Priority: P1) 🎯 MVP

Là một người hiệu đính bản dịch, khi muốn kiểm tra các vị trí xuất hiện của một từ ngữ trong chương hiện tại, tôi muốn mở hộp thoại Tìm và Thay thế, nhập từ cần tìm và bấm duyệt (Trước / Sau) để hệ thống tự động cuộn và làm nổi bật từng vị trí tương ứng trong ô soạn thảo.

**Why this priority**: Đây là nền tảng cơ bản nhất của tính năng tìm kiếm văn bản. Người dùng cần nhìn thấy từ ngữ trong ngữ cảnh cụ thể trước khi quyết định thay thế.

**Independent Test**:
- Mở một chương có chứa từ khóa lặp lại nhiều lần (ví dụ: từ "Tô Bạch" xuất hiện 5 lần).
- Mở hộp thoại "Tìm và Thay thế", nhập "Tô Bạch" vào ô "Tìm kiếm".
- Bấm nút "Sau" hoặc "Trước": Khung soạn thảo cuộn đến và bôi đen từng lần xuất hiện theo thứ tự vòng lặp.

**Acceptance Scenarios**:
1. **Given** người dùng mở hộp thoại Tìm và Thay thế và nhập từ khóa tìm kiếm, **When** có kết quả trùng khớp trong văn bản, **Then** hệ thống hiển thị số lượng kết quả (ví dụ: "1/5") và tự động bôi đen kết quả đầu tiên.
2. **Given** văn bản có nhiều kết quả trùng khớp, **When** người dùng bấm nút "Sau" (hoặc "Trước"), **Then** con trỏ nhảy đến kết quả kế tiếp (hoặc trước đó); khi đến cuối văn bản, bấm "Sau" sẽ tự động quay tròn về kết quả đầu tiên.
3. **Given** người dùng bôi đen sẵn một đoạn văn bản trong ô soạn thảo trước khi mở hộp thoại, **When** hộp thoại mở lên, **Then** ô "Tìm kiếm" được tự động điền sẵn đoạn văn bản đang chọn đó.
4. **Given** từ khóa tìm kiếm không tồn tại trong văn bản, **When** người dùng tìm kiếm, **Then** hệ thống thông báo rõ ràng "0 kết quả" hoặc "Không tìm thấy" và không làm thay đổi vị trí con trỏ hiện tại.

---

### User Story 2 - Thay thế đơn lẻ và Thay thế tất cả hàng loạt (Priority: P1) 🎯 MVP

Là một dịch giả đang cần sửa đồng loạt một từ ngữ bị dịch sai (ví dụ thay "hắn" thành "chàng" hoặc sửa tên riêng sai chính tả), tôi muốn bấm nút "Thay thế" để đổi từng vị trí đang chọn, hoặc bấm "Thay tất cả" để hệ thống tự động đổi toàn bộ các vị trí trùng khớp trong chương chỉ bằng một cú nhấp chuột.

**Why this priority**: Đây là mục tiêu trực tiếp mà người dùng mong muốn ("để đỡ phải thay từng từ"). Khả năng thay thế hàng loạt giúp tiết kiệm tối đa thời gian hiệu đính.

**Independent Test**:
- Nhập từ tìm kiếm "Tiêu Viêm" và từ thay thế "Tiêu Hỏa".
- Bấm "Thay tất cả": Toàn bộ các vị trí "Tiêu Viêm" trong bản dịch lập tức biến thành "Tiêu Hỏa".
- Hệ thống thông báo số lượng đã thay thế thành công (ví dụ: "Đã thay thế 8 vị trí").

**Acceptance Scenarios**:
1. **Given** kết quả tìm kiếm đang được bôi đen tại vị trí hiện tại, **When** người dùng bấm "Thay thế", **Then** từ ngữ tại vị trí đó được thay bằng nội dung trong ô "Thay thế bằng", và hệ thống tự động chuyển vùng chọn sang vị trí kết quả tiếp theo.
2. **Given** có nhiều vị trí trùng khớp trong văn bản chương, **When** người dùng bấm "Thay tất cả", **Then** toàn bộ các vị trí đó được thay thế đồng loạt trong một thao tác duy nhất.
3. **Given** thao tác "Thay tất cả" hoàn tất, **When** hiển thị phản hồi, **Then** hệ thống đưa ra thông báo rõ ràng số lượng vị trí đã được thay thế (ví dụ: "Đã thay thế 12 vị trí") và cập nhật trạng thái văn bản của chương.
4. **Given** ô "Thay thế bằng" để trống, **When** người dùng bấm "Thay thế" hoặc "Thay tất cả", **Then** các từ khóa tìm kiếm được xóa bỏ khỏi văn bản (thay thế bằng chuỗi rỗng).

---

### User Story 3 - Tùy chọn phân biệt chữ hoa/chữ thường & Phím tắt thao tác nhanh (Priority: P2)

Là một người dùng thường xuyên thao tác bằng bàn phím, tôi muốn có thể mở nhanh hộp thoại bằng phím tắt chuẩn (`Ctrl+H` hoặc `Ctrl+F`), đóng nhanh bằng phím `Esc`, và có tùy chọn "Phân biệt chữ hoa/thường" để kiểm soát chính xác phạm vi thay thế (ví dụ: chỉ thay "Anh" danh từ riêng mà không thay "anh" đại từ).

**Why this priority**: Nâng cao tính tiện dụng và độ an toàn khi thay thế văn bản, tránh làm hỏng các từ có viết hoa viết thường khác nhau.

**Independent Test**:
- Trong văn bản có cả "Thần" và "thần".
- Tích chọn "Phân biệt chữ hoa/thường", tìm kiếm "Thần" và thay bằng "Chúa".
- Xác minh: Chỉ có "Thần" (chữ hoa) bị thay thế, "thần" (chữ thường) được giữ nguyên vẹn.

**Acceptance Scenarios**:
1. **Given** ô tùy chọn "Phân biệt chữ hoa/thường" chưa được chọn (mặc định), **When** tìm kiếm "hoa", **Then** cả "hoa", "Hoa", "HOA" đều được xem là kết quả trùng khớp.
2. **Given** ô tùy chọn "Phân biệt chữ hoa/thường" được tích chọn, **When** tìm kiếm "Hoa", **Then** chỉ những từ viết hoa chữ đầu "Hoa" mới được khớp, bỏ qua "hoa" chữ thường.
3. **Given** người dùng đang ở trong khung soạn thảo, **When** nhấn tổ hợp phím `Ctrl+H` hoặc bấm nút biểu tượng kính lúp/thay thế trên thanh công cụ, **Then** hộp thoại "Tìm và Thay thế" lập tức xuất hiện và con trỏ tập trung vào ô "Tìm kiếm".
4. **Given** hộp thoại đang mở, **When** người dùng nhấn phím `Esc` hoặc bấm nút "Đóng" (hoặc dấu `x`), **Then** hộp thoại đóng lại và con trỏ trả về khung soạn thảo văn bản.

---

## Edge Cases

- **Thay thế chính từ đó bằng cụm từ chứa từ đó** (ví dụ: thay "Kiếm" bằng "Thánh Kiếm"):
  - Thao tác "Thay tất cả" phải đảm bảo thực hiện một lượt an toàn, không rơi vào vòng lặp thay thế vô tận.
- **Văn bản cần tìm chứa các ký tự đặc biệt Regex** (như `[`, `]`, `(`, `)`, `?`, `*`, `+`, `.`):
  - Hệ thống tìm kiếm theo chuỗi ký tự thông thường (literal text matching), tự động xử lý an toàn các ký tự đặc biệt để không gây lỗi cú pháp tìm kiếm.
- **Chuyển đổi giữa hai phân vùng dịch (Dịch thô và Biên tập)**:
  - Tính năng Tìm và Thay thế áp dụng trực tiếp trên phân vùng dịch đang hoạt động (`activeStage`), tự động nhận diện và cập nhật đúng nội dung văn bản đang biên tập.
- **Người dùng bấm "Thay thế" khi chưa có kết quả nào được chọn**:
  - Nút bấm tự động thực hiện tìm kiếm kết quả tiếp theo trước khi thay thế, hoặc hiển thị trạng thái vô hiệu hóa (disabled) trực quan khi chưa có từ tìm kiếm.
- **Chương truyện dài hàng chục ngàn từ**:
  - Thuật toán tìm và thay thế tất cả phải xử lý tức thì (dưới 100ms), không gây giật lag giao diện.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI cung cấp hộp thoại modal "Tìm và Thay thế" với đầy đủ các trường: Ô nhập "Tìm kiếm", Ô nhập "Thay thế bằng", Hộp kiểm "Phân biệt chữ hoa/thường", cùng các nút điều khiển "Trước", "Sau", "Đóng", "Thay thế", "Thay tất cả".
- **FR-002**: Hệ thống PHẢI hỗ trợ mở hộp thoại thông qua nút bấm trên thanh công cụ biên tập và qua tổ hợp phím tắt chuẩn (`Ctrl+H` hoặc `Ctrl+F`), đồng thời hỗ trợ đóng hộp thoại qua phím `Esc`, nút "Đóng" hoặc nút đóng `x`.
- **FR-003**: Nếu người dùng đang bôi chọn một đoạn văn bản trong ô soạn thảo khi kích hoạt mở hộp thoại, đoạn văn bản đó PHẢI được tự động điền vào ô "Tìm kiếm".
- **FR-004**: Hệ thống PHẢI tự động tính toán và hiển thị số lượng kết quả tìm kiếm trùng khớp cùng vị trí hiện tại (ví dụ: "1/8", "0 kết quả") theo thời gian thực khi người dùng nhập từ khóa.
- **FR-005**: Thao tác "Sau" và "Trước" PHẢI cuộn khung soạn thảo đến vị trí từ khóa trùng khớp và bôi đen vùng chọn tương ứng trong văn bản theo cơ chế vòng tròn (wrap-around).
- **FR-006**: Hộp kiểm "Phân biệt chữ hoa/thường" PHẢI cho phép chuyển đổi linh hoạt giữa tìm kiếm không phân biệt chữ hoa/thường (mặc định) và phân biệt chính xác từng ký tự viết hoa/thường.
- **FR-007**: Thao tác "Thay thế" PHẢI thay thế đoạn văn bản đang được chọn bằng nội dung trong ô "Thay thế bằng", sau đó tự động chuyển sang vị trí kết quả trùng khớp kế tiếp.
- **FR-008**: Thao tác "Thay tất cả" PHẢI thay thế đồng loạt toàn bộ các vị trí trùng khớp trong phân vùng bản dịch hiện tại và hiển thị thông báo phản hồi (toast) về tổng số lượng vị trí đã thay thế.
- **FR-009**: Hệ thống PHẢI hỗ trợ thay thế bằng chuỗi rỗng (xóa từ tìm kiếm khi ô "Thay thế bằng" để trống).
- **FR-010**: Mọi thay đổi từ thao tác thay thế PHẢI được cập nhật đồng bộ vào trạng thái chương đang soạn thảo và tương thích hoàn toàn với tính năng lưu chương cục bộ.

---

### Key Entities

- **Trạng thái Tìm & Thay thế (FindReplaceState)**: Quản lý từ khóa tìm kiếm (`searchTerm`), từ thay thế (`replaceTerm`), tùy chọn phân biệt chữ hoa/thường (`matchCase`), danh sách vị trí tìm thấy (`matches`), và chỉ số kết quả đang kích hoạt (`currentMatchIndex`).
- **Vị trí trùng khớp (MatchLocation)**: Tọa độ bắt đầu (`start`) và kết thúc (`end`) của từng từ khóa xuất hiện trong chuỗi văn bản.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% các lần thực hiện "Thay tất cả" thay thế chính xác tất cả các vị trí trùng khớp trên toàn bộ văn bản chương mà không bỏ sót hoặc thay thế sai vị trí.
- **SC-002**: Thời gian thực hiện thao tác "Thay tất cả" trên một chương văn bản dài 10,000 từ hoàn tất trong dưới 150ms.
- **SC-003**: Người dùng có thể kích hoạt hộp thoại Tìm & Thay thế trong vòng 1 thao tác (phím tắt `Ctrl+H` hoặc bấm 1 nút trên thanh công cụ).
- **SC-004**: 100% các ký tự đặc biệt (dấu câu, ký hiệu toán học, ngoặc) trong ô tìm kiếm được xử lý an toàn tuyệt đối, không gây lỗi ứng dụng.
- **SC-005**: 100% các bài kiểm tra chất lượng hiến pháp (`npm run lint`, `npm test`, `npm run build`) vượt qua sạch sẽ.

---

## Assumptions

- Tính năng Tìm và Thay thế áp dụng trực tiếp trên phân vùng văn bản đang hoạt động (Bản dịch thô hoặc Bản chuốt mịn) của chương hiện tại đang mở trong Bàn Dịch.
- Hộp thoại được hiển thị dạng modal hoặc floating dialog nổi phía trên khung soạn thảo mà không che khuất hoàn toàn dòng văn bản đang được bôi chọn.
- Thao tác thay thế cập nhật trực tiếp vào văn bản trong editor, người dùng có thể lưu lại chương bằng tính năng Lưu chương (`Ctrl+S`) sẵn có.
