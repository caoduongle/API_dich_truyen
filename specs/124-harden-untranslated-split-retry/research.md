# Research: Gia cố cơ chế phân đoạn cứu nguy và chống sót chữ Hán cho Flash-Lite

**Feature**: `124-harden-untranslated-split-retry`  
**Date**: 2026-09-12  
**Status**: Completed

## 1. Phân tích nguyên nhân thực tế từ sự cố Runtime

Dựa trên log thực tế của người dùng:
```text
Xử lý [1/1]: 第一卷 — 恐怖广播 | Key xoay vòng: #2
[Cứu nguy GĐ1] Phát hiện sự cố (Bản dịch sót nhiều chữ Hán). Tự động kích hoạt phân đoạn thích ứng cấp 2 (chia 3 phần) để dịch lại...
Lỗi xử lý chương "第一卷 — 恐怖广播": UNTRANSLATED_CHINESE_LEFTOVER: Bản dịch chứa tỉ lệ chữ Hán bất thường (28.2% > 10%), nghi ngờ AI chưa dịch.
Bỏ qua chương "第一卷 — 恐怖广播" lỗi và tiếp tục...
```

Hệ thống đã chỉ ra 3 nguyên nhân cốt lõi:

1. **Phân đoạn độ dài (> 2000 token) tiêu hao độ sâu đệ quy**:
   Trong `rawWithContentSplitDirect`, khối văn bản dài (> 2000 token) được chia đôi ban đầu và gọi đệ quy với `depth + 1` (khiến `depth = 1`). Khi đoạn con này gặp lỗi sót chữ Hán, hệ thống chia 3 phần và gọi với `depth + 1` (thành `depth = 2`). Khi một mảnh con ở `depth = 2` tiếp tục vi phạm, điều kiện `if (depth >= 2) throw error` lập tức ném lỗi ra ngoài và làm sập toàn bộ chương truyện.
2. **Thiếu chỉ thị tăng cường chống chữ Hán khi retry**:
   Các mô hình gọn nhẹ (Flash-Lite) khi dịch văn bản có ngữ cảnh dài hoặc có nhiều từ điển thường có xu hướng sao chép lại chữ Hán. Khi thử lại cứu nguy, hệ thống chưa bổ sung chỉ thị cảnh báo nghiêm ngặt về ngôn ngữ đích.
3. **Prompt bị trùng lặp ngữ cảnh khi dùng văn bản quét từ điển**:
   Khi bật `hasProcessedText`, văn bản đã chứa sẵn các tag `[Tên_Việt]`. Hàm `buildRawTranslationPayload` lại tiếp tục thay thế và nhồi nhét cả 2 bản `VĂN BẢN TIẾNG TRUNG GỐC` và `VĂN BẢN ĐÃ ĐÁNH DẤU TỪ ĐIỂN`, làm tăng gấp đôi độ dài prompt và khiến Flash-Lite dễ nhại lại chữ Hán.
4. **Cơ chế ném lỗi All-or-Nothing làm mất toàn bộ tiến trình chương**:
   Chỉ vì một mảnh con nhỏ (ví dụ 1 đoạn văn khó) bị sót chữ Hán, toàn bộ các mảnh con khác của chương đã dịch thành công bị ném bỏ, dẫn đến chương bị đánh dấu bỏ qua (`skipFailedChapters`).

---

## 2. Quyết định Kỹ thuật (Technical Decisions)

### Decision 1: Tách biệt bộ đếm phân đoạn độ dài và bộ đếm thử lại lỗi (`retryDepth`)

- **Decision**: Trong `rawWithContentSplitDirect`, việc phân đoạn ban đầu theo độ dài token (`estimateTokenCount(text) > 2000`) gọi các phân đoạn con với `retryDepth = 0`.
- **Rationale**: Phân đoạn độ dài là tối ưu hóa dung lượng token bình thường, không phải là lỗi. Việc giữ `retryDepth = 0` đảm bảo mỗi phân đoạn con luôn được hưởng trọn vẹn 2 cấp thử lại cứu nguy độc lập khi phát sinh lỗi.
- **Alternatives considered**: Tăng max depth lên 4; bị từ chối vì có thể gây bùng nổ đệ quy không kiểm soát nếu gặp lỗi thực sự.

---

### Decision 2: Tự động gia cố chỉ thị chống nhại chữ Hán (Prompt Reinforcement Directive)

- **Decision**: Khi gọi dịch lại cứu nguy (`isRetry: true`), tự động bổ sung chỉ thị nghiêm khắc vào `systemInstruction`:
  `"⚠️ CẢNH BÁO: Lượt dịch trước bị lỗi do để sót chữ Hán. BẮT BUỘC PHẢI DỊCH 100% SANG TIẾNG VIỆT HOẶC PHIÊN ÂM HÁN-VIỆT. TUYỆT ĐỐI KHÔNG COPY NGUYÊN VĂN BẤT KỲ CÂU TỪ CHỮ HÁN NÀO."`
- **Rationale**: Flash-Lite tuân thủ chỉ thị tốt hơn đáng kể khi có cảnh báo rõ ràng và cụ thể về lỗi đã xảy ra ở lượt gọi trước.
- **Alternatives considered**: Tăng nhiệt độ (temperature); bị từ chối vì nhiệt độ cao làm mô hình dễ bịa đặt (hallucinate).

---

### Decision 3: Cứu nguy phân cấp đa tầng (Multi-tier Graceful Fallback)

- **Decision**: Thiết lập quy trình cứu nguy 3 tầng cho GĐ1:
  - **Tier 1 (Adaptive Split)**: Chia nhỏ thích ứng đệ quy kèm prompt gia cố (tối đa 2 cấp).
  - **Tier 2 (Line-by-Line Fallback)**: Nếu một mảnh con vẫn không đạt sau 2 cấp chia nhỏ, tự động chuyển mảnh con đó sang chế độ `enableSegmentTranslation: true` để dịch từng dòng/câu độc lập.
  - **Tier 3 (Sino-Vietnamese Character Fallback)**: Nếu một dòng vẫn chứa chữ Hán sót lại sau khi dịch dòng, thay thế các chữ Hán đó bằng phiên âm Hán-Việt hoặc bản dịch từ điển tương ứng và gắn cờ cảnh báo chẩn đoán thay vì làm sập toàn bộ chương.
- **Rationale**: Đảm bảo 100% không bao giờ bỏ qua một chương truyện 2000-4000 từ chỉ vì một câu ngắn bị AI nhại chữ Hán.
- **Alternatives considered**: Lưu chữ Hán nguyên tác; bị từ chối vì vi phạm tiêu chuẩn chất lượng bản dịch.

---

### Decision 4: Chuẩn hóa payload khi sử dụng văn bản đã quét từ điển

- **Decision**: Trong `buildRawTranslationPayload`, nếu văn bản đầu vào đã chứa các nhãn từ điển `[...]`, không lặp lại việc chèn hai lần văn bản gốc và văn bản đánh dấu, mà gom thành một khối văn bản duy nhất để giảm tải token và tránh nhầm lẫn cho mô hình.
- **Rationale**: Giảm độ dài prompt khoảng 30-40%, giúp Flash-Lite tập trung toàn bộ context window vào việc dịch nghĩa.
