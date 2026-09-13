# Contract: Key Rotation & Quota Exhaustion

**Feature**: `134-fix-quota-key-rotation`  
**Date**: 2026-09-13  
**Status**: Active  

---

## 1. Interface: `chapterTranslationService.ts` Exception Contract

### `executeSingleChapterTranslation`
- **Throws**: `Error` instance
- **Contract Specification**:
  - Khi bắt ngoại lệ từ `translateRawDirect`, `polishTranslationDirect`, hoặc bất kỳ hàm AI nội bộ nào:
    - Nếu `(err as any)?.code === 'ALL_KEYS_EXHAUSTED'` hoặc `err.message` chứa `'Toàn bộ API Key đã hết hạn mức'`:
      - Ngoại lệ ném ra ngoài MUST có thuộc tính `code: 'ALL_KEYS_EXHAUSTED'`.
      - Thuộc tính `isOverload` KHÔNG ĐƯỢC làm lu mờ `code: 'ALL_KEYS_EXHAUSTED'`.
    - Với các lỗi quá tải tạm thời (503, hoặc lỗi văn bản rỗng, bộ lọc):
      - Ngoại lệ ném ra có `isOverload: true` và `code !== 'ALL_KEYS_EXHAUSTED'`.

---

## 2. Interface: `useTranslationProcess.ts` Key Pointer Contract

### `runTranslationLoop`
- **Initial Key**:
  - `const baseKeyIndex = currentApiKeyIndexRef.current;`
- **Batch Progression Contract**:
  - Khi một chương hoàn thành thành công:
    - `nextKeyIndex = (r.lastKeyIndex + 1) % keyCount;`
  - Khi một chương thất bại / gặp lỗi:
    - `nextKeyIndex = (baseKeyIndex + 1) % keyCount;`
  - Cuối batch:
    - `currentApiKeyIndexRef.current = nextKeyIndex;` (hoặc vị trí khả dụng tiếp theo qua `findNextAvailableKeyIndex`).
- **Emergency Stop Contract**:
  - Nếu `(err as any)?.code === 'ALL_KEYS_EXHAUSTED'` hoặc `errMsg.includes('Toàn bộ API Key đã hết hạn mức')`:
    - Đặt `allKeysExhausted = true`.
    - Ghi log dừng khẩn cấp: `"DỪNG KHẨN CẤP: Toàn bộ API Key đã chạm hạn mức (429 RESOURCE_EXHAUSTED) hoặc giới hạn người dùng. Tự động tạm dừng tiến trình."`
    - Bẻ gãy vòng lặp (`break`) ngay lập tức, không tiếp tục duyệt các chương còn lại.

### `handleRetryFailedChapters`
- **Contract**:
  - Trước khi khởi động `runTranslationLoop`, MUST xác định khóa bắt đầu:
    ```typescript
    const cleanKeys = (paramsRef.current.apiKeys || []).filter(k => typeof k === 'string' && k.trim().length > 0);
    const customLimits = getStoredCustomLimits();
    const nextHealthy = localQuotaTracker.findNextAvailableKeyIndex(cleanKeys, (currentApiKeyIndexRef.current + 1) % (cleanKeys.length || 1), customLimits);
    currentApiKeyIndexRef.current = nextHealthy !== -1 ? nextHealthy : 0;
    ```

---

## 3. Interface: `localQuotaTracker.ts` Availability Inspection Contract

### `findNextAvailableKeyIndex(keys: string[], startIndex?: number, customLimits?: Record<string, CustomLimit>, now?: number): number`
- **Input**:
  - `keys`: Mảng chuỗi API Key của người dùng.
  - `startIndex`: Vị trí bắt đầu tìm kiếm (0-indexed).
  - `customLimits`: Bản đồ giới hạn cá nhân (nếu có).
  - `now`: Mốc thời gian kiểm tra.
- **Output**:
  - `number`: Chỉ số của khóa đầu tiên khả dụng (0-indexed).
  - Trả về `-1` nếu và chỉ nếu TẤT CẢ các khóa trong mảng đều không khả dụng.
