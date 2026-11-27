# Interface Contracts: Cải Tiến Chất Lượng Quét Thuật Ngữ Cho Mô Hình Tốc Độ Cao

**Feature**: `170-glossary-scan-quality-upgrade` | **Date**: 2026-11-27

## 1. Scan Quality Linguistic & Gate Contracts (`src/lib/glossaryScanQuality.ts`)

### 1.1 Format & Noise Detectors
- `detectMandarinPinyin(text: string): boolean`
  - Trả về `true` nếu chứa thanh điệu Bính âm (`[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]`) HOẶC chứa từ Bính âm không dấu đặc trưng tiếng Hoa (`zh/ch/sh/q/x` hoặc vần `iang/iong/uan/iao/ie/uo/ou/ang/eng` theo cụm nhiều âm tiết không dấu tiếng Việt, ngoại trừ tên riêng tiếng Anh phổ biến hợp lệ).
- `containsHanChars(text: string): boolean`
  - Trả về `true` nếu chứa bất kỳ ký tự Hán (`[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]`).
- `sanitizeScannedNote(note: string): { cleanedNote: string; hadHanLeak: boolean; cleanEnough: boolean }`
  - Loại bỏ các cụm ký tự Hán rò rỉ (kèm ngoặc đơn/ngoặc kép trống rỗng sau khi cắt) trong `note`; xác định `cleanEnough = true` nếu `cleanedNote.length >= 6` và chứa chữ cái Latinh/tiếng Việt, không chỉ toàn ký tự Hán đã cắt.
- `isShortAlphanumericCode(text: string): boolean`
  - Nhận diện mã ngắn kiểu `^[A-Za-z]{1,2}[-_]?\d{1,3}$` hoặc thuần số ký hiệu (vd `A1`, `A2`, `B-04`).
- `hasSentencePunctuationOrOverlong(chinese: string): boolean`
  - Trả về `true` nếu `chinese` chứa dấu ngắt câu (`，`, `。`, `！`, `？`, `;`, `:`, `\n`) hoặc vượt quá 10 ký tự Hán (ngoại trừ trường hợp cấu trúc tên phương Tây có dấu `·` như `伊丽莎白·乌里扬诺夫`).
- `isCommonEverydayScanNoise(chinese: string, type?: string): boolean`
  - Kế thừa `isNoisyGlossaryTerm(chinese, type)` và mở rộng chặn cụm từ phổ thông/mệnh lệnh sinh hoạt rõ rệt (vd `电脑`, `步行街`, `匿名`, `我想看鬼`, `暗度陈仓`, `图灵测试`).

### 1.2 Sub-Term / Composite Overlap Detector
- `findSubTermOrCompositeOverlap(candidateChinese: string, existingGlossary: GlossaryItem[], chapterSourceText: string): { reason: string; relatedChinese: string } | null`
  - Phát hiện khi:
    - `canonical(candidateChinese)` là chuỗi con thực sự (`< length`) nằm trong `canonical(existing.chinese)` (vd `苍一` trong `钱仓一`, `魏成` trong `魏成和`, `长兰` trong `长兰小区`), và `candidateChinese` **không** xuất hiện độc lập ngoài các lần xuất hiện của `existing` trong `chapterSourceText`; HOẶC
    - `canonical(existing.chinese)` (`>= 2` chữ Hán) nằm lọt bên trong `canonical(candidateChinese)` và phần chênh lệch là hậu tố chỉ loại/danh xưng phổ biến (`岛`, `镇`, `城`, `村`, `小区`, `博士`, `船长`, `警官`, `医生`, `局长`, `先生`, `小姐`, `徽章`, `2`, `3`, `4`).

### 1.3 Unified 3-Way Gate & Batch Classifier
- `evaluateScannedTermCandidate(params: { candidate: DiscoveredEntity; existingGlossary: GlossaryItem[]; sourceText: string; checkStandaloneOutsideLongTerm?: boolean }): ScanQualityEvaluation`
- `classifyScannedGlossaryBatch(params: { candidates: DiscoveredEntity[]; existingGlossary: GlossaryItem[]; sourceText: string; chapterTitle?: string; chapterId?: string; idPrefix?: string; defaultOrigin?: GlossaryItem['origin'] }): ScanBatchClassificationResult`
  - Dùng chung cho cả `useGlossaryScan.ts` (quét sỉ) và `classifyDiscoveredEntitiesForGlossary` / `useWorkspaceState.ts` (đơn chương).
  - Bảo đảm chạy hoàn toàn tất định, `< 10ms` mỗi chương, `0` lời gọi API bên ngoài.

### 1.4 Loop-1 Chapter Anchor Selector
- `prioritizeKnownAnchorEntriesForChapter(sourceText: string, glossary: GlossaryItem[], maxLimit?: number): ChapterScanAnchorEntry[]`
  - Ưu tiên các mục xuất hiện trực tiếp trong `sourceText` (kể cả Giản/Phồn thể và `variants`) lên trước, rồi đến các mục `isPinned`, tối đa `maxLimit = 150`. Trả về `{ chinese, vietnamese, isPinned }` giữ nguyên nghĩa Việt chuẩn để mô hình tham chiếu ngay từ Vòng 1.

---

## 2. Prompt & Direct Engine Contracts (`src/services/ai/glossaryPrompts.ts`, `src/services/ai/prompts.ts`, `src/services/directGlossaryEngine.ts`)

- **`glossaryPrompts.ts`**:
  - Sửa typo ví dụ tại `buildEntityExtractionInstruction('analyze')` từ `'萬劍歸宗' -> '萬劍归宗'` thành quy tắc bảo toàn chính xác dạng chữ gốc (`'萬劍歸宗'` giữ nguyên `'萬劍歸宗'`).
  - Bổ sung chỉ dẫn âm tính rõ ràng trong `analyze`/`extract` và `buildEntitySchema`:
    - `pinyin`: BẮT BUỘC phiên âm Hán-Việt tiếng Việt; CẤM Bính âm có/không dấu thanh (`huò zūn`, `Yì Tiān Lěi`), CẤM chữ Hán (`秦局`).
    - `vietnamese`: Tên Trung dùng Hán-Việt chuẩn; chỉ dùng tên tiếng Anh nếu là phiên âm ngoại lai thật.
    - `note`: Viết 100% bằng tiếng Việt thuần túy, CẤM chép lẫn chữ Hán gốc vào mô tả.
    - Không trích xuất danh từ phổ thông, câu bình luận, mã ngắn (`A1`, `A2`), hay mảnh cắt ngắn của thuật ngữ đã có.
- **`prompts.ts` (`buildAnalyzeGlossaryPayload`)**:
  - Nhận thêm `genre?: string`, `tone?: string`, `description?: string`, `knownGlossaryEntries?: ChapterScanAnchorEntry[]`.
  - Khi `knownGlossaryEntries` có dữ liệu (áp dụng cho **cả Vòng 1 lẫn Vòng 2+**), chèn khối `[THUẬT NGỮ ĐÃ BIẾT TRONG TRUYỆN - GIỮ NHẤT QUÁN & KHÔNG TRÍCH LẠI]:` kèm `- [chinese] -> [vietnamese]`, cùng bối cảnh thể loại/tông giọng truyện nếu có.
  - Vẫn tương thích ngược 100% với caller cũ chỉ truyền `knownChineseTerms?: string[]`.
- **`directGlossaryEngine.ts` (`DirectGlossaryCommonParams`)**:
  - Chấp nhận thêm `genre?: string`, `tone?: string`, `description?: string`, `knownGlossaryEntries?: ChapterScanAnchorEntry[]` và truyền vào `buildAnalyzeGlossaryPayload`.

---

## 3. Hook & UI Contracts

- **`useGlossaryScan.ts`**:
  - Ở **cả Vòng 1 lẫn Vòng 2+**, gọi `prioritizeKnownAnchorEntriesForChapter(chapterInputText, updatedGlossary, 150)` và truyền `genre`, `tone`, `description` của `activeProject` vào `analyzeGlossaryDirect`.
  - Chuyển toàn bộ `suggestions` qua `classifyScannedGlossaryBatch`: `acceptedItems` → `updatedGlossary` + log mới, `reviewItems` → `projectRef.current.pendingGlossary` + `pendingDiscovered`, cộng dồn `scanTelemetry` (`acceptedCount`, `reviewCount`, `rejectedCount`) và log dòng `[Tổng kết hậu kiểm]` khi kết thúc.
- **`useWorkspaceState.ts` (`handleAnalyzeGlossary` + `handleImportSuggestions`)**:
  - Truyền `genre`, `tone`, `description` và `knownGlossaryEntries` từ `activeProject` vào `analyzeGlossaryDirect`.
  - Đưa gợi ý đi qua `evaluateScannedTermCandidate` để gắn cảnh báo/lọc rác nhất quán với quét sỉ.
- **`glossaryMatch.ts` (`computeGlossaryHealth`) + `useGlossaryState.ts` + `GlossaryHealthBar.tsx`**:
  - Thêm `formatIssueIds: string[]` trong `GlossaryHealthReport` và bộ lọc `'format_issues'` (`"Lỗi phiên âm / ghi chú"`) trên `GlossaryHealthBar`.
