# Feature Specification: Cải thiện chất lượng dịch — Bảo toàn cấu trúc 1-1 với bản raw

**Feature Branch**: `166-strict-raw-structure-parity`

**Created**: 2026-11-27

**Status**: Draft

**Input**: User description: "tôi muốn cải tiến để cải thiện chất lượng dịch; đảm bảo cấu trúc giống 1-1 với bản raw; từ dấu câu; cách ngắt câu; xuống dòng;"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Bảo toàn chính xác 1-1 cấu trúc dòng và đoạn văn so với bản raw (Priority: P1)

Khi người dịch chạy dịch thô hoặc chuốt văn cho một chương truyện (dù ngắn hay dài), mỗi đoạn văn, dòng thoại, câu thơ, dòng tiêu đề và dòng phân cảnh trong bản raw đều phải xuất hiện đúng 1-1 ở vị trí tương ứng trong bản dịch. Không có tình trạng gộp nhiều dòng ngắn thành một khối văn dài hoặc tự ý tách một đoạn gốc thành nhiều đoạn lẻ.

**Why this priority**: Cấu trúc xuống dòng và phân đoạn quyết định trực tiếp nhịp đọc của truyện mạng (đặc biệt là hội thoại đối đáp ngắn và cao trào) và là điều kiện bắt buộc để người dịch đối chiếu song ngữ từng dòng với bản raw.

**Independent Test**: Dịch và chuốt văn một chương mẫu gồm tiêu đề chương, đoạn tự sự, chuỗi 8 dòng hội thoại ngắn liên tiếp, 4 dòng thơ/khẩu quyết và dòng phân cảnh; kiểm tra bản dịch thô và bản chuốt văn đều có số lượng đoạn/dòng khớp chính xác 100% (lệch 0 đoạn) và ánh xạ đúng vị trí 1-1 với bản raw.

**Acceptance Scenarios**:

1. **Given** bản raw có chính xác N đoạn/dòng có nội dung (kể cả khi N < 5 hoặc N > 50), **When** hệ thống hoàn thành dịch thô, **Then** bản dịch thô có chính xác N đoạn/dòng tương ứng 1-1 theo đúng thứ tự, không gộp và không tách thêm đoạn.
2. **Given** bản dịch thô đã khớp 1-1 với bản raw, **When** hệ thống thực hiện chuốt văn (một hoặc nhiều lượt), **Then** bản chuốt văn giữ nguyên chính xác N đoạn/dòng 1-1, không gộp thoại vào tự sự và không đánh mất tiêu đề hay dòng phân cảnh.
3. **Given** bản raw là một chương dài phải chia thành nhiều phần để xử lý, **When** hệ thống ghép các phần lại thành chương hoàn chỉnh, **Then** ranh giới ghép nối bảo toàn đúng phân tách dòng của bản raw, không bị mất dòng trống hoặc dính liền hai đoạn ở điểm nối.

---

### User Story 2 - Chuẩn hóa và bảo toàn 1-1 hệ thống dấu câu từ bản raw (Priority: P1)

Người dịch muốn mọi dấu câu mang ngữ khí và chức năng cấu trúc trong bản raw tiếng Trung được chuyển sang dấu câu tiếng Việt tương đương một cách chính xác và nhất quán: câu hỏi giữ dấu hỏi (`?`), câu cảm thán giữ dấu chấm than (`!`), câu bỏ lửng giữ dấu ba chấm (`...`), ngắt nhịp/chêm xen giữ dấu gạch ngang (`—`), lời thoại giữ nguyên cặp dấu ngoặc thoại, nội dung trong ngoặc đơn giữ dấu ngoặc đơn, và tuyệt đối không còn sót dấu câu toàn giác tiếng Trung trong bản dịch.

**Why this priority**: Việc AI tự ý bỏ dấu ngoặc thoại, biến câu hỏi/cảm thán/bỏ lửng thành dấu chấm thường hoặc để sót dấu câu tiếng Trung làm mất sắc thái nhân vật và khiến người biên tập phải rà soát sửa tay toàn bộ chương.

**Independent Test**: Dịch và chuốt văn một đoạn mẫu chứa đủ các loại dấu câu tiếng Trung (`。`, `，`, `、`, `；`, `：`, `？`, `！`, `……`, `——`, `“...”`, `「...」`, `（...）`, `《...》`); kiểm tra 0 dấu câu tiếng Trung còn sót và mọi dấu ngữ khí/cấu trúc tương ứng đều được bảo toàn đúng vị trí.

**Acceptance Scenarios**:

1. **Given** bản raw chứa các dấu câu tiếng Trung (`。`, `，`, `、`, `；`, `：`, `？`, `！`, `……`, `——`, `“...”`, `「...」`, `『...』`, `（...）`, `《...》`), **When** hoàn tất dịch thô và chuốt văn, **Then** toàn bộ dấu câu được chuyển sang chuẩn dấu câu tiếng Việt tương ứng và không còn sót bất kỳ ký tự dấu câu tiếng Trung nào.
2. **Given** một đoạn thoại trong bản raw nằm trong cặp dấu ngoặc thoại và kết thúc bằng dấu chấm hỏi hoặc dấu chấm than, **When** dịch và chuốt văn, **Then** lời thoại vẫn nằm trong cặp dấu ngoặc thoại trực tiếp (không bị biến thành câu kể gián tiếp) và giữ nguyên dấu chấm hỏi hoặc dấu chấm than tương ứng.
3. **Given** bản raw có câu kết thúc bằng dấu ba chấm (`……`) hoặc ngắt đột ngột bằng dấu gạch ngang (`——`), **When** dịch và chuốt văn, **Then** bản dịch giữ nguyên dấu ba chấm (`...`) hoặc dấu gạch ngang (`—`) tại đúng vị trí ngắt nhịp, không tự ý thay bằng dấu chấm thường (`.`).

---

### User Story 3 - Giữ nguyên cách ngắt câu và nhịp văn của bản raw qua mọi lượt dịch & chuốt văn (Priority: P1)

Người dịch muốn bản dịch vẫn mượt mà, thuần Việt nhưng phải tôn trọng cách ngắt câu của tác giả trong bản raw: không tự ý gộp nhiều câu ngắn dồn dập thành một câu dài lê thê, không tự ý cắt vụn một câu trọn vẹn thành nhiều câu rời làm đổi nhịp đọc, và không đảo lộn trật tự các câu trong cùng một đoạn.

**Why this priority**: Khi biên tập chuốt văn, AI thường có xu hướng viết lại cấu trúc câu quá đà (gộp 2–3 câu thành 1 câu dài hoặc chia nhỏ câu tùy tiện), làm mất nhịp điệu nguyên tác và phá vỡ khả năng đối chiếu từng câu giữa bản dịch và bản raw.

**Independent Test**: Dịch và chuốt văn (2 lượt) một chương mẫu có cả đoạn hành động nhịp nhanh (nhiều câu ngắn liên tiếp) lẫn đoạn miêu tả câu dài; đối chiếu từng đoạn giữa bản raw, bản dịch thô và bản chuốt văn để xác nhận số câu và ranh giới ngắt câu khớp 1-1 theo đúng trật tự.

**Acceptance Scenarios**:

1. **Given** một đoạn trong bản raw có 4 câu ngắn liên tiếp tạo nhịp dồn dập, **When** dịch thô và chuốt văn, **Then** bản dịch giữ đúng 4 câu theo đúng thứ tự, không gộp thành 1–2 câu dài.
2. **Given** một đoạn trong bản raw có 1 câu dài trọn vẹn, **When** chuốt văn nhiều lượt, **Then** hệ thống giữ đúng ranh giới 1 câu (chỉ tinh chỉnh từ ngữ và cách dùng dấu phẩy tự nhiên bên trong câu), không tự ý tách thành nhiều câu rời làm thay đổi cấu trúc.
3. **Given** người dùng nhập yêu cầu biên tập bổ sung hoặc bật nhiều lượt chuốt văn, **When** chuốt văn chạy, **Then** yêu cầu giữ nguyên cấu trúc 1-1 (xuống dòng, ngắt câu, dấu câu) luôn có mức ưu tiên cao nhất và không bị ghi đè bởi hướng dẫn làm văn phong bay bổng.

---

### User Story 4 - Tự động phát hiện, phục hồi và cảnh báo sai lệch cấu trúc 1-1 (Priority: P2)

Khi kết quả trả về từ AI ở giai đoạn dịch thô, chuốt văn hoặc sửa đoạn bị sai lệch cấu trúc so với bản raw (lệch số đoạn/dòng, sót dấu câu tiếng Trung, mất cặp dấu thoại, lệch dấu kết câu/ngắt câu nghiêm trọng), hệ thống tự động phát hiện ngay, ưu tiên tự khắc phục (chuẩn hóa dấu câu an toàn, thử lại/chia nhỏ đoạn bị lệch, hoặc giữ lại bản đạt chuẩn trước đó ở lượt chuốt văn) và báo rõ các sai lệch còn lại gắn với từng đoạn để người dịch rà soát nhanh.

**Why this priority**: Chỉ nhắc trong chỉ dẫn là chưa đủ vì AI vẫn có xác suất vi phạm trên các đoạn phức tạp; cần tầng kiểm định tự động, phục hồi và hiển thị minh bạch để đạt độ tin cậy cao trong thực tế.

**Independent Test**: Đưa vào các bản dịch có cài sẵn sai lệch (gộp 2 đoạn thành 1, sót dấu `。` và `「」`, mất dấu ngoặc thoại, gộp 3 câu thành 1 câu); kiểm tra hệ thống tự động phát hiện đủ các loại sai lệch, tự chuẩn hóa/thử lại đúng quy tắc và báo cáo chính xác chỉ số đoạn bị ảnh hưởng.

**Acceptance Scenarios**:

1. **Given** kết quả dịch thô hoặc chuốt văn bị lệch số đoạn so với bản raw (dù chỉ lệch 1 đoạn), **When** kiểm tra cấu trúc chạy, **Then** hệ thống phát hiện sai lệch và tự động kích hoạt cơ chế xử lý lại theo phần nhỏ hơn để khôi phục đối xứng 1-1.
2. **Given** lượt chuốt văn thứ K làm hỏng cấu trúc 1-1 (lệch đoạn, mất dấu thoại, hoặc làm tăng sai lệch ngắt câu/dấu câu so với lượt trước), **When** lượt K kết thúc, **Then** hệ thống loại bỏ kết quả lượt K, giữ nguyên bản tốt hơn trước đó và ghi nhận lý do rõ ràng.
3. **Given** sau khi hoàn tất dịch/chuốt văn vẫn còn đoạn có sai lệch dấu câu hoặc ngắt câu không thể tự phục hồi hoàn toàn, **When** kiểm duyệt chất lượng chạy, **Then** mỗi sai lệch được ghi nhận thành cảnh báo gắn đúng số thứ tự đoạn văn để người dịch nhảy tới sửa ngay.

---

### Edge Cases

- Chương rất ngắn (1–4 dòng, thông báo tác giả, lời nói đầu) — quy tắc khớp 1-1 số đoạn vẫn phải áp dụng, không bị bỏ qua vì dưới ngưỡng số đoạn tối thiểu.
- Dòng chỉ gồm một từ cảm thán, ký hiệu phân cảnh (`***`, `---`, `~~~`), hoặc câu thơ/khẩu quyết nhiều dòng — mỗi dòng độc lập phải được giữ nguyên dòng riêng, không bị gộp hoặc xóa.
- Bản raw có nhiều dòng trống liên tiếp (3–4 dòng trống) hoặc khoảng trắng thừa đầu/cuối dòng — hệ thống chuẩn hóa khoảng trắng thừa hợp lý nhưng bảo toàn đúng ranh giới giữa các đoạn nội dung và không làm lệch chỉ số đoạn 1-1.
- Bản raw dùng hỗn hợp nhiều kiểu dấu ngoặc thoại (`“...”`, `「...」`, `『...』`) hoặc dấu ngoặc bị thiếu cặp đóng ngay từ bản raw — chuyển đổi nhất quán sang dấu ngoặc chuẩn tiếng Việt và không báo lỗi giả cho các lỗi vốn có sẵn trong bản raw.
- Một câu tiếng Trung có nhiều vế nối bằng dấu phẩy (`，`) hoặc dấu liệt kê (`、`) — cho phép điều chỉnh linh hoạt nhẹ ở dấu phẩy nội câu để tiếng Việt tự nhiên, nhưng không được phá vỡ ranh giới kết câu (`.`, `?`, `!`, `...`), không gộp/tách câu và không làm mất dấu ngữ khí.
- Dấu câu xuất hiện trong ngữ cảnh đặc biệt (số thập phân `3.5`, tên viết tắt, dòng trạng thái/giao diện hệ thống `[...]` trong truyện hệ thống/võng du) — không bị nhầm là dấu kết câu hoặc bị xóa nhầm.
- Sửa có mục tiêu cho một đoạn bị lỗi — bản sửa của đoạn đó phải giữ nguyên đúng cấu trúc 1 đoạn, dấu câu và cách ngắt câu của đoạn gốc, không ảnh hưởng bất kỳ đoạn nào khác.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống MUST áp dụng ràng buộc đối xứng cấu trúc 1-1 so với bản raw ở cả giai đoạn dịch thô, giai đoạn chuốt văn (mọi lượt) và thao tác sửa từng đoạn; trong đó số lượng đoạn/dòng nội dung, thứ tự đoạn và ranh giới xuống dòng phải khớp chính xác 1-1 với bản raw (bao gồm cả chương ngắn có ít hơn 5 đoạn).
- **FR-002**: Hệ thống MUST ngăn chặn việc gộp đoạn, tách đoạn tùy tiện, gộp lời thoại vào đoạn tự sự, hoặc gộp tiêu đề chương vào đoạn mở đầu ở mọi giai đoạn dịch và chuốt văn.
- **FR-003**: Hệ thống MUST áp dụng quy tắc chuyển đổi dấu câu 1-1 nhất quán từ bản raw tiếng Trung sang tiếng Việt chuẩn:
  - Dấu kết câu và ngắt vế: `。` → `.`, `，` / `、` → `,`, `；` → `;`, `：` → `:`.
  - Dấu ngữ khí và ngắt nhịp: `？` → `?`, `！` → `!`, `……` → `...`, `——` → `—`.
  - Dấu bao đóng: `“...”` / `「...」` / `『...』` → dấu ngoặc kép thoại chuẩn tiếng Việt (`"..."` hoặc cặp ngoặc thống nhất toàn chương), `（...）` → `(...)`, `《...》` → dấu ngoặc tên tác phẩm chuẩn nhất quán.
- **FR-004**: Hệ thống MUST đảm bảo không còn sót ký tự dấu câu tiếng Trung toàn giác trong bản dịch đầu ra (bằng chỉ dẫn kết hợp bước chuẩn hóa dấu câu tự động an toàn sau khi nhận kết quả).
- **FR-005**: Hệ thống MUST bảo toàn cấu trúc lời thoại trực tiếp: mọi lời thoại nằm trong ngoặc ở bản raw phải được giữ là lời thoại trực tiếp trong ngoặc ở bản dịch, không chuyển thành lời kể gián tiếp và giữ cân bằng cặp dấu mở/đóng tương ứng với bản raw.
- **FR-006**: Hệ thống MUST bảo toàn cách ngắt câu và số lượng câu trên từng đoạn so với bản raw: không gộp nhiều câu gốc thành một câu dài, không cắt một câu gốc thành nhiều câu rời khi không cần thiết, và giữ nguyên trật tự các câu trong đoạn.
- **FR-007**: Hệ thống MUST loại bỏ các chỉ dẫn mặc định mâu thuẫn với ràng buộc bảo toàn cấu trúc (ví dụ khuyến khích viết lại quá tự do làm thay đổi ngắt câu/dấu câu) và đặt nguyên tắc "Trung thành nguyên tác + cấu trúc 1-1 (xuống dòng, ngắt câu, dấu câu)" ở mức ưu tiên cao nhất trong mọi giai đoạn.
- **FR-008**: Hệ thống MUST thực hiện kiểm định đối xứng cấu trúc tất định ở cả giai đoạn dịch thô và giai đoạn chuốt văn, kiểm tra tối thiểu:
  1. Khớp chính xác số lượng đoạn/dòng 1-1 với bản raw.
  2. Không sót dấu câu tiếng Trung.
  3. Tương thích dấu ngữ khí chủ đạo theo từng đoạn (dấu hỏi, dấu cảm thán, dấu ba chấm, dấu gạch ngang, cặp ngoặc thoại).
  4. Độ lệch số lượng câu trong từng đoạn nằm trong ngưỡng chặt đã quy định.
- **FR-009**: Khi phát hiện sai lệch cấu trúc 1-1 vượt ngưỡng ở giai đoạn dịch thô hoặc chuốt văn, hệ thống MUST tự động kích hoạt cơ chế phục hồi (chuẩn hóa dấu câu an toàn cho lỗi ký tự thuần túy; hoặc chia nhỏ/thử lại cho lỗi gộp/tách đoạn hoặc lệch cấu trúc nặng; hoặc giữ lại bản đạt chuẩn của lượt trước nếu lượt chuốt văn mới làm xấu đi cấu trúc).
- **FR-010**: Khi một chương bị chia nhỏ thành nhiều phần để dịch hoặc chuốt văn, hệ thống MUST bảo toàn chính xác ánh xạ 1-1 trên từng phần và tại ranh giới ghép nối giữa các phần.
- **FR-011**: Khi kiểm duyệt chất lượng chạy trên bản dịch, hệ thống MUST ghi nhận các sai lệch cấu trúc 1-1 còn tồn tại (lệch đoạn/xuống dòng, mất cặp dấu thoại, lệch dấu ngữ khí hoặc gộp/tách câu bất thường) kèm số thứ tự đoạn văn tương ứng để người dịch dễ đối chiếu và sửa.
- **FR-012**: Hệ thống MUST giữ nguyên các bảo đảm chất lượng hiện có (tuân thủ từ điển, hồ sơ nhân vật và xưng hô, ngữ cảnh liên tục, chống bỏ sót/thêm thắt, phòng chống can thiệp chỉ dẫn, không làm tăng số lượt gọi dịch khi đầu ra đã đạt chuẩn).

### Key Entities *(include if feature involves data)*

- **Đơn vị đoạn/dòng (Paragraph / Line Unit)**: Một đoạn văn, dòng thoại, dòng thơ, tiêu đề hoặc dòng phân cảnh độc lập trong bản raw, được đánh số thứ tự để ánh xạ 1-1 sang bản dịch thô và bản chuốt văn.
- **Hồ sơ cấu trúc đoạn (Paragraph Structural Signature)**: Tập đặc trưng cấu trúc rút ra từ một đơn vị đoạn gồm: số câu (theo ranh giới kết câu), tập dấu ngữ khí/ngắt nhịp (hỏi, cảm thán, ba chấm, gạch ngang), trạng thái và số cặp ngoặc thoại, và ký hiệu đặc biệt (phân cảnh, tiêu đề).
- **Báo cáo đối xứng cấu trúc 1-1 (Structure Parity Report)**: Kết quả đối chiếu giữa bản raw và bản dịch (thô hoặc chuốt) gồm trạng thái khớp số đoạn, danh sách đoạn bị lệch dấu câu/ngắt câu/thoại và mức độ sai lệch.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% chương trong bộ mẫu chuẩn đạt khớp chính xác 1-1 số đoạn/dòng giữa bản raw, bản dịch thô và bản chuốt văn (0 đoạn bị gộp hoặc tách thêm, kể cả chương ngắn < 5 đoạn và chương dài phải chia phần).
- **SC-002**: 0 ký tự dấu câu tiếng Trung toàn giác còn sót lại trong bản dịch cuối trên 100% chương kiểm thử.
- **SC-003**: ≥ 98% các đoạn trong bộ mẫu chuẩn bảo toàn chính xác dấu ngữ khí và dấu cấu trúc chính (cặp ngoặc thoại, dấu chấm hỏi, dấu chấm than, dấu ba chấm, dấu gạch ngang) đúng vị trí tương ứng với bản raw.
- **SC-004**: ≥ 95% các đoạn trong bộ mẫu chuẩn khớp 1-1 về số lượng câu và ranh giới ngắt câu giữa bản raw và bản chuốt văn cuối cùng (giảm tối thiểu 80% tình trạng tự ý gộp câu hoặc tách câu so với trước cải tiến).
- **SC-005**: 100% trường hợp lượt chuốt văn mới làm phá vỡ đối xứng đoạn hoặc làm tăng sai lệch dấu câu/ngắt câu đều được tự động chặn và giữ lại bản đạt chuẩn trước đó.
- **SC-006**: Không gây hồi quy các chỉ số chất lượng dịch hiện có (tỉ lệ tuân thủ từ điển, không sót chữ Hán, nhất quán xưng hô) và không làm tăng số lần gọi AI trên các chương đã đạt chuẩn ngay từ lượt đầu.

## Assumptions

- Mục tiêu "giống 1-1 với bản raw" áp dụng cho cấu trúc trình bày và nhịp điệu văn bản (số đoạn/dòng, vị trí xuống dòng, ranh giới câu, dấu ngữ khí và dấu thoại), vẫn cho phép điều chỉnh trật tự từ ngữ và linh hoạt nhẹ ở dấu phẩy nội câu để tiếng Việt tự nhiên, không biến bản dịch thành dịch từng chữ cứng nhắc (word-by-word).
- Chuẩn dấu ngoặc thoại mặc định trong bản dịch tiếng Việt là dấu ngoặc kép chuẩn (`"..."`), đồng nhất cho các biến thể dấu thoại trong bản raw (`“...”`, `「...」`, `『...』`).
- Các dòng trống thừa liên tiếp trong bản raw (ví dụ 3–4 dòng trống do nguồn sao chép lỗi) được chuẩn hóa gọn khi lưu/hiển thị giữa các đoạn nội dung, trong khi mọi đoạn/dòng có nội dung (kể cả dòng thơ, thoại ngắn và dòng phân cảnh) luôn giữ đúng 1-1 từng dòng.
- Tính năng mở rộng trực tiếp trên quy trình dịch 3 giai đoạn hiện có (Dịch thô → Chuốt văn → Kiểm duyệt), không thay đổi cấu trúc lưu trữ cốt lõi hay thêm dịch vụ bên ngoài.
