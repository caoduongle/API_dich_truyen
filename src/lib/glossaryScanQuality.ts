/**
 * Post-Scan Glossary Quality Gate, Pinyin/Han Leak Detection, Noise Filtering & Loop-1 Anchor Selection
 * Hoạt động hoàn toàn tất định phía client (<10ms/chương, 0 API call bổ sung) cho mô hình nhẹ tốc độ cao.
 */

import { GlossaryItem, GlossaryType, PendingGlossaryItem } from '../types';
import { DiscoveredEntity } from '../services/translation/types';
import {
  containsHanChars,
  countHanChars,
  detectMandarinPinyin,
  inferCharacterGenderFromContext,
  isNoisyGlossaryTerm,
} from './glossaryMatch';
import { canonicalizeHan, isHanEquivalent } from './sinoNormalize';

export type ScanQualityVerdict = 'accept' | 'review' | 'reject';

export type ScanQualityFlag =
  | 'pinyin_in_reading'
  | 'han_in_reading'
  | 'pinyin_in_vietnamese'
  | 'han_in_note'
  | 'noisy_common_term'
  | 'short_code'
  | 'sentence_fragment'
  | 'single_han_char'
  | 'subterm_overlap'
  | 'needs_review_flag';

export interface ScanQualityEvaluation {
  verdict: ScanQualityVerdict;
  reason?: string;
  cleanedNote: string;
  normalizedChinese: string;
  flags: ScanQualityFlag[];
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

export interface ChapterScanAnchorEntry {
  chinese: string;
  vietnamese: string;
  isPinned?: boolean;
}

const SHORT_CODE_RE = /^[A-Za-z]{1,2}[-_]?\d{1,3}$/;
const SENTENCE_PUNCT_RE = /[，,。！？!?;；:：\n\r]/;
const LATIN_WORD_LETTER_RE = /[A-Za-z\u00C0-\u1EF9]/;

/**
 * Các cụm phổ thông sinh hoạt / câu nói / khái niệm đại chúng không nên tự động ép thành thuật ngữ dịch.
 */
const SCAN_COMMON_EVERYDAY_STOPWORDS = new Set<string>([
  '电脑', '手机', '电话', '电视', '网吧', '医院', '学校', '公园', '商店', '房间',
  '步行街', '办公室', '会议室', '实验室', '停车场', '十字路口',
  '匿名', '群主', '管理员', '网友', '网友们', '评论区', '私聊', '朋友圈',
  '我想看鬼', '图灵测试', '人工智能', '密码', '账号', '登录',
  '大悲咒', '暗度陈仓',
]);

const COMPOSITE_AFFIXES = [
  '博士', '教授', '先生', '女士', '小姐', '夫人', '船长', '警官', '医生', '院长',
  '局长', '大师', '长老', '宗主', '皇帝', '王爷', '将军', '同学', '老师',
  '岛', '镇', '城', '村', '市', '路', '街', '山', '河', '海', '港', '寺', '殿',
  '小区', '公园', '医院', '大学', '徽章', '手册', '笔记',
  '1', '2', '3', '4', '5',
];

/**
 * Làm sạch ghi chú tiếng Việt khỏi chữ Hán bị AI chép lẫn vào (FR-005).
 */
export function sanitizeScannedNote(note?: string | null): {
  cleanedNote: string;
  hadHanLeak: boolean;
  cleanEnough: boolean;
} {
  const raw = typeof note === 'string' ? note.trim() : '';
  if (!raw) {
    return { cleanedNote: '', hadHanLeak: false, cleanEnough: true };
  }

  const hadHanLeak = containsHanChars(raw);
  if (!hadHanLeak) {
    return { cleanedNote: raw, hadHanLeak: false, cleanEnough: true };
  }

  // Gỡ cụm chữ Hán kèm dấu ngoặc/nháy rỗng nếu có
  const stripped = raw
    .replace(/['"“”‘’「」『』()（）]*[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]+['"“”‘’「」『』()（）]*/g, ' ')
    .replace(/\(\s*\)|\[\s*\]|['"]\s*['"]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/^(của|và|với|tại|ở)\s+/i, '')
    .trim()
    .replace(/[.,;:\-–]+$/, '')
    .trim();

  const letterCount = Array.from(stripped).filter((c) => LATIN_WORD_LETTER_RE.test(c)).length;
  const cleanEnough = stripped.length >= 6 && letterCount >= 5;

  return {
    cleanedNote: cleanEnough ? stripped : raw,
    hadHanLeak: true,
    cleanEnough,
  };
}

/**
 * Kiểm tra mã ký hiệu Latinh-số ngắn vô nghĩa như A1, A2, B-04 (FR-006).
 */
export function isShortAlphanumericCode(chinese: string): boolean {
  const cleaned = (chinese || '').replace(/\s+/g, '').trim();
  if (!cleaned) return false;
  if (countHanChars(cleaned) > 0) return false;
  return SHORT_CODE_RE.test(cleaned);
}

/**
 * Kiểm tra cụm mang dấu câu ngắt câu hoặc quá dài giống nguyên câu văn thay vì danh từ riêng (FR-006).
 */
export function hasSentencePunctuationOrOverlong(chinese: string): boolean {
  const cleaned = (chinese || '').trim();
  if (!cleaned) return true;
  if (SENTENCE_PUNCT_RE.test(cleaned)) return true;
  const hanCount = countHanChars(cleaned);
  // Tên phương Tây ghép dấu '·' có thể dài hơn 10 ký tự Hán (vd 伊丽莎白·乌里扬诺夫)
  if (!cleaned.includes('·') && hanCount > 10) {
    return true;
  }
  return false;
}

/**
 * Kiểm tra từ đơn đúng 1 ký tự Hán thuần túy (như 海, 昆, 鸢),
 * bảo toàn các mã hỗn hợp dài hơn 1 ký tự (như 42号, G-3218号, 词_chap_1).
 */
export function isSingleHanCharTerm(chinese: string): boolean {
  const cleaned = (chinese || '').replace(/\s+/g, '').trim();
  return countHanChars(cleaned) === 1 && Array.from(cleaned).length === 1;
}

/**
 * Lọc bỏ từ phổ thông sinh hoạt, hư từ, thành ngữ phổ thông (FR-006).
 */
export function isCommonEverydayScanNoise(chinese: string, type?: string): boolean {
  if (isNoisyGlossaryTerm(chinese, type)) return true;
  const cleaned = (chinese || '').replace(/\s+/g, '').trim();
  const canon = canonicalizeHan(cleaned);
  return SCAN_COMMON_EVERYDAY_STOPWORDS.has(cleaned) || SCAN_COMMON_EVERYDAY_STOPWORDS.has(canon);
}

/**
 * Kiểm tra chồng lấn mảnh cắt hoặc biến thể kèm hậu tố/chức danh với mục đã có (FR-007).
 */
export function findSubTermOrCompositeOverlap(
  candidateChinese: string,
  existingGlossary: GlossaryItem[],
  chapterSourceText: string
): { reason: string; relatedChinese: string } | null {
  const cleanCand = (candidateChinese || '').replace(/\s+/g, '').trim();
  const canonCand = canonicalizeHan(cleanCand);
  if (countHanChars(canonCand) < 2) return null;

  for (const existing of existingGlossary || []) {
    if (!existing || !existing.chinese) continue;
    const cleanExisting = existing.chinese.replace(/\s+/g, '').trim();
    const canonExisting = canonicalizeHan(cleanExisting);
    if (!canonExisting || canonExisting === canonCand || countHanChars(canonExisting) < 2) {
      continue;
    }

    // Trường hợp 1: Ứng viên là mảnh cắt ngắn hơn nằm lọt trong mục dài đã có (vd 仓一 trong 钱仓一, 魏成 trong 魏成和)
    if (canonExisting.includes(canonCand) && canonCand.length < canonExisting.length) {
      if (chapterSourceText) {
        const canonSource = canonicalizeHan(chapterSourceText);
        // Nếu xóa hết các lần xuất hiện của mục dài mà không còn thấy mảnh ngắn đứng độc lập -> mảnh cắt trùng
        const withoutLong = canonSource.split(canonExisting).join(' ');
        if (!withoutLong.includes(canonCand)) {
          return {
            relatedChinese: existing.chinese,
            reason: `Mảnh cắt ngắn hơn nằm hoàn toàn trong thuật ngữ đã có "${existing.chinese}" (${existing.vietnamese})`,
          };
        }
      } else {
        return {
          relatedChinese: existing.chinese,
          reason: `Mảnh cắt ngắn hơn của thuật ngữ đã có "${existing.chinese}" (${existing.vietnamese})`,
        };
      }
    }

    // Trường hợp 2: Ứng viên dài hơn chỉ là mục đã có gắn thêm danh xưng/hậu tố phổ biến (vd 天马博士 vs 天马, 保罗 vs 保罗船长)
    if (canonCand.includes(canonExisting) && canonCand.length > canonExisting.length) {
      const remainder = canonCand.replace(canonExisting, '');
      const hasKnownAffix = COMPOSITE_AFFIXES.some(
        (affix) => canonicalizeHan(affix) === remainder || canonCand.endsWith(canonicalizeHan(affix)) || canonCand.startsWith(canonicalizeHan(affix))
      );
      if (hasKnownAffix || remainder.length <= 2) {
        return {
          relatedChinese: existing.chinese,
          reason: `Trùng lặp mở rộng/chức danh của thuật ngữ đã có "${existing.chinese}" (${existing.vietnamese})`,
        };
      }
    }
  }

  return null;
}

/**
 * Đánh giá một ứng viên đơn lẻ qua cổng hậu kiểm 3 luồng (accept / review / reject) (FR-003–FR-009).
 */
export function evaluateScannedTermCandidate(params: {
  candidate: DiscoveredEntity;
  existingGlossary: GlossaryItem[];
  sourceText: string;
}): ScanQualityEvaluation {
  const { candidate, existingGlossary, sourceText } = params;
  const rawChinese = (candidate.chinese || '').trim();
  const normalizedChinese = rawChinese.replace(/\s+/g, '').trim();
  const pinyin = (candidate.pinyin || '').trim();
  const vietnamese = (candidate.vietnamese || '').trim();
  const noteInfo = sanitizeScannedNote(candidate.note);
  const flags: ScanQualityFlag[] = [];

  if (!normalizedChinese || isShortAlphanumericCode(normalizedChinese)) {
    flags.push('short_code');
    return {
      verdict: 'reject',
      reason: `Loại bỏ mã ngắn không phải tên riêng ("${normalizedChinese || rawChinese}").`,
      cleanedNote: noteInfo.cleanedNote,
      normalizedChinese,
      flags,
    };
  }

  if (hasSentencePunctuationOrOverlong(rawChinese)) {
    flags.push('sentence_fragment');
    return {
      verdict: 'reject',
      reason: `Loại bỏ cụm câu hoặc dấu câu không hợp lệ ("${rawChinese.slice(0, 30)}").`,
      cleanedNote: noteInfo.cleanedNote,
      normalizedChinese,
      flags,
    };
  }

  if (isCommonEverydayScanNoise(normalizedChinese, candidate.type)) {
    flags.push('noisy_common_term');
    return {
      verdict: 'reject',
      reason: `Loại bỏ từ phổ thông / hư từ gây nhiễu dịch thuật ("${normalizedChinese}").`,
      cleanedNote: noteInfo.cleanedNote,
      normalizedChinese,
      flags,
    };
  }

  const reviewReasons: string[] = [];

  if (candidate.needsReview) {
    flags.push('needs_review_flag');
    reviewReasons.push('AI trích xuất nghi ngờ không khớp nguyên văn.');
  }

  if (isSingleHanCharTerm(normalizedChinese)) {
    flags.push('single_han_char');
    reviewReasons.push('Thuật ngữ đơn 1 chữ Hán có nguy cơ thay thế nhầm từ ghép.');
  }

  const readingHasHan = containsHanChars(pinyin);
  const readingHasPinyin = detectMandarinPinyin(pinyin);
  if (readingHasHan) {
    flags.push('han_in_reading');
    reviewReasons.push(`Cột phiên âm còn sót chữ Hán ("${pinyin}").`);
  } else if (readingHasPinyin) {
    flags.push('pinyin_in_reading');
    reviewReasons.push(`Cột phiên âm chứa Bính âm tiếng Phổ thông thay vì Hán-Việt ("${pinyin}").`);
  }

  const candidateHasHan = containsHanChars(normalizedChinese);
  const viLooksLikePinyin =
    candidateHasHan &&
    vietnamese.length > 0 &&
    detectMandarinPinyin(vietnamese);

  if (viLooksLikePinyin) {
    flags.push('pinyin_in_vietnamese');
    reviewReasons.push(`Bản dịch Việt nghi ngờ giữ Bính âm tiếng Phổ thông ("${vietnamese}").`);
  }

  if (noteInfo.hadHanLeak && !noteInfo.cleanEnough) {
    flags.push('han_in_note');
    reviewReasons.push('Ghi chú ngữ cảnh chứa chữ Hán chưa dịch rõ ràng.');
  } else if (noteInfo.hadHanLeak) {
    flags.push('han_in_note');
  }

  const overlap = findSubTermOrCompositeOverlap(normalizedChinese, existingGlossary, sourceText);
  if (overlap) {
    flags.push('subterm_overlap');
    reviewReasons.push(overlap.reason);
  }

  if (reviewReasons.length > 0) {
    return {
      verdict: 'review',
      reason: reviewReasons.join(' '),
      cleanedNote: noteInfo.cleanedNote,
      normalizedChinese,
      flags,
    };
  }

  return {
    verdict: 'accept',
    cleanedNote: noteInfo.cleanedNote,
    normalizedChinese,
    flags,
  };
}

/**
 * Cổng hậu kiểm hợp nhất cho một lô ứng viên quét (dùng cho cả quét sỉ và quét đơn chương) (FR-009).
 */
export function classifyScannedGlossaryBatch(params: {
  candidates: DiscoveredEntity[];
  existingGlossary: GlossaryItem[];
  existingPendingGlossary?: PendingGlossaryItem[];
  sourceText: string;
  chapterTitle?: string;
  chapterId?: string;
  idPrefix?: string;
  defaultOrigin?: GlossaryItem['origin'];
}): ScanBatchClassificationResult {
  const {
    candidates,
    existingGlossary,
    existingPendingGlossary,
    sourceText,
    chapterTitle,
    chapterId,
    idPrefix = 'auto',
    defaultOrigin = 'scanned',
  } = params;

  const acceptedItems: GlossaryItem[] = [];
  const reviewItems: PendingGlossaryItem[] = [];
  const rejectedCandidates: Array<{ chinese: string; reason: string }> = [];

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return {
      acceptedItems,
      reviewItems,
      rejectedCandidates,
      telemetry: { acceptedCount: 0, reviewCount: 0, rejectedCount: 0 },
    };
  }

  const workingGlossary: GlossaryItem[] = [...(existingGlossary || [])];
  const pendingChineseSeen = (existingPendingGlossary || []).map((p) => p.chinese).filter(Boolean);
  const pushReviewIfNotPending = (item: PendingGlossaryItem) => {
    if (pendingChineseSeen.some((cn) => isHanEquivalent(cn, item.chinese))) {
      return;
    }
    pendingChineseSeen.push(item.chinese);
    reviewItems.push(item);
  };
  const sourceParagraphs = (sourceText || '').split('\n');
  const nowIso = new Date().toISOString();

  for (const cand of candidates) {
    if (!cand || typeof cand.chinese !== 'string') continue;
    const rawChinese = cand.chinese.trim();
    if (!rawChinese) continue;

    const cleanChinese = rawChinese.replace(/\s+/g, '').trim();
    const cleanVietnamese = (typeof cand.vietnamese === 'string' ? cand.vietnamese : '').trim();
    const cleanPinyin = (typeof cand.pinyin === 'string' ? cand.pinyin : '').trim();
    const cleanType: GlossaryType = (cand.type || 'other') as GlossaryType;

    // 1. Kiểm tra trùng chính xác trước để giữ hành vi dedupe chuẩn
    const matchedByCn = workingGlossary.find((gItem) => isHanEquivalent(gItem.chinese, rawChinese));
    if (matchedByCn) {
      // Nếu là mục hoàn toàn trùng với từ điển hiện có trong cùng lần quét hoặc vòng quét trước:
      // chỉ giữ im nếu giống hệt nghĩa Việt; đưa vào kiểm duyệt nếu nghĩa khác biệt
      const existingVi = (matchedByCn.vietnamese || '').trim().toLowerCase();
      if (cleanVietnamese && existingVi && cleanVietnamese.toLowerCase() !== existingVi) {
        const suffix = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        pushReviewIfNotPending({
          id: `pend_${idPrefix}_${suffix}`,
          chinese: cleanChinese,
          pinyin: cleanPinyin,
          vietnamese: cleanVietnamese,
          type: cleanType,
          note: sanitizeScannedNote(cand.note).cleanedNote,
          reason: 'Duplicate Chinese',
          originalValue: `Trùng chữ Trung gốc: "${matchedByCn.chinese}" đã dịch là "${matchedByCn.vietnamese}"`,
          importedAt: nowIso,
          needsReview: false,
          ...(chapterId ? { sourceChapterId: chapterId } : {}),
        });
      }
      continue;
    }

    // 2. Đánh giá qua cổng hậu kiểm 3 luồng
    const evaluation = evaluateScannedTermCandidate({
      candidate: cand,
      existingGlossary: workingGlossary,
      sourceText,
    });

    if (evaluation.verdict === 'reject') {
      rejectedCandidates.push({
        chinese: evaluation.normalizedChinese || rawChinese,
        reason: evaluation.reason || 'Từ nhiễu không hợp lệ',
      });
      continue;
    }

    const originParagraph =
      sourceParagraphs
        .find((p) => p.includes(rawChinese) || p.replace(/\s+/g, '').includes(cleanChinese))
        ?.trim() || '';

    const suffix = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    if (evaluation.verdict === 'review') {
      const hasOverlap = evaluation.flags.includes('subterm_overlap');
      pushReviewIfNotPending({
        id: `pend_${idPrefix}_${suffix}`,
        chinese: cleanChinese,
        pinyin: cleanPinyin,
        vietnamese: cleanVietnamese,
        type: cleanType,
        note: evaluation.cleanedNote,
        reason: hasOverlap ? 'Duplicate Chinese' : 'AI trích xuất nghi ngờ hallucinate',
        originalValue: evaluation.reason || 'Cần kiểm duyệt chất lượng trước khi lưu.',
        importedAt: nowIso,
        needsReview: !hasOverlap,
        ...(chapterId ? { sourceChapterId: chapterId } : {}),
      });
      continue;
    }

    const inferredGender =
      cleanType === 'character'
        ? inferCharacterGenderFromContext({
            chinese: cleanChinese,
            note: evaluation.cleanedNote,
            sourceParagraph: originParagraph,
          })
        : undefined;

    const newItem: GlossaryItem = {
      id: `glo_${idPrefix}_${suffix}`,
      chinese: cleanChinese,
      pinyin: cleanPinyin || cleanVietnamese,
      vietnamese: cleanVietnamese,
      type: cleanType,
      note: evaluation.cleanedNote,
      ...(inferredGender ? { characterProfile: { gender: inferredGender } } : {}),
      ...(chapterTitle ? { sourceChapter: chapterTitle } : {}),
      ...(originParagraph || chapterTitle ? { sourceParagraph: originParagraph } : {}),
      ...(chapterId ? { sourceChapterId: chapterId } : {}),
      origin: defaultOrigin,
      createdAt: nowIso,
    };

    acceptedItems.push(newItem);
    workingGlossary.push(newItem);
  }

  return {
    acceptedItems,
    reviewItems,
    rejectedCandidates,
    telemetry: {
      acceptedCount: acceptedItems.length,
      reviewCount: reviewItems.length,
      rejectedCount: rejectedCandidates.length,
    },
  };
}

/**
 * Chọn tối đa `maxLimit` thuật ngữ neo từ từ điển hiện có kèm nghĩa tiếng Việt chuẩn cho chương đang quét,
 * ưu tiên các thuật ngữ thực sự xuất hiện trong chương ngay từ Vòng 1 (FR-001).
 */
export function prioritizeKnownAnchorEntriesForChapter(
  sourceText: string,
  glossary: GlossaryItem[],
  maxLimit = 150
): ChapterScanAnchorEntry[] {
  if (!Array.isArray(glossary) || glossary.length === 0 || maxLimit <= 0) {
    return [];
  }

  const safeSource = sourceText || '';
  const canonSource = canonicalizeHan(safeSource);

  const matched: ChapterScanAnchorEntry[] = [];
  const pinned: ChapterScanAnchorEntry[] = [];
  const rest: ChapterScanAnchorEntry[] = [];
  const seenCanon = new Set<string>();

  for (const item of glossary) {
    if (!item || typeof item.chinese !== 'string') continue;
    const rawCn = item.chinese.trim();
    if (!rawCn) continue;
    const canonCn = canonicalizeHan(rawCn);
    if (!canonCn || seenCanon.has(canonCn)) continue;
    seenCanon.add(canonCn);

    const forms = [rawCn, ...(Array.isArray(item.variants) ? item.variants : [])]
      .map((f) => (f || '').trim())
      .filter(Boolean);

    let isMatched = false;
    if (safeSource) {
      for (const form of forms) {
        if (safeSource.includes(form)) {
          isMatched = true;
          break;
        }
        const canonForm = canonicalizeHan(form);
        if (canonForm && canonSource.includes(canonForm)) {
          isMatched = true;
          break;
        }
      }
    }

    const entry: ChapterScanAnchorEntry = {
      chinese: rawCn,
      vietnamese: (item.vietnamese || '').trim(),
      ...(item.isPinned ? { isPinned: true } : {}),
    };

    if (isMatched) {
      matched.push(entry);
    } else if (item.isPinned) {
      pinned.push(entry);
    } else {
      rest.push(entry);
    }
  }

  return [...matched, ...pinned, ...rest].slice(0, maxLimit);
}
