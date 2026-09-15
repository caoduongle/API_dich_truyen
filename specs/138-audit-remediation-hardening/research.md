# Research & Technical Decisions: Khắc Phục Kiểm Toán & Gia Cố Tính Nhất Quán (138-audit-remediation-hardening)

## 1. Single Failure Recording in Gemini Client

### Problem Statement
Trong `src/services/gemini/geminiClient.ts`, khi HTTP response trả về mã lỗi (`!response.ok`):
1. `localQuotaTracker.recordFailure(...)` được gọi trực tiếp với thông tin lỗi có cấu trúc.
2. Nếu các khóa đã hết hoặc đạt giới hạn thử lại, hàm ném `throw lastError` (hoặc `throw quotaErr`).
3. Khối `catch (err: any)` bao quanh toàn bộ vòng lặp bắt lấy biệt lệ này.
4. Trong `catch (err: any)`, nếu `err.code !== 'ALL_KEYS_EXHAUSTED'`, dòng `localQuotaTracker.recordFailure(currentKey, modelName, { message: err?.message })` lại được gọi lần thứ hai cho cùng một lượt thử.

### Decision
Sử dụng cờ kiểm soát theo từng lượt thử: `let attemptFailureRecorded = false;` trong phạm vi mỗi vòng lặp `while (attemptsCount < rawKeys.length)`.
- Khi `!response.ok`: gọi `recordFailure(...)` với đầy đủ chi tiết lỗi kỹ thuật và gán `attemptFailureRecorded = true;`.
- Trong `catch (err: any)`:
  - Bỏ qua nếu `err.name === 'AbortError'` hoặc `err.code === 'ALL_KEYS_EXHAUSTED'`.
  - Chỉ gọi `recordFailure(...)` nếu `!attemptFailureRecorded` (dành riêng cho các ngoại lệ mạng thực sự như `TypeError: Failed to fetch`, CORS, DNS failure, timeout).
  - Gán `attemptFailureRecorded = true;`.
- Khi chuyển sang khóa tiếp theo (`currentKeyIdx = nextIdx`, `attemptsCount++`), cờ `attemptFailureRecorded` được khởi tạo lại thành `false`.

### Rationale
- Đảm bảo tính toán tử Idempotent: 1 lượt gọi vật lý (provider attempt) chỉ phát sinh tối đa 1 lượt ghi nhận thất bại (failure entry).
- Bảo toàn trọn vẹn chỉ số `errorsTotal`, `consecutiveErrors`, ngăn chặn hiện tượng Circuit Breaker nhảy sang trạng thái `Open` hoặc `Cooldown` quá sớm.

### Alternatives Considered
- *Xóa lệnh `recordFailure` trong nhánh `!response.ok` và chỉ ghi nhận ở `catch`:* Bị bác bỏ vì `catch` chỉ nhận được đối tượng `Error` chung chung, làm mất các thông tin cấu trúc quan trọng (HTTP status, error details JSON, phân loại `RATE_LIMIT_RPM` vs `QUOTA_EXHAUSTED_RPD`).
- *Gắn cờ nội bộ vào đối tượng lỗi `(lastError as any)._alreadyRecorded = true`:* Bị bác bỏ vì phụ thuộc vào việc gắn thuộc tính động lên đối tượng Error, kém minh bạch hơn biến cờ trong phạm vi thực thi.

---

## 2. Quota & Circuit Breaker State Persistence on Page Reload

### Problem Statement
`localQuotaTracker.ts` lưu dữ liệu vào `sessionStorage`, nhưng:
1. `saveToStorage()` không lưu `circuitBreakerStatus`, `cooldownUntil`, `lastTransitionAt`, `consecutiveErrors`, `consecutiveSuccesses`.
2. `loadFromStorage()` gán cứng:
   ```ts
   healthState: item.healthState === 'AuthFailed' ? 'AuthFailed' : 'Healthy',
   circuitBreakerStatus: 'Closed',
   cooldownUntil: 0,
   ```
   Làm biến mất hoàn toàn các trạng thái nghỉ (`QuotaExhausted`, `RateLimited`, `Cooldown`, `Degraded`) ngay khi người dùng F5 / reload trang.

### Decision
1. **Mở rộng schema tuần tự hóa trong `saveToStorage()`**:
   - Lưu trữ đầy đủ: `healthState`, `circuitBreakerStatus`, `cooldownUntil`, `transitionReason`, `lastTransitionAt`, `consecutiveErrors`, `consecutiveSuccesses`.
2. **Khôi phục thông minh trong `loadFromStorage()`**:
   - Lấy mốc thời gian hiện tại `now = Date.now()` và ngày hiện tại tại Los Angeles `currentDay = getDayInLosAngeles(now)`.
   - **Nếu đổi ngày (`item.lastResetDay !== currentDay`)**:
     - Đặt lại các bộ đếm ngày (`requestsToday = 0`, `errorsToday = 0`, `tokensToday = 0`).
     - Nếu `item.healthState === 'QuotaExhausted'`, giải phóng về `Healthy` với `circuitBreakerStatus = 'Closed'` và `cooldownUntil = 0`.
   - **Nếu cùng ngày (`item.lastResetDay === currentDay`)**:
     - Nếu `item.healthState === 'QuotaExhausted'`: giữ nguyên `QuotaExhausted`, `circuitBreakerStatus = 'Open'`, `cooldownUntil = getNextPstMidnight(now)`.
     - Nếu `item.healthState === 'RateLimited'` hoặc `item.healthState === 'Cooldown'`:
       - Nếu `item.cooldownUntil && item.cooldownUntil > now`: giữ nguyên `healthState`, `circuitBreakerStatus`, và `cooldownUntil` còn lại.
       - Nếu `now >= item.cooldownUntil`: thời gian làm nguội đã hết trong lúc đóng trang -> khôi phục về `Healthy`, `circuitBreakerStatus = 'Closed'`, `cooldownUntil = 0`.
     - Nếu `item.healthState === 'AuthFailed'`: luôn giữ nguyên `AuthFailed`.

### Rationale
- Khóa bị lỗi 429 hoặc cạn hạn ngạch không bị kích hoạt thử lại vô tội vạ ngay sau khi refresh trang.
- Tôn trọng chu kỳ làm mới lúc 00:00 PST và mốc thời gian làm nguội thực tế.

---

## 3. Database Write Serialization to Prevent Race Conditions

### Problem Statement
Trong `src/hooks/useProjects.ts`, các hàm thêm từ cẩm nang (`handleAddGlossaryItem`, `handleAddGlossaryItems`), sửa từ (`handleUpdateGlossaryItem`), xóa từ (`handleDeleteGlossaryItem`), cập nhật cài đặt (`handleUpdateProjectSettings`), gắn thẻ (`handleUpdateProjectTags`) gọi:
```ts
saveProjectToDB(updatedToSave);
```
theo kiểu fire-and-forget, không `await` và không có cơ chế xếp hàng.
Nếu người dùng thêm nhiều từ nhanh hoặc có các cập nhật đồng thời, các transaction IndexedDB có thể hoàn thành lệch thứ tự (out-of-order), khiến snapshot cũ ghi đè lên snapshot mới.

### Decision
Xây dựng module quản lý hàng đợi ghi tuần tự `src/services/projectStorageQueue.ts` (hoặc tích hợp trực tiếp trong `src/services/db.ts`):
- Duy trì một chuỗi Promise tuần tự (Sequential Promise Chain) cho các thao tác ghi dự án:
  ```ts
  let saveChain: Promise<void> = Promise.resolve();

  export function enqueueProjectSave(project: StoryProject): Promise<void> {
    saveChain = saveChain
      .catch(() => {}) // Bảo đảm lỗi trước đó không làm đứt chuỗi
      .then(() => saveProjectToDB(project));
    return saveChain;
  }
  ```
- Trong `useProjects.ts`, thay thế toàn bộ các lời gọi `saveProjectToDB(updatedToSave)` độc lập bằng `enqueueProjectSave(updatedToSave)`.

### Rationale
- Đảm bảo tính nhất quán tuần tự (FIFO - First In, First Out) tuyệt đối của các thao tác ghi vào cơ sở dữ liệu.
- Hoàn toàn không làm nghẽn luồng giao diện (non-blocking UI) vì React state vẫn được cập nhật lạc quan (optimistic) ngay lập tức, trong khi persistence dưới IndexedDB được xếp hàng xử lý an toàn.

---

## 4. Web Crypto SHA-256 for Key Hashing

### Problem Statement
Hàm `hashApiKey(key: string): string` hiện dùng fallback băm số nguyên 32-bit dịch bit trên trình duyệt:
```ts
hash = ((hash << 5) - hash) + trimmed.charCodeAt(i);
return Math.abs(hash).toString(16).padStart(8, '0').repeat(8);
```
Không gian va chạm chỉ xấp xỉ $2^{32}$, rất dễ xảy ra va chạm hash giữa các API key khác nhau, dẫn đến dùng chung hạn mức và trạng thái sức khỏe.

### Decision
1. Cung cấp thuật toán SHA-256 mật mã học thuần JavaScript chuẩn xác (hoặc sử dụng `crypto.subtle.digest` kèm bộ nhớ đệm đồng bộ `Map<string, string>`).
2. Triển khai hàm tính SHA-256 đồng bộ deterministic (hoặc async pre-digest + sync lookup) tạo ra chuỗi 64 ký tự thập lục phân chuẩn RFC 6234 / FIPS 180-4:
   - Trong Node.js: `crypto.createHash('sha256').update(key).digest('hex')`.
   - Trong Browser: bộ nhớ đệm `keyHashCache` + hàm SHA-256 bitwise chuẩn, đảm bảo cho ra kết quả băm trùng khớp 100% với Node.js crypto.
   - Cung cấp thêm hàm `hashApiKeyAsync(key: string): Promise<string>` sử dụng `window.crypto.subtle.digest('SHA-256', ...)` để nạp vào cache khi người dùng nhập khóa trên giao diện.

### Rationale
- Khử sạch nguy cơ va chạm hash giữa các khóa API.
- Giữ nguyên chữ ký hàm đồng bộ `hashApiKey(key: string): string` để không phá vỡ hàng chục vị trí gọi hiện tại trong `geminiKeyScheduler`, `localQuotaTracker` và các bài kiểm thử.

---

## 5. Documentation & Metadata Realignment

### Decision
1. **`docs/model-system.md`**:
   - Thay thế các sơ đồ tuần tự sequence diagram chứa `Express Server` và `/api/list-models`, `/api/verify-model` bằng quy trình thuần Client-side SPA trực tiếp gọi Google Gemini qua `@google/genai` và `directGeminiClient.ts`.
   - Cập nhật tài liệu về cơ chế SWR client-side lưu trong `localStorage`.
2. **`SECURITY.md`**:
   - Thay thế cụm từ "Zero-Server-Knowledge" bằng "Client-Direct Architecture (Không trung gian máy chủ)".
   - Cập nhật danh sách miền CSP đồng bộ chuẩn xác với `vercel.json`.
3. **`.env.example`**:
   - Bỏ câu nói "mã hóa IndexedDB", ghi nhận chính xác khóa được lưu trong `sessionStorage` của trình duyệt.
4. **Bilingual Splitter Contract & Semantic Parity**:
   - Đồng bộ kiểu `BilingualSplitOptions` và hàm `splitBilingualAdaptively` hỗ trợ cả 2 dạng gọi: `(sourceText, rawText, targetParts)` và `(options: BilingualSplitOptions)`.
   - Bổ sung kiểm tra ranh giới đoạn văn và câu hoàn chỉnh, tránh chia cắt vô nghĩa khi số đoạn lệch nhau.
