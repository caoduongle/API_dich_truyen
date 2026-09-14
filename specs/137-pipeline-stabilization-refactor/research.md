# Research & Architectural Decisions: Ổn Định Hóa Pipeline Dịch Thuật & Tái Cấu Trúc (137-pipeline-stabilization-refactor)

**Date**: 2026-09-14  
**Status**: Completed  
**Scope**: P0, P1, P2 Stabilization & Refactoring Tasks

---

## 1. Cơ Chế Quota Tracker & Ngữ Nghĩa RPM/TPM (P0 - #1)

### Vấn Đề Hiện Tại
Trong `src/services/localQuotaTracker.ts`, danh sách `recentCalls` được dùng để tính `requestsThisMinute` (RPM) và `tokensThisMinute` (TPM) trên cửa sổ trượt 60 giây. Tuy nhiên, `recentCalls` chỉ được thêm mới bên trong `recordSuccess()`. Trong khi đó, `recordProviderAttempt()` mới là nơi ghi nhận mỗi lần thực tế gửi yêu cầu đến Google Gemini API.
Hệ quả: Nếu 1 yêu cầu gặp 2 lần lỗi (ví dụ: 429 rồi 503) trước khi thử lại thành công ở lần 3, `recentCalls` chỉ ghi nhận 1 thay vì 3 lượt gọi. Dashboard báo cáo sai lưu lượng thực tế, dẫn đến việc ước tính RPM thấp hơn thực tế.

### Quyết Định Kiến Trúc
Tách biệt rõ ràng giữa **Lượt thử nghiệm (Provider Attempts)** và **Lượt thành công (Successful Calls)**:
1. `InternalKeyStats` và `InternalModelStats` sẽ lưu trữ 2 cửa sổ trượt riêng biệt:
   - `recentAttempts: { timestamp: number }[]`: Ghi nhận ngay lập tức trong `recordProviderAttempt(key, model, timestamp)`. Dùng để tính toán chính xác `requestsThisMinute` (RPM) và `providerAttemptsThisMinute`.
   - `recentTokens: { timestamp: number; tokens: number }[]`: Ghi nhận trong `recordSuccess(key, model, tokens, latency, timestamp)`. Dùng để tính toán `tokensThisMinute` (TPM) và lượng token thực tế tiêu thụ.
2. `getQuotaStatus()` lọc các bản ghi trong `[now - 60_000, now]`:
   - `requestsThisMinute = stats.recentAttempts.length;`
   - `tokensThisMinute = stats.recentTokens.reduce((acc, c) => acc + c.tokens, 0);`
3. Tương thích lưu trữ: Khi lưu vào `sessionStorage`, chỉ lưu mảng rút gọn hoặc tự động dọn sạch các mục cũ hơn 60 giây để tránh phình to bộ nhớ.

---

## 2. Tính Toán Thời Điểm Đặt Lại Hạn Ngạch Ngày Giờ PST (P0 - #2)

### Vấn Đề Hiện Tại
Khi gặp lỗi `QuotaExhausted` (cạn hạn mức RPD 1,500 req/ngày của Gemini Free Tier), mã nguồn hiện tại đặt:
`keyStats.cooldownUntil = now + 4 * 3600 * 1000;` (cố định 4 giờ), trong khi ghi chú là "Tạm dừng đến 00:00 PST ngày hôm sau".
Hệ quả: Nếu quota hết lúc 01:00 PST, thời gian chờ thực tế đến ngày mới là 23 giờ nhưng hệ thống lại mở khóa sau 4 giờ (lại gặp tiếp 429). Ngược lại, nếu hết lúc 22:00 PST, chỉ còn 2 giờ là sang ngày mới nhưng hệ thống lại khóa 4 giờ.

### Quyết Định Kiến Trúc
Xây dựng hàm tính chính xác thời điểm 00:00:00.000 kế tiếp theo múi giờ `America/Los_Angeles`:
```ts
export function getNextPstMidnight(now: number = Date.now()): number {
  // Lấy ngày hiện tại tại Los Angeles dưới dạng YYYY-MM-DD
  const currentDay = getDayInLosAngeles(now);
  const [year, month, day] = currentDay.split('-').map(Number);
  
  // Tạo mốc ngày tiếp theo
  const nextDate = new Date(Date.UTC(year, month - 1, day + 1, 8, 0, 0)); // Ước lượng UTC cho 00:00 PST (UTC-8)
  
  // Xác định chính xác offset của America/Los_Angeles tại thời điểm 00:00 ngày tiếp theo
  // bằng cách so sánh chuỗi ngày giờ được format qua Intl
  const targetDayStr = getDayInLosAngeles(nextDate.getTime());
  
  // Dò tìm chính xác epoch millisecond khi Los Angeles đạt đúng 00:00:00
  // Bước nhảy an toàn: lấy mốc giữa UTC-7 (PDT) và UTC-8 (PST)
  // Đảm bảo không phụ thuộc thư viện bên ngoài (zero-dependency)
  return computeExactMidnightPst(year, month, day);
}
```
Khi `recordFailure` nhận diện lỗi cạn kiệt ngày, đặt `keyStats.cooldownUntil = getNextPstMidnight(now)`.

---

## 3. Phân Loại Lỗi Gemini Bền Vững (P0 - #3)

### Vấn Đề Hiện Tại
Code đang phân biệt lỗi cạn hạn mức ngày (RPD) và giới hạn tốc độ (RPM/TPM) dựa trên việc so sánh chuỗi thông báo (`msg.toLowerCase().includes('quota')`, v.v.). Điều này mong manh vì Google có thể cập nhật câu từ thông báo bất cứ lúc nào.

### Quyết Định Kiến Trúc
Xây dựng bộ phân loại lỗi có thứ tự ưu tiên cấu trúc (Structure-first taxonomy):
1. **Ưu tiên 1 - Cấu trúc chi tiết lỗi (`error.details`)**:
   - QuotaFailure: Kiểm tra `@type === 'type.googleapis.com/google.rpc.QuotaFailure'` và `violations`. Nếu vi phạm liên quan đến `RequestsPerDay` hoặc `per_day` → `RPD_EXHAUSTED`.
   - ErrorInfo: Kiểm tra `@type === 'type.googleapis.com/google.rpc.ErrorInfo'`. Nếu `reason === 'RATE_LIMIT_EXCEEDED'` và `metadata.quota_limit` chứa `Day` → `RPD_EXHAUSTED`. Nếu chứa `Minute` hoặc không có `Day` → `RPM_RATE_LIMIT`.
2. **Ưu tiên 2 - Mã trạng thái HTTP & Error Code/Status**:
   - HTTP 401, 403, hoặc status `UNAUTHENTICATED`, `PERMISSION_DENIED` → `AUTH_ERROR`.
   - HTTP 429 hoặc status `RESOURCE_EXHAUSTED`:
     - Nếu không có details, fallback sang kiểm tra `reason` hoặc từ khóa đặc trưng trong `error.message`.
   - HTTP 500, 503, hoặc status `UNAVAILABLE`, `INTERNAL` → `SERVER_OVERLOAD`.
3. **Ưu tiên 3 - Thông báo chuỗi (Fallback)**:
   - Chỉ áp dụng khi API phản hồi lỗi không có mảng `details`.

---

## 4. Phân Đoạn Thích Ứng Đồng Bộ Ranh Giới Đoạn Văn (P0 - #4)

### Vấn Đề Hiện Tại
Khi văn bản dài, `polishWithContentSplitDirect` đang gọi:
```ts
const sourceParts = splitTextAdaptively(sourceText, 2);
const rawParts = splitTextAdaptively(rawTranslation, sourceParts.length);
```
Vì tiếng Trung và tiếng Việt có mật độ token, độ dài từ và cấu trúc ngắt dòng khác nhau, hai lần gọi `splitTextAdaptively` độc lập có thể cắt ở các đoạn văn khác nhau (ví dụ: tiếng Trung cắt ở đoạn 4, tiếng Việt cắt ở đoạn 5). Khi ghép cặp `sourceParts[i]` với `rawParts[i]`, AI sẽ nhận được ngữ cảnh bị lệch, tạo ra bản dịch chuốt râu ông nọ cắm cằm bà kia.

### Quyết Định Kiến Trúc
Xây dựng hàm phân đoạn song ngữ đồng bộ:
`splitBilingualAdaptively(sourceText: string, rawText: string, targetParts: number = 2): TranslationChunk[]`
1. **Trường hợp chuẩn (Paragraph Parity)**:
   - Tách `sourceText` thành danh sách đoạn `sourceParas = splitParagraphs(sourceText)`.
   - Tách `rawText` thành danh sách đoạn `rawParas = splitParagraphs(rawText)`.
   - Nếu `sourceParas.length === rawParas.length`: Cắt cả hai tại cùng một chỉ số phân đoạn `splitIndex`.
2. **Trường hợp lệch số đoạn**:
   - Ánh xạ ranh giới đoạn văn theo tỷ lệ tương quan giữa 2 văn bản:
     `rawIndex = Math.round(sourceIndex * (rawParas.length / sourceParas.length))`
   - Đảm bảo mỗi `TranslationChunk` đại diện cho một khoảng đoạn văn liên tục được ghép cặp chặt chẽ.
3. Cấu trúc `TranslationChunk`:
   ```ts
   export interface TranslationChunk {
     source: string;
     raw: string;
     startParagraphIndex: number;
     endParagraphIndex: number;
   }
   ```

---

## 5. Giới Hạn Tương Tranh Khi Phân Đoạn Thích Ứng (P0 - #5)

### Vấn Đề Hiện Tại
Khi phân đoạn thử lại hoặc chia văn bản, hàm hiện tại dùng `Promise.all(sourceParts.map(...))` gọi đồng thời toàn bộ các phân đoạn. Với văn bản chia thành 4-6 đoạn, điều này tạo ra burst 4-6 request API cùng lúc, gây nghẽn tốc độ (RPM) và làm các API key bị quá tải liên tiếp.

### Quyết Định Kiến Trúc
Thay thế `Promise.all` bằng bộ thực thi giới hạn tương tranh (Bounded Concurrency Queue):
- Giới hạn mặc định: `maxConcurrency = 2` (hoặc 1 khi đang ở chế độ bảo toàn quota).
- Triển khai tiện ích `mapWithConcurrencyLimit<T, R>(items: T[], limit: number, worker: (item: T, idx: number) => Promise<R>): Promise<R[]>`.
- Bảo đảm kết quả trả về đúng thứ tự ban đầu của mảng phân đoạn.
- Phối hợp nhịp nhàng với cơ chế luân chuyển khóa (Key Rotation).

---

## 6. Tái Cấu Trúc `callGeminiDirect()` (P1 - #6)

### Vấn Đề Hiện Tại
`callGeminiDirect()` trong `src/services/directGeminiClient.ts` đang gánh vác: chuẩn hóa model, tạo URL, sinh payload, kiểm tra quota, chọn key, fetch HTTP, phân loại lỗi, ghi nhận quota, xoay vòng thử lại, xử lý lỗi mạng, trích xuất token.

### Quyết Định Kiến Trúc
Tách thành module hướng đối tượng / hàm chức năng trong `src/services/gemini/`:
- `geminiRequestBuilder.ts`: Chuẩn hóa tên model, tạo endpoint URL, xây dựng cấu trúc JSON body.
- `geminiTransport.ts`: Thực hiện `fetch` mạng với AbortController và timeout.
- `geminiErrorClassifier.ts`: Phân loại lỗi mạng, HTTP status, và chi tiết Quota/RateLimit.
- `geminiKeyScheduler.ts`: Lựa chọn khóa khả dụng tiếp theo dựa trên sức khỏe từ `localQuotaTracker`.
- `geminiClient.ts`: Điều phối luồng gọi, thử lại và ghi nhận số liệu.
- `src/services/directGeminiClient.ts`: Giữ nguyên hàm xuất `callGeminiDirect()` làm Facade công khai để bảo toàn 100% tương thích với các component và bài test hiện có.

---

## 7. Tái Cấu Trúc `directTranslationEngine.ts` (P1 - #7)

### Vấn Đề Hiện Tại
`src/services/directTranslationEngine.ts` dài hơn 760 dòng xử lý toàn bộ các công đoạn: dịch thô, chuốt văn, thẩm định QA, viết lại câu, phân tách thích ứng, bảo tồn tiêu đề, kiểm tra cấu trúc.

### Quyết Định Kiến Trúc
Tách thành các module chức năng trong `src/services/translation/`:
- `rawTranslation.ts`: Xử lý bước 1 (Dịch thô + Trích xuất thực thể).
- `polishTranslation.ts`: Xử lý bước 2 (Chuốt văn theo ngữ cảnh).
- `bilingualSplit.ts`: Thuật toán phân đoạn song ngữ đồng bộ ranh giới đoạn và kiểm soát lưu lượng.
- `qaCritique.ts`: Xử lý bước 3 (Đánh giá chất lượng và kiểm tra sai sót).
- `sentenceRewrite.ts`: Xử lý viết lại câu đơn lẻ theo chỉ định.
- `translationValidation.ts`: Kiểm tra toàn vẹn cấu trúc, bảo tồn tiêu đề, phát hiện cắt cụt.
- `index.ts`: Điểm xuất khẩu API duy nhất.
- `src/services/directTranslationEngine.ts`: Re-export toàn bộ public API từ `src/services/translation/` để tương thích ngược tuyệt đối.

---

## 8. Xử Lý Tương Tranh Google Drive & Bộ Nhớ Đệm Theo Người Dùng (P1 - #8, #9)

### Vấn Đề Hiện Tại
- `ensureAppFolder()` tìm kiếm rồi tạo thư mục nếu chưa thấy. Hai tab chạy song song có thể cùng tìm không thấy và cùng tạo thư mục trùng lặp.
- `cachedFolderId` là biến tĩnh/thuộc tính đơn lẻ, không gắn với danh tính tài khoản Google hiện tại.

### Quyết Định Kiến Trúc
1. **Single-Flight Promise Lock**: Sử dụng biến nhớ promise đang thực thi `inFlightEnsureFolderPromise` để các cuộc gọi song song trong cùng phiên tái sử dụng chung kết quả.
2. **Reconciliation**: Sau khi tạo hoặc tìm kiếm, nếu Drive trả về nhiều thư mục cùng tên, tự động chọn thư mục cũ nhất và ghi nhật ký cảnh báo.
3. **User-Scoped Cache**: Gắn bộ nhớ đệm thư mục với mã nhận diện người dùng hoặc xóa sạch bộ nhớ đệm khi trạng thái xác thực (`token`) thay đổi.

---

## 9. Minh Bạch Hóa Lỗi Lưu Trữ IndexedDB (P1 - #10, #11)

### Vấn Đề Hiện Tại
`db.ts` bắt mọi ngoại lệ và trả về `[]` hoặc `null`. Người dùng hoặc hook không thể phân biệt giữa "chưa có dự án" và "IndexedDB bị lỗi/hết dung lượng".

### Quyết Định Kiến Trúc
1. Định nghĩa cấu trúc `StorageResult<T>`:
   ```ts
   export type StorageResult<T> =
     | { success: true; data: T }
     | { success: false; error: StorageError };
   ```
2. Cung cấp các hàm mới có hậu tố `Result` (ví dụ: `getProjectsResultFromDB()`), trong khi các hàm cũ tiếp tục hoạt động và ghi log chi tiết, giúp các tầng gọi cấp cao có thể nâng cấp dần mà không gây lỗi phá vỡ.
3. Duy trì CRDT (`Y.Doc` / `workspaceState`) là nguồn chân lý duy nhất cho nội dung chương đang soạn thảo; `saveProjectToDB()` chỉ lưu trữ ảnh chụp dự án và không ghi đè dữ liệu rỗng lên các chương có dữ liệu.

---

## 10. Tối Ưu Bảo Mật, Môi Trường & Dọn Dẹp Phụ Thuộc (P2)

1. **DiffModal.tsx**: Thay thế `dangerouslySetInnerHTML` bằng hàm trả về danh sách các `ReactNode` (các chuỗi văn bản xen kẽ các thẻ `<mark>`), loại bỏ hoàn toàn bề mặt tấn công XSS.
2. **CSP Allowlist**: Rà soát `index.html` và `vite.config.ts`, loại bỏ các wildcard quá rộng, giới hạn cụ thể các endpoint Google APIs.
3. **Cross-Platform Clean Script**: Cập nhật `"clean": "node -e \"fs.rmSync('dist', { recursive: true, force: true })\""` trong `package.json` để tương thích mượt mà trên cả Windows PowerShell, CMD và Linux/macOS.
4. **Loại bỏ `dotenv`**: Gỡ gói `dotenv` khỏi `package.json` vì ứng dụng là thuần Client-side SPA, không chạy Node server ở runtime.
