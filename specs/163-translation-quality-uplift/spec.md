# Feature Specification: Nâng cao chất lượng dịch truyện (Translation Quality Uplift)

**Feature Branch**: `163-translation-quality-uplift`

**Created**: 2026-11-15

**Status**: Draft

**Input**: User description: "rà soát repo; tôi muốn cải thiện chất lượng dịch truyện"

**Bằng chứng rà soát**: [repo-review.md](./repo-review.md) (các phát hiện F1–F10 được tham chiếu bên dưới)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tên riêng & thuật ngữ được áp dụng đúng, không làm vỡ câu chữ xung quanh (Priority: P1)

Người dịch đã xây dựng bảng từ điển (tên nhân vật, địa danh, chiêu thức). Khi dịch một chương, mọi thuật ngữ xuất hiện trong nguyên tác phải được dịch đúng theo từ điển, đồng thời các từ ghép tình cờ chứa ký tự trùng với một mục từ điển (ví dụ họ "林" nằm trong "森林" — rừng) không bị biến dạng. Sau khi dịch, người dịch thấy ngay danh sách các chỗ bản dịch không tuân thủ từ điển. (F1, F2, F3, F9)

**Why this priority**: Sai tên/thuật ngữ là lỗi người đọc nhận ra nhanh nhất và lan ra toàn bộ truyện; việc thay thế cứng hiện tại có thể làm hỏng chính văn bản nguồn trước khi gửi đi dịch.

**Independent Test**: Dịch một chương mẫu với từ điển có cả mục dài và mục 1 ký tự trùng với một phần của từ ghép trong chương; kiểm tra bản dịch dùng đúng tên theo từ điển, từ ghép được dịch đúng nghĩa, và báo cáo tuân thủ từ điển liệt kê chính xác các vi phạm.

**Acceptance Scenarios**:

1. **Given** từ điển có mục "林 → Lâm" và chương chứa cả "林动" (tên) lẫn "森林" (rừng), **When** dịch chương, **Then** "森林" được dịch theo nghĩa thông thường ("rừng") và không xuất hiện "Lâm" sai chỗ.
2. **Given** từ điển có 500 mục nhưng chương chỉ chứa 12 thuật ngữ, **When** dịch chương, **Then** chỉ 12 thuật ngữ liên quan (cộng các mục ưu tiên do người dùng đánh dấu, nếu có) được đưa vào chỉ dẫn cho AI ở mọi giai đoạn, kể cả kiểm duyệt.
3. **Given** chương chứa "萧炎" và từ điển quy định "萧炎 → Tiêu Viêm", **When** bản dịch cuối viết "Tiêu Diệm", **Then** báo cáo chất lượng ghi nhận một lỗi thuật ngữ, chỉ rõ đoạn văn liên quan, thuật ngữ gốc và dạng đúng.
4. **Given** hai mục từ điển cùng chữ Hán nhưng khác nghĩa Việt, **When** dịch, **Then** hệ thống dùng một quy tắc chọn nhất quán, có thể dự đoán và cảnh báo xung đột cho người dùng.

---

### User Story 2 - Xưng hô, giới tính và ngôi kể nhất quán giữa các phân đoạn và giữa các chương (Priority: P1)

Người dịch muốn một nhân vật nữ luôn được gọi là "nàng" (không bỗng thành "hắn"), cặp sư huynh–sư muội luôn xưng hô "huynh–muội" như đã thiết lập, và mạch truyện ở đầu chương mới khớp với đoạn kết chương trước — kể cả khi chương dài bị tách thành nhiều phân đoạn để dịch. (F5, F6)

**Why this priority**: Xưng hô "nhảy loạn" là phàn nàn phổ biến nhất của truyện dịch máy tiếng Việt; hiện các phân đoạn và các chương được dịch hoàn toàn độc lập, không có ngữ cảnh chuyển tiếp.

**Independent Test**: Lấy một chương dài đủ để bị tách, có hội thoại giữa nhân vật nam và nữ ở ngay ranh giới tách; khai báo giới tính/xưng hô của hai nhân vật; dịch và kiểm tra xưng hô ở cả hai phía ranh giới, cũng như ở đầu chương kế tiếp.

**Acceptance Scenarios**:

1. **Given** một chương bị tách thành nhiều phân đoạn, **When** dịch phân đoạn thứ N (N > 1), **Then** phân đoạn đó được dịch với ngữ cảnh chỉ-đọc từ phần cuối phân đoạn liền trước, và phần ngữ cảnh này không bị dịch lặp lại vào kết quả.
2. **Given** chương trước đã có bản dịch hoàn chỉnh, **When** dịch chương kế tiếp, **Then** phần kết của chương trước được dùng làm ngữ cảnh tham chiếu liên tục; **Given** chương trước chưa được dịch (hoặc đang được dịch song song), **Then** chương vẫn được dịch bình thường không có ngữ cảnh này và không bị chặn.
3. **Given** nhân vật "林小雨" được khai báo là nữ, xưng "muội" với "师兄", **When** dịch các đoạn hội thoại của nhân vật này, **Then** bản dịch dùng đại từ nữ và cặp xưng hô đã khai báo.
4. **Given** bản dịch dùng đại từ trái với giới tính đã khai báo cho một nhân vật, **When** kiểm duyệt chạy, **Then** một lỗi xưng hô/giới tính được ghi nhận kèm vị trí.

---

### User Story 3 - Chuốt văn mượt hơn nhưng vẫn trung thành với nguyên tác (Priority: P2)

Người dịch bật nhiều lượt chuốt văn và muốn văn bản mượt mà, thuần Việt hơn sau mỗi lượt nhưng không được bịa thêm tình tiết, tên riêng, cảm xúc hay hình ảnh không có trong nguyên tác, và không làm mất thuật ngữ đã đúng ở bản thô. (F7, F8)

**Why this priority**: Chỉ dẫn mặc định hiện tại ("bay bổng nhất có thể") và các lượt chuốt chỉ đối chiếu với bản lượt trước khiến sai lệch tích lũy; người dịch khó phát hiện vì văn bản đọc "hay" nhưng sai nguyên tác.

**Independent Test**: Chuốt văn 3 lượt cho một chương mẫu đã có bản dịch thô đúng; so sánh từng lượt với nguyên tác để đếm tên riêng/chi tiết mới không có trong nguồn và số vi phạm từ điển phát sinh.

**Acceptance Scenarios**:

1. **Given** người dùng không nhập yêu cầu biên tập bổ sung, **When** chuốt văn, **Then** chỉ dẫn mặc định ưu tiên trung thành nguyên tác trước, mượt mà sau, và cấm thêm nội dung không có trong nguồn.
2. **Given** lượt chuốt văn thứ K tạo ra tên riêng không có trong nguyên tác hoặc làm tăng số vi phạm từ điển so với lượt K−1, **When** lượt K hoàn tất, **Then** hệ thống giữ lại kết quả lượt K−1, ghi log lý do, và không tiếp tục các lượt sau dựa trên kết quả bị loại.
3. **Given** mỗi lượt chuốt văn có mức độ sáng tạo được khai báo riêng, **When** chạy lượt đó, **Then** mức độ đã khai báo được áp dụng đúng như mô tả (không bị thay bằng giá trị cố định khác).
4. **Given** người dùng tự nhập yêu cầu biên tập bổ sung, **When** chuốt văn, **Then** yêu cầu của người dùng được tôn trọng nhưng ràng buộc "không thêm nội dung ngoài nguyên tác" vẫn luôn có hiệu lực.

---

### User Story 4 - Kiểm duyệt phát hiện đủ loại lỗi và hỗ trợ sửa có mục tiêu (Priority: P2)

Sau khi dịch, người dịch nhận một danh sách lỗi đầy đủ hơn — gồm cả dịch sai nghĩa, xưng hô sai, sót chữ Hán, vi phạm từ điển — mỗi lỗi gắn với đoạn văn cụ thể, và có thể sửa những lỗi nghiêm trọng bằng cách dịch lại đúng đoạn bị ảnh hưởng thay vì dịch lại cả chương. (F9)

**Why this priority**: Kiểm duyệt hiện tại không phân loại "sai nghĩa" và "xưng hô", và kết quả chỉ dùng để hiển thị; người dịch phải sửa thủ công từng câu.

**Independent Test**: Đưa vào một bản dịch mẫu có cài sẵn các lỗi đã biết (bỏ sót một câu, sai nghĩa một câu, sai đại từ, sai thuật ngữ); chạy kiểm duyệt và kiểm tra tỉ lệ phát hiện, vị trí đoạn văn; chạy sửa có mục tiêu và kiểm tra lỗi nghiêm trọng được khắc phục mà các đoạn khác không đổi.

**Acceptance Scenarios**:

1. **Given** bản dịch có một câu dịch sai nghĩa, **When** kiểm duyệt chạy, **Then** lỗi được phân loại là "sai nghĩa" (không gộp vào "khác").
2. **Given** kiểm duyệt AI và kiểm tra tất định đều phát hiện cùng một vi phạm từ điển, **When** hiển thị kết quả, **Then** chỉ có một mục lỗi (không trùng lặp).
3. **Given** chương có lỗi nghiêm trọng (bỏ sót/sai nghĩa) gắn với đoạn số 7, **When** sửa có mục tiêu được kích hoạt, **Then** chỉ đoạn 7 được dịch lại (có ngữ cảnh các đoạn lân cận), các đoạn khác giữ nguyên từng ký tự.
4. **Given** bản sửa của đoạn 7 tạo thêm lỗi mới hoặc thất bại (hết hạn mức, bị chặn nội dung), **When** sửa xong, **Then** đoạn 7 giữ nguyên bản cũ, lỗi gốc vẫn được giữ trong danh sách và người dùng được thông báo lý do.
5. **Given** tùy chọn "tự động sửa lỗi nghiêm trọng" đang tắt (mặc định), **When** kiểm duyệt phát hiện lỗi nghiêm trọng, **Then** không có lời gọi AI bổ sung nào được thực hiện; lỗi chỉ được ghi nhận và người dùng vẫn có thể sửa thủ công.
6. **Given** người dùng đã bật tùy chọn "tự động sửa lỗi nghiêm trọng", **When** một chương có lỗi nghiêm trọng sau kiểm duyệt, **Then** hệ thống thực hiện tối đa một lượt sửa có mục tiêu cho chương đó và không lặp lại dù vẫn còn lỗi.

---

### User Story 5 - Chỉ dẫn gửi AI rõ ràng, không mâu thuẫn, không trùng lặp (Priority: P3)

Người dịch (và người bảo trì) cần chắc chắn rằng các nguồn chỉ dẫn — hướng dẫn thể loại, tông giọng, cẩm nang/quy tắc xưng hô của truyện, hồ sơ nhân vật, yêu cầu biên tập bổ sung — được trình bày có cấu trúc, đánh số đúng, không gửi trùng văn bản nguồn, và có thứ tự ưu tiên rõ khi mâu thuẫn. (F3, F4)

**Why this priority**: Ảnh hưởng gián tiếp nhưng rộng đến mọi giai đoạn; chi phí thấp, rủi ro thấp.

**Independent Test**: Sinh chỉ dẫn cho một đoạn mẫu với đủ mọi nguồn cấu hình; kiểm tra mỗi quy tắc nằm trọn trong một mục riêng, văn bản nguồn chỉ xuất hiện một lần, và thứ tự ưu tiên được nêu rõ.

**Acceptance Scenarios**:

1. **Given** chỉ dẫn dịch thô được sinh ra, **When** kiểm tra cấu trúc, **Then** mỗi quy tắc nằm trong một mục đánh số riêng, không có mục bị chèn vào giữa mục khác.
2. **Given** đoạn văn có thuật ngữ được đánh dấu, **When** sinh chỉ dẫn, **Then** văn bản nguồn chỉ được gửi một lần.
3. **Given** cẩm nang của truyện quy định xưng hô "tôi–cậu" trong khi hướng dẫn thể loại mặc định "ta–ngươi", **When** dịch, **Then** quy định của cẩm nang được ưu tiên theo thứ tự ưu tiên đã công bố.

---

### User Story 6 - Đo được chất lượng trước và sau thay đổi (Priority: P3)

Người bảo trì cần một bộ mẫu chuẩn và báo cáo chất lượng có thể lặp lại để chứng minh mỗi thay đổi thực sự cải thiện (hoặc không làm xấu đi) chất lượng dịch, thay vì đánh giá cảm tính.

**Why this priority**: Là điều kiện để kiểm chứng các tiêu chí thành công của các story khác; các chỉ số tất định chạy được không cần gọi AI.

**Independent Test**: Chạy bộ đánh giá trên các bản dịch mẫu cố định và nhận báo cáo với các chỉ số: tỉ lệ tuân thủ từ điển, sót chữ Hán, parity đoạn văn, nhất quán xưng hô, tên riêng ngoài nguồn.

**Acceptance Scenarios**:

1. **Given** bộ mẫu chuẩn và một bộ bản dịch, **When** chạy đánh giá hai lần trên cùng dữ liệu, **Then** các chỉ số tất định cho kết quả giống hệt nhau.
2. **Given** baseline đã được ghi nhận trước khi thay đổi, **When** chạy lại sau thay đổi, **Then** báo cáo hiển thị chênh lệch từng chỉ số so với baseline.

---

### Edge Cases

- Mục từ điển 1 ký tự hoặc rất ngắn trùng với một phần của từ ghép thông dụng.
- Thuật ngữ ngắn nằm bên trong thuật ngữ dài hơn (ví dụ "林" nằm trong "林动"): thuật ngữ dài phải thắng.
- Thuật ngữ xuất hiện ở dạng phồn thể trong khi từ điển lưu giản thể (và ngược lại).
- Hai mục từ điển cùng chữ Hán khác nghĩa Việt; hoặc khác chữ Hán cùng nghĩa Việt (hai nhân vật cùng tên Việt).
- Từ điển rất lớn (≥ 1.000 mục) — chỉ dẫn không được phình theo kích thước từ điển.
- Chương đầu tiên (không có chương trước); chương trước chưa dịch; dịch song song nhiều chương; dịch không theo thứ tự.
- Chế độ dịch từng dòng độc lập (segment translation) — ngữ cảnh liên tục vẫn phải được cung cấp ở mức hợp lý hoặc ghi rõ là không áp dụng.
- Phân đoạn đi qua đường cứu nguy phiên âm Hán-Việt dự phòng (do bị chặn nội dung/hết thời gian): kiểm tra chất lượng phải đánh dấu phân đoạn này là "bản dự phòng" thay vì báo hàng loạt lỗi giả.
- Trích dẫn của một lỗi kiểm duyệt không tìm thấy trong bản dịch → lỗi vẫn hiển thị nhưng định vị ở mức chương.
- Nhân vật chưa khai báo giới tính → không áp ràng buộc giới tính, không báo lỗi xưng hô cho nhân vật đó.
- Dự án/bản sao lưu tạo từ phiên bản cũ (không có hồ sơ nhân vật) được mở hoặc khôi phục → dùng bình thường, mọi mục được coi là "chưa khai báo hồ sơ".
- Thiết bị chạy phiên bản cũ đồng bộ dữ liệu lên sau khi thiết bị mới đã khai báo hồ sơ nhân vật → hồ sơ đã khai báo không bị mất.
- Bật tự động sửa nhưng chương vẫn còn lỗi nghiêm trọng sau lượt sửa duy nhất → dừng, giữ lỗi còn lại để người dùng xử lý thủ công.
- Người dùng hủy giữa chừng khi đang sửa có mục tiêu → không ghi đè bản dịch hiện có.
- Hết hạn mức API trong lúc sửa có mục tiêu → dừng sửa, giữ bản dịch hiện có, giữ lỗi.

## Requirements *(mandatory)*

### Functional Requirements

**Tuân thủ từ điển (US1)**

- **FR-001**: Hệ thống MUST chỉ đưa vào chỉ dẫn của mỗi giai đoạn (dịch thô, chuốt văn, kiểm duyệt) các mục từ điển xuất hiện trong đoạn văn đang xử lý (tính cả biến thể phồn/giản), cộng với các mục người dùng đã đánh dấu ưu tiên (nếu tính năng đánh dấu tồn tại), thay vì toàn bộ từ điển hoặc N mục đầu tiên.
- **FR-002**: Hệ thống MUST NOT thay thế cứng vào văn bản nguồn các mục từ điển có rủi ro khớp nhầm cao (mặc định: mục chỉ có 1 ký tự Hán); các mục này vẫn được cung cấp cho AI dưới dạng tham chiếu.
- **FR-003**: Khi nhiều mục từ điển chồng lấn tại cùng vị trí, hệ thống MUST ưu tiên mục dài nhất, và MUST NOT thay thế bên trong một đoạn đã được thay thế.
- **FR-004**: Hệ thống MUST phát hiện xung đột từ điển (cùng chữ Hán khác nghĩa Việt) và áp dụng một quy tắc chọn tất định đã được công bố, đồng thời cảnh báo người dùng.
- **FR-005**: Sau giai đoạn dịch thô và sau giai đoạn chuốt văn cuối cùng, hệ thống MUST chạy kiểm tra tuân thủ từ điển tất định (không cần AI): với mỗi thuật ngữ có trong nguồn, xác định bản dịch có chứa dạng Việt quy định hay không, và ghi lỗi "thuật ngữ" kèm số thứ tự đoạn văn khi vi phạm.

**Ngữ cảnh liên tục & xưng hô (US2)**

- **FR-006**: Khi một chương bị tách thành nhiều phân đoạn, mỗi phân đoạn (trừ phân đoạn đầu) MUST nhận phần cuối của văn bản nguồn liền trước làm ngữ cảnh chỉ-đọc, có giới hạn độ dài, và kết quả MUST NOT chứa bản dịch của phần ngữ cảnh đó.
- **FR-007**: Khi chương liền trước trong cùng dự án đã có bản dịch hoàn chỉnh tại thời điểm bắt đầu dịch, hệ thống MUST cung cấp phần kết (giới hạn độ dài) của bản dịch đó làm ngữ cảnh tham chiếu; khi không có, hệ thống MUST tiếp tục dịch bình thường mà không chờ.
- **FR-008**: Hệ thống MUST cho phép mô tả cho nhân vật: giới tính và quy ước xưng hô với các nhân vật khác, và MUST đưa thông tin này vào chỉ dẫn khi nhân vật xuất hiện trong đoạn đang xử lý. Thông tin này MUST được lưu dưới dạng các trường có cấu trúc, tùy chọn, gắn với mục từ điển loại "nhân vật".
- **FR-008a**: Việc bổ sung các trường hồ sơ nhân vật MUST tương thích ngược: dữ liệu hiện có (mục từ điển không có hồ sơ), bản sao lưu cũ và dữ liệu đồng bộ từ thiết bị/phiên bản cũ MUST tiếp tục được đọc và dùng bình thường mà không mất dữ liệu; mục thiếu hồ sơ được coi là "chưa khai báo".
- **FR-008b**: Khi hợp nhất/đồng bộ dữ liệu từ phiên bản cũ không biết đến hồ sơ nhân vật, hệ thống MUST NOT xóa hồ sơ nhân vật đã khai báo ở phiên bản mới.
- **FR-008c**: Người dùng MUST xem, thêm, sửa và xóa được hồ sơ nhân vật cho từng mục từ điển loại "nhân vật"; trường hồ sơ để trống là hợp lệ.
- **FR-009**: Hệ thống MUST kiểm tra (tất định khi có thể) việc dùng đại từ trái với giới tính đã khai báo trong các câu có tên nhân vật đó, và ghi lỗi "xưng hô/giới tính" kèm vị trí.

**Chuốt văn trung thành (US3)**

- **FR-010**: Chỉ dẫn chuốt văn mặc định MUST ưu tiên trung thành nguyên tác và cấm thêm tình tiết, tên riêng, hình ảnh không có trong nguồn; ràng buộc này MUST luôn có hiệu lực kể cả khi người dùng nhập yêu cầu biên tập bổ sung.
- **FR-011**: Sau mỗi lượt chuốt văn, hệ thống MUST so sánh kết quả với nguyên tác (không chỉ với lượt trước) theo các tín hiệu tất định: tên riêng/thuật ngữ không có trong nguồn, số vi phạm từ điển, parity đoạn văn; nếu lượt hiện tại xấu hơn lượt trước theo bất kỳ tín hiệu nào, hệ thống MUST giữ kết quả lượt trước và dừng các lượt sau cho chương đó.
- **FR-012**: Mức độ sáng tạo khai báo cho từng lượt chuốt văn MUST được áp dụng đúng như khai báo cho mọi lượt, ở cả luồng dịch hàng loạt và luồng dịch đơn chương.

**Kiểm duyệt & sửa có mục tiêu (US4)**

- **FR-013**: Kiểm duyệt MUST phân loại tối thiểu: bỏ sót, thêm thắt, lặp lại, sai thuật ngữ, sai nghĩa, xưng hô/giới tính, sót chữ Hán, khác.
- **FR-014**: Mỗi lỗi MUST gắn với số thứ tự đoạn văn trong bản dịch khi định vị được; khi không định vị được, MUST gắn ở mức chương.
- **FR-015**: Kết quả kiểm tra tất định (FR-005, FR-009) và kết quả kiểm duyệt AI MUST được hợp nhất và khử trùng lặp trước khi lưu/hiển thị.
- **FR-016**: Hệ thống MUST hỗ trợ sửa có mục tiêu: dịch lại chỉ các đoạn có lỗi nghiêm trọng, kèm ngữ cảnh các đoạn lân cận, và giữ nguyên từng ký tự các đoạn không liên quan.
- **FR-017**: Bản sửa của một đoạn MUST chỉ được chấp nhận khi qua lại các kiểm tra tất định mà không phát sinh lỗi mới; nếu không, đoạn cũ được giữ và lỗi gốc được giữ lại kèm lý do.
- **FR-018**: Sửa có mục tiêu MUST tôn trọng thao tác hủy của người dùng, giới hạn hạn mức và các quy tắc xử lý nội dung bị chặn giống như toàn bộ luồng dịch hiện có.

**Chỉ dẫn & đo lường (US5, US6)**

- **FR-019**: Chỉ dẫn của mỗi giai đoạn MUST có cấu trúc đánh số đúng (mỗi quy tắc một mục), MUST gửi văn bản nguồn đúng một lần, và MUST nêu thứ tự ưu tiên: cẩm nang/quy tắc xưng hô của truyện > hồ sơ nhân vật > yêu cầu biên tập bổ sung > hướng dẫn thể loại/tông giọng mặc định; riêng ràng buộc trung thành nguyên tác và bảo toàn cấu trúc đoạn luôn ở mức cao nhất.
- **FR-020**: Dự án MUST có bộ mẫu đánh giá cố định và quy trình đánh giá lặp lại được, báo cáo tối thiểu: tỉ lệ tuân thủ từ điển, số lần thay thế từ điển khớp nhầm, sót chữ Hán, parity đoạn văn, lỗi xưng hô/giới tính, tên riêng ngoài nguồn; các chỉ số tất định MUST chạy được mà không gọi AI.
- **FR-021**: Hai luồng dịch (hàng loạt và đơn chương) MUST dùng cùng quy tắc chống trùng khi thêm thực thể mới vào từ điển. (F10)

**Ràng buộc bảo toàn**

- **FR-022**: Mọi thay đổi MUST giữ nguyên các bảo đảm hiện có: 100% độ phủ văn bản nguồn, chống cắt cụt, parity đoạn văn, phòng chống prompt injection, cơ chế tách/thử lại khi lỗi, và chỉ dùng tầng gọi AI hiện có.
- **FR-023**: Các tính năng làm tăng số lần gọi AI (ví dụ sửa có mục tiêu) MUST hiển thị rõ cho người dùng và có thể tắt.
- **FR-024**: Tự động sửa có mục tiêu trong luồng dịch MUST là tùy chọn do người dùng bật, **mặc định tắt**; khi bật, MUST giới hạn tối đa một lượt sửa cho mỗi chương. Thao tác sửa thủ công theo từng lỗi MUST luôn khả dụng bất kể tùy chọn này.
- **FR-025**: Lựa chọn bật/tắt tự động sửa MUST được ghi nhớ giữa các phiên làm việc giống như các tùy chọn dịch hiện có.

### Key Entities *(include if feature involves data)*

- **Mục từ điển (Glossary Entry)**: thuật ngữ gốc tiếng Trung, các biến thể, dạng Việt quy định, loại, ghi chú; có thể mang mức ưu tiên và (đối với nhân vật) hồ sơ nhân vật.
- **Hồ sơ nhân vật (Character Profile)**: thông tin tùy chọn gồm giới tính và quy ước xưng hô với từng nhân vật/nhóm khác; lưu có cấu trúc trong mục từ điển loại "nhân vật"; thiếu hồ sơ nghĩa là "chưa khai báo".
- **Ngữ cảnh liên tục (Continuity Context)**: phần cuối văn bản nguồn của phân đoạn trước, và/hoặc phần kết bản dịch chương trước; chỉ đọc, có giới hạn độ dài, không được dịch lại.
- **Lỗi chất lượng (Quality Issue)**: loại, mức độ, nguồn phát hiện (tất định/AI), vị trí đoạn văn, trích dẫn, mô tả, trạng thái sửa.
- **Báo cáo chất lượng (Quality Report)**: tập chỉ số theo chương/bộ mẫu, so sánh với baseline.
- **Mẫu đánh giá (Evaluation Sample)**: đoạn nguyên tác cố định + từ điển + hồ sơ nhân vật + bản dịch tham chiếu/ràng buộc kỳ vọng.

## Success Criteria *(mandatory)*

### Measurable Outcomes

Baseline cho mọi chỉ số được đo trên bộ mẫu đánh giá (FR-020) **trước** khi triển khai các thay đổi khác.

- **SC-001**: Tỉ lệ thuật ngữ trong nguồn được dịch đúng dạng quy định đạt ≥ 98% trên bộ mẫu.
- **SC-002**: 0 trường hợp từ điển làm biến dạng từ ghép không liên quan trên bộ mẫu (bao gồm các ca mục 1 ký tự).
- **SC-003**: Số lỗi xưng hô/giới tính trên mỗi chương giảm ≥ 50% so với baseline đối với các nhân vật đã khai báo hồ sơ, tính riêng tại các ranh giới phân đoạn và đoạn mở đầu chương.
- **SC-004**: Sau chuốt văn nhiều lượt, ≥ 99% chương không chứa tên riêng/thuật ngữ không có trong nguyên tác; số lỗi "thêm thắt" do kiểm duyệt báo giảm ≥ 50% so với baseline.
- **SC-005**: Với dự án có ≥ 200 mục từ điển, hạn mức tiêu thụ trung bình mỗi chương giảm ≥ 25% so với baseline (khi tắt sửa có mục tiêu), trong khi SC-001 vẫn đạt.
- **SC-006**: Kiểm duyệt phát hiện ≥ 80% lỗi cài sẵn trong bộ mẫu (bỏ sót, sai nghĩa, xưng hô, thuật ngữ), mỗi lỗi định vị đúng đoạn văn trong ≥ 90% trường hợp định vị được.
- **SC-007**: Khi bật sửa có mục tiêu, ≥ 80% lỗi nghiêm trọng được khắc phục tự động mà không làm tăng tổng số lỗi của chương, và 100% đoạn không liên quan giữ nguyên.
- **SC-008**: Thời gian dịch trung bình mỗi chương (khi tắt sửa có mục tiêu) tăng không quá 15% so với baseline.
- **SC-009**: Không có hồi quy: toàn bộ cổng kiểm tra chất lượng bắt buộc của dự án vẫn đạt, và các bảo đảm ở FR-022 vẫn được các kiểm thử hiện có xác nhận.
- **SC-010**: 100% dự án, bản sao lưu và dữ liệu đồng bộ tạo từ phiên bản trước mở/khôi phục được mà không mất mục từ điển nào; 0 trường hợp hồ sơ nhân vật bị mất sau khi đồng bộ với thiết bị chạy phiên bản cũ trong các kịch bản kiểm thử.
- **SC-011**: Với cấu hình mặc định (tự động sửa tắt), số lần gọi AI mỗi chương không tăng so với baseline do tính năng sửa có mục tiêu.

## Assumptions

- Giữ nguyên kiến trúc hiện tại: SPA thuần client, pipeline 3 giai đoạn (Dịch thô → Chuốt văn → Kiểm duyệt), gọi AI qua tầng dịch vụ hiện có; không thêm backend, không thêm client AI thứ hai, không thêm dependency mới trừ khi thật sự cần.
- Ngữ cảnh chương trước (FR-007) chỉ dùng bản dịch **đã có sẵn**; không tạo thêm lời gọi AI để tóm tắt chương. Trong chế độ dịch song song, chương có thể không có ngữ cảnh này — chấp nhận được.
- Ngưỡng "rủi ro khớp nhầm cao" mặc định là mục 1 ký tự Hán; có thể tinh chỉnh trong giai đoạn lập kế hoạch dựa trên bộ mẫu.
- Bộ mẫu đánh giá được xây từ các đoạn trích ngắn do người dùng cung cấp hoặc văn bản không vướng bản quyền, lưu cùng mã nguồn; bản dịch mẫu dùng cho chỉ số tất định là dữ liệu cố định (không gọi AI khi chạy test).
- Các chỉ số dựa trên AI (SC-006, SC-007) được đo thủ công/định kỳ bằng API key của người dùng, không chạy trong CI.
- Nhãn và thông báo tiếng Việt hiện có giữ nguyên; chỉ bổ sung nhãn mới cho các tùy chọn mới.
- Người dùng đã cho phép rõ ràng việc mở rộng dữ liệu lưu trữ để thêm hồ sơ nhân vật (FR-008); đây là thay đổi **bổ sung, tùy chọn**, không đổi nghĩa của các trường hiện có và phải tương thích ngược với dữ liệu, bản sao lưu và đồng bộ đám mây hiện có (FR-008a, FR-008b).
- Tự động sửa có mục tiêu mặc định tắt (FR-024); với cấu hình mặc định, số lần gọi AI mỗi chương không tăng do tính năng này.

## Clarifications

### Session 2026-11-15

- Q: Lưu hồ sơ nhân vật (giới tính, xưng hô) ở đâu? → A: Thêm trường có cấu trúc, tùy chọn vào mục từ điển, kèm chuyển đổi tương thích ngược (FR-008, FR-008a–c).
- Q: Có tự động dịch lại đoạn bị lỗi nghiêm trọng không? → A: Có tùy chọn bật/tắt, mặc định tắt; khi bật tối đa 1 lượt sửa mỗi chương (FR-024, FR-025; US4 kịch bản 5–6).
