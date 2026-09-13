# Research: Sửa Cơ Chế Xoay Vòng API Key Khi Chạm Quota & Tránh Kẹt Khóa Lỗi

**Feature**: `134-fix-quota-key-rotation`  
**Date**: 2026-09-13  
**Status**: Completed  

---

## 1. Research Topics & Key Decisions

### Decision 1: Luân Chuyển Khóa Tự Động Qua Từng Chương (Round-Robin Key Advance)
- **Vấn đề / Bối cảnh**: 
  Trong [`useTranslationProcess.ts`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/hooks/useTranslationProcess.ts#L351-L414), `currentApiKeyIndexRef.current` được gán lại bằng `lastSuccessKeyIndex`.
  Tuy nhiên:
  1. Khi một chương thành công với khóa $K$, `lastSuccessKeyIndex` nhận giá trị $K$, dẫn tới chương tiếp theo lại bắt đầu bằng đúng khóa $K$ thay vì xoay vòng sang khóa $K+1$. Do đó toàn bộ các yêu cầu bị dồn vào 1 khóa duy nhất cho đến khi khóa đó kiệt sức (429 RESOURCE_EXHAUSTED).
  2. Khi một chương gặp lỗi, `lastSuccessKeyIndex` hoàn toàn không được cập nhật, giữ nguyên giá trị cũ $K$. Vòng lặp bỏ qua chương lỗi (`skipFailedChapters`) và chạy chương tiếp theo vẫn với khóa $K$. Cả 17 chương trong hàng đợi đều bị ép chạy vào khóa lỗi.
- **Quyết định**:
  1. Sau mỗi chương/lô thành công với khóa $K$, chỉ số khóa cho chương tiếp theo phải được tịnh tiến sang khóa kế tiếp: `(r.lastKeyIndex + 1) % keyCount`.
  2. Khi một chương/lô thất bại hoặc gặp ngoại lệ, chỉ số khóa MUST được tịnh tiến sang khóa kế tiếp `(baseKeyIndex + batchSize) % keyCount`, hoặc tìm khóa khả dụng tiếp theo qua `localQuotaTracker.findNextAvailableKeyIndex(apiKeys, (baseKeyIndex + 1) % keyCount, customLimits)`.
- **Hệ quả & Lợi ích**:
  - Tải được phân bổ đều cho toàn bộ $N$ khóa API (ví dụ 8 khóa chia đều thay vì 1 khóa gánh 100% rồi chết).
  - Khi 1 khóa bị chạm quota, các chương tiếp theo không bao giờ bị kẹt lại ở khóa đó mà tự động chạy trên các khóa còn lại.

---

### Decision 2: Khởi Tạo Khóa Khả Dụng Khi "Dịch Lại Các Chương Lỗi" (`handleRetryFailedChapters`)
- **Vấn đề / Bối cảnh**:
  Hàm `handleRetryFailedChapters` trong [`useTranslationProcess.ts`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/hooks/useTranslationProcess.ts#L610-L643) chỉ thiết lập lại `chaptersQueue = failedChaps`, `currentChapterIndex = 0` và gọi `runTranslationLoop(failedChaps, 0)`.
  Con trỏ `currentApiKeyIndexRef.current` hoàn toàn bị bỏ quên, giữ nguyên vị trí của khóa vừa gây ra lỗi trong đợt dịch trước (ví dụ Khóa #7).
- **Quyết định**:
  Trong `handleRetryFailedChapters`, trước khi bắt đầu vòng lặp, hệ thống gọi:
  ```typescript
  const cleanKeys = (paramsRef.current.apiKeys || []).filter(k => typeof k === 'string' && k.trim().length > 0);
  const customLimits = getStoredCustomLimits();
  const nextHealthyIdx = localQuotaTracker.findNextAvailableKeyIndex(cleanKeys, (currentApiKeyIndexRef.current + 1) % (cleanKeys.length || 1), customLimits);
  currentApiKeyIndexRef.current = nextHealthyIdx !== -1 ? nextHealthyIdx : 0;
  ```
- **Hệ quả & Lợi ích**:
  Đợt dịch lại sẽ luôn khởi đầu bằng một khóa khỏe mạnh còn hạn mức, tránh việc vừa bấm "Dịch lại" là vấp ngay lỗi của khóa cũ.

---

### Decision 3: Bảo Toàn Mã Lỗi `ALL_KEYS_EXHAUSTED` Qua Các Tầng Dịch Vụ
- **Vấn đề / Bối cảnh**:
  Khi tất cả các khóa đều cạn kiệt, [`directGeminiClient.ts`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/services/directGeminiClient.ts#L90) ném lỗi với `err.code = 'ALL_KEYS_EXHAUSTED'`.
  Tuy nhiên:
  1. [`chapterTranslationService.ts`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/services/chapterTranslationService.ts#L183) bọc ngoại lệ lại bằng `new Error(err?.message)` và chỉ gán `{ isOverload }`, làm mất thuộc tính `code`.
  2. [`useTranslationProcess.ts`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/hooks/useTranslationProcess.ts#L387) kiểm tra `if (errMsg.startsWith("ALL_KEYS_EXHAUSTED"))`. Vì thông điệp lỗi bắt đầu bằng `"Toàn bộ API Key đã hết hạn mức..."` nên phép so sánh luôn sai (`false`).
  3. Lỗi này có chứa chữ *"hạn mức"* nên bị hiểu nhầm thành `isOverload === true`, dẫn đến việc in log `"⚡ Chương ... lỗi tạm thời do model quá tải"` và tiếp tục `skip` qua toàn bộ danh sách chương.
- **Quyết định**:
  1. Trong `chapterTranslationService.ts`: Bảo toàn thuộc tính `code` khi bọc lỗi:
     ```typescript
     } catch (err: any) {
       const isOverload = err?.message && /429|RESOURCE_EXHAUSTED|hạn mức|quá tải/i.test(err.message);
       const isAllKeysExhausted = err?.code === 'ALL_KEYS_EXHAUSTED' || (err?.message && err.message.includes('Toàn bộ API Key đã hết hạn mức'));
       const newErr = Object.assign(new Error(err?.message || 'Lỗi dịch thô từ hệ thống AI trực tiếp.'), {
         isOverload,
         code: isAllKeysExhausted ? 'ALL_KEYS_EXHAUSTED' : err?.code,
       });
       throw newErr;
     }
     ```
  2. Trong `useTranslationProcess.ts`: Kiểm tra dừng khẩn cấp:
     ```typescript
     const isAllKeysExhausted = (err as any)?.code === 'ALL_KEYS_EXHAUSTED' || errMsg.includes('Toàn bộ API Key đã hết hạn mức');
     if (isAllKeysExhausted) {
       allKeysExhausted = true;
       continue;
     }
     ```
- **Hệ quả & Lợi ích**:
  Khi toàn bộ khóa thực sự cạn kiệt, hệ thống dừng khẩn cấp ngay lập tức tại chương đầu tiên, không lãng phí tài nguyên và không spam lỗi hiểu nhầm.

---

### Decision 4: Minh Bạch Hóa Thông Tin Khóa Đang Sử Dụng Trong Nhật Ký
- **Vấn đề / Bối cảnh**:
  Hiện tại dòng log `Xử lý [1/17]: ... | Key xoay vòng: #7` chỉ phản ánh giá trị `baseKeyIndex` ban đầu. Nếu trong quá trình gọi, `callGeminiDirect` phát hiện Khóa #7 đang cooldown và tự động chọn Khóa #8 (hoặc xoay sang Khóa #8 khi gặp 429), nhật ký hoàn toàn không ghi nhận việc này, khiến người dùng lầm tưởng hệ thống "chỉ dùng mỗi khóa #7".
- **Quyết định**:
  1. Khi bắt đầu chương, trước khi in log, resolve chỉ số khóa khả dụng thực tế sẽ được thử đầu tiên:
     `const effectiveStartKeyIdx = localQuotaTracker.findNextAvailableKeyIndex(rawKeys, baseKeyIndex, customLimits);`
     Nếu tìm thấy khóa khả dụng khác `baseKeyIndex`, cập nhật hiển thị `Key xoay vòng: #${effectiveStartKeyIdx + 1}` (kèm ghi chú nếu khóa gốc đang cooldown).
  2. Trả về `lastKeyIndex` chính xác sau khi hoàn thành chương để cập nhật con trỏ xoay vòng.

---

## 2. Hiến Pháp & Kiểm Tra Tiêu Chí (Constitution Alignment)

- **Principle I (Strict Quality Gates)**: Tất cả thay đổi bắt buộc vượt qua `npm run lint`, `npm test`, `npm run build`.
- **Principle II (Dependency Minimization)**: Không thêm bất kỳ package nào; tận dụng `localQuotaTracker` và `getStoredCustomLimits` đã có.
- **Principle III (Strict Concern Separation)**:
  - Logic tính toán sức khỏe key và hạn mức thuộc Model (`src/services/localQuotaTracker.ts`, `src/services/directGeminiClient.ts`).
  - Điều phối vòng lặp và con trỏ xoay vòng thuộc Controller (`src/hooks/useTranslationProcess.ts`).
  - Giao diện và thông báo giữ nguyên nhãn tiếng Việt chuẩn.
- **Principle IV (Immutable Core Schemas)**: Không thay đổi schema IndexedDB hay `types.ts`.
