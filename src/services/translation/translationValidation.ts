/**
 * Translation Validation & Error Recognition
 * Kiểm tra tính hợp lệ của văn bản dịch, bảo tồn tiêu đề chương và nhận diện lỗi có thể retry đệ quy
 */

import {
  separateChapterTitleAndBody,
  ensureChapterTitlePreserved,
  validateTranslationOutput,
  validatePolishIntegrity,
  validateParagraphParity,
  isChapterTitleLine,
} from '../../lib/text';

import { ChapterMetadata, GlossaryItem } from '../../types';
import {
  countHanChars,
  findNonOverlappingParagraphTerms,
  normalizeCharacterProfile,
  selectRelevantGlossary,
} from '../../lib/glossaryMatch';
import { canonicalizeHan, findCanonicalSubstring } from '../../lib/sinoNormalize';
import { GeminiRequestError } from '../gemini/types';
import {
  ContinuityContext,
  DirectQaCritiqueIssue,
  ParagraphMergeReversion,
  PolishFidelityReport,
  PolishParagraphMergeResult,
  TranslationOutcomeType,
} from './types';
import {
  analyzeStructureParity,
  checkStructureParityIssues,
  extractParagraphSignature,
} from './structureParity';

/**
 * Trích xuất ngữ cảnh liên tục tối đa 1-2 đoạn cuối từ chương liền trước (đã được dịch) (FR-007).
 */
export function buildChapterContinuityContext(
  prevChapter?: {
    sourceText?: string;
    polishedTranslation?: string;
    rawTranslation?: string;
  } | null
): ContinuityContext | undefined {
  if (!prevChapter) return undefined;
  const bestTranslation = (prevChapter.polishedTranslation || prevChapter.rawTranslation || '').trim();
  const srcText = (prevChapter.sourceText || '').trim();
  if (!bestTranslation) return undefined;

  const extractTail = (txt: string, maxChars: number): string => {
    if (!txt) return '';
    const joined = txt
      .replace(/\r\n/g, '\n')
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean)
      .slice(-2)
      .join('\n\n');
    return joined.length > maxChars ? joined.slice(-maxChars) : joined;
  };

  const previousSourceTail = extractTail(srcText, 350);
  const previousTranslationTail = extractTail(bestTranslation, 500);
  if (!previousTranslationTail) return undefined;

  return {
    ...(previousSourceTail ? { previousSourceTail } : {}),
    previousTranslationTail,
    sourceKind: 'previous-chapter',
  };
}

/**
 * Tìm ID của chương ngay trước chương hiện tại trong danh sách chương theo vị trí mảng.
 */
export function resolvePreviousChapterId(chapters: ChapterMetadata[], currentChapterId: string): string | null {
  if (!Array.isArray(chapters) || chapters.length === 0 || !currentChapterId) return null;
  const idx = chapters.findIndex((c) => c.id === currentChapterId);
  if (idx > 0) return chapters[idx - 1].id;
  return null;
}

export {
  separateChapterTitleAndBody,
  ensureChapterTitlePreserved,
  validateTranslationOutput,
  validatePolishIntegrity,
  validateParagraphParity,
};

const HAN_RUN_RE = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]{2,}/;
const HAN_CHAR_RE = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;

export function splitNonEmptyParagraphs(text: string): string[] {
  if (!text) return [];
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function paragraphContainsGlossaryTerm(sourceParagraph: string, item: GlossaryItem): boolean {
  if (!sourceParagraph) return false;
  const forms = [item.chinese, ...(item.variants || [])]
    .map((f) => (f || '').trim())
    .filter(Boolean);
  const canonPara = canonicalizeHan(sourceParagraph);

  for (const form of forms) {
    if (countHanChars(form) >= 2) {
      if (sourceParagraph.includes(form)) return true;
      const canonForm = canonicalizeHan(form);
      if (canonForm && canonPara.includes(canonForm)) return true;
      if (findCanonicalSubstring(sourceParagraph, form) !== null) return true;
    } else if (countHanChars(form) === 1) {
      // Với từ đơn 1 ký tự Hán, chỉ khớp khi đứng độc lập (không kẹp giữa ký tự Hán tạo từ ghép như 森林)
      const chars = Array.from(sourceParagraph);
      const targetChar = Array.from(form)[0];
      const targetCanon = canonicalizeHan(targetChar);
      for (let idx = 0; idx < chars.length; idx++) {
        if (chars[idx] === targetChar || canonicalizeHan(chars[idx]) === targetCanon) {
          const prevHan = idx > 0 && HAN_CHAR_RE.test(chars[idx - 1]);
          const nextHan = idx < chars.length - 1 && HAN_CHAR_RE.test(chars[idx + 1]);
          if (!prevHan && !nextHan) return true;
        }
      }
    }
  }
  return false;
}

/**
 * Kiểm tra tuân thủ từ điển và sót chữ Hán theo từng đoạn văn (FR-005).
 */
export function checkGlossaryCompliance(params: {
  sourceText: string;
  translatedText: string;
  glossary: GlossaryItem[];
  isPartialFallback?: boolean;
}): DirectQaCritiqueIssue[] {
  const { sourceText, translatedText, glossary, isPartialFallback } = params;
  if (isPartialFallback || !sourceText?.trim() || !translatedText?.trim()) {
    return [];
  }

  const sourceParagraphs = splitNonEmptyParagraphs(sourceText);
  const translatedParagraphs = splitNonEmptyParagraphs(translatedText);
  if (sourceParagraphs.length === 0 || translatedParagraphs.length === 0) {
    return [];
  }

  const issues: DirectQaCritiqueIssue[] = [];
  const { matchedInSource } = selectRelevantGlossary(sourceText, glossary || []);
  const checkableItems = matchedInSource.filter((g) => (g.vietnamese || '').trim().length > 0);
  const reportedNonExactPairs = new Set<string>();

  for (let pIdx = 0; pIdx < translatedParagraphs.length; pIdx++) {
    const transPara = translatedParagraphs[pIdx];

    // Kiểm tra sót chữ Hán (>= 2 ký tự Hán liên tiếp)
    const leakMatch = HAN_RUN_RE.exec(transPara);
    if (leakMatch) {
      issues.push({
        type: 'raw_leak',
        severity: 'critical',
        targetText: transPara,
        description: `Đoạn ${pIdx + 1} còn sót chữ Hán chưa dịch ("${leakMatch[0]}").`,
        paragraphIndex: pIdx,
        source: 'deterministic',
      });
    }

    if (checkableItems.length === 0) continue;

    const alignment = mapTranslatedParagraphToSourceWindow(
      pIdx,
      sourceParagraphs,
      translatedParagraphs
    );

    const srcSlice = alignment.isExactOneToOne
      ? sourceParagraphs[alignment.primarySourceIndex] || ''
      : sourceParagraphs
          .slice(alignment.windowStartIndex, alignment.windowEndIndex + 1)
          .join('\n');

    const transSlice = alignment.isExactOneToOne
      ? transPara
      : translatedParagraphs
          .slice(Math.max(0, pIdx - 1), Math.min(translatedParagraphs.length, pIdx + 2))
          .join('\n');

    const normTransSlice = transSlice.normalize('NFKC').toLowerCase();
    const matchedSpans = findNonOverlappingParagraphTerms(srcSlice, checkableItems);
    const matchedItemsInSlice = new Set<GlossaryItem>();
    for (const span of matchedSpans) {
      matchedItemsInSlice.add(span.item);
    }

    for (const item of matchedItemsInSlice) {
      const expectedVi = item.vietnamese.trim();
      const normExpectedVi = expectedVi.normalize('NFKC').toLowerCase();
      if (!normExpectedVi) continue;

      if (!normTransSlice.includes(normExpectedVi)) {
        const dedupeKey = `${canonicalizeHan(item.chinese)}::${alignment.isExactOneToOne ? pIdx : 'window'}`;
        if (!alignment.isExactOneToOne && reportedNonExactPairs.has(dedupeKey)) {
          continue;
        }
        reportedNonExactPairs.add(dedupeKey);

        issues.push({
          type: 'terminology',
          severity: 'critical',
          targetText: transPara,
          description: `Đoạn ${pIdx + 1} có thuật ngữ "${item.chinese}" trong nguyên tác nhưng bản dịch chưa dùng đúng tên quy ước "${expectedVi}".`,
          paragraphIndex: pIdx,
          source: 'deterministic',
          expectedTerm: {
            chinese: item.chinese,
            vietnamese: expectedVi,
          },
        });
      }
    }
  }

  return issues;
}

const MALE_NARRATIVE_PRONOUN_RE = /(?:^|[^\p{L}\p{N}])(hắn|gã|chàng)(?=$|[^\p{L}\p{N}])/iu;
const FEMALE_NARRATIVE_PRONOUN_RE = /(?:^|[^\p{L}\p{N}])(nàng|cô ấy|cô ta|nàng ấy|nàng ta)(?=$|[^\p{L}\p{N}])/iu;
const GENERIC_MALE_NOUN_VI_RE = /(?:^|[^\p{L}\p{N}])(nam tử|nam nhân|thiếu niên|đại hán|lão giả|lão nhân|sư huynh|sư đệ|phụ thân|địch thủ|tên kia|gã kia|người đàn ông)(?=$|[^\p{L}\p{N}])/iu;
const GENERIC_FEMALE_NOUN_VI_RE = /(?:^|[^\p{L}\p{N}])(nữ tử|nữ nhân|thiếu nữ|cô gái|cô nương|tiểu thư|sư tỷ|sư muội|mẫu thân|phu nhân|người phụ nữ)(?=$|[^\p{L}\p{N}])/iu;
const SOURCE_MALE_HINT_RE = /他|少年|男子|男人|青年|大汉|师兄|师弟|父亲/;
const SOURCE_FEMALE_HINT_RE = /她|少女|女子|女人|姑娘|小姐|师姐|师妹|母亲|夫人/;

function stripQuotedDialogue(paragraph: string): string {
  return paragraph
    .replace(/"[^"\n]*"/g, ' ')
    .replace(/“[^”\n]*”/g, ' ')
    .replace(/«[^»\n]*»/g, ' ')
    .replace(/「[^」\n]*」/g, ' ');
}

function escapeRegExpSimple(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function paragraphMentionsCharacter(narrativeText: string, item: GlossaryItem): boolean {
  const vi = (item.vietnamese || '').trim();
  if (!vi) return false;
  const re = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRegExpSimple(vi)}(?=$|[^\\p{L}\\p{N}])`, 'iu');
  return re.test(narrativeText);
}

/**
 * Kiểm tra tính nhất quán đại từ nhân xưng ngôi thứ 3 dựa trên CharacterProfile (FR-009).
 * Chỉ báo lỗi khi câu văn (ngoài lời thoại) có mâu thuẫn giới tính rõ ràng với hồ sơ nhân vật duy nhất
 * được xác định trong đoạn văn để tránh báo nhầm trong cảnh có nhiều nhân vật khác giới.
 */
export function checkCharacterPronounConsistency(params: {
  sourceText: string;
  translatedText: string;
  glossary: GlossaryItem[];
  isPartialFallback?: boolean;
}): DirectQaCritiqueIssue[] {
  const { sourceText, translatedText, glossary, isPartialFallback } = params;
  if (isPartialFallback || !sourceText?.trim() || !translatedText?.trim()) {
    return [];
  }

  const { matchedInSource } = selectRelevantGlossary(sourceText, glossary || []);
  const profiledChars = matchedInSource.filter((g) => {
    const profile = normalizeCharacterProfile(g.characterProfile);
    return (
      (g.type === 'character' || profile !== undefined) &&
      (profile?.gender === 'male' || profile?.gender === 'female') &&
      (g.vietnamese || '').trim().length > 0
    );
  });

  if (profiledChars.length === 0) {
    return [];
  }

  const sourceParagraphs = splitNonEmptyParagraphs(sourceText);
  const translatedParagraphs = splitNonEmptyParagraphs(translatedText);
  const issues: DirectQaCritiqueIssue[] = [];

  for (let pIdx = 0; pIdx < translatedParagraphs.length; pIdx++) {
    const transPara = translatedParagraphs[pIdx];
    const narrativeOnly = stripQuotedDialogue(transPara);
    if (!narrativeOnly.trim()) continue;

    const alignment = mapTranslatedParagraphToSourceWindow(
      pIdx,
      sourceParagraphs,
      translatedParagraphs
    );
    const srcSlice = alignment.isExactOneToOne
      ? sourceParagraphs[alignment.primarySourceIndex] || ''
      : sourceParagraphs
          .slice(alignment.windowStartIndex, alignment.windowEndIndex + 1)
          .join('\n');

    const activeCharsInPara = profiledChars.filter(
      (c) => paragraphContainsGlossaryTerm(srcSlice, c) || paragraphMentionsCharacter(narrativeOnly, c)
    );
    if (activeCharsInPara.length === 0) continue;

    // Kiểm tra từng nhân vật có hồ sơ giới tính rõ ràng nếu trong đoạn không có nhân vật đối lập giới tính
    for (const charItem of activeCharsInPara) {
      const profile = normalizeCharacterProfile(charItem.characterProfile);
      const gender = profile?.gender;
      if (gender !== 'male' && gender !== 'female') continue;

      if (!paragraphMentionsCharacter(narrativeOnly, charItem)) continue;

      const hasOppositeProfiledChar = activeCharsInPara.some((other) => {
        if (other === charItem) return false;
        const otherGender = normalizeCharacterProfile(other.characterProfile)?.gender;
        return otherGender !== gender;
      });
      if (hasOppositeProfiledChar) continue;

      if (gender === 'female') {
        if (SOURCE_MALE_HINT_RE.test(srcSlice) || GENERIC_MALE_NOUN_VI_RE.test(narrativeOnly)) {
          continue;
        }
        const wrongMatch = MALE_NARRATIVE_PRONOUN_RE.exec(narrativeOnly);
        if (wrongMatch) {
          const suggested = profile?.defaultNarrativePronoun || 'nàng/cô';
          issues.push({
            type: 'pronoun',
            severity: 'critical',
            targetText: transPara,
            description: `Đoạn ${pIdx + 1}: Nhân vật "${charItem.vietnamese}" có giới tính Nữ nhưng văn tự sự dùng đại từ nam ("${wrongMatch[1]}"). Nên dùng "${suggested}".`,
            paragraphIndex: pIdx,
            source: 'deterministic',
            expectedTerm: {
              chinese: charItem.chinese,
              vietnamese: suggested,
            },
          });
        }
      } else if (gender === 'male') {
        if (SOURCE_FEMALE_HINT_RE.test(srcSlice) || GENERIC_FEMALE_NOUN_VI_RE.test(narrativeOnly)) {
          continue;
        }
        const wrongMatch = FEMALE_NARRATIVE_PRONOUN_RE.exec(narrativeOnly);
        if (wrongMatch) {
          const suggested = profile?.defaultNarrativePronoun || 'hắn/chàng';
          issues.push({
            type: 'pronoun',
            severity: 'critical',
            targetText: transPara,
            description: `Đoạn ${pIdx + 1}: Nhân vật "${charItem.vietnamese}" có giới tính Nam nhưng văn tự sự dùng đại từ nữ ("${wrongMatch[1]}"). Nên dùng "${suggested}".`,
            paragraphIndex: pIdx,
            source: 'deterministic',
            expectedTerm: {
              chinese: charItem.chinese,
              vietnamese: suggested,
            },
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Kiểm tra tất định tuân thủ từ điển và nhất quán đại từ nhân vật theo từng đoạn văn (FR-005, FR-009).
 * Nếu isPartialFallback === true, trả về mảng rỗng để tránh báo lỗi giả trên đoạn dùng phiên âm dự phòng.
 */
export function runDeterministicTranslationChecks(params: {
  sourceText: string;
  translatedText: string;
  glossary: GlossaryItem[];
  isPartialFallback?: boolean;
  includeStructureParity?: boolean;
}): DirectQaCritiqueIssue[] {
  if (params.isPartialFallback) {
    return [];
  }
  const baseIssues = [
    ...checkGlossaryCompliance(params),
    ...checkCharacterPronounConsistency(params),
  ];
  if (!params.includeStructureParity) {
    return baseIssues;
  }
  return [
    ...baseIssues,
    ...checkStructureParityIssues({
      sourceText: params.sourceText,
      translatedText: params.translatedText,
      isPartialFallback: params.isPartialFallback,
    }),
  ];
}

const TITLE_CASE_ENTITY_RE =
  /(?:^|[^\p{L}\p{N}])([\p{Lu}][\p{Ll}\p{M}]+(?:\s+[\p{Lu}][\p{Ll}\p{M}]*)+)(?=$|[^\p{L}\p{N}])/gu;
const UNICODE_WORD_RE = /[\p{L}\p{N}]+/gu;
const LATIN_WORD_RE = /[A-Za-z\u00C0-\u1EF9]+/gu;
const STRUCTURAL_GROUNDED_WORDS = ['chương', 'hồi', 'quyển', 'phần', 'tiết'];

function extractLowerWordTokens(input: string, regex: RegExp = UNICODE_WORD_RE): string[] {
  if (!input) return [];
  const normalized = input.normalize('NFC');
  const matches = normalized.match(regex);
  return matches ? matches.map((w) => w.toLowerCase()) : [];
}

/**
 * Phát hiện các cụm danh từ riêng viết hoa (>= 2 âm tiết Title Case) xuất hiện mới trong bản chuốt văn
 * mà không bắt nguồn từ bản lượt trước, nguyên tác hay bảng từ điển (FR-011).
 * Cho phép đổi chữ thường -> viết hoa chính xác (so khớp không phân biệt hoa/thường theo từng âm tiết).
 */
export function detectUngroundedProperNouns(params: {
  sourceText: string;
  previousDraft: string;
  candidatePolished: string;
  glossary: GlossaryItem[];
}): string[] {
  const { sourceText, previousDraft, candidatePolished, glossary } = params;
  if (!candidatePolished?.trim()) return [];

  const groundedTokens = new Set<string>(STRUCTURAL_GROUNDED_WORDS);
  for (const tok of extractLowerWordTokens(previousDraft || '')) {
    groundedTokens.add(tok);
  }
  for (const tok of extractLowerWordTokens(sourceText || '', LATIN_WORD_RE)) {
    groundedTokens.add(tok);
  }
  for (const item of glossary || []) {
    if (!item) continue;
    for (const tok of extractLowerWordTokens(item.vietnamese || '')) {
      groundedTokens.add(tok);
    }
    for (const tok of extractLowerWordTokens(item.pinyin || '')) {
      groundedTokens.add(tok);
    }
    for (const v of item.variants || []) {
      for (const tok of extractLowerWordTokens(v || '', LATIN_WORD_RE)) {
        groundedTokens.add(tok);
      }
    }
  }

  const ungrounded: string[] = [];
  const seen = new Set<string>();
  const lines = candidatePolished.normalize('NFC').split(/\r?\n/);

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || isChapterTitleLine(trimmedLine)) continue;

    // Bỏ qua dòng tiêu đề viết hoa toàn bộ (ALL CAPS)
    const lineWords = trimmedLine.match(UNICODE_WORD_RE) || [];
    const upperWords = lineWords.filter((w) => w.length >= 2 && w === w.toUpperCase() && w !== w.toLowerCase());
    if (lineWords.length >= 3 && upperWords.length / lineWords.length >= 0.6) {
      continue;
    }

    TITLE_CASE_ENTITY_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = TITLE_CASE_ENTITY_RE.exec(trimmedLine)) !== null) {
      const phrase = match[1].trim();
      if (phrase.replace(/\s+/g, '').length < 3) continue;

      const phraseTokens = extractLowerWordTokens(phrase);
      if (phraseTokens.length < 2) continue;

      const hasUngroundedToken = phraseTokens.some((tok) => !groundedTokens.has(tok));
      if (hasUngroundedToken) {
        const key = phrase.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          ungrounded.push(phrase);
        }
      }
    }
  }

  return ungrounded;
}

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
  roundIndex?: number;
}): PolishFidelityReport {
  const { sourceText, previousDraft, candidatePolished, glossary, roundIndex } = params;

  const previousGlossaryViolations = checkGlossaryCompliance({
    sourceText,
    translatedText: previousDraft,
    glossary,
  }).length;

  const candidateGlossaryViolations = checkGlossaryCompliance({
    sourceText,
    translatedText: candidatePolished,
    glossary,
  }).length;

  const draftParityReport = analyzeStructureParity(previousDraft, candidatePolished);
  const paragraphCountDelta = draftParityReport.paragraphCountDelta;

  const shouldCheckProperNouns = (roundIndex ?? 2) >= 2;
  const ungroundedProperNouns = shouldCheckProperNouns
    ? detectUngroundedProperNouns({
        sourceText,
        previousDraft,
        candidatePolished,
        glossary,
      })
    : [];

  const prevSourceReport = sourceText?.trim()
    ? analyzeStructureParity(sourceText, previousDraft)
    : null;
  const candSourceReport = sourceText?.trim()
    ? analyzeStructureParity(sourceText, candidatePolished)
    : null;

  const isMultiRound = (roundIndex ?? 2) >= 2;
  const reasons: string[] = [];
  if (candidateGlossaryViolations > previousGlossaryViolations) {
    reasons.push('GLOSSARY_REGRESSION');
  }
  if (ungroundedProperNouns.length > 0) {
    reasons.push('UNGROUNDED_PROPER_NOUN');
  }
  if (isMultiRound && paragraphCountDelta > 0) {
    reasons.push('PARAGRAPH_STRUCTURE_DIVERGENCE');
  }
  if (
    prevSourceReport &&
    candSourceReport &&
    candSourceReport.penaltyScore > prevSourceReport.penaltyScore &&
    (isMultiRound || paragraphCountDelta === 0)
  ) {
    reasons.push('STRUCTURE_PARITY_REGRESSION');
  }

  return {
    isAcceptable: reasons.length === 0,
    previousGlossaryViolations,
    candidateGlossaryViolations,
    ungroundedProperNouns,
    paragraphCountDelta,
    ...(prevSourceReport ? { previousStructurePenalty: prevSourceReport.penaltyScore } : {}),
    ...(candSourceReport ? { candidateStructurePenalty: candSourceReport.penaltyScore } : {}),
    ...(candSourceReport ? { structureDiscrepancyCount: candSourceReport.discrepancies.length } : {}),
    ...(reasons.length > 0 ? { rejectionReason: reasons.join(', ') } : {}),
  };
}

/**
 * Đánh giá và hợp nhất bản chuốt văn GĐ2 ở cấp độ từng đoạn (Feature 171 - US2).
 * Giữ lại mọi đoạn cải thiện đạt chuẩn; chỉ hoàn tác riêng các đoạn bị suy giảm về bản lượt trước.
 * Chỉ kích hoạt rollback toàn chương (`isCatastrophicRollback`) khi sụp đổ cấu trúc diện rộng.
 */
export function evaluateAndMergePolishRound(params: {
  sourceText: string;
  previousDraft: string;
  candidatePolished: string;
  glossary: GlossaryItem[];
  roundIndex?: number;
}): PolishParagraphMergeResult {
  const { sourceText, previousDraft, candidatePolished, glossary, roundIndex } = params;

  const prevParas = splitNonEmptyParagraphs(previousDraft);
  const candParas = splitNonEmptyParagraphs(candidatePolished);
  const srcParas = splitNonEmptyParagraphs(sourceText);

  const previousGlossaryViolations = checkGlossaryCompliance({
    sourceText,
    translatedText: previousDraft,
    glossary,
  }).length;
  const candidateGlossaryViolations = checkGlossaryCompliance({
    sourceText,
    translatedText: candidatePolished,
    glossary,
  }).length;

  const draftParityReport = analyzeStructureParity(previousDraft, candidatePolished);
  const paragraphCountDelta = draftParityReport.paragraphCountDelta;

  const prevSourceReport = sourceText?.trim()
    ? analyzeStructureParity(sourceText, previousDraft)
    : null;
  const candSourceReport = sourceText?.trim()
    ? analyzeStructureParity(sourceText, candidatePolished)
    : null;

  const shouldCheckProperNouns = (roundIndex ?? 2) >= 2;
  const overallUngrounded = shouldCheckProperNouns
    ? detectUngroundedProperNouns({
        sourceText,
        previousDraft,
        candidatePolished,
        glossary,
      })
    : [];

  // Nếu không thể gióng đoạn 1-1 với bản lượt trước hoặc bị cắt cụt nặng:
  // Trên lượt >= 2 coi là suy giảm cấu trúc; trên lượt 1 giữ tương thích với evaluatePolishRoundFidelity.
  const isSeverelyTruncated =
    shouldCheckProperNouns &&
    previousDraft.trim().length > 200 &&
    candidatePolished.trim().length < previousDraft.trim().length * 0.6;

  if (
    prevParas.length === 0 ||
    candParas.length === 0 ||
    prevParas.length !== candParas.length ||
    isSeverelyTruncated
  ) {
    if (!shouldCheckProperNouns && prevParas.length > 0 && candParas.length > 0) {
      const round1Report = evaluatePolishRoundFidelity({
        sourceText,
        previousDraft,
        candidatePolished,
        glossary,
        roundIndex,
      });
      if (round1Report.isAcceptable) {
        return {
          ...round1Report,
          isCatastrophicRollback: false,
          mergedPolishedText: candidatePolished,
          acceptedParagraphCount: candParas.length,
          revertedParagraphs: [],
        };
      }
    }
    const reasons: string[] = [];
    if (paragraphCountDelta > 0 || prevParas.length !== candParas.length) {
      reasons.push('PARAGRAPH_STRUCTURE_DIVERGENCE');
    }
    if (candidateGlossaryViolations > previousGlossaryViolations) {
      reasons.push('GLOSSARY_REGRESSION');
    }
    if (overallUngrounded.length > 0) {
      reasons.push('UNGROUNDED_PROPER_NOUN');
    }
    if (isSeverelyTruncated) {
      reasons.push('POLISH_TRUNCATION_DETECTED');
    }
    return {
      isAcceptable: false,
      isCatastrophicRollback: true,
      mergedPolishedText: previousDraft,
      acceptedParagraphCount: 0,
      revertedParagraphs: [],
      previousGlossaryViolations,
      candidateGlossaryViolations,
      ungroundedProperNouns: overallUngrounded,
      paragraphCountDelta,
      ...(prevSourceReport ? { previousStructurePenalty: prevSourceReport.penaltyScore } : {}),
      ...(candSourceReport ? { candidateStructurePenalty: candSourceReport.penaltyScore } : {}),
      ...(candSourceReport ? { structureDiscrepancyCount: candSourceReport.discrepancies.length } : {}),
      rejectionReason: reasons.join(', ') || 'PARAGRAPH_STRUCTURE_DIVERGENCE',
    };
  }

  const mergedParas: string[] = [];
  const revertedParagraphs: ParagraphMergeReversion[] = [];
  let acceptedChangedCount = 0;

  for (let i = 0; i < prevParas.length; i++) {
    const prevPara = prevParas[i];
    const candPara = candParas[i];

    if (prevPara === candPara) {
      mergedParas.push(candPara);
      continue;
    }

    const alignment = mapTranslatedParagraphToSourceWindow(i, srcParas, prevParas);
    const srcPara =
      srcParas[alignment.primarySourceIndex] ||
      srcParas.slice(alignment.windowStartIndex, alignment.windowEndIndex + 1).join('\n') ||
      '';

    const paraReasons: string[] = [];

    if (srcPara) {
      const prevTermErr = checkGlossaryCompliance({
        sourceText: srcPara,
        translatedText: prevPara,
        glossary,
      }).length;
      const candTermErr = checkGlossaryCompliance({
        sourceText: srcPara,
        translatedText: candPara,
        glossary,
      }).length;
      if (candTermErr > prevTermErr) {
        paraReasons.push('suy giảm tuân thủ từ điển/xưng hô (GLOSSARY_REGRESSION)');
      }
    }

    if (shouldCheckProperNouns) {
      const ungroundedInPara = detectUngroundedProperNouns({
        sourceText,
        previousDraft,
        candidatePolished: candPara,
        glossary,
      });
      if (ungroundedInPara.length > 0) {
        paraReasons.push(`phát sinh tên riêng ngoài nguồn: ${ungroundedInPara.slice(0, 2).join(', ')}`);
      }
    }

    const prevParaSig = extractParagraphSignature(prevPara, 'vi', i);
    const candParaSig = extractParagraphSignature(candPara, 'vi', i);
    if (candParaSig.cjkPunctuationCount > prevParaSig.cjkPunctuationCount) {
      paraReasons.push('sót dấu câu tiếng Trung');
    }
    if (prevParaSig.hasDirectDialogue && !candParaSig.hasDirectDialogue) {
      paraReasons.push('mất dấu ngoặc lời thoại trực tiếp');
    }

    if (srcPara && srcParas.length === prevParas.length) {
      const prevParaPenalty = analyzeStructureParity(srcPara, prevPara).penaltyScore;
      const candParaPenalty = analyzeStructureParity(srcPara, candPara).penaltyScore;
      if (candParaPenalty > prevParaPenalty) {
        paraReasons.push('lệch dấu câu hoặc ngắt câu (STRUCTURE_PARITY_REGRESSION)');
      }
    }

    if (paraReasons.length > 0) {
      revertedParagraphs.push({
        paragraphIndex: i,
        reasons: paraReasons,
      });
      mergedParas.push(prevPara);
    } else {
      acceptedChangedCount++;
      mergedParas.push(candPara);
    }
  }

  const revertedRatio = prevParas.length > 0 ? revertedParagraphs.length / prevParas.length : 0;
  const isCatastrophicRollback =
    revertedRatio > 0.4 ||
    (acceptedChangedCount === 0 && revertedParagraphs.length > 0);

  if (isCatastrophicRollback) {
    const legacyReport = evaluatePolishRoundFidelity({
      sourceText,
      previousDraft,
      candidatePolished,
      glossary,
      roundIndex,
    });
    const fallbackReason =
      legacyReport.rejectionReason ||
      revertedParagraphs.flatMap((r) => r.reasons).slice(0, 3).join('; ') ||
      'GLOSSARY_REGRESSION';
    return {
      ...legacyReport,
      isAcceptable: false,
      isCatastrophicRollback: true,
      mergedPolishedText: previousDraft,
      acceptedParagraphCount: 0,
      revertedParagraphs,
      rejectionReason: fallbackReason,
    };
  }

  const acceptedParagraphCount = prevParas.length - revertedParagraphs.length;
  return {
    isAcceptable: true,
    isCatastrophicRollback: false,
    mergedPolishedText: mergedParas.join('\n\n'),
    acceptedParagraphCount,
    revertedParagraphs,
    previousGlossaryViolations,
    candidateGlossaryViolations,
    ungroundedProperNouns: overallUngrounded,
    paragraphCountDelta,
    ...(prevSourceReport ? { previousStructurePenalty: prevSourceReport.penaltyScore } : {}),
    ...(candSourceReport ? { candidateStructurePenalty: candSourceReport.penaltyScore } : {}),
    ...(candSourceReport ? { structureDiscrepancyCount: candSourceReport.discrepancies.length } : {}),
    ...(revertedParagraphs.length > 0
      ? {
          rejectionReason: `Hợp nhất cấp đoạn: giữ nguyên ${revertedParagraphs.length} đoạn lượt trước (${revertedParagraphs
            .slice(0, 2)
            .map((r) => `Đoạn ${r.paragraphIndex + 1}: ${r.reasons[0]}`)
            .join('; ')})`,
        }
      : {}),
  };
}

function locateParagraphIndexForTarget(targetText: string, paragraphs: string[]): number {
  const normTarget = (targetText || '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!normTarget || paragraphs.length === 0) return -1;

  for (let i = 0; i < paragraphs.length; i++) {
    const normPara = paragraphs[i].replace(/\s+/g, ' ').trim().toLowerCase();
    if (!normPara) continue;
    if (normPara === normTarget || normPara.includes(normTarget)) {
      return i;
    }
  }

  // Fallback: nếu targetText kéo dài qua 1 câu ngắn hơn, thử đối chiếu khi paragraph nằm trong target
  if (normTarget.length >= 16) {
    for (let i = 0; i < paragraphs.length; i++) {
      const normPara = paragraphs[i].replace(/\s+/g, ' ').trim().toLowerCase();
      if (normPara.length >= 12 && normTarget.includes(normPara)) {
        return i;
      }
    }
  }
  return -1;
}

/**
 * Gán paragraphIndex cho các lỗi từ AI QA Critique (dựa trên targetText) và khử trùng lặp
 * với danh sách lỗi tất định (FR-014, FR-015).
 * BẤT BIẾN TƯƠNG THÍCH:
 * - Chỉ gắn `paragraphIndex` vào object lỗi AI khi tìm thấy đoạn văn khớp (`idx >= 0`),
 *   không thêm key `undefined` làm thay đổi hình dạng object của lỗi AI gốc.
 */
export function mergeAndDeduplicateQaIssues(params: {
  deterministicIssues: DirectQaCritiqueIssue[];
  aiIssues: DirectQaCritiqueIssue[];
  translatedText: string;
}): DirectQaCritiqueIssue[] {
  const { deterministicIssues, aiIssues, translatedText } = params;
  const paragraphs = splitNonEmptyParagraphs(translatedText || '');

  const safeDet = Array.isArray(deterministicIssues) ? [...deterministicIssues] : [];
  const safeAi = Array.isArray(aiIssues) ? aiIssues : [];

  const detKeys = new Set<string>();
  const detTypeParaKeys = new Set<string>();
  for (const det of safeDet) {
    if (!det) continue;
    const pIdx =
      typeof det.paragraphIndex === 'number'
        ? det.paragraphIndex
        : locateParagraphIndexForTarget(det.targetText, paragraphs);
    if (pIdx >= 0) {
      // Không dùng cảnh báo [Cấu trúc 1-1] loại 'other' để chặn các lỗi AI loại 'other' khác nghĩa trên cùng đoạn
      const isStructureOtherWarning = det.type === 'other' && det.description?.startsWith('[Cấu trúc 1-1]');
      if (!isStructureOtherWarning) {
        detTypeParaKeys.add(`${det.type}::${pIdx}`);
      }
      if (det.expectedTerm?.chinese) {
        detKeys.add(`${det.type}::${pIdx}::${canonicalizeHan(det.expectedTerm.chinese)}`);
      }
    }
  }

  const merged: DirectQaCritiqueIssue[] = [...safeDet];

  for (const aiIssue of safeAi) {
    if (!aiIssue) continue;
    const matchedIdx =
      typeof aiIssue.paragraphIndex === 'number' && aiIssue.paragraphIndex >= 0
        ? aiIssue.paragraphIndex
        : locateParagraphIndexForTarget(aiIssue.targetText, paragraphs);

    const enrichedAiIssue: DirectQaCritiqueIssue =
      matchedIdx >= 0 && aiIssue.paragraphIndex === undefined
        ? { ...aiIssue, paragraphIndex: matchedIdx }
        : aiIssue;

    // Khử trùng lặp theo (type, paragraphIndex) với các lỗi tất định có cùng đoạn văn
    if (matchedIdx >= 0 && detTypeParaKeys.has(`${enrichedAiIssue.type}::${matchedIdx}`)) {
      continue;
    }

    // Kiểm tra trùng lặp mục tiêu gần giống với lỗi đã tồn tại trong merged
    const normTarget = (enrichedAiIssue.targetText || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const isDuplicate = merged.some((existing) => {
      if (existing.type !== enrichedAiIssue.type) return false;
      if (
        existing.type === 'other' &&
        existing.source === 'deterministic' &&
        existing.description?.startsWith('[Cấu trúc 1-1]')
      ) {
        return false;
      }
      if (
        matchedIdx >= 0 &&
        typeof existing.paragraphIndex === 'number' &&
        existing.paragraphIndex === matchedIdx
      ) {
        return true;
      }
      if (normTarget && existing.targetText) {
        const normExisting = existing.targetText.replace(/\s+/g, ' ').trim().toLowerCase();
        if (normExisting === normTarget) return true;
      }
      return false;
    });

    if (!isDuplicate) {
      merged.push(enrichedAiIssue);
    }
  }

  return merged;
}

export interface SourceParagraphWindow {
  primarySourceIndex: number;
  windowStartIndex: number;
  windowEndIndex: number;
  isExactOneToOne: boolean;
}

/**
 * Gióng chỉ số đoạn văn bản dịch (`paragraphIndex`) sang cửa sổ đoạn văn tiếng Trung gốc,
 * có bù trừ độ lệch dòng tiêu đề chương (`isChapterTitleLine`).
 */
export function mapTranslatedParagraphToSourceWindow(
  paragraphIndex: number,
  sourceParagraphs: string[],
  translatedParagraphs: string[]
): SourceParagraphWindow {
  if (!Array.isArray(sourceParagraphs) || sourceParagraphs.length === 0) {
    return {
      primarySourceIndex: 0,
      windowStartIndex: 0,
      windowEndIndex: 0,
      isExactOneToOne: false,
    };
  }

  const maxSrcIdx = sourceParagraphs.length - 1;
  if (!Array.isArray(translatedParagraphs) || translatedParagraphs.length === 0) {
    return {
      primarySourceIndex: 0,
      windowStartIndex: 0,
      windowEndIndex: Math.min(maxSrcIdx, 1),
      isExactOneToOne: false,
    };
  }

  const safeParaIdx = Math.max(0, Math.min(translatedParagraphs.length - 1, Math.floor(paragraphIndex)));
  const srcHasTitle = sourceParagraphs.length > 1 && isChapterTitleLine(sourceParagraphs[0]);
  const transHasTitle = translatedParagraphs.length > 1 && isChapterTitleLine(translatedParagraphs[0]);
  const srcOffset = srcHasTitle ? 1 : 0;
  const transOffset = transHasTitle ? 1 : 0;
  const srcBodyLen = sourceParagraphs.length - srcOffset;
  const transBodyLen = translatedParagraphs.length - transOffset;

  let primarySourceIndex = 0;
  let isExactOneToOne = false;

  if (sourceParagraphs.length === translatedParagraphs.length) {
    primarySourceIndex = safeParaIdx;
    isExactOneToOne = true;
  } else if (srcBodyLen === transBodyLen) {
    if (transHasTitle && safeParaIdx === 0) {
      primarySourceIndex = 0;
      isExactOneToOne = srcHasTitle;
    } else {
      const mapped = safeParaIdx - transOffset + srcOffset;
      primarySourceIndex = Math.max(0, Math.min(maxSrcIdx, mapped));
      isExactOneToOne = true;
    }
  } else {
    const transBodyIdx = Math.max(0, safeParaIdx - transOffset);
    const ratio = transBodyLen > 1 ? transBodyIdx / (transBodyLen - 1) : 0;
    const approxBodyIdx = Math.round(ratio * Math.max(0, srcBodyLen - 1));
    primarySourceIndex = Math.max(0, Math.min(maxSrcIdx, srcOffset + approxBodyIdx));
    isExactOneToOne = false;
  }

  const windowStartIndex = Math.max(0, primarySourceIndex - 1);
  const windowEndIndex = Math.min(maxSrcIdx, primarySourceIndex + 1);

  return {
    primarySourceIndex,
    windowStartIndex,
    windowEndIndex,
    isExactOneToOne,
  };
}

export interface ClassifiedTranslationOutcome {
  type: TranslationOutcomeType;
  isRetryable: boolean;
  canSplitRetry: boolean;
  reason: string;
  isContentBlocked: boolean;
}

/**
 * Phân loại kết quả dịch thuật và lỗi có cấu trúc
 */
export function classifyTranslationOutcome(err: unknown): ClassifiedTranslationOutcome {
  if (!err) {
    return {
      type: 'SUCCESS',
      isRetryable: false,
      canSplitRetry: false,
      reason: 'No error',
      isContentBlocked: false,
    };
  }

  // 1. Kiểm tra GeminiRequestError có cấu trúc
  if (err instanceof GeminiRequestError) {
    const isContentBlocked =
      err.category === 'CONTENT_BLOCKED' ||
      err.code === 'CONTENT_BLOCKED';

    if (isContentBlocked) {
      return {
        type: 'TERMINAL',
        isRetryable: false, // cấm xoay key và cấm retry cùng prompt
        canSplitRetry: true, // chia nhỏ văn cảnh để cô lập câu bị chặn
        reason: 'CONTENT_BLOCKED',
        isContentBlocked: true,
      };
    }

    if (
      err.category === 'AUTH_FAILURE' ||
      err.code === 'AUTH_FAILURE' ||
      err.category === 'RESOURCE_NOT_FOUND' ||
      err.code === 'RESOURCE_NOT_FOUND' ||
      err.category === 'QUOTA_EXHAUSTED_RPD'
    ) {
      return {
        type: 'TERMINAL',
        isRetryable: false,
        canSplitRetry: false,
        reason: err.category || err.code,
        isContentBlocked: false,
      };
    }

    if (
      err.category === 'RATE_LIMIT_RPM' ||
      err.category === 'SERVICE_OVERLOAD' ||
      err.category === 'NETWORK_FAILURE'
    ) {
      return {
        type: 'RETRYABLE',
        isRetryable: true,
        canSplitRetry: true,
        reason: err.category,
        isContentBlocked: false,
      };
    }
  }

  // 2. Kiểm tra AbortError
  const errObj = err as { name?: string; message?: string };
  if (errObj?.name === 'AbortError' || errObj?.message?.includes('aborted')) {
    return {
      type: 'TERMINAL',
      isRetryable: false,
      canSplitRetry: false,
      reason: 'AbortError',
      isContentBlocked: false,
    };
  }

  // 3. Kiểm tra các lỗi nghiệp vụ xác thực (Domain Validation Errors)
  const msg = errObj?.message || String(err || '');
  const lowerMsg = msg.toLowerCase();

  const isSafetyMsg =
    lowerMsg.includes('bộ lọc an toàn') ||
    lowerMsg.includes('safety') ||
    lowerMsg.includes('chặn bởi bộ lọc') ||
    lowerMsg.includes('content_blocked');

  if (isSafetyMsg) {
    return {
      type: 'TERMINAL',
      isRetryable: false,
      canSplitRetry: true,
      reason: 'CONTENT_BLOCKED',
      isContentBlocked: true,
    };
  }

  // 3. Kiểm tra lỗi schema cấu trúc không thỏa mãn (không được cứu nguy bằng split)
  if (
    msg.includes('không thỏa mãn cấu trúc yêu cầu') ||
    msg.includes('SCHEMA_INVALID')
  ) {
    return {
      type: 'TERMINAL',
      isRetryable: false,
      canSplitRetry: false,
      reason: 'SCHEMA_INVALID',
      isContentBlocked: false,
    };
  }

  // 4. Kiểm tra các lỗi nghiệp vụ xác thực (Domain Validation Errors có thể chia đoạn để phục hồi)
  const isDomainValidationError =
    msg.includes('UNTRANSLATED_CHINESE_LEFTOVER') ||
    msg.includes('POLISH_TRUNCATION_DETECTED') ||
    msg.includes('PARAGRAPH_STRUCTURE_DIVERGENCE') ||
    msg.includes('phản hồi rỗng') ||
    msg.includes('kết quả trả về trống') ||
    msg.includes('EMPTY_RESPONSE');

  if (isDomainValidationError) {
    return {
      type: 'RETRYABLE',
      isRetryable: true,
      canSplitRetry: true,
      reason: msg,
      isContentBlocked: false,
    };
  }

  // 5. Mặc định cho các lỗi không nhận diện (không split retry để tránh nuốt lỗi cấu trúc)
  return {
    type: 'TERMINAL',
    isRetryable: false,
    canSplitRetry: false,
    reason: msg || 'UNKNOWN_ERROR',
    isContentBlocked: false,
  };
}

/**
 * Tương thích ngược: kiểm tra xem lỗi có nên kích hoạt phân đoạn thích ứng không
 */
export function isAdaptiveSplitRetryableError(err: any): boolean {
  return classifyTranslationOutcome(err).canSplitRetry;
}

export function isSafetyOrEmptyErrorDirect(err: any): boolean {
  return isAdaptiveSplitRetryableError(err);
}
