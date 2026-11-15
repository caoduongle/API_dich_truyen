# Data Model: Nâng cao chất lượng dịch truyện (Translation Quality Uplift)

**Feature**: `163-translation-quality-uplift`
**Date**: 2026-11-15
**Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

Tất cả các thay đổi đối với mô hình dữ liệu lưu trữ (`src/types.ts`) đều là **bổ sung tùy chọn (additive & optional)** theo sự cho phép rõ ràng của người dùng (Clarifications 2026-11-15, Constitution Principle IV), bảo đảm tương thích ngược 100% với IndexedDB, tệp sao lưu `.json` và đồng bộ Google Drive.

---

## 1. Hồ sơ nhân vật & Mục từ điển (`src/types.ts`)

### 1.1. `CharacterGender` & `CharacterRelationRule`

```ts
export type CharacterGender = 'male' | 'female' | 'neutral' | 'unknown';

export interface CharacterRelationRule {
  /** Tên tiếng Trung, tên tiếng Việt hoặc vai trò của đối phương (ví dụ: "萧薰儿", "Huân Nhi", "Sư huynh") */
  targetName: string;
  /** Đại từ nhân vật này tự xưng với đối phương (ví dụ: "ta", "muội", "đệ", "vi sư") */
  selfPronoun: string;
  /** Đại từ nhân vật này gọi đối phương (ví dụ: "ngươi", "huynh", "tỷ", "đồ nhi") */
  targetPronoun: string;
  /** Ghi chú hoàn cảnh áp dụng tùy chọn (ví dụ: "khi ở riêng", "trước mặt người ngoài") */
  note?: string;
}

export interface CharacterProfile {
  /** Giới tính nhân vật để cố định đại từ ngôi thứ 3 và xưng hô */
  gender?: CharacterGender;
  /** Ngôi tự xưng mặc định khi nói chuyện chung (ví dụ: "ta", "bản tọa", "thiếp", "tôi") */
  defaultSelfPronoun?: string;
  /** Đại từ ngôi thứ 3 trong lời dẫn tự sự (ví dụ: "hắn", "y", "chàng", "nàng", "cô", "lão") */
  defaultNarrativePronoun?: string;
  /** Danh sách quy tắc xưng hô cụ thể với các nhân vật/vai trò khác */
  relations?: CharacterRelationRule[];
}
```

### 1.2. Mở rộng `GlossaryItem` & `PendingGlossaryItem`

| Trường | Kiểu | Bắt buộc | Mô tả & Quy tắc xác thực |
|---|---|---|---|
| `id` .. `needsReview` | *(giữ nguyên)* | *(như hiện tại)* | Không thay đổi ngữ nghĩa hoặc kiểu dữ liệu của bất kỳ trường hiện có nào. |
| `isPinned` | `boolean \| undefined` | Không | Nếu `true`, mục từ điển luôn được đưa vào chỉ dẫn của mọi giai đoạn trong dự án (tối đa 50 mục ghim mỗi lượt gọi). Mặc định `undefined` (`false`). |
| `characterProfile` | `CharacterProfile \| undefined` | Không | Chỉ có ý nghĩa khi `type === 'character'`. Nếu thiếu hoặc tất cả trường con rỗng → coi là "chưa khai báo hồ sơ" (`FR-008a`). |

**Quy tắc xác thực & phòng chống Prompt Injection (`validateCharacterProfile` / `normalizeCharacterProfile`)**:
- `gender` nếu có phải thuộc `'male' | 'female' | 'neutral' | 'unknown'`; giá trị lạ được chuẩn hóa về `'unknown'`.
- Mọi trường chuỗi trong `CharacterProfile` (`defaultSelfPronoun`, `defaultNarrativePronoun`, `relations[].targetName`, `relations[].selfPronoun`, `relations[].targetPronoun`, `relations[].note`) BẮT BUỘC đi qua `sanitizePromptInput`, loại bỏ hoàn toàn ký tự xuống dòng (`[\r\n]+` → khoảng trắng) để ngăn chặn kỹ thuật chèn dòng phá vỡ cấu trúc prompt khi nhập từ tệp JSON/Drive chia sẻ, cắt khoảng trắng thừa (`trim()`), và giới hạn độ dài (`<= 40` ký tự cho đại từ/tên, `<= 120` ký tự cho `note`).
- Mỗi phần tử trong `relations` chỉ hợp lệ khi có đủ `targetName.trim()`, `selfPronoun.trim()`, và `targetPronoun.trim()`; giới hạn tối đa 20 quy tắc quan hệ mỗi nhân vật.

### 1.3. Quy tắc bảo toàn khi đồng bộ & hợp nhất (`mergeGlossaryPreservingProfiles`)

Khi hợp nhất danh sách `remoteGlossary` (từ Google Drive bundle/monolithic hoặc tệp nhập) với `localGlossary`:
1. Khớp mục từ điển theo `id` trước; nếu không khớp `id`, khớp theo chữ Hán chuẩn hóa (`isHanEquivalent(local.chinese, remote.chinese)`) và cùng `vietnamese`.
2. Nếu mục `remote` không có `characterProfile` (`undefined`) nhưng mục `local` tương ứng đã có `characterProfile`, **bảo toàn `local.characterProfile`** (`FR-008b`).
3. Nếu cả hai cùng có `characterProfile`, ưu tiên bản thuộc dự án có `updatedAt` mới hơn; đối với mảng `relations`, hợp nhất theo `targetName` không trùng lặp.
4. Tương tự cho cờ `isPinned`: nếu `remote.isPinned === undefined` và `local.isPinned !== undefined`, giữ giá trị của `local`.

---

## 2. Ngữ cảnh liên tục (`ContinuityContext` — `src/services/translation/types.ts`)

Thực thể chỉ tồn tại trong bộ nhớ lúc chạy (runtime-only, không lưu xuống IndexedDB):

```ts
export interface ContinuityContext {
  /** 1-2 đoạn văn tiếng Trung cuối cùng của phân đoạn hoặc chương liền trước (tối đa 350 ký tự) */
  previousSourceTail?: string;
  /** 1-2 đoạn văn tiếng Việt cuối cùng của phân đoạn hoặc chương liền trước (tối đa 500 ký tự) */
  previousTranslationTail?: string;
  /** Nhãn nguồn ngữ cảnh để ghi log/debug ('previous-chunk' | 'previous-chapter') */
  sourceKind?: 'previous-chunk' | 'previous-chapter';
}
```

**Quy tắc vòng đời**:
- Chỉ đọc: được truyền vào `buildRawTranslationPayload` và `buildPolishTranslationPayload` trong một khối đóng khung riêng biệt.
- Hậu kiểm chống lặp (`stripDuplicatedContinuityOverlap`): Nếu đoạn đầu tiên của kết quả dịch trùng khớp $\ge 85\%$ với đoạn cuối của `previousTranslationTail`, đoạn bị lặp ở đầu kết quả mới sẽ bị loại bỏ.

---

## 3. Lỗi chất lượng mở rộng (`DirectQaCritiqueIssue` — `src/types.ts` & `src/services/translation/types.ts`)

### 3.1. Phân loại lỗi (`QaIssueType`)

```ts
export type QaIssueType =
  | 'omission'        // Bỏ sót câu/đoạn/chi tiết
  | 'addition'        // Thêm thắt/ảo giác ngoài nguyên tác
  | 'repetition'      // Lặp từ/câu/đoạn
  | 'terminology'     // Sai thuật ngữ/tên riêng trong từ điển
  | 'mistranslation'  // Dịch sai lệch nghĩa gốc (MỚI - FR-013)
  | 'pronoun'         // Sai đại từ nhân xưng / giới tính (MỚI - FR-013)
  | 'raw_leak'        // Sót chữ Hán chưa dịch (MỚI - FR-013)
  | 'other';          // Lỗi khác
```

### 3.2. Cấu trúc `DirectQaCritiqueIssue` (dùng chung cho `Chapter.qaIssues` & `ChapterMetadata.qaIssues`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `type` | `QaIssueType` | Có | Loại lỗi kiểm duyệt (tương thích ngược với 5 loại cũ + 3 loại mới). |
| `severity` | `'critical' \| 'warning' \| 'info'` | Có | Mức độ nghiêm trọng. |
| `targetText` | `string` | Có | Đoạn trích nguyên văn trong bản dịch tiếng Việt (hoặc `""` nếu bỏ sót hoàn toàn / lỗi cấp chương). |
| `description` | `string` | Có | Mô tả chi tiết vấn đề và đối chiếu tiếng Trung gốc. |
| `paragraphIndex` | `number \| undefined` | Không | Chỉ số đoạn văn (0-based) trong bản dịch nơi xảy ra lỗi; `undefined` nếu lỗi ở mức toàn chương (`FR-014`). |
| `source` | `'deterministic' \| 'ai_critique' \| undefined` | Không | Nguồn phát hiện lỗi (`FR-015`). Mặc định `'ai_critique'` đối với dữ liệu cũ. |
| `expectedTerm` | `{ chinese: string; vietnamese: string } \| undefined` | Không | Cặp thuật ngữ kỳ vọng (nếu là lỗi `terminology` hoặc `pronoun`). |
| `repaired` | `boolean \| undefined` | Không | Đánh dấu lỗi đã được sửa qua luồng sửa có mục tiêu (`FR-016`). |

---

## 4. Báo cáo độ trung thành lượt chuốt & Đánh giá chất lượng (`src/services/translation/types.ts`)

```ts
export interface PolishFidelityReport {
  isAcceptable: boolean;
  previousGlossaryViolations: number;
  candidateGlossaryViolations: number;
  ungroundedProperNouns: string[];
  paragraphCountDelta: number;
  rejectionReason?: string;
}

export interface QualityEvaluationMetrics {
  sampleId: string;
  glossaryComplianceRate: number;      // 0.0 -> 1.0 (SC-001: >= 0.98)
  falseSubstitutionCount: number;      // Số lần thay thế cứng làm hỏng từ ghép (SC-002: === 0)
  chineseLeftoverRatio: number;        // Tỉ lệ ký tự Hán sót lại
  paragraphParityPassed: boolean;      // Khớp cấu trúc đoạn
  pronounConsistencyRate: number;      // 0.0 -> 1.0 (SC-003)
  ungroundedProperNounCount: number;   // Số tên riêng bịa thêm ngoài nguồn (SC-004)
  promptGlossaryCharCount: number;     // Độ dài phần từ điển trong prompt (SC-005)
}
```

---

## 5. Cài đặt người dùng (`localStorage` qua `src/hooks/useAIConfig.ts`)

| Khóa `localStorage` | Kiểu | Mặc định | Mô tả |
|---|---|---|---|
| `enable_auto_targeted_repair` | `'true' \| 'false'` | `'false'` | Bật/tắt tự động sửa lỗi nghiêm trọng theo đoạn (tối đa 1 lượt/chương) sau khi kiểm duyệt (`FR-024`, `FR-025`). |
