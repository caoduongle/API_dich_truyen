# Interface & Module Contracts: Nâng cao chất lượng dịch truyện (163)

**Feature**: `163-translation-quality-uplift`
**Date**: 2026-11-15
**Spec**: [../spec.md](../spec.md) | **Data Model**: [../data-model.md](../data-model.md)

Tài liệu này quy định hợp đồng giao tiếp giữa các tầng Model/Service (`src/lib/`, `src/services/`), Controller (`src/hooks/`) và View (`src/components/`) theo đúng ranh giới kiến trúc MVC của Constitution Principle III.

---

## 1. Hợp đồng Xử lý Từ điển & Hồ sơ Nhân vật (`src/lib/glossaryMatch.ts`)

```ts
import { GlossaryItem, CharacterProfile } from '../types';

export interface GlossaryConflictWarning {
  canonicalChinese: string;
  winningItem: GlossaryItem;
  shadowedItems: GlossaryItem[];
}

export interface RelevantGlossarySelection {
  /** Các mục từ điển thực sự xuất hiện trong văn bản nguồn + các mục được ghim (isPinned) */
  entries: GlossaryItem[];
  /** Các mục từ điển có xuất hiện trực tiếp trong văn bản nguồn (dùng cho kiểm tra tuân thủ) */
  matchedInSource: GlossaryItem[];
  /** Danh sách cảnh báo khi có nhiều mục trùng chữ Hán nhưng khác nghĩa Việt */
  conflicts: GlossaryConflictWarning[];
}

export interface SafeSubstitutionResult {
  /** Văn bản nguồn sau khi đã thay thế các thuật ngữ có độ dài >= minHanLength bằng [Tên_Việt] */
  substitutedText: string;
  /** Tổng số lần thay thế đã thực hiện */
  totalReplacements: number;
  /** Danh sách thuật ngữ đã được thay thế cứng */
  substitutedTerms: GlossaryItem[];
}

/**
 * Lọc danh sách từ điển liên quan đến sourceText (hỗ trợ cả giản thể/phồn thể qua canonicalizeHan)
 * và giải quyết xung đột tất định (FR-001, FR-004).
 */
export function selectRelevantGlossary(
  sourceText: string,
  glossary: GlossaryItem[],
  options?: { maxPinned?: number }
): RelevantGlossarySelection;

/**
 * Thay thế cứng an toàn các thuật ngữ vào sourceText:
 * - Bỏ qua các mục có số ký tự Hán < minHanLength (mặc định 2) để không làm vỡ từ ghép (FR-002).
 * - Ưu tiên cụm dài nhất trước, một lượt duy nhất, không thay bên trong [...] đã đánh dấu (FR-003).
 */
export function substituteGlossaryTermsSafely(
  sourceText: string,
  glossary: GlossaryItem[],
  options?: { minHanLength?: number }
): SafeSubstitutionResult;

/**
 * Hợp nhất danh sách từ điển khi kéo dữ liệu từ Google Drive / bản sao lưu cũ:
 * Bảo toàn characterProfile và isPinned của bản local nếu bản remote từ phiên bản cũ không có (FR-008b).
 */
export function mergeGlossaryPreservingProfiles(
  localGlossary: GlossaryItem[],
  remoteGlossary: GlossaryItem[]
): GlossaryItem[];

/**
 * Chuẩn hóa và xác thực CharacterProfile từ dữ liệu nhập hoặc lưu trữ (FR-008a, FR-008c).
 */
export function normalizeCharacterProfile(
  profile?: CharacterProfile | null
): CharacterProfile | undefined;
```

---

## 2. Hợp đồng Xây dựng Prompt & Ngữ cảnh Liên tục (`src/services/ai/prompts.ts`)

```ts
import { ContinuityContext } from '../translation/types';

export interface BuildRawTranslationPromptParams {
  text: string;
  genre: string;
  tone: string;
  description?: string;
  glossary?: GlossaryEntry[];
  isRetry?: boolean;
  /** Ngữ cảnh chỉ-đọc từ phân đoạn trước hoặc chương trước (FR-006, FR-007) */
  continuity?: ContinuityContext;
}

export interface BuildPolishTranslationPromptParams {
  sourceText: string;
  rawTranslation: string;
  genre: string;
  tone: string;
  description?: string;
  glossary?: GlossaryEntry[];
  additionalInstructions?: string;
  isExtractionEnabled?: boolean;
  roundIndex?: number;
  totalRounds?: number;
  /** Ngữ cảnh chỉ-đọc từ phân đoạn trước hoặc chương trước (FR-006, FR-007) */
  continuity?: ContinuityContext;
}
```

**Bất biến của Prompt Builder (FR-010, FR-019)**:
1. Văn bản nguồn cần dịch chỉ xuất hiện **đúng 1 lần** trong `prompt` của `buildRawTranslationPayload`:
   - Nếu văn bản đầu vào đã có sẵn ngoặc vuông (`hasBrackets`), dùng tiêu đề `--- VĂN BẢN TIẾNG TRUNG (ĐÃ ĐÁNH DẤU TỪ ĐIỂN) ---`.
   - Nếu văn bản đầu vào chưa có ngoặc vuông, dùng tiêu đề `--- VĂN BẢN TIẾNG TRUNG GỐC ---` với chú thích nội tuyến giữ nguyên chữ Hán gốc kèm nghĩa Việt `Chữ_Hán[Tên_Việt]` cho các thuật ngữ $\ge 2$ ký tự Hán (giúp gửi 1 lần duy nhất mà vẫn giữ nguyên mặt chữ Hán gốc tại chỗ cho AI và cho các kiểm thử cắt chuỗi theo tiêu đề này).
2. Khối `ContinuityContext` (`[NGỮ CẢNH LIỀN TRƯỚC — CHỈ ĐỌC...]`), nếu có, BẮT BUỘC đặt **trước** tiêu đề `--- VĂN BẢN TIẾNG TRUNG GỐC ---` để phần sau tiêu đề chỉ chứa thuần túy văn bản cần dịch của phân đoạn hiện tại.
3. Chỉ các mục từ điển từ `selectRelevantGlossary(text, glossary).entries` mới được đưa vào `prompt` của cả 3 giai đoạn (`buildRawTranslationPayload`, `buildPolishTranslationPayload`, `buildQaCritiquePayload`).
4. Với mỗi mục có `type === 'character'` và `characterProfile`, dòng mô tả trong prompt hiển thị rõ giới tính, đại từ ngôi thứ 3 (`defaultNarrativePronoun`), ngôi tự xưng (`defaultSelfPronoun`) và các cặp quan hệ (`relations`) liên quan (đã qua `normalizeCharacterProfile` khử ký tự điều khiển và xuống dòng).
5. Thứ tự ưu tiên chỉ dẫn luôn được phát biểu tường minh trong `systemInstruction`. Trong `buildPolishTranslationPayload`, giữ nguyên chuỗi mặc định của `[YÊU CẦU BIÊN TẬP BỔ SUNG TỪ NGƯỜI DÙNG]` để tương thích ngược với kiểm thử hiện có, nhưng đặt ràng buộc "trung thành tuyệt đối 100% với nguyên tác, không thêm thắt tình tiết/tên riêng ngoài nguồn" ở mức ưu tiên số 1 trong `systemInstruction`.
6. Trong `buildQaCritiquePayload`, schema JSON cho `issues.items.properties.type.enum` bao gồm đủ 8 loại:
   `["omission", "addition", "repetition", "terminology", "mistranslation", "pronoun", "raw_leak", "other"]`.

---

## 3. Hợp đồng Kiểm tra Tất định & Hậu kiểm Chuốt văn (`src/services/translation/translationValidation.ts`)

```ts
import { GlossaryItem } from '../../types';
import { DirectQaCritiqueIssue, PolishFidelityReport } from './types';

/**
 * Kiểm tra tất định tuân thủ từ điển và nhất quán đại từ nhân vật theo từng đoạn văn (FR-005, FR-009).
 * Nếu isPartialFallback === true, không sinh hàng loạt lỗi giả trên đoạn dùng phiên âm dự phòng.
 */
export function runDeterministicTranslationChecks(params: {
  sourceText: string;
  translatedText: string;
  glossary: GlossaryItem[];
  isPartialFallback?: boolean;
}): DirectQaCritiqueIssue[];

/**
 * Đánh giá độ trung thành của bản chuốt văn lượt K so với nguyên tác và bản lượt K-1 (FR-011).
 * Trả về isAcceptable = false nếu vi phạm từ điển tăng lên, xuất hiện tên riêng bịa đặt ngoài nguồn,
 * hoặc lệch cấu trúc đoạn văn.
 */
export function evaluatePolishRoundFidelity(params: {
  sourceText: string;
  previousDraft: string;
  candidatePolished: string;
  glossary: GlossaryItem[];
}): PolishFidelityReport;

/**
 * Gán paragraphIndex cho các lỗi từ AI QA Critique (dựa trên targetText) và khử trùng lặp
 * với danh sách lỗi tất định (FR-014, FR-015).
 * BẤT BIẾN TƯƠNG THÍCH:
 * - Chỉ gắn thuộc tính `paragraphIndex` vào object lỗi khi tìm thấy đoạn văn khớp (`idx >= 0`),
 *   không thêm các key `undefined` làm thay đổi hình dạng object của lỗi AI gốc.
 * - Trong `executeSingleChapterTranslation`, chỉ cập nhật `chapter.qaIssues` khi
 *   `enableAiQaCritique && qaRunSucceeded` (tuân thủ `resolveChapterQaIssues`).
 */
export function mergeAndDeduplicateQaIssues(params: {
  deterministicIssues: DirectQaCritiqueIssue[];
  aiIssues: DirectQaCritiqueIssue[];
  translatedText: string;
}): DirectQaCritiqueIssue[];

/**
 * Gióng đoạn văn bản dịch (`paragraphIndex`) sang cửa sổ đoạn văn tiếng Trung gốc tương ứng,
 * có bù trừ độ lệch dòng tiêu đề chương (`isChapterTitleLine`) để tránh lấy nhầm đoạn nguồn
 * khi sửa có mục tiêu.
 */
export function mapTranslatedParagraphToSourceWindow(
  paragraphIndex: number,
  sourceParagraphs: string[],
  translatedParagraphs: string[]
): {
  primarySourceIndex: number;
  windowStartIndex: number;
  windowEndIndex: number;
  isExactOneToOne: boolean;
};
```

---

## 4. Hợp đồng Sửa có Mục tiêu theo Đoạn (`src/services/translation/targetedRepair.ts`)

```ts
import { GlossaryItem } from '../../types';
import { DirectQaCritiqueIssue } from './types';

export interface TargetedParagraphRepairParams {
  sourceText: string;
  translatedText: string;
  issues: DirectQaCritiqueIssue[];
  glossary: GlossaryItem[];
  genre: string;
  tone: string;
  description?: string;
  apiKeys: string[];
  model?: string;
  startKeyIndex?: number;
  signal?: AbortSignal;
  /** Nếu truyền vào, chỉ sửa đúng các lỗi có trong mảng này; mặc định lọc các lỗi severity === 'critical' có paragraphIndex hợp lệ */
  targetIssueIndices?: number[];
}

export interface TargetedParagraphRepairResult {
  repairedTranslatedText: string;
  updatedIssues: DirectQaCritiqueIssue[];
  repairedParagraphIndices: number[];
  rejectedParagraphIndices: number[];
  successKeyIndex: number;
}

/**
 * Dịch lại chỉ các đoạn văn có lỗi nghiêm trọng thông qua callGeminiDirect,
 * kèm 1 đoạn trước và 1 đoạn sau làm ngữ cảnh chỉ-đọc (FR-016, FR-017, FR-018).
 * Bảo đảm 100% các đoạn không nằm trong repairedParagraphIndices giữ nguyên từng ký tự.
 */
export async function repairChapterCriticalIssuesDirect(
  params: TargetedParagraphRepairParams
): Promise<TargetedParagraphRepairResult>;
```

---

## 5. Hợp đồng UI & Controller (`src/hooks/`, `src/components/`)

1. **`useAIConfig.ts` & `TranslationQualitySection.tsx`**:
   - Bổ sung state `enableAutoTargetedRepair: boolean` (mặc định `false`, đồng bộ với `localStorage.getItem('enable_auto_targeted_repair')`) và `setEnableAutoTargetedRepair: (b: boolean) => void` (`FR-024`, `FR-025`).
   - Hiển thị công tắc bật/tắt trong `TranslationQualitySection.tsx` với mô tả rõ ràng về việc tiêu thụ thêm tối đa 1 lượt gọi AI cho mỗi chương có lỗi nghiêm trọng (`FR-023`).
2. **`AddGlossaryForm.tsx`, `GlossaryDetailSidebar.tsx`, `QuickAddTermModal.tsx`**:
   - Khi `type === 'character'`, hiển thị khối cấu hình tùy chọn **Hồ sơ nhân vật** (Giới tính, Đại từ ngôi thứ 3, Ngôi tự xưng mặc định, Quy tắc xưng hô theo quan hệ) và nút ghim ưu tiên (`isPinned`) (`FR-008c`).
3. **`chapterTranslationService.ts` & `useWorkspaceState.ts`**:
   - Dùng chung một hàm chuẩn hóa và kiểm tra trùng thực thể mới phát hiện (`classifyDiscoveredEntitiesForGlossary`) để hai luồng dịch hàng loạt và dịch đơn chương hành xử đồng nhất (`FR-021`).
