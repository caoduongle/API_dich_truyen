# Feature Specification: Moderator Project Quality Checker Workspace

**Feature Branch**: `075-moderator-quality-checker`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: "Chỉnh lại khu vực kiểm định chất lượng dịch cho moderator (đã triển khai ở specs/075-moderator-quality-checker) để bỏ hoàn toàn phần lấy dữ liệu bằng cách cào (scrape) từ Hako/Docln qua URL, thay bằng lấy chương trực tiếp từ chính các dự án dịch đã có sẵn trong ứng dụng. Vấn đề: Bản triển khai hiện tại bắt moderator dán URL truyện trên Hako để hệ thống tự cào danh mục tập/chương và nội dung chương. Việc này thừa: ứng dụng đã tự dịch và lưu sẵn từng chương (sourceText = raw tiếng Trung, polishedTranslation/rawTranslation = bản dịch tiếng Việt) ngay trong dự án của người dùng, nên cào lại từ Hako vừa chậm, dễ bị chặn (rate limit/Cloudflare), vừa tạo phụ thuộc mạng ra bên ngoài không cần thiết. Người dùng: moderator/biên tập viên dùng chính ứng dụng dịch thuật này, muốn rà soát các chương ĐÃ DỊCH trong dự án của họ trước khi đăng, không phải rà soát nội dung đã public trên Hako. Luồng chính: moderator mở khu vực kiểm định chất lượng → chọn một dự án dịch đang có trong ứng dụng → hệ thống hiển thị danh sách chương của dự án kèm trạng thái dịch → moderator chọn tối đa 12 chương → hệ thống tự dùng sourceText làm bản gốc và polishedTranslation (hoặc rawTranslation nếu chương chưa biên tập) làm bản dịch cần kiểm tra, không cần dán raw thủ công nữa (vẫn giữ ô cho phép dán đè raw khác nếu moderator muốn) → trả về danh sách lỗi nghi ngờ như cũ (tên riêng, nhân xưng/giới tính, thuật ngữ, sót raw, lặp đoạn, sai nghĩa/bỏ sót/dịch thừa khi có raw) → moderator xác nhận/yêu cầu xem lại/bác bỏ từng lỗi, quyết định lưu bền vững như luồng đã có. Giữ nguyên: engine phát hiện lỗi trong hakoQualityEngine.ts, các kiểu QualityIssue/QualityReviewSession, HakoIssueCard, HakoIssueReviewPanel, HakoReportExportModal, hakoSessionStore.ts, tái dùng API key/model Gemini, giới hạn 12 chương/lượt. Loại bỏ hoàn toàn: mọi logic cào/scrape Hako/Docln, xử lý Cloudflare/rate-limit/403/429 của Hako, route/controller/service server riêng cho Hako, client hakoApiService.ts, HakoNovelImporter.tsx. Ràng buộc bắt buộc: Không đổi hành vi luồng dịch 2 giai đoạn hiện có; không sửa schema Chapter/StoryProject trong src/types.ts; toàn bộ dữ liệu kiểm định lấy từ local state/IndexedDB của ứng dụng; xoá endpoint /api/hako/* khi không còn nơi gọi."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Chọn dự án dịch và chọn đợt chương kiểm định chất lượng (Priority: P1)

Là một moderator hoặc biên tập viên, tôi muốn chọn một dự án dịch tiểu thuyết đang có sẵn trong ứng dụng để hệ thống hiển thị danh sách toàn bộ các chương kèm trạng thái bản dịch (đã biên tập, đã dịch thô, chưa dịch), cho phép tôi chọn tối đa 12 chương cần kiểm định chất lượng trong đợt làm việc này mà không phải cào dữ liệu từ bất kỳ trang web bên ngoài nào.

**Why this priority**: Đây là điểm khởi đầu thiết yếu cho toàn bộ quy trình kiểm định chất lượng nội bộ. Thay vì dựa vào web scraper từ trang thứ ba, việc đọc trực tiếp từ dự án có sẵn giúp truy cập tức thì và loại bỏ hoàn toàn rủi ro mạng/bị chặn.

**Independent Test**: Moderator mở khu vực kiểm định chất lượng, chọn một dự án dịch từ danh sách thả xuống; danh sách chương của dự án xuất hiện đầy đủ tức thì kèm số từ và trạng thái dịch; moderator có thể đánh dấu chọn từ 1 đến 12 chương có nội dung dịch và hệ thống ngăn chặn việc chọn quá 12 chương hoặc chọn chương chưa dịch.

**Acceptance Scenarios**:

1. **Given** moderator đang ở khu vực kiểm định chất lượng, **When** chọn một dự án dịch từ danh sách dự án hiện có trong ứng dụng, **Then** hệ thống hiển thị thông tin dự án (tên truyện, tác giả, số lượng chương) cùng danh sách toàn bộ các chương và trạng thái dịch của từng chương (Đã biên tập, Đã dịch thô, Chưa dịch).
2. **Given** danh sách chương của dự án hiển thị, **When** moderator chọn các chương đã có bản dịch để rà soát, **Then** số lượng chương đã chọn được cập nhật trực quan (ví dụ: `3/12`) và nút bắt đầu kiểm định được kích hoạt nếu số lượng chọn từ 1 đến 12.
3. **Given** moderator đã chọn đủ 12 chương, **When** cố gắng chọn thêm chương thứ 13, **Then** hệ thống không cho phép chọn thêm và hiển thị cảnh báo giới hạn tối đa 12 chương mỗi lượt.
4. **Given** một chương chưa có nội dung dịch (`sourceText` hoặc bản dịch trống), **When** moderator xem danh sách, **Then** chương đó bị vô hiệu hóa chọn và hiển thị trạng thái "Chưa có bản dịch".

---

### User Story 2 - Rà soát tự động từ dữ liệu dự án và xử lý danh sách lỗi nghi ngờ (Priority: P1)

Là một moderator, tôi muốn hệ thống tự động sử dụng văn bản gốc tiếng Trung (`sourceText`) và bản dịch tiếng Việt (`polishedTranslation` hoặc `rawTranslation`) có sẵn trong từng chương của dự án để phân tích phát hiện các lỗi dịch thuật, biên tập và sai lệch ngữ nghĩa, đồng thời cho phép tôi xác nhận, yêu cầu xem lại hoặc bác bỏ từng lỗi và lưu trữ bền vững quyết định này.

**Why this priority**: Đây là giá trị cốt lõi của tính năng, giúp moderator phát hiện nhanh các lỗi tên riêng, xưng hô/giới tính, thuật ngữ không đồng bộ, câu sót raw, đoạn lặp, cũng như các lỗi đối chiếu song ngữ (sai nghĩa, bỏ sót câu, dịch thừa) hoàn toàn tự động từ dữ liệu có sẵn của dự án.

**Independent Test**: Sau khi chọn các chương trong dự án, moderator nhấn bắt đầu kiểm định; hệ thống hiển thị danh sách các lỗi nghi ngờ kèm phân loại, mức độ nghiêm trọng, đoạn trích tiếng Việt làm bằng chứng, đoạn trích raw đối ứng (lấy tự động từ `sourceText`) và lời giải thích; moderator có thể đổi trạng thái từng lỗi và trạng thái này vẫn được lưu khi rời trang và quay lại.

**Acceptance Scenarios**:

1. **Given** các chương đã chọn trong dự án (1-12 chương), **When** moderator kích hoạt lệnh kiểm định, **Then** hệ thống tự động nạp `sourceText` làm bản gốc và `polishedTranslation` (hoặc `rawTranslation` nếu chưa biên tập) làm bản dịch tiếng Việt, sau đó tiến hành phân tích Heuristic và AI.
2. **Given** quá trình phân tích hoàn tất, **When** moderator xem danh sách lỗi, **Then** hệ thống hiển thị các lỗi nghi vấn được phân loại rõ ràng (tên riêng, xưng hô/giới tính, thuật ngữ, sót raw, trùng lặp, sai nghĩa, bỏ sót, dịch thừa) kèm mức độ nghiêm trọng và đoạn trích bằng chứng từ bản dịch cùng đoạn raw đối ứng.
3. **Given** một lỗi trong danh sách, **When** moderator chọn "Xác nhận lỗi", "Cần xem lại", hoặc "Bác bỏ", **Then** trạng thái quyết định của lỗi được cập nhật ngay lập tức.
4. **Given** phiên làm việc đã có các quyết định của moderator, **When** moderator điều hướng sang mục khác của ứng dụng hoặc tải lại trang và quay lại, **Then** toàn bộ dự án đã chọn, danh sách chương, các lỗi phát hiện và trạng thái xử lý của moderator được khôi phục nguyên vẹn từ bộ nhớ cục bộ.

---

### User Story 3 - Tùy chỉnh hoặc dán đè văn bản raw đối chiếu khi cần thiết (Priority: P2)

Là một moderator, tôi muốn có tùy chọn xem và dán đè văn bản raw tiếng Trung cho từng chương nếu muốn đối chiếu với một phiên bản raw khác (dị bản) hoặc khi chương trong dự án bị thiếu văn bản gốc.

**Why this priority**: Mặc dù hệ thống đã tự động lấy `sourceText` từ dự án, tùy chọn cho phép dán đè raw mang lại sự linh hoạt tối đa khi biên tập viên muốn so sánh với bản raw từ nguồn khác mà không làm biến đổi dữ liệu gốc của chương trong dự án.

**Independent Test**: Tại một chương cụ thể trong danh sách, moderator mở ngăn nhập raw, dán một đoạn văn bản raw mới; hệ thống sử dụng văn bản raw mới này cho phân tích song ngữ của chương đó mà không ghi đè vào `sourceText` của dự án gốc.

**Acceptance Scenarios**:

1. **Given** một chương đã chọn có `sourceText` mặc định, **When** moderator mở ngăn nhập raw của chương, **Then** hệ thống hiển thị văn bản raw hiện tại lấy từ `sourceText` của dự án.
2. **Given** ô nhập raw của chương, **When** moderator chỉnh sửa hoặc dán nội dung raw mới và chạy phân tích, **Then** kết quả kiểm định song ngữ của chương đó sử dụng đoạn raw mới được dán.

---

### User Story 4 - Xuất báo cáo kiểm định và tổng kết sai sót (Priority: P3)

Là một moderator, tôi muốn sao chép hoặc xuất báo cáo các lỗi đã xác nhận dưới dạng văn bản Markdown có cấu trúc để gửi phản hồi cho dịch giả hoặc lưu trữ hồ sơ kiểm định chất lượng trước khi xuất bản.

**Why this priority**: Cung cấp công cụ chia sẻ kết quả nhanh chóng, kết nối quy trình kiểm định của moderator với dịch giả/nhóm biên tập.

**Independent Test**: Moderator sau khi hoàn tất xem xét nhấn nút "Xuất báo cáo", xem trước bảng tổng hợp số liệu và bản tóm tắt Markdown, nhấn "Sao chép vào Clipboard" và nhận thông báo thành công.

**Acceptance Scenarios**:

1. **Given** phiên làm việc có các lỗi đã được moderator xác nhận, **When** moderator chọn chức năng xuất báo cáo, **Then** hệ thống hiển thị thống kê tổng quan (số lỗi theo mức độ nghiêm trọng, phân loại) và bản tóm tắt Markdown rõ ràng phân nhóm theo từng chương.
2. **Given** modal xuất báo cáo đang mở, **When** moderator nhấn "Sao chép vào Clipboard", **Then** toàn bộ nội dung báo cáo được sao chép vào bộ nhớ tạm kèm thông báo thành công.
3. **Given** không có lỗi nào được xác nhận trong đợt kiểm tra, **When** moderator xem báo cáo, **Then** hệ thống hiển thị thông báo bản dịch đạt chuẩn chất lượng xuất sắc.

---

### Edge Cases

- **Dự án chưa có chương nào hoặc chưa dịch chương nào**: Hệ thống hiển thị thông báo trạng thái rỗng thân thiện, hướng dẫn người dùng tạo chương hoặc dịch chương trước khi thực hiện kiểm định.
- **Chương chỉ mới có bản dịch thô (chưa biên tập)**: Hệ thống tự động sử dụng `rawTranslation` làm bản dịch cần kiểm tra và gắn nhãn ghi chú "Sử dụng bản dịch thô" để moderator nắm rõ bối cảnh.
- **Chương bị thiếu `sourceText`**: Hệ thống vẫn thực hiện kiểm tra đơn ngữ tiếng Việt bình thường (phát hiện tên riêng, xưng hô, lặp đoạn, sót raw) và cho phép moderator dán thêm raw thủ công nếu muốn kiểm tra song ngữ.
- **Moderator chọn quá 12 chương**: Giao diện vô hiệu hóa việc chọn thêm và cảnh báo trực tiếp về hạn mức tối đa 12 chương mỗi lượt rà soát.
- **Gián đoạn kết nối mạng trong lúc gọi mô hình AI**: Tiến trình kiểm định lưu lại kết quả của các chương đã xử lý xong trước đó và cho phép moderator tiếp tục phân tích các chương còn lại mà không phải bắt đầu lại từ đầu.
- **Dự án gốc bị xóa khi đang mở phiên kiểm định**: Phiên kiểm định vẫn giữ nguyên bản sao dữ liệu chương đã nạp trong bộ nhớ phiên cục bộ để moderator không bị mất kết quả đang xem xét dở dang.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI cho phép moderator chọn một dự án dịch (`StoryProject`) hiện có trong ứng dụng để nạp danh sách chương và thông tin dự án tức thì từ dữ liệu cục bộ (IndexedDB/State), TUYỆT ĐỐI KHÔNG thực hiện bất kỳ yêu cầu mạng cào dữ liệu nào ra bên ngoài.
- **FR-002**: Hệ thống PHẢI hiển thị danh sách toàn bộ các chương của dự án kèm thông tin: tiêu đề chương, số thứ tự, số từ, và trạng thái dịch (Đã biên tập / Đã dịch thô / Chưa có bản dịch).
- **FR-003**: Hệ thống PHẢI cho phép moderator chọn tối thiểu 1 chương và tối đa 12 chương có nội dung bản dịch trong một đợt kiểm định chất lượng; các chương chưa có bản dịch PHẢI bị vô hiệu hóa chọn.
- **FR-004**: Hệ thống PHẢI tự động sử dụng `sourceText` của chương làm văn bản gốc tiếng Trung và `polishedTranslation` (ưu tiên) hoặc `rawTranslation` làm bản dịch tiếng Việt cần rà soát cho mỗi chương được chọn mà không bắt người dùng phải sao chép hay dán lại thủ công.
- **FR-005**: Hệ thống PHẢI cung cấp tùy chọn cho phép moderator xem và dán đè văn bản raw tiếng Trung khác cho từng chương khi cần đối chiếu dị bản, mà KHÔNG làm biến đổi dữ liệu `sourceText` gốc của chương trong dự án.
- **FR-006**: Hệ thống PHẢI phân tích nội dung tiếng Việt kết hợp đối chiếu song ngữ với văn bản gốc để tự động phát hiện các lỗi chất lượng bao gồm:
  - Tên riêng (nhân vật, địa danh, tổ chức) không nhất quán giữa các đoạn hoặc các chương.
  - Xưng hô, đại từ nhân xưng và giới tính nhân vật bị mâu thuẫn hoặc thay đổi bất thường.
  - Thuật ngữ dịch thuật không đồng nhất.
  - Câu hoặc đoạn còn sót lại văn bản raw/Hán Việt chưa dịch.
  - Đoạn văn bị lặp lại nhiều lần hoặc dấu hiệu đăng nhầm/trùng lặp nội dung.
  - Dịch sai lệch ngữ nghĩa so với bản gốc tiếng Trung.
  - Bỏ sót câu hoặc đoạn có trong bản gốc tiếng Trung.
  - Dịch thừa hoặc bịa thêm nội dung không có trong bản gốc tiếng Trung.
- **FR-007**: Với mỗi lỗi được phát hiện, hệ thống PHẢI cung cấp đầy đủ: mã định danh lỗi, phân loại lỗi, mức độ nghiêm trọng (Nghiêm trọng / Lớn / Nhẹ / Cảnh báo), vị trí chương, đoạn trích bản dịch làm bằng chứng, đoạn trích raw đối ứng (nếu có), giải thích chi tiết lý do nghi ngờ và gợi ý sửa đổi.
- **FR-008**: Hệ thống PHẢI cho phép moderator thực hiện các quyết định đánh giá trên từng lỗi: "Xác nhận lỗi" (Confirm), "Cần xem lại" (Needs Review), hoặc "Bác bỏ / Bỏ qua" (Dismiss), kèm theo tùy chọn nhập ghi chú bổ sung của moderator.
- **FR-009**: Hệ thống PHẢI lưu trữ bền vững trạng thái phiên làm việc và các quyết định của moderator trong cơ sở dữ liệu cục bộ (`hako_quality_sessions` / `HakoQualityCheckerDB`), đảm bảo khôi phục đầy đủ khi người dùng làm mới trang hoặc chuyển qua lại giữa các tab khác nhau.
- **FR-010**: Hệ thống PHẢI cung cấp tính năng xem trước và sao chép báo cáo tổng hợp các lỗi đã xác nhận ra định dạng văn bản Markdown có cấu trúc rõ ràng vào clipboard với 1 lượt bấm.
- **FR-011**: Hệ thống PHẢI tự động tái sử dụng cấu hình mô hình AI và cơ chế quản lý API key sẵn có của ứng dụng hiện tại (`AIConfigContext`) mà KHÔNG yêu cầu moderator phải nhập lại khóa hoặc cấu hình tham số mô hình riêng.
- **FR-012**: Khu vực làm việc của moderator PHẢI hoạt động hoàn toàn độc lập ở chế độ đọc (read-only đối với StoryProject và Chapter), KHÔNG làm biến đổi hay can thiệp vào luồng dịch 2 giai đoạn và không làm thay đổi cấu trúc schema của dự án gốc.
- **FR-013**: Hệ thống PHẢI loại bỏ hoàn toàn mọi logic cào web (scraping), xử lý thử thách chống bot/Cloudflare, giới hạn tốc độ 429 từ bên thứ ba, và xóa bỏ các endpoint backend `/api/hako/*` không còn sử dụng.

### Key Entities *(include if feature involves data)*

- **QualityReviewSession (Phiên kiểm định chất lượng)**: Đại diện cho một phiên làm việc của moderator, gồm mã định danh phiên, mã dự án liên kết (`projectId`), tên dự án (`projectTitle`), danh sách chương được chọn, danh sách lỗi phát hiện (`issues`), thời gian khởi tạo, thời gian cập nhật lần cuối và trạng thái tổng thể (`idle`, `analyzing`, `completed`, `error`).
- **ProjectReviewChapter (Chương kiểm định)**: Đại diện cho một chương trong phiên rà soát, gồm mã chương (`chapterId`), tiêu đề chương, số thứ tự chương, nội dung văn bản tiếng Việt cần kiểm định (`vietnameseContent`), nội dung raw tiếng Trung gốc (`rawChineseContent`), loại bản dịch sử dụng (`polished` hoặc `raw`), số lượng từ và trạng thái phân tích.
- **QualityIssue (Lỗi chất lượng phát hiện)**: Đại diện cho một lỗi nghi ngờ được phát hiện, gồm mã định danh lỗi, mã chương liên kết, phân loại lỗi (tên riêng, xưng hô/giới tính, thuật ngữ, sót raw, trùng lặp, sai nghĩa, bỏ sót, dịch thừa, khác), mức độ nghiêm trọng (critical, major, minor, warning), đoạn trích tiếng Việt làm bằng chứng, đoạn trích raw đối ứng (nếu có), giải thích của hệ thống, gợi ý sửa đổi, trạng thái quyết định của moderator (pending, confirmed, review_needed, dismissed), ghi chú của moderator và nguồn phát hiện (heuristic hoặc ai).
- **QualityReport (Báo cáo chất lượng)**: Bản tổng hợp kết quả sau khi moderator hoàn tất đánh giá, gồm tóm tắt số liệu (tổng số lỗi theo mức độ, theo loại) và danh sách chi tiết các lỗi đã được xác nhận kèm ghi chú để xuất hoặc sao chép.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Moderator có thể nạp toàn bộ danh sách chương ngay tức thì (dưới 0.5 giây) khi chọn bất kỳ dự án dịch nào, do dữ liệu được đọc trực tiếp từ bộ nhớ cục bộ (IndexedDB/State), không có độ trễ mạng.
- **SC-002**: Hệ thống tự động liên kết 100% văn bản gốc tiếng Trung (`sourceText`) và bản dịch (`polishedTranslation`/`rawTranslation`) cho các chương được chọn mà người dùng không cần thao tác dán thủ công.
- **SC-003**: Thời gian rà soát tự động cho đợt tối đa 12 chương hoàn thành trong vòng dưới 60 giây đối với phân tích ngữ nghĩa kết hợp đối chiếu song ngữ.
- **SC-004**: 100% các quyết định đánh giá lỗi (xác nhận, xem lại, bác bỏ) và ghi chú của moderator được bảo toàn nguyên vẹn sau khi tải lại trang hoặc chuyển tab.
- **SC-005**: 100% dữ liệu đầu vào lấy từ local storage / IndexedDB nội bộ, không phát sinh bất kỳ yêu cầu mạng nào ra nền tảng bên ngoài để lấy nội dung chương.
- **SC-006**: Thao tác sao chép báo cáo lỗi đã duyệt vào clipboard hoàn thành chỉ với 1 lượt bấm và đảm bảo định dạng văn bản Markdown chuẩn xác, dễ đọc.
- **SC-007**: Loại bỏ hoàn toàn 100% các lỗi gián đoạn do cơ chế chống bot, rate limit 429 hoặc thay đổi cấu trúc HTML của nền tảng web bên ngoài.

## Assumptions

- Người dùng là moderator hoặc biên tập viên đã có sẵn các dự án dịch trong ứng dụng hoặc được chia sẻ dự án.
- Ứng dụng đã có sẵn cấu hình API key và mô hình AI đang hoạt động ổn định trong `AIConfigContext`.
- Các chương được chọn kiểm định đã có ít nhất một bản dịch (`polishedTranslation` hoặc `rawTranslation`).
- Việc lưu trữ phiên kiểm định moderator được duy trì tại môi trường lưu trữ cục bộ của người dùng để đảm bảo quyền riêng tư và tốc độ truy cập tức thì.
