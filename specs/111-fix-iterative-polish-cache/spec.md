# Feature Specification: Fix Iterative Polish Cache Bypass

**Feature Branch**: `111-fix-iterative-polish-cache`

**Created**: 2026-09-12

**Status**: Draft

**Input**: User description: "Khi chuốt văn học hoặc rà soát thuật ngữ hoặc bất kì việc gì lặp lại, nó lại lấy cache từ lần đầu chạy rồi coi như đã thực hiện. Điều này đi ngược lại với mong muốn tạo ra các vòng lặp để ngăn việc bị thiếu sót cũng như giúp cải thiện văn phong."

## Bối cảnh vấn đề

Hệ thống dịch thuật sử dụng kiến trúc Client-Side SPA gọi trực tiếp Google Gemini REST API từ trình duyệt. Dự án đã loại bỏ toàn bộ tầng cache phía ứng dụng (không còn Redis/LRU/idempotency nào) kể từ lần chuyển đổi sang Pure Client-Side (Specs 092 & 110).

Tuy nhiên, người dùng phát hiện rằng khi chạy **nhiều vòng lặp** chuốt văn phong (polishCycles 1→5) hoặc rà soát thuật ngữ (extractionLoops 1→3), kết quả của các vòng 2+ gần như **giống hệt** vòng 1 — hệ thống hoạt động như thể nó "lấy cache từ lần đầu chạy rồi coi như đã thực hiện".

### Phân tích nguyên nhân gốc rễ

Sau khi rà soát toàn bộ codebase, đã xác định **2 nguyên nhân gốc rễ gây ra hiện tượng "cache giả"** khiến các vòng lặp trả về kết quả gần giống nhau:

**Nguyên nhân 1 — Prompt bất biến giữa các vòng lặp (Deterministic Prompt Problem):**
Hàm `buildPolishTranslationPayload()` (trong `src/services/ai/prompts.ts`) xây dựng prompt **hoàn toàn giống nhau** cho mọi vòng chuốt `j = 1, 2, ..., N`:
- `systemInstruction` — cố định hoàn toàn
- `rawTranslation` (trong user prompt) — ở vòng 2+ tuy nhận văn bản đã chuốt từ vòng trước, nhưng nếu vòng 1 đã chuốt "tốt" thì đầu vào gần giống → prompt gần giống → Gemini API trả kết quả gần giống (hoặc giống hệt khi temperature thấp 0.45)
- Không có chỉ thị phân biệt vòng lặp nào trong prompt (không có "Đây là lần chuốt thứ N, hãy cải thiện thêm so với lần trước")

Khi hai request liên tiếp có payload prompt gần giống nhau, Gemini API (phía Google server) có thể trả về kết quả từ internal response cache hoặc đơn giản là LLM sinh ra output gần giống do input gần giống + temperature thấp → người dùng cảm nhận như "bị cache".

**Nguyên nhân 2 — Không có cơ chế đánh giá sự cải thiện giữa các vòng:**
Vòng lặp hiện tại chỉ đơn giản gọi lại cùng hàm `polishTranslationDirect()` mà không có:
- Thông tin về lượt chuốt hiện tại (round number)
- Hướng dẫn cụ thể khác nhau cho mỗi vòng (vòng 1: ngữ pháp, vòng 2: tinh chỉnh văn phong, vòng 3: đọc lại toàn bộ...)
- Phản hồi (feedback loop) về những gì đã thay đổi ở vòng trước để AI biết cần cải thiện gì thêm
- Phát hiện khi bản chuốt đã hội tụ (convergence detection) → không cần chạy thêm vòng nữa

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Vòng chuốt lặp phải thực sự cải thiện văn phong qua mỗi lần (Priority: P1)

Khi người dùng chọn chuốt văn phong từ 2 đến 5 vòng, mỗi vòng lặp PHẢI thực sự mang lại sự cải thiện đáng kể so với vòng trước đó. Hệ thống phải gửi prompt khác biệt cho mỗi vòng, với hướng dẫn cụ thể phù hợp giai đoạn biên tập, để AI hiểu rằng đây là lần rà soát lại chứ không phải lần đầu tiên.

**Why this priority**: Đây là lỗi cốt lõi — toàn bộ tính năng "nhiều vòng chuốt" hiện tại không hoạt động đúng mục đích. Người dùng tạo vòng lặp để ngăn thiếu sót và cải thiện văn phong, nhưng kết quả thực tế gần như không thay đổi.

**Independent Test**: Có thể kiểm tra bằng cách dịch 1 chương với 3 vòng chuốt và so sánh bản text giữa lần 1, lần 2, lần 3 — phải có sự khác biệt rõ ràng.

**Acceptance Scenarios**:

1. **Given** chương đã có bản dịch thô, **When** người dùng chạy 3 vòng chuốt, **Then** mỗi vòng tạo ra bản dịch khác biệt có thể đo được (ít nhất 5% diff so với vòng trước) và prompt gửi đi phải chứa thông tin vòng lặp hiện tại
2. **Given** chương đã có bản dịch thô, **When** người dùng chạy 2 vòng chuốt, **Then** log phải hiển thị rõ hướng dẫn biên tập khác nhau cho từng vòng (vòng 1: tinh chỉnh ngữ pháp tổng thể, vòng 2: mài giũa văn phong sâu)
3. **Given** chương đã chuốt xong vòng 1, **When** hệ thống gửi prompt cho vòng 2, **Then** prompt phải bao gồm chỉ dẫn rõ ràng rằng đây là "lần rà soát thứ 2" cùng tiêu chí cải thiện cụ thể khác với vòng 1

---

### User Story 2 - Phát hiện hội tụ tự động (Convergence Detection) (Priority: P2)

Khi bản dịch đã đạt chất lượng tốt sau vài vòng chuốt và không còn cải thiện thêm đáng kể, hệ thống nên phát hiện sự hội tụ và dừng sớm thay vì chạy tiếp các vòng còn lại một cách vô ích (tiêu tốn token).

**Why this priority**: Tiết kiệm chi phí API token và thời gian chờ cho người dùng. Ngăn chặn trường hợp AI chuốt lại "lung tung" ở vòng cuối do thiếu cải thiện thực chất.

**Independent Test**: Dịch 1 chương ngắn với 5 vòng chuốt — nếu vòng 3 và vòng 4 gần giống nhau (dưới ngưỡng khác biệt), hệ thống tự dừng và thông báo.

**Acceptance Scenarios**:

1. **Given** bản chuốt vòng N và vòng N-1 có độ tương đồng trên 95%, **When** hệ thống so sánh hai bản, **Then** hệ thống log cảnh báo "Bản dịch đã hội tụ" và bỏ qua các vòng còn lại
2. **Given** người dùng chọn 5 vòng chuốt nhưng bản dịch hội tụ ở vòng 3, **When** quá trình hoàn tất, **Then** log hiển thị "Hội tụ sau 3/5 vòng, tiết kiệm 2 lượt gọi API"

---

### User Story 3 - Vòng lặp quét thuật ngữ phải khám phá thuật ngữ mới qua mỗi lần (Priority: P2)

Khi người dùng chọn nhiều vòng quét thuật ngữ (extractionLoops), mỗi vòng phải có khả năng phát hiện thêm thuật ngữ bị sót ở vòng trước bằng cách loại trừ thuật ngữ đã tìm thấy khỏi prompt.

**Why this priority**: Tương tự vấn đề chuốt văn — vòng lặp quét thuật ngữ cũng bị hiện tượng "cache giả" nếu prompt giống nhau.

**Independent Test**: Quét 1 chương dài với 2 vòng — vòng 2 phải biết thuật ngữ nào đã tìm thấy ở vòng 1 để tập trung tìm cái mới.

**Acceptance Scenarios**:

1. **Given** đã quét vòng 1 tìm được 5 thuật ngữ, **When** chạy vòng 2, **Then** prompt gửi đi phải liệt kê 5 thuật ngữ đã tìm được và yêu cầu AI tìm thêm cái mới bị sót
2. **Given** vòng 2 không tìm thêm thuật ngữ mới nào, **When** so sánh kết quả, **Then** hệ thống báo "Không phát hiện thuật ngữ mới, dừng quét"

---

### Edge Cases

- Khi văn bản quá ngắn (vài câu), chuốt nhiều vòng có thể không tạo ra khác biệt → cần convergence detection
- Khi temperature = 0.0, output sẽ hoàn toàn deterministic → phải tăng temperature hoặc thêm variation vào prompt
- Khi chạy ở chế độ segment translation, mỗi segment ngắn sẽ hội tụ nhanh hơn → ngưỡng convergence cần điều chỉnh
- Khi chạy hàng loạt (batch mode) với concurrency > 1, nhiều chương song song đều chuốt nhiều vòng → tải API tăng đáng kể nếu không có convergence detection

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI bổ sung thông tin vòng lặp (round number, tổng số vòng) vào prompt chuốt văn phong gửi cho AI, để mỗi vòng có chỉ dẫn biên tập khác biệt
- **FR-002**: Hệ thống PHẢI định nghĩa hướng dẫn biên tập phân tầng theo giai đoạn cho mỗi vòng lặp (ví dụ: vòng 1 — chỉnh ngữ pháp & thuật ngữ, vòng 2 — tinh chỉnh văn phong & tiết tấu, vòng 3 — đọc lại toàn bộ & mài giũa chi tiết nhỏ)
- **FR-003**: Hệ thống PHẢI tính toán diff/similarity giữa bản chuốt vòng N và vòng N-1, và dừng sớm khi phát hiện hội tụ (similarity > ngưỡng cấu hình)
- **FR-004**: Hệ thống PHẢI ghi log rõ ràng cho mỗi vòng chuốt: tiêu chí biên tập, % thay đổi so với vòng trước, và lý do dừng sớm (nếu có)
- **FR-005**: Với vòng lặp quét thuật ngữ, hệ thống PHẢI truyền danh sách thuật ngữ đã trích xuất từ vòng trước vào prompt vòng tiếp theo để tránh trùng lặp và khuyến khích khám phá mới
- **FR-006**: Hệ thống PHẢI điều chỉnh temperature tăng nhẹ theo vòng lặp (ví dụ: vòng 1: 0.45, vòng 2: 0.55, vòng 3+: 0.6) để khuyến khích sự đa dạng trong output

### Key Entities

- **PolishRoundStrategy**: Chiến lược biên tập cho mỗi vòng lặp chuốt, bao gồm hướng dẫn cụ thể, temperature tương ứng, và trọng tâm biên tập
- **ConvergenceResult**: Kết quả so sánh giữa hai bản dịch liên tiếp, bao gồm tỷ lệ similarity, số từ thay đổi, và quyết định dừng/tiếp

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Mỗi vòng chuốt (từ vòng 2 trở đi) tạo ra bản dịch có ít nhất 5% khác biệt text so với vòng trước (trừ khi đã hội tụ)
- **SC-002**: Khi bản dịch hội tụ, hệ thống phát hiện và dừng sớm trong vòng 1 vòng lặp thừa (không lãng phí > 1 API call cho kết quả không thay đổi)
- **SC-003**: Log hệ thống hiển thị rõ chiến lược biên tập và % thay đổi cho từng vòng, giúp người dùng hiểu giá trị của mỗi lần chuốt
- **SC-004**: Quét thuật ngữ nhiều vòng phải tìm được ít nhất 10% thuật ngữ mới ở vòng 2 so với vòng 1 (trên chương dài > 3000 từ Trung)

## Assumptions

- Google Gemini API có thể trả về kết quả tương tự hoặc giống nhau khi nhận cùng prompt với temperature thấp → đây là hành vi mong đợi của LLM, giải pháp phải thay đổi prompt chứ không phải đấu với API caching
- Người dùng cấu hình 1-5 vòng chuốt trên giao diện hiện tại — giao diện không thay đổi, chỉ hành vi xử lý bên dưới thay đổi
- Ngưỡng convergence mặc định ~95% similarity là hợp lý cho hầu hết trường hợp, có thể hardcode ban đầu
- Temperature tối đa cho chuốt văn không vượt quá 0.7 để tránh AI "sáng tác" thay vì "biên tập"
