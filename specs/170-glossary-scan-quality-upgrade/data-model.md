# Data Model: Cải Tiến Chất Lượng Quét Thuật Ngữ Cho Mô Hình Tốc Độ Cao

**Feature**: `170-glossary-scan-quality-upgrade` | **Date**: 2026-11-27

## Bất biến Schema cốt lõi (Constitution Principle IV)
- **KHÔNG sửa** bất kỳ kiểu dữ liệu nào trong `src/types.ts` (`GlossaryItem`, `PendingGlossaryItem`, `CharacterProfile`, `StoryProject`).
- **KHÔNG thay đổi** IndexedDB schema hay version trong `src/services/db.ts`.
- Toàn bộ kiểu dữ liệu dưới đây thuộc tầng xử lý nội bộ trên bộ nhớ của bộ lọc hậu kiểm quét, prompt context và Sức khỏe từ điển.

---

## 1. Scan Quality Verdict & Batch Classification (`src/lib/glossaryScanQuality.ts`)

```ts
export type ScanQualityVerdict = 'accept' | 'review' | 'reject';

export interface ScanQualityEvaluation {
  verdict: ScanQualityVerdict;
  /** Lý do tiếng Việt giải thích khi verdict là 'review' hoặc 'reject' */
  reason?: string;
  /** Ghi chú đã được làm sạch ký tự Hán dư thừa nếu còn đủ nghĩa tiếng Việt */
  cleanedNote: string;
  /** Dạng tiếng Trung chuẩn hóa sạch khoảng trắng thừa */
  normalizedChinese: string;
  /** Phân loại lỗi định dạng phát hiện được (nếu có) */
  flags: Array<
    | 'pinyin_in_reading'
    | 'han_in_reading'
    | 'pinyin_in_vietnamese'
    | 'han_in_note'
    | 'noisy_common_term'
    | 'short_code'
    | 'sentence_fragment'
    | 'single_han_char'
    | 'subterm_overlap'
    | 'needs_review_flag'
  >;
}

export interface ScanBatchClassificationResult {
  acceptedItems: GlossaryItem[];
  reviewItems: PendingGlossaryItem[];
  rejectedCandidates: Array<{ chinese: string; reason: string }>;
  telemetry: {
    acceptedCount: number;
    reviewCount: number;
    rejectedCount: number;
  };
}
```

### Chuyển đổi trạng thái ứng viên
1. Nếu ứng viên vi phạm rác rõ rệt (`noisy_common_term`, `short_code`, `sentence_fragment`, rỗng hoặc chứa dấu câu ngắt câu) → `verdict = 'reject'` (loại bỏ, tăng `rejectedCount`).
2. Nếu ứng viên không bị `reject`, nhưng có bất kỳ cờ rủi ro/trùng lặp nào (`needs_review_flag`, trùng `existingGlossary`, `pinyin_in_reading`, `han_in_reading`, `pinyin_in_vietnamese`, `han_in_note` không sạch hẳn, `single_han_char`, `subterm_overlap`) → `verdict = 'review'`, tạo `PendingGlossaryItem` với `needsReview: true` (hoặc `reason` trùng) và tăng `reviewCount`.
3. Ngược lại → `verdict = 'accept'`, tạo `GlossaryItem` kèm `cleanedNote` và gợi ý giới tính an toàn (`inferCharacterGenderFromContext`), thêm vào `acceptedItems` + `workingGlossary`, tăng `acceptedCount`.

---

## 2. Chapter Scan Anchor Context (`src/services/ai/prompts.ts`, `src/services/directGlossaryEngine.ts`)

```ts
export interface ChapterScanAnchorEntry {
  chinese: string;
  vietnamese: string;
  isPinned?: boolean;
}
```

- Được tổng hợp trước mỗi lượt phân tích chương (ngay từ **Vòng 1** và mọi vòng sau) bằng cách ưu tiên các mục trong từ điển hiện tại có mặt trong văn bản chương, tối đa `150` mục, kèm nghĩa tiếng Việt quy ước (`- 钱仓一 => Tiền Thương Nhất`) và ngữ cảnh truyện (`genre`, `tone`, `description`).

---

## 3. Scan Quality Telemetry (`src/hooks/useGlossaryScan.ts`)

```ts
export interface ScanQualityTelemetry {
  acceptedCount: number;
  reviewCount: number;
  rejectedCount: number;
}
```

- Cộng dồn qua mọi chương và vòng lặp trong một lần chạy `handleAutoExtractGlossary`, xuất trong log tổng kết cuối phiên.

---

## 4. Extended Glossary Health Report (`src/lib/glossaryMatch.ts`)

Mở rộng kiểu hiện có (tương thích ngược bằng cách cộng thêm trường mới):

```ts
export type GlossaryHealthFilter = 'all' | 'conflicts' | 'missing_profile' | 'incomplete' | 'format_issues';

export interface GlossaryHealthReport {
  conflictGroupCount: number;
  conflictItemIds: string[];
  missingProfileCharIds: string[];
  incompleteViIds: string[];
  /** ID các mục có cột phiên âm nghi ngờ Bính âm/chữ Hán hoặc ghi chú còn lẫn chữ Hán */
  formatIssueIds: string[];
  totalIssueItems: number;
}
```
