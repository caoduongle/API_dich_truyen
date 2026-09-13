# Feature Specification: Mở Rộng Độ Sâu Đệ Quy Lên 4 Cấp, Phân Đôi Nhị Phân & Cô Lập Nhánh Lỗi (Binary Split Max Depth 4 & Isolated Sub-branch Recursion)

**Feature Branch**: `132-binary-split-max-depth-4`

**Created**: 2026-09-13

**Status**: Draft

**Input**: User description: "tôi muốn sửa lại tăng depth tối đa lên 4; depth = 0: Chia làm 2 phần.; depth =1 thì chia nhỏ mỗi phần trong 2 phần trước đó ra thành mỗi cái 2 phần nữa; tiếp tục làm tương tự cho đến khi thành công hoặc chạm max_depth; bỏ Tách văn bản thành từng dòng riêng biệt. Cải tiến thêm: ví dụ đã chia chương thành 4 phần; phần 1;2 thành công nhưng đến phần 3 thì gặp lỗi; khi đó chỉ thực hiện tiếp tục đệ quy với phần 3; còn các phần còn lại không bị lỗi thì giữ nguyên; đến cuối thì gộp vào"

---

## Bối Cảnh & Mục Tiêu (Context & Goals)

Trong quá trình dịch tự động tiểu thuyết Trung - Việt qua Gemini API, khi xử lý các đoạn văn dài hoặc gặp các đoạn văn dính kiểm duyệt an toàn, phản hồi rỗng, hoặc sót chữ Hán, hệ thống chia nhỏ văn bản để thử lại. Tuy nhiên cơ chế hiện tại còn một số bất cập:
1. **Giới hạn độ sâu quá nông**: Chỉ dừng ở `depth < 2`, bỏ lỡ cơ hội tự phục hồi khi chia nhỏ sâu hơn.
2. **Chiến lược phân đoạn không nhất quán**: Ở tầng 0 chia 2 phần nhưng ở tầng 1 lại chia 3 phần.
3. **Phân rã từng dòng (`Line-by-Line Fallback`) gây tắc nghẽn**: Khi chạm trần đệ quy, hệ thống cắt từng dòng đơn lẻ gửi hàng chục/hàng trăm request, làm cạn kiệt hạn mức RPM/TPM và đứt gãy ngữ cảnh văn phong.
4. **Nguy cơ lãng phí tài nguyên khi xử lý nhánh**: Khi một khối văn bản được chia thành nhiều phần con (ví dụ 4 phần), nếu phần 1 và 2 đã dịch thành công nhưng phần 3 gặp lỗi, hệ thống cần đảm bảo **chỉ cô lập và đệ quy riêng trên phần 3**, tuyệt đối không được dịch lại phần 1 và 2, đồng thời bảo toàn kết quả đã có để gộp lại theo đúng thứ tự ban đầu.

**Mục tiêu tính năng**:
- Tăng giới hạn độ sâu đệ quy tối đa lên **4 cấp** (`depth` từ 0 đến 3, dừng lại khi chạm trần `depth >= 4`).
- Chuẩn hóa chiến lược phân đoạn đệ quy thành **chia đôi nhị phân thuần túy (Pure Binary Split)** ở mọi cấp độ sâu: `depth = 0` chia làm 2 phần; `depth = 1` chia mỗi phần con bị lỗi thành 2 phần nhỏ hơn; tiếp tục chia đôi cho đến khi từng phần con dịch thành công hoặc chạm trần độ sâu 4.
- **Cô lập lỗi theo từng nhánh con độc lập (Isolated Sub-branch Recursion)**: Các phân đoạn con đã dịch thành công được chốt kết quả ngay lập tức; chỉ những phân đoạn con gặp lỗi mới tiếp tục chia đôi đệ quy sâu hơn.
- **Loại bỏ hoàn toàn** cơ chế phân rã dịch từng dòng riêng lẻ (`Line-by-Line Fallback`).
- Khi một phân đoạn con chạm trần độ sâu tối đa (`depth = 4`) mà vẫn không thể hoàn thành:
  - Ở Giai đoạn 1 (Dịch thô): Cứu nguy phân đoạn đó bằng cơ chế phiên âm Hán-Việt kết hợp từ điển trực tiếp trên phân đoạn, đảm bảo không sập chương.
  - Ở Giai đoạn 2 (Chuốt văn): Bảo toàn phân đoạn bằng chính bản dịch thô tương ứng đã có từ Giai đoạn 1 và đánh dấu hoàn thành một phần (`isPartial = true`).
- **Gộp kết quả tuần tự (In-order Assembly)**: Sau khi tất cả các nhánh con hoàn tất (thành công hoặc cứu nguy), hệ thống tự động gộp các kết quả lại theo đúng thứ tự gốc của chương.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tự động chia đôi đệ quy sâu đến 4 cấp và cô lập nhánh lỗi (Priority: P1) 🎯 MVP

Người dùng dịch một chương truyện. Khi một khối văn bản được chia thành các phần con (ví dụ 2 hoặc 4 phần con qua các tầng chia đôi):
- Phần con 1 và phần con 2 dịch thành công: Hệ thống chốt và lưu giữ kết quả của phần 1 và 2 ngay lập tức.
- Phần con 3 gặp lỗi (ví dụ sót chữ Hán hoặc cảnh báo an toàn): Hệ thống **chỉ thực hiện đệ quy chia đôi riêng phần 3** thành 2 phần nhỏ hơn ở cấp độ sâu tiếp theo (`depth + 1`), không gọi lại phần 1 hay phần 2.
- Phần con 4 dịch thành công: Hệ thống lưu giữ kết quả phần 4.
- Các phần con nhỏ hơn của phần 3 tiếp tục được xử lý độc lập cho đến khi thành công hoặc chạm trần độ sâu 4 (`depth = 4`).
- Cuối cùng, hệ thống gộp kết quả của toàn bộ các phần: `Phần 1` + `Phần 2` + `Kết quả con của Phần 3` + `Phần 4` theo đúng trật tự câu văn ban đầu.

**Why this priority**: Đây là giá trị cốt lõi: vừa tăng khả năng tự sửa lỗi với độ sâu 4 cấp, vừa tối ưu hóa tài nguyên (không dịch lại phần đã thành công), vừa bảo đảm tính toàn vẹn và trật tự của bản dịch.

**Independent Test**:
- Giả lập một văn bản gồm 4 đoạn, trong đó đoạn 3 được cài cắm nội dung gây lỗi dịch có thể thử lại.
- Xác nhận: Đoạn 1, 2, 4 chỉ được gửi API 1 lần duy nhất và thành công; chỉ có đoạn 3 tiếp tục bị chia đôi thành 2 đoạn con ở tầng đệ quy tiếp theo; kết quả cuối cùng chứa đầy đủ 4 đoạn theo đúng thứ tự.

**Acceptance Scenarios**:
1. **Given** một khối văn bản được chia thành các phần con, **When** một số phần con thành công và một phần con bị lỗi, **Then** hệ thống lưu giữ nguyên vẹn kết quả của các phần con thành công và chỉ kích hoạt đệ quy chia đôi đối với phần con bị lỗi.
2. **Given** phần con bị lỗi tiếp tục được chia đôi ở cấp độ sâu tiếp theo (`depth + 1`), **When** một trong hai nhánh con nhỏ hơn thành công và nhánh kia lỗi, **Then** nhánh thành công được chốt kết quả ngay và chỉ nhánh lỗi mới tiếp tục chia đôi nếu chưa chạm trần `depth = 4`.
3. **Given** tất cả các nhánh con đã hoàn thành (hoặc dịch thành công hoặc được cứu nguy ở trần độ sâu 4), **When** hoàn tất xử lý, **Then** hệ thống gộp kết quả của tất cả các nhánh con lại theo đúng vị trí và thứ tự ngữ nghĩa ban đầu của văn bản nguồn.
4. **Given** các phân đoạn đã dịch thành công, **When** hệ thống tiếp tục xử lý các phân đoạn lỗi khác, **Then** tuyệt đối không phát sinh thêm bất kỳ yêu cầu API nào đối với các phân đoạn đã thành công.

---

### User Story 2 - Loại bỏ phân rã từng dòng và cứu nguy phân đoạn tại trần độ sâu 4 (Priority: P2)

Người dùng gặp một phân đoạn chứa từ ngữ cực kỳ nhạy cảm khiến ngay cả khi chia đôi đến cấp độ sâu 4 (`depth = 4`) vẫn không thể vượt qua bộ lọc của mô hình. Hệ thống không tách phân đoạn đó thành từng dòng riêng lẻ để gửi hàng loạt request gây nghẽn hạn mức API, mà thực hiện cứu nguy trực tiếp trên phân đoạn đó (phiên âm Hán-Việt kết hợp từ điển ở bản thô; giữ nguyên bản thô ở bản chuốt), sau đó ghép nối liền mạch với các phân đoạn thành công khác để hoàn tất chương.

**Why this priority**: Ngăn ngừa nghẽn hạn mức API (RPM/TPM), bảo vệ tính ổn định của hệ thống và loại bỏ hoàn toàn cơ chế dịch từng dòng kém hiệu quả.

**Independent Test**:
- Tạo một phân đoạn luôn gây lỗi an toàn qua cả 4 cấp chia đôi.
- Kiểm tra hệ thống không thực hiện tách từng dòng (`text.split(/\n/)`) để gửi request, mà áp dụng cứu nguy phân đoạn trực tiếp tại nhánh chạm trần và gộp vào bản dịch chung.

**Acceptance Scenarios**:
1. **Given** một phân đoạn con chạm trần độ sâu 4 (`depth = 4`) trong Giai đoạn Dịch thô, **When** không thể chia đôi thêm, **Then** hệ thống không phân rã thành từng dòng đơn lẻ, mà kích hoạt cứu nguy trực tiếp bằng phiên âm Hán-Việt kết hợp từ điển cho phân đoạn đó.
2. **Given** một phân đoạn con chạm trần độ sâu 4 (`depth = 4`) trong Giai đoạn Chuốt văn phong, **When** không thể hoàn thành chuốt, **Then** hệ thống giữ nguyên bản dịch thô tương ứng của phân đoạn đó và đánh dấu cờ hoàn thành một phần (`isPartial = true`).
3. **Given** phân đoạn được cứu nguy ở trần độ sâu 4, **When** gộp bản dịch, **Then** phân đoạn cứu nguy nằm đúng vị trí ban đầu giữa các phân đoạn đã dịch thành công khác mà không làm lệch cấu trúc chương.

---

### User Story 3 - Giám sát tiến trình đệ quy nhị phân theo thời gian thực (Priority: P3)

Người dùng theo dõi tiến trình dịch trên giao diện. Khi hệ thống kích hoạt cơ chế chia đôi trên một nhánh cụ thể, sự kiện tiến trình hiển thị rõ ràng thông tin: nhánh đang xử lý, độ sâu hiện tại trên thang đo 4 cấp, và số lượng nhánh con đã hoàn thành.

**Why this priority**: Cung cấp khả năng quan sát minh bạch, giúp người dùng nắm rõ nhánh nào đang được tự phục hồi.

**Independent Test**:
- Chạy dịch một chương có kích hoạt đệ quy và theo dõi sự kiện qua callback `onSplitRetry`.

**Acceptance Scenarios**:
1. **Given** một nhánh con đang được chia đôi đệ quy ở cấp độ sâu `depth = K` (K từ 0 đến 3), **When** phát sự kiện thử lại, **Then** thông tin gửi kèm phản ánh chính xác cấp độ sâu thực tế, tỷ lệ chia đôi (`partsCount = 2`) và lý do thử lại.

---

### Edge Cases

- **Phân đoạn lỗi quá ngắn không thể chia đôi**: Nếu một phân đoạn bị lỗi ở độ sâu bất kỳ nhưng quá ngắn (dưới 60 token hoặc chỉ gồm 1 câu duy nhất) không thể cắt đôi được nữa -> Hệ thống xem như đã đạt giới hạn chia nhỏ và chuyển thẳng sang cơ chế cứu nguy phân đoạn, không chia rỗng hay lặp vô hạn.
- **Tiền phân đoạn văn bản dài (> 2000 token)**: Khi văn bản ban đầu vượt quá 2000 token, hệ thống tiền phân đoạn chia đôi với `depth = 0, isPreSplit = true`. Mỗi nửa văn bản được xử lý độc lập và có đầy đủ 4 cấp độ sâu thử lại nếu phát sinh lỗi.
- **Nhiều nhánh con cùng lỗi**: Nếu cả 2 nhánh con của một nút đều gặp lỗi, mỗi nhánh được chia đôi và đệ quy hoàn toàn độc lập, nhánh nào xong trước thì giữ kết quả trước.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI hỗ trợ độ sâu phân đoạn đệ quy tối đa lên đến 4 cấp (`max_depth = 4`, tương ứng các cấp độ sâu từ 0 đến 3, dừng lại khi `depth >= 4`).
- **FR-002**: Ở MỌI cấp độ sâu đệ quy (`depth = 0, 1, 2, 3`), hệ thống PHẢI áp dụng chiến lược phân đoạn nhị phân thuần túy (chia đôi làm 2 phần con: `partsCount = 2`), loại bỏ hoàn toàn cơ chế chia 3 phần ở các cấp độ sâu sau cấp 0.
- **FR-003**: Hệ thống PHẢI thực hiện **cô lập lỗi theo từng nhánh con độc lập**. Khi một phân đoạn con gặp lỗi có thể thử lại, CHỈ phân đoạn con đó mới tiếp tục kích hoạt đệ quy chia đôi sâu hơn. Mọi phân đoạn con khác đã xử lý thành công PHẢI được bảo toàn nguyên vẹn và KHÔNG được gọi dịch lại.
- **FR-004**: Hệ thống PHẢI loại bỏ hoàn toàn cơ chế phân rã dịch từng dòng đơn lẻ (`Line-by-Line Fallback`) tại Giai đoạn 1 (Dịch thô).
- **FR-005**: Khi một phân đoạn con trong Giai đoạn 1 chạm trần độ sâu tối đa (`depth >= 4`) hoặc không thể tiếp tục chia đôi, hệ thống PHẢI kích hoạt cứu nguy phân đoạn trực tiếp bằng phiên âm Hán-Việt kết hợp từ điển cho toàn bộ phân đoạn đó để đảm bảo không sập chương và không mất chữ.
- **FR-006**: Khi một phân đoạn con trong Giai đoạn 2 (Chuốt văn phong) chạm trần độ sâu tối đa (`depth >= 4`) hoặc không thể tiếp tục chia đôi, hệ thống PHẢI giữ nguyên bản dịch thô tương ứng của phân đoạn đó và đánh dấu trạng thái hoàn thành một phần (`isPartial = true`).
- **FR-007**: Hệ thống PHẢI gộp kết quả của tất cả các phân đoạn con (dù hoàn thành ở độ sâu khác nhau hay qua cứu nguy) theo đúng trật tự và vị trí ban đầu của văn bản nguồn.
- **FR-008**: Hệ thống PHẢI duy trì cơ chế luân phiên đổi khóa API giữa các phân đoạn con để phân tán tải và tránh giới hạn tốc độ (rate limit).
- **FR-009**: Sự kiện giám sát tiến trình phân đoạn (`onSplitRetry`) PHẢI phản ánh chính xác cấu trúc chia đôi và thang đo độ sâu tối đa 4 cấp.

---

### Key Entities

- **Cây Phân Đoạn Nhị Phân (Binary Chunk Node)**: Đại diện cho một nút trong cây chia nhỏ văn bản, chứa nội dung nguồn, độ sâu (`retryDepth`: 0 đến 4), thứ tự vị trí (`chunkIndex`), trạng thái (`PENDING`, `SUCCESS`, `RESCUED`), và kết quả dịch đã hoàn thành.
- **Sự Kiện Cứu Nguy Phân Đoạn (Split Retry Event)**: Gồm giai đoạn dịch (`raw` hoặc `polish`), độ sâu hiện tại (`depth`: 0 đến 3), số phần chia luôn bằng 2 (`partsCount = 2`), lý do thử lại và tầng xử lý (`split` hoặc `rescue`).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 0% số lượng yêu cầu API bị lãng phí cho việc dịch lại các phân đoạn con đã thành công trước đó trong cùng một phiên dịch chương (tính cô lập nhánh đạt 100%).
- **SC-002**: Giảm 100% các yêu cầu API phát sinh từ cơ chế dịch từng dòng đơn lẻ (0 lệnh gọi API đơn dòng nào được thực thi khi chạm trần phân đoạn).
- **SC-003**: 100% các phân đoạn gặp lỗi có thể phục hồi (chữ Hán sót, bộ lọc an toàn cục bộ) đều được thử lại tối đa 4 cấp chia đôi trước khi kích hoạt cứu nguy.
- **SC-004**: 100% văn bản đầu ra bảo toàn đúng trật tự vị trí đoạn văn so với văn bản nguồn ban đầu, không bị đảo lộn hay mất đoạn.
- **SC-005**: Tỷ lệ hoàn thành chương không bị sập đạt 100% đối với các lỗi an toàn hoặc sót chữ Hán cục bộ.

---

## Assumptions

- **Thuật toán phân đoạn nhị phân**: Hàm `splitTextAdaptively` với `partsCount = 2` được dùng ở mọi cấp độ sâu để chia đôi khối văn bản theo các ranh giới tự nhiên (đoạn văn kép `\n\n`, dòng đơn `\n`, hoặc dấu câu).
- **Bảo tồn thứ tự phân đoạn**: Khi một phân đoạn cha được chia thành 2 phần con (trái và phải), kết quả của phần con trái luôn đứng trước phần con phải trong chuỗi văn bản gộp cuối cùng.
- **Cứu nguy trực tiếp tại chỗ**: Phiên âm Hán-Việt kết hợp từ điển trực tiếp trên phân đoạn con ở độ sâu 4 thay thế hoàn toàn cho bước phân rã từng dòng, vừa nhanh hơn vừa không làm phát sinh request API.
