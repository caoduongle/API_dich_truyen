# Research & Technical Decisions: Binary Split Max Depth 4 & Isolated Sub-branch Recursion

**Feature Branch**: `132-binary-split-max-depth-4`  
**Date**: 2026-09-13  
**Spec**: [spec.md](./spec.md)

---

## Decision 1: Kiến trúc chia đôi nhị phân thuần túy (Pure Binary Split) đến độ sâu tối đa 4

### Decision
Hệ thống chuẩn hóa toàn bộ các cấp độ sâu thử lại sang cơ chế **chia đôi nhị phân** (`partsCount = 2` tại mọi cấp `depth = 0, 1, 2, 3`):
- `depth = 0`: Khi khối văn bản ban đầu gặp lỗi có thể thử lại (`isAdaptiveSplitRetryableError`), chia thành 2 phần con bằng `splitTextAdaptively(text, 2)`.
- `depth = 1, 2, 3`: Nếu một phần con gặp lỗi, chỉ phần con đó được chia đôi tiếp thành 2 phần nhỏ hơn bằng `splitTextAdaptively(subText, 2)` với `depth + 1`.
- `depth >= 4`: Chạm trần độ sâu tối đa, dừng phân đoạn và chuyển sang cơ chế cứu nguy trực tiếp.

### Rationale
- Việc chia 3 phần ở `depth = 1` như trước đây làm tăng số lượng nhánh con đột ngột, gây khó khăn cho việc cân bằng token và ngữ cảnh ngữ nghĩa.
- Chia đôi nhị phân tạo ra cây phân đoạn nhị phân cân đối (Binary Chunk Tree), dễ dàng cô lập phạm vi lỗi và giới hạn kích thước phân đoạn theo hàm mũ cơ số 2 ($1 \rightarrow 2 \rightarrow 4 \rightarrow 8 \rightarrow 16$).
- Độ sâu tối đa 4 cấp ($2^4 = 16$ mảnh ở kịch bản biên xấu nhất) cho phép bẻ nhỏ một chương 3.000 từ xuống các mảnh ~180-200 từ, đủ nhỏ để vượt qua mọi bộ lọc an toàn cục bộ mà không cần phải xé nhỏ đến từng câu.

### Alternatives considered
- **Giữ chia 3 phần khi depth >= 1**: Bị từ chối vì không đáp ứng yêu cầu người dùng và gây bùng nổ request nhanh hơn ($1 \rightarrow 2 \rightarrow 6 \rightarrow 18$).
- **Tăng độ sâu lên 6-8**: Bị từ chối vì có thể tiêu tốn quota API quá mức nếu gặp văn bản lỗi toàn diện.

---

## Decision 2: Cô lập lỗi theo từng nhánh con & Ghép nối bảo toàn trật tự (Isolated Sub-branch Recursion & In-order Assembly)

### Decision
- Khi một phân đoạn được chia thành 2 phần con `[chunkLeft, chunkRight]`:
  - `chunkLeft` được xử lý trước. Nếu thành công, kết quả được lưu trữ ngay vào mảng kết quả cục bộ `results[0]`.
  - `chunkRight` được xử lý sau. Nếu `chunkRight` thất bại, chỉ `chunkRight` mới kích hoạt gọi đệ quy `rawWithContentSplitDirect(chunkRight, retryDepth + 1)`.
  - `chunkLeft` tuyệt đối không bị gọi lại hay bị phân đoạn lại.
  - Tương tự, nếu `chunkLeft` lỗi và `chunkRight` thành công, `chunkRight` giữ nguyên và chỉ `chunkLeft` đệ quy.
- Kết quả cuối cùng là phép nối tuần tự: `results.join('\n\n')`, bảo đảm trật tự 100% khớp với cấu trúc đoạn văn bản nguồn.

### Rationale
- Tiết kiệm 100% chi phí token cho các đoạn đã dịch thành công, ngăn ngừa tình trạng dịch lại làm thay đổi văn phong hoặc gây lỗi mới trên đoạn vốn dĩ đã tốt.
- Xử lý tuần tự giữa các nhánh con trong GĐ1 (Dịch thô) giúp luân phiên API key hiệu quả (`staggeredKey`) và dễ kiểm soát luồng bộ nhớ. Trong GĐ2 (Chuốt văn), có thể xử lý song song từng cặp hoặc tuần tự có bảo vệ.

### Alternatives considered
- **Bắt đầu lại cả khối cha khi một mảnh con lỗi**: Bị loại bỏ vì lãng phí tài nguyên và vi phạm yêu cầu trực tiếp của người dùng.

---

## Decision 3: Loại bỏ hoàn toàn phân rã từng dòng (Line-by-Line Fallback) & Cứu nguy phân đoạn trực tiếp

### Decision
- Xóa bỏ hoàn toàn Tier 2 (Line-by-Line Fallback): không còn vòng lặp `text.split(/\r?\n/)` gửi API từng dòng khi chạm trần phân đoạn.
- Khi một phân đoạn con chạm trần độ sâu `retryDepth >= 4` hoặc không thể chia đôi thêm (`chunks.length <= 1`):
  - **Giai đoạn 1 (Dịch thô)**: Kích hoạt cứu nguy trực tiếp bằng hàm phiên âm Hán-Việt kết hợp từ điển `fallbackSinoVietnameseLine(text, params.glossary)` cho toàn bộ phân đoạn đó.
  - **Giai đoạn 2 (Chuốt văn phong)**: Trả về chính bản dịch thô tương ứng `rawTranslation` của phân đoạn đó kèm cờ `isPartial: true`.
- Sự kiện `onSplitRetry` chỉ còn 2 tầng: `split` (cho các cấp đệ quy 0 -> 3) và `sino-fallback` (khi cứu nguy ở trần độ sâu 4 hoặc không thể chia nhỏ). Loại bỏ `tier: 'line-by-line'`.

### Rationale
- Dịch từng dòng gây bùng nổ request API (hàng chục dòng = hàng chục request nối tiếp), dễ làm chạm trần RPM và kéo dài thời gian dịch lên gấp nhiều lần.
- Với 4 cấp chia đôi, kích thước phân đoạn đã rất nhỏ (~1-2 đoạn văn). Nếu ở độ sâu này mô hình AI vẫn từ chối do kiểm duyệt từ ngữ, thì dịch từng dòng cũng sẽ tiếp tục gặp lỗi ở các dòng chứa từ đó. Việc chuyển thẳng sang cứu nguy Hán-Việt giúp xử lý tức thì trong 0ms, không tiêu tốn thêm bất kỳ quota API nào và loại bỏ 100% nguy cơ sập chương.

### Alternatives considered
- **Ném exception làm sập chương**: Bị từ chối vì vi phạm nguyên tắc bảo vệ trải nghiệm người dùng và tính toàn vẹn của chương truyện.
- **Bỏ qua phân đoạn lỗi**: Bị từ chối vì làm cụt mất nội dung truyện của độc giả.

---

## Decision 4: Đồng bộ hóa Giai đoạn 2 (Chuốt văn phong) theo mô hình nhị phân 4 cấp

### Decision
Hàm `polishWithContentSplitDirect` trong GĐ2 cũng được nâng cấp tương thích:
- Nâng trần độ sâu từ `depth >= 2` lên `depth >= 4`.
- Sử dụng chia đôi `partsCount = 2` ở mọi cấp (thay cho `partsCount = depth >= 1 ? 3 : 2`).
- Chia đồng bộ cả `sourceText` và `rawTranslation` thành 2 phần tương ứng bằng `splitTextAdaptively(..., 2)`.
- Khi chạm trần `depth >= 4`, fallback an toàn giữ nguyên `rawTranslation` tương ứng và đánh dấu `isPartial: true`.

### Rationale
Đảm bảo tính nhất quán về kiến trúc giữa Giai đoạn 1 và Giai đoạn 2, giúp hệ thống dễ bảo trì và có hành vi dự đoán được.
