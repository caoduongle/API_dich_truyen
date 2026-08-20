# Feature Specification: Pipeline Translation Hardening - Chapter Title Preservation & Untranslated Chinese Auto-Retry

**Feature Branch**: `034-pipeline-translation-fixes`  
**Created**: 2026-08-20  
**Status**: Draft  
**Input**: User description: "Sửa 2 lỗi trong pipeline dịch AI 2 giai đoạn (Dịch thô → Biên tập): BUG 1 — Tiêu đề chương bị mất ở Giai đoạn 2 (Biên tập); BUG 2 — Dịch thô đôi khi trả về gần như nguyên văn tiếng Trung. Hoàn thiện và nối tiếp FR-002 & SC-003 từ specs/002-preserve-paragraph-formatting."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Bảo tồn tuyệt đối tiêu đề chương qua cả 2 giai đoạn dịch thuật (Priority: P1) 🎯 MVP

Là một dịch giả hoặc độc giả,  
Tôi muốn khi thực hiện biên tập/chuốt văn ở Giai đoạn 2 (hoặc chuốt lại từ bản dịch thô), tiêu đề chương (ví dụ: `Chương 1: Đài Phát Thanh Kinh Hoàng`) luôn luôn được bảo toàn nguyên vẹn trên dòng đầu tiên của bản dịch cuối cùng và cách thân chương ít nhất 1 dòng trống,  
Để bản dịch không bị mất tiêu đề hoặc bị gộp tiêu đề vào câu văn xuôi mở đầu của tác phẩm, đảm bảo cấu trúc xuất file và hiển thị hoàn hảo.

**Why this priority**: Tiêu đề chương là thành phần nhận diện cấu trúc cốt lõi của tác phẩm. Việc mất tiêu đề ở Phase 2 làm hỏng mục lục, xuất tệp và làm giảm sút chất lượng biên tập.

**Independent Test**:
1. Chuẩn bị bản dịch thô Phase 1 có dòng đầu là `Chương 1: Đài Phát Thanh Kinh Hoàng\n\nNội dung mở đầu...`.
2. Giả lập AI Phase 2 trả về bản chuốt chỉ có thân bài (bỏ mất dòng tiêu đề `Chương 1...`).
3. Chạy qua pipeline chuốt văn Phase 2 và xác minh kết quả đầu ra cuối cùng vẫn có `Chương 1: Đài Phát Thanh Kinh Hoàng` ở dòng đầu tiên, phân tách bằng `\n\n` với thân chương.

**Acceptance Scenarios**:
1. **Given** bản dịch thô (Phase 1) có tiêu đề chương hợp lệ ở dòng đầu tiên, **When** thực hiện chuốt văn (Phase 2) trực tiếp (`callPolishDirect`), **Then** bản dịch chuốt văn trả về giữ nguyên vẹn dòng tiêu đề chương ở đầu bản dịch.
2. **Given** AI ở Phase 2 vô tình lược bỏ dòng tiêu đề và chỉ trả về thân văn xuôi, **When** hệ thống nhận kết quả từ AI, **Then** hệ thống tự động phát hiện và khôi phục (restore/prepend) tiêu đề chương từ bản thô vào đầu bản chuốt, ngăn cách bằng `\n\n`.
3. **Given** một chương dài được chuốt văn qua cơ chế Divide & Conquer (`polishWithContentSplit`), **When** các phân đoạn được ghép nối lại, **Then** tiêu đề chương chỉ xuất hiện duy nhất một lần ở đầu phân đoạn 1 và không bị lặp lại ở các phân đoạn tiếp theo.

---

### User Story 2 - Tự động phát hiện bản dịch sót chữ Hán & Tự kích hoạt Retry Divide & Conquer (Priority: P1) 🎯 MVP

Là một người dùng dịch truyện tự động,  
Tôi muốn hệ thống tự động phát hiện các trường hợp AI "nhại lại" (echo/copy nguyên văn) văn bản tiếng Trung gốc hoặc trả về bản dịch chứa tỉ lệ ký tự Hán bất thường,  
Để hệ thống tự động kích hoạt cơ chế thử lại thông minh (Divide & Conquer / Adaptive Split retry) thay vì trả về kết quả lỗi hoặc bản tiếng Trung chưa dịch cho tôi.

**Why this priority**: Ngăn ngừa hoàn toàn tình trạng bản dịch thô "rác" (toàn chữ Hán hoặc chỉ thay thế vài từ điển trong ngoặc vuông) lọt qua pipeline và hiển thị ra màn hình người dùng.

**Independent Test**:
1. Giả lập API AI trả về nội dung chứa > 10% ký tự Hán (ví dụ: model copy lại văn bản tiếng Trung gốc có gắn tag `[Từ_Việt]`).
2. Gửi yêu cầu dịch qua `rawController.ts` hoặc `polishController.ts`.
3. Xác minh hệ thống nhận diện lỗi `UNTRANSLATED_CHINESE_LEFTOVER`, kích hoạt chia nhỏ đoạn văn bản (Divide & Conquer retry) và không chấp nhận trả thẳng kết quả có nhiều chữ Hán.

**Acceptance Scenarios**:
1. **Given** kết quả trả về từ AI có tỉ lệ ký tự Hán vượt quá ngưỡng cho phép (> 10% tổng ký tự trên văn bản dài), **When** hệ thống xác thực kết quả (Giai đoạn 1 hoặc Giai đoạn 2), **Then** hệ thống từ chối kết quả đó và phát sinh lỗi `UNTRANSLATED_CHINESE_LEFTOVER`.
2. **Given** phát sinh lỗi `UNTRANSLATED_CHINESE_LEFTOVER`, **When** cơ chế phân loại lỗi `isSafetyOrEmptyError` xử lý, **Then** hệ thống tự động kích hoạt chia nhỏ thích ứng (Adaptive Content Split) và thử dịch lại từng phần.
3. **Given** văn bản dịch hợp lệ chỉ chứa một vài ký tự Hán nhỏ hợp lệ (ví dụ: tên riêng phiên âm hoặc trích đoạn ngắn < 5% tỉ lệ), **When** xác thực, **Then** hệ thống chấp nhận kết quả bình thường mà không gây false-positive retry.

---

### User Story 3 - Củng cố Chỉ thị Prompt & Đồng bộ Hậu xử lý cho Toàn bộ Pipeline (Priority: P2)

Là một kỹ sư vận hành hệ thống dịch,  
Tôi muốn các câu chỉ thị trong Prompt/System Instruction và các hàm chuẩn hóa văn bản ở backend hoạt động nhất quán,  
Để giảm thiểu tối đa xác suất AI vi phạm bố cục ngay từ lượt gọi đầu tiên.

**Why this priority**: Giảm số lần phải kích hoạt fallback/retry, tiết kiệm chi phí token và giảm độ trễ phản hồi của Gemini API.

**Independent Test**: Kiểm tra nội dung prompt và schema của cả `rawController.ts` và `polishController.ts` đảm bảo ràng buộc rõ ràng về tiêu đề chương và ngôn ngữ đích tiếng Việt 100%.

**Acceptance Scenarios**:
1. **Given** prompt Giai đoạn 2 trong `polishController.ts`, **When** AI xử lý, **Then** prompt có chỉ thị rõ ràng và tách biệt: "Tiêu đề chương ở dòng đầu tiên của bản dịch thô là BẤT BIẾN, PHẢI GIỮ LẠI NGUYÊN VẸN TRÊN DÒNG ĐẦU TIÊN của bản chuốt, ngăn cách với thân bài bằng dòng trống".
2. **Given** hàm hậu xử lý văn bản trong `server/utils/text.ts`, **When** chuẩn hóa phân đoạn, **Then** vừa tách dòng tiêu đề dính liền (theo `specs/002`), vừa bảo toàn tiêu đề gốc khi chuyển đổi giữa các giai đoạn.

---

### Edge Cases

- **Chương không có tiêu đề**: Văn bản gốc tiếng Trung không có dòng tiêu đề (vào thẳng nội dung) $\to$ hệ thống không tự ý chèn tiêu đề giả, xử lý phân đoạn bình thường.
- **Tiêu đề ở bản gốc là chữ Hán (`第一章 恐怖广播`), bản thô dịch thành `Chương 1: Đài Phát Thanh Kinh Hoàng`**: Bản chuốt phải giữ tiêu đề tiếng Việt đã dịch ở bản thô.
- **Văn bản gốc chứa thuật ngữ tiếng Trung nằm trong ngoặc vuông `[Tên_Việt]`**: Khi kiểm tra ký tự Hán, tính toán chính xác trên toàn bộ chuỗi để không bị đánh lừa bởi các tag ngoặc vuông.
- **Văn bản dịch ngắn (dưới 30 ký tự)**: Điều chỉnh ngưỡng ký tự Hán phù hợp để không chặn nhầm các câu cảm thán hoặc trích dẫn ngắn.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI đảm bảo tiêu đề chương đã có ở Giai đoạn 1 (Dịch thô) được bảo toàn 100% ở dòng đầu tiên của Giai đoạn 2 (Chuốt văn/Biên tập), phân tách với thân chương bằng dòng trống (`\n\n`).
- **FR-002**: Hệ thống PHẢI bổ sung hàm `ensureChapterTitlePreserved(rawText: string, polishedText: string): string` trong `server/utils/text.ts` để tự động phát hiện và khôi phục tiêu đề từ bản dịch thô nếu bản chuốt bị model lược bỏ (nối tiếp và hoàn thiện FR-002 & SC-003 trong `specs/002-preserve-paragraph-formatting`).
- **FR-003**: System Instruction và Prompt hướng dẫn biên tập của `polishController.ts` PHẢI được củng cố với điều khoản bất biến về tiêu đề chương, tránh xung đột với chỉ thị trau chuốt văn phong văn học.
- **FR-004**: Hệ thống PHẢI xây dựng các tiện ích kiểm tra ký tự Hán trong `server/utils/text.ts`:
  - `countChineseCharacters(text: string): number`
  - `calculateChineseCharRatio(text: string): number`
  - Tái sử dụng regex ký tự Hán chuẩn Unicode đã có (`/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g`), TUYỆT ĐỐI KHÔNG cài thêm dependency bên ngoài (tuân thủ Principle II).
- **FR-005**: Hệ thống PHẢI kiểm tra kết quả trả về trong `rawController.ts` và `polishController.ts`. Nếu tỉ lệ ký tự Hán vượt quá ngưỡng cho phép (> 10% đối với văn bản từ 50 ký tự trở lên), hệ thống PHẢI ném lỗi `UNTRANSLATED_CHINESE_LEFTOVER`.
- **FR-006**: Hàm `isSafetyOrEmptyError` trong `server/services/geminiService.ts` PHẢI nhận diện lỗi `UNTRANSLATED_CHINESE_LEFTOVER` như một điều kiện kích hoạt chia nhỏ thích ứng (Adaptive Split Retry) tương tự như lỗi an toàn hoặc kết quả rỗng.
- **FR-007**: Các hàm xử lý chia nhỏ `translateRawWithContentSplit` và `polishWithContentSplit` PHẢI xử lý đúng vị trí tiêu đề: chỉ phân đoạn đầu tiên (chunk 0) chứa tiêu đề, các phân đoạn sau không chèn lặp tiêu đề chương.

---

### Key Entities

- **Tiêu đề chương (Chapter Title)**: Dòng đầu tiên khớp các định dạng tiêu đề chương tiêu chuẩn (`Chương X: ...`, `Hồi Y: ...`, `Chapter Z: ...`).
- **Tỉ lệ ký tự Hán (Chinese Character Ratio)**: Tỉ số giữa số lượng ký tự Hán Unicode và tổng số ký tự không khoảng trắng trong văn bản kết quả.
- **Lỗi chưa dịch (Untranslated Error)**: Lỗi nghiệp vụ khi AI trả về văn bản chứa tỉ lệ ký tự Hán vượt ngưỡng, kích hoạt cơ chế retry tự động.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: **100% Bảo toàn Tiêu đề**: 100% các chương có tiêu đề ở Giai đoạn 1 giữ nguyên tiêu đề đó trên dòng riêng biệt ở Giai đoạn 2 (kể cả khi chạy đơn lẻ, Divide & Conquer hoặc Segment Translation).
- **SC-002**: **0% Lọt lưới Văn bản Chưa Dịch**: 100% các trường hợp model AI nhại lại tiếng Trung hoặc trả về bản dịch có > 10% ký tự Hán được hệ thống phát hiện và kích hoạt chia nhỏ thử lại tự động, 0% kết quả lỗi bị trả thẳng cho người dùng.
- **SC-003**: **100% Test Coverage**: Toàn bộ các test cases mới và hiện có trong `server/utils/__tests__/text.test.ts` và `server/controllers/__tests__/translationController.test.ts` pass 100% mà không có bất kỳ test nào bị skip/xóa.
- **SC-004**: **0 Thư viện mới**: Hoàn thành toàn bộ tính năng bằng native Regex và cấu trúc hiện có theo đúng Principle II của Hiến pháp dự án.

---

## Assumptions

- Bản dịch thô (Phase 1) là nguồn chân lý (source of truth) cho tiêu đề chương đã được dịch sang tiếng Việt.
- Tỉ lệ ký tự Hán > 10% là dấu hiệu chắc chắn của việc chưa dịch hoặc dịch lỗi (vì bản dịch tiếng Việt thông thường có 0% chữ Hán, ngoại trừ một số rất ít trường hợp trích dẫn ngắn).
- Cơ chế Divide & Conquer chia nhỏ đoạn văn bản sẽ giúp mô hình tập trung hơn và dịch thành công các đoạn mà trước đó mô hình bị nhại tiếng Trung do quá tải context.
