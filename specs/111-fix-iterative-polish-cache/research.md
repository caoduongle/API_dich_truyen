# Research & Technical Decisions: Fix Iterative Polish Cache Bypass

**Feature**: `111-fix-iterative-polish-cache`  
**Date**: 2026-09-12

## 1. Vấn đề cốt lõi & Cơ chế phát sinh "Cache giả"

### Bối cảnh
Khi người dùng kích hoạt chuỗi lặp (chọn 2→5 vòng chuốt văn học hoặc 2→3 vòng rà soát thuật ngữ), hệ thống dường như "lấy cache từ lần đầu chạy rồi coi như đã thực hiện".

### Khảo sát mã nguồn thực tế
1. **Dự án thuần Client-side (Zero-backend)**: Toàn bộ tầng server cache (Redis/LRU) từ các spec cũ (004, 026) đã bị dọn dẹp hoàn toàn trong Spec 110. Phía client không hề có cờ cache cho kết quả dịch.
2. **Nguyên nhân 1 - Chuốt văn học (Polish Translation Loops)**:
   - Trong `buildPolishTranslationPayload` (`src/services/ai/prompts.ts`):
     - Không truyền thông tin vòng lặp (`cycleIndex`, `totalCycles`).
     - Tiêu đề trong prompt luôn cứng nhắc là `[BẢN DỊCH THÔ GIAI ĐOẠN 1]`, ngay cả khi đang là vòng 2, 3, 4, 5.
     - System prompt là generic và giống nhau cho mọi vòng.
     - `temperature` trong `polishTranslationDirect` cố định ở `0.45`.
   - Kết quả: Khi vòng 1 đã cho ra một bản dịch tương đối mượt, đầu vào của vòng 2 gần giống vòng 1, prompt giống hệt, temperature thấp (0.45) → Google Gemini sinh ra output hầu như trùng khớp hoặc Gemini API server-side reuse response → người dùng cảm giác như bị dính cache.
   - Thiếu cơ chế phát hiện hội tụ (Convergence Detection): Dù bản dịch không còn thay đổi, hệ thống vẫn tiêu tốn token gọi tiếp các vòng sau.
3. **Nguyên nhân 2 - Rà soát thuật ngữ (Glossary Scan Loops)**:
   - Trong `useGlossaryScan.ts` (`for (let loop = 1; loop <= extractionLoops; loop++)`):
     - Lệnh gọi `analyzeGlossaryDirect` gửi chính xác `text: ${chap.title}\n\n${chap.sourceText}` với `temperature: 0.2` trong mọi vòng lặp.
     - Không hề truyền danh sách thuật ngữ đã tìm thấy từ vòng trước (`excludedTerms` / `knownTerms`).
     - Gemini nhận prompt giống 100%, temperature 0.2 siêu thấp → trả về chính xác danh sách thuật ngữ cũ.
     - Code client lọc trùng: tất cả đều đã tồn tại trong `updatedGlossary` → **0 thuật ngữ mới được phát hiện ở vòng 2 và 3**.
4. **Nguyên nhân 3 - Biên tập thủ công đơn chương (`handlePolishTranslation`)**:
   - Trong `useWorkspaceState.ts` (dòng 642): Nút "Chuốt văn thuần Việt" luôn gửi `rawTranslation: rawTranslation` thay vì cho phép chuốt tiếp trên bản `polishedTranslation` hiện tại nếu người dùng bấm chuốt lần 2.

---

## 2. Quyết định kỹ thuật (Technical Decisions)

### Quyết định 1: Chiến lược chuốt văn phân tầng theo vòng lặp (Tiered Polish Strategy)
- **Decision**: Thiết kế 5 cấp độ biên tập tương ứng với từng vòng lặp `roundIndex` (1 đến 5) kết hợp điều chỉnh dynamic temperature:
  - **Vòng 1 (Cơ bản - Structural & Grammar)**:
    - Trọng tâm: Sửa lỗi ngữ pháp, loại bỏ câu dịch máy thô cứng, đảm bảo đủ ý 100% so với bản gốc tiếng Trung, tuân thủ thuật ngữ và đại từ nhân xưng.
    - Temperature: `0.40`.
    - Nhãn ngữ cảnh: `[BẢN DỊCH THÔ BAN ĐẦU]`.
  - **Vòng 2 (Nâng cao - Fluency & Rhythm)**:
    - Trọng tâm: Tinh chỉnh nhịp điệu câu văn, thay thế các từ ngữ Hán-Việt gượng gạo bằng từ thuần Việt giàu hình ảnh, gọt giũa nhạc tính và cảm xúc câu chữ.
    - Temperature: `0.50`.
    - Nhãn ngữ cảnh: `[BẢN DỊCH ĐÃ BIÊN TẬP LƯỢT 1]`.
  - **Vòng 3 (Sâu sắc - Character Voice & Atmospheric Tone)**:
    - Trọng tâm: Khắc họa rõ nét khẩu khí nhân vật (lời thoại phù hợp tính cách/địa vị), tăng tính biểu cảm theo tông giọng truyện (tiên hiệp cổ phong / hiện đại hài hước / bi tráng...).
    - Temperature: `0.55`.
    - Nhãn ngữ cảnh: `[BẢN DỊCH ĐÃ BIÊN TẬP LƯỢT 2]`.
  - **Vòng 4 (Trau chuốt - Micro-consistency & Word Variety)**:
    - Trọng tâm: Khử triệt để các từ lặp lại trong phạm vi gần, hoàn thiện liên kết giữa các đoạn văn, làm sắc sảo các phân đoạn cao trào hành động/nội tâm.
    - Temperature: `0.60`.
    - Nhãn ngữ cảnh: `[BẢN DỊCH ĐÃ BIÊN TẬP LƯỢT 3]`.
  - **Vòng 5 (Xuất bản - Master Polish & Editorial Polish)**:
    - Trọng tâm: Đọc duyệt toàn diện như một tác phẩm văn học hoàn chỉnh xuất bản, tự nhiên như văn bản sáng tác thuần Việt nhưng bảo tồn tuyệt đối 100% chi tiết nguyên tác.
    - Temperature: `0.65`.
    - Nhãn ngữ cảnh: `[BẢN DỊCH ĐÃ BIÊN TẬP LƯỢT 4]`.
- **Rationale**: Mỗi vòng gửi một chỉ thị biên tập khác biệt và nhãn đầu vào khác biệt, kèm temperature tăng dần có kiểm soát (0.40 → 0.65). Điều này triệt tiêu hoàn toàn khả năng Gemini API trả về kết quả giống vòng trước, đồng thời thực sự mang lại giá trị gia tăng sau mỗi vòng lặp.
- **Alternatives considered**:
  - *Chỉ tăng temperature mà giữ nguyên prompt*: Vẫn có thể bị lặp ý hoặc Gemini tự biến tấu lung tung không theo định hướng biên tập.
  - *Chỉ thêm random seed/nonce vào prompt*: Tránh được cache nhưng không giúp bản dịch tốt hơn theo từng vòng.

---

### Quyết định 2: Thuật toán phát hiện hội tụ (Convergence Detection)
- **Decision**: Xây dựng hàm `calculateTextSimilarity(prevText: string, newText: string): { similarity: number; changedWords: number; isConverged: boolean }` sử dụng hệ số Dice trên word-level bigrams trong `src/lib/text.ts`.
  - Ngưỡng hội tụ: `CONVERGENCE_THRESHOLD = 0.96` (96% tương đồng ngữ nghĩa và câu chữ).
  - Khi `similarity >= 0.96` ở vòng $j \ge 2$:
    - Dừng chu trình chuốt sớm.
    - Ghi log thông báo: `[Hội tụ] Bản dịch đã đạt độ hoàn thiện tối ưu tại Lượt ${j}/${totalRounds} (Độ tương đồng ${(similarity * 100).toFixed(1)}%). Tự động dừng sớm để tiết kiệm hạn mức API.`
    - Giữ lại bản dịch tốt hơn hoặc mới nhất.
- **Rationale**:
  - Bigram Dice coefficient trên mảng từ tiếng Việt chạy với độ phức tạp $O(N + M)$, thời gian tính toán < 2ms cho văn bản 5000 chữ, không phụ thuộc thư viện ngoài.
  - Tiết kiệm token và thời gian chờ đợi cho người dùng khi bản dịch đã đạt điểm bão hòa.
- **Alternatives considered**:
  - *Levenshtein Distance trên ký tự*: Quá chậm cho văn bản 15.000 ký tự ($O(N \times M) \approx 2.25 \times 10^8$ phép tính, gây giật UI main thread).
  - *Chỉ so sánh `prevText === newText`*: Quá lỏng lẻo; nếu AI chỉ đổi 1 dấu chấm phẩy thì similarity 99.9% nhưng vẫn bị coi là chưa hội tụ.

---

### Quyết định 3: Khử mù lặp trong Quét thuật ngữ (Progressive Exclusion in Glossary Scan)
- **Decision**:
  - Nâng cấp `analyzeGlossaryDirect` và `buildAnalyzeGlossaryPayload` để tiếp nhận tham số tùy chọn:
    - `knownTerms?: string[]`: Danh sách các từ tiếng Trung đã phát hiện hoặc đã có trong từ điển.
    - `loopIndex?: number`: Vòng quét hiện tại (1..N).
    - `totalLoops?: number`: Tổng số vòng quét.
  - Trong prompt phân tích:
    - Khi `loopIndex > 1` và có `knownTerms`: Bổ sung danh sách các từ đã biết vào mục `[CÁC THUẬT NGỮ ĐÃ CÓ / ĐÃ QUÉT ĐƯỢC - BỎ QUA KHÔNG TRÍCH XUẤT LẠI]`.
    - Hướng dẫn AI: `Đây là lượt rà soát thứ ${loopIndex}/${totalLoops}. Bỏ qua các từ đã liệt kê ở trên, hãy tập trung tìm kiếm các danh từ riêng, biệt danh, địa danh phụ, hoặc chiêu thức ẩn bị bỏ sót trong văn bản gốc.`
    - Nâng nhẹ temperature từ `0.2` ở vòng 1 lên `0.35` ở vòng 2 và `0.45` ở vòng 3 để mở rộng khả năng nhận diện các thực thể ít phổ biến.
- **Rationale**: AI có bối cảnh loại trừ rõ ràng nên bắt buộc phải quét sâu hơn tìm các thực thể bị sót, thay vì trả lại danh sách 10 thực thể phổ biến nhất ở đầu chương.
- **Alternatives considered**:
  - *Chỉ chạy 1 vòng quét duy nhất*: Người dùng có nhu cầu quét kỹ nhiều lượt với tiểu thuyết đồ sộ nhiều nhân vật phụ.
  - *Dùng LLM khác nhau cho mỗi vòng*: Tăng phức tạp cấu hình, người dùng có thể chỉ có 1 API key hoặc 1 model được cấp quyền.

---

### Quyết định 4: Hỗ trợ tái chuốt trong Biên tập đơn chương (`handlePolishTranslation`)
- **Decision**:
  - Trong `useWorkspaceState.ts`, nếu `polishedTranslation` đã có nội dung hợp lệ:
    - Cho phép chuốt tiếp dựa trên `polishedTranslation` hiện tại (thay vì luôn quay về `rawTranslation`).
    - Gửi `roundIndex: 2` (hoặc tính số lần đã chuốt) và nhãn phù hợp.
    - Thêm thông báo toast/log rõ ràng: "Đang chuốt tiếp trên bản dịch hiện tại..."
- **Rationale**: Khắc phục trực tiếp trải nghiệm người dùng khi làm việc trên trình soạn thảo song ngữ.

---

## 3. Tóm tắt ma trận thay đổi (Change Matrix)

| Module / Tệp | Thành phần thay đổi | Mục đích |
|---|---|---|
| `src/lib/text.ts` | Thêm `calculateTextSimilarity`, `getPolishStrategyForRound` | Hàm tính tương đồng Dice bigram và định nghĩa 5 tầng chiến lược chuốt |
| `src/services/ai/prompts.ts` | Cập nhật `buildPolishTranslationPayload`, `buildAnalyzeGlossaryPayload` | Nhúng vòng lặp, nhãn đầu vào động, chỉ thị phân tầng, danh sách loại trừ |
| `src/services/directTranslationEngine.ts` | Cập nhật `polishTranslationDirect` | Nhận `roundIndex`, `totalRounds`, `temperature` động theo chiến lược |
| `src/services/chapterTranslationService.ts` | Cập nhật vòng lặp `executeSingleChapterTranslation` | Tích hợp kiểm tra hội tụ, truyền round info, ghi log chi tiết % diff |
| `src/services/directGlossaryEngine.ts` | Cập nhật `analyzeGlossaryDirect` | Nhận `knownTerms`, `loopIndex`, `totalLoops` |
| `src/hooks/useGlossaryScan.ts` | Cập nhật vòng lặp quét `loop = 1..extractionLoops` | Truyền `updatedGlossary` vào các vòng sau để loại trừ trùng lặp |
| `src/hooks/useWorkspaceState.ts` | Cập nhật `handlePolishTranslation` | Cho phép chuốt tiếp từ `polishedTranslation` có sẵn |
