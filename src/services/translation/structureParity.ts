/**
 * Strict 1:1 Raw Structure Parity Engine
 * Chuẩn hóa dấu câu CJK -> tiếng Việt, khôi phục phân dòng an toàn,
 * trích xuất chữ ký cấu trúc đoạn tuyến tính O(n) và đối chiếu 1-1 với bản raw.
 */

import { countChineseCharacters, isChapterTitleLine } from '../../lib/text';
import { DirectQaCritiqueIssue } from './types';

export type StructureDiscrepancyKind =
  | 'paragraph_count_mismatch'
  | 'cjk_punctuation_leak'
  | 'dialogue_quote_loss'
  | 'terminal_punctuation_mismatch'
  | 'expressive_punctuation_loss'
  | 'sentence_count_divergence';

export type TerminalPunctuationKind =
  | 'period'
  | 'question'
  | 'exclamation'
  | 'ellipsis'
  | 'dash'
  | 'colon'
  | 'divider'
  | 'other';

export interface ParagraphStructuralSignature {
  index: number;
  isTitle: boolean;
  isSceneDivider: boolean;
  sentenceCount: number;
  questionCount: number;
  exclamationCount: number;
  ellipsisCount: number;
  dashCount: number;
  dialogueQuoteCount: number;
  hasDirectDialogue: boolean;
  terminalKind: TerminalPunctuationKind;
  cjkPunctuationCount: number;
}

export interface ParagraphParityDiscrepancy {
  paragraphIndex: number;
  sourceParagraphIndex?: number;
  kind: StructureDiscrepancyKind;
  severity: 'critical' | 'warning';
  description: string;
}

export interface StructureParityReport {
  sourceParagraphCount: number;
  targetParagraphCount: number;
  sourceBodyCount: number;
  targetBodyCount: number;
  isParagraphCountExact: boolean;
  paragraphCountDelta: number;
  leftoverCjkPunctuationCount: number;
  discrepancies: ParagraphParityDiscrepancy[];
  penaltyScore: number;
}

const CJK_PUNCTUATION_CHAR_RE = /[。，、；：？！「」『』（）《》〈〉【】［］＂＇．～…]/g;
const SCENE_DIVIDER_RE = /^(?:[*=~·—-]\s*){3,}$/;
const EXTENDED_TITLE_LINE_RE = /^(?:楔子|序章|序幕|番外|尾声|终章|后记|Lời mở đầu|Ngoại truyện|Vĩ thanh|Chương cuối)(?:$|\s|[:.\-—])/iu;
const ADJACENT_PURE_DIALOGUES_RE = /^"[^"\n]+"(?:\s+"[^"\n]+")+$/;

function isTitleParagraph(line: string): boolean {
  const trimmed = (line || '').trim();
  if (!trimmed) return false;
  return isChapterTitleLine(trimmed) || EXTENDED_TITLE_LINE_RE.test(trimmed);
}

export function isSceneDividerParagraph(line: string): boolean {
  const trimmed = (line || '').trim();
  if (!trimmed) return false;
  return SCENE_DIVIDER_RE.test(trimmed);
}

export function splitParagraphsPreservingOrder(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function splitTitleAndBodyParagraphs(paragraphs: string[]): {
  hasTitle: boolean;
  title?: string;
  body: string[];
} {
  if (paragraphs.length > 1 && isTitleParagraph(paragraphs[0])) {
    return {
      hasTitle: true,
      title: paragraphs[0],
      body: paragraphs.slice(1),
    };
  }
  return {
    hasTitle: false,
    body: paragraphs,
  };
}

/**
 * Chuyển đổi tất định 1-1 toàn bộ dấu câu toàn giác tiếng Trung sang chuẩn tiếng Việt
 * mà không làm thay đổi cấu trúc dòng (\n), số thập phân hay ký hiệu hệ thống.
 */
export function normalizeTranslatedPunctuation(text: string): string {
  if (!text || typeof text !== 'string') return '';

  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const normalizedLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    if (isSceneDividerParagraph(trimmed)) return trimmed;

    const OPEN_Q = '\uE001';
    const CLOSE_Q = '\uE002';

    let out = line
      .replace(/。{3,}/g, '...')
      .replace(/……+/g, '...')
      .replace(/…+/g, '...')
      .replace(/——+/g, '—')
      .replace(/──+/g, '—')
      .replace(/[。．]/g, '.')
      .replace(/[，、]/g, ',')
      .replace(/；/g, ';')
      .replace(/：/g, ':')
      .replace(/？/g, '?')
      .replace(/！/g, '!')
      .replace(/[“「]/g, OPEN_Q)
      .replace(/[”」]/g, CLOSE_Q)
      .replace(/＂/g, '"')
      .replace(/[‘’『』＇]/g, "'")
      .replace(/（/g, '(')
      .replace(/）/g, ')')
      .replace(/[《〈]/g, '«')
      .replace(/[》〉]/g, '»')
      .replace(/[【［]/g, '[')
      .replace(/[】］]/g, ']')
      .replace(/～/g, '~');

    // Xóa khoảng trắng thừa trước dấu câu kết/ngắt (tránh làm hỏng '...' hoặc '---')
    out = out.replace(new RegExp(`([\\p{L}\\p{N})${CLOSE_Q}"»\\]])[ \\t]+([,;?!:])`, 'gu'), '$1$2');
    out = out.replace(new RegExp(`([\\p{L}\\p{N})${CLOSE_Q}"»\\]])[ \\t]+\\.(?!\\.)`, 'gu'), '$1.');

    // Xóa khoảng trắng thừa ngay sau ngoặc mở / ngay trước ngoặc đóng CJK
    out = out.replace(new RegExp(`${OPEN_Q}[ \\t]+`, 'g'), OPEN_Q);
    out = out.replace(new RegExp(`[ \\t]+${CLOSE_Q}`, 'g'), CLOSE_Q);

    // Bổ sung 1 khoảng trắng sau dấu câu nếu dính sát chữ cái hoặc ngoặc mở
    out = out.replace(new RegExp(`([\\p{L}\\p{N})${CLOSE_Q}"»\\]])([,;?!])([\\p{L}${OPEN_Q}«(])`, 'gu'), '$1$2 $3');
    // Dấu hai chấm: chỉ tách khi đứng sau chữ cái/ngoặc đóng (tránh phá vỡ giờ 12:30 hay tỉ lệ 1:1)
    out = out.replace(new RegExp(`([\\p{L})${CLOSE_Q}"»\\]])(:)([\\p{L}\\p{N}${OPEN_Q}"«(])`, 'gu'), '$1$2 $3');
    // Khoảng trắng sau ngoặc đóng thoại khi dính chữ kế tiếp (vd: ?"Tiêu -> ?" Tiêu)
    out = out.replace(new RegExp(`${CLOSE_Q}([\\p{L}«(])`, 'gu'), `${CLOSE_Q} $1`);
    out = out.replace(/([,.?!;])"([\p{L}«(])/gu, '$1" $2');
    // Dấu chấm đơn giữa 2 chữ cái (bảo vệ số thập phân 3.5 và dấu ba chấm ...)
    out = out.replace(new RegExp(`(?<!\\.)(\\p{L}{2,})\\.([\\p{Lu}${OPEN_Q}"«])`, 'gu'), '$1. $2');

    // Chuyển marker ngoặc mở/đóng về dấu ngoặc kép chuẩn '"'
    out = out.replace(new RegExp(`[${OPEN_Q}${CLOSE_Q}]`, 'g'), '"');

    // Bổ sung khoảng trắng quanh ngoặc đơn/ngoặc tác phẩm khi dính chữ cái, số hoặc ngoặc đóng vuông
    out = out.replace(/([\p{L}\p{N}\]])([«(])/gu, '$1 $2');
    out = out.replace(/([»)])([\p{L}\p{N}])/gu, '$1 $2');

    // Chuẩn hóa khoảng trắng trong cặp ngoặc đơn/ngoặc vuông
    out = out.replace(/\([ \t]+/g, '(').replace(/[ \t]+\)/g, ')');
    // Gộp nhiều space ngang liên tiếp thành 1 space (giữ nguyên thụt lề = 0)
    out = out.replace(/[ \t]{2,}/g, ' ').trim();
    return out;
  });

  return normalizedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function isDigit(ch: string | undefined): boolean {
  return ch !== undefined && ch >= '0' && ch <= '9';
}

function detectTerminalKind(trimmed: string, isDivider: boolean): TerminalPunctuationKind {
  if (isDivider) return 'divider';
  if (!trimmed) return 'other';

  let idx = trimmed.length - 1;
  while (
    idx >= 0 &&
    (trimmed[idx] === ' ' ||
      trimmed[idx] === '\t' ||
      trimmed[idx] === '"' ||
      trimmed[idx] === "'" ||
      trimmed[idx] === '”' ||
      trimmed[idx] === '’' ||
      trimmed[idx] === '」' ||
      trimmed[idx] === '』' ||
      trimmed[idx] === ')' ||
      trimmed[idx] === '）' ||
      trimmed[idx] === '»' ||
      trimmed[idx] === '》' ||
      trimmed[idx] === ']' ||
      trimmed[idx] === '】')
  ) {
    idx--;
  }
  if (idx < 0) return 'other';

  const ch = trimmed[idx];
  if (ch === '?' || ch === '？') return 'question';
  if (ch === '!' || ch === '！') return 'exclamation';
  if (ch === '…' || (ch === '.' && idx >= 2 && trimmed[idx - 1] === '.' && trimmed[idx - 2] === '.')) {
    return 'ellipsis';
  }
  if (ch === '—' || ch === '─') return 'dash';
  if (ch === ':' || ch === '：') return 'colon';
  if (ch === '.' || ch === '。') return 'period';
  return 'other';
}

/**
 * Quét tuyến tính O(n) trên một đoạn văn đơn để trích xuất chữ ký cấu trúc 1-1.
 */
export function extractParagraphSignature(
  paragraph: string,
  _lang: 'zh' | 'vi' = 'vi',
  index: number = 0
): ParagraphStructuralSignature {
  const trimmed = (paragraph || '').trim();
  const isTitle = isTitleParagraph(trimmed);
  const isSceneDivider = !isTitle && isSceneDividerParagraph(trimmed);

  let questionCount = 0;
  let exclamationCount = 0;
  let ellipsisCount = 0;
  let dashCount = 0;
  let sentenceCount = 0;
  let cjkPunctuationCount = 0;

  let straightDoubleQuotes = 0;
  let cnOpenDouble = 0;
  let cnCloseDouble = 0;
  let jpOpenQuote = 0;
  let jpCloseQuote = 0;

  let i = 0;
  const len = trimmed.length;
  while (i < len) {
    const ch = trimmed[i];

    if (CJK_PUNCTUATION_CHAR_RE.test(ch)) {
      cjkPunctuationCount++;
    }
    CJK_PUNCTUATION_CHAR_RE.lastIndex = 0;

    if (ch === '“' || ch === '「') cnOpenDouble++;
    else if (ch === '”' || ch === '」') cnCloseDouble++;
    else if (ch === '"') straightDoubleQuotes++;
    else if (ch === '＂') straightDoubleQuotes++;

    if (
      ch === '?' || ch === '？' ||
      ch === '!' || ch === '！' ||
      ch === '…' || ch === '。' || ch === '．' || ch === '.'
    ) {
      // Bỏ qua dấu chấm thập phân (vd: 3.5) khi đứng đơn lẻ giữa 2 chữ số
      if ((ch === '.' || ch === '．') && isDigit(trimmed[i - 1]) && isDigit(trimmed[i + 1])) {
        i++;
        continue;
      }

      // Gom trọn cụm dấu kết câu liên tiếp (vd: ？！, ！！！, ……？, 。。。) thành 1 câu
      let hasQuestion = false;
      let hasExclamation = false;
      let hasEllipsis = false;

      while (i < len) {
        const c = trimmed[i];
        if (c === '?' || c === '？') {
          hasQuestion = true;
          i++;
        } else if (c === '!' || c === '！') {
          hasExclamation = true;
          i++;
        } else if (c === '…') {
          hasEllipsis = true;
          i++;
        } else if (c === '。' || c === '．' || c === '.') {
          if ((c === '.' || c === '．') && isDigit(trimmed[i - 1]) && isDigit(trimmed[i + 1])) {
            break;
          }
          let dotRun = 0;
          while (i + dotRun < len && (trimmed[i + dotRun] === c)) dotRun++;
          if (dotRun >= 3 || (c !== '。' && dotRun >= 2)) {
            hasEllipsis = true;
          }
          i += dotRun;
        } else {
          break;
        }

        if (i < len && CJK_PUNCTUATION_CHAR_RE.test(trimmed[i])) {
          cjkPunctuationCount++;
        }
        CJK_PUNCTUATION_CHAR_RE.lastIndex = 0;
      }

      if (hasQuestion) questionCount++;
      if (hasExclamation) exclamationCount++;
      if (hasEllipsis) ellipsisCount++;
      sentenceCount++;
      continue;
    }

    if (ch === '—' || ch === '─') {
      while (i < len && (trimmed[i] === '—' || trimmed[i] === '─')) i++;
      dashCount++;
      continue;
    }

    i++;
  }

  const dialogueQuoteCount =
    Math.floor(straightDoubleQuotes / 2) +
    Math.min(cnOpenDouble, cnCloseDouble) +
    Math.min(jpOpenQuote, jpCloseQuote);

  const terminalKind = detectTerminalKind(trimmed, isSceneDivider);
  if (trimmed && sentenceCount === 0) {
    sentenceCount = 1;
  }

  return {
    index,
    isTitle,
    isSceneDivider,
    sentenceCount,
    questionCount,
    exclamationCount,
    ellipsisCount,
    dashCount,
    dialogueQuoteCount,
    hasDirectDialogue: dialogueQuoteCount > 0,
    terminalKind,
    cjkPunctuationCount,
  };
}

/**
 * Khôi phục phân dòng tất định trong các trường hợp an toàn 100% không làm sai nghĩa:
 * 1. Nguồn có đúng 1 đoạn thân bài (không phải phân cảnh) nhưng AI tự tách thành 2-4 dòng ngắn -> gộp lại thành 1 đoạn.
 * 2. AI gộp nhiều dòng thoại độc lập ("..." "...") không có dẫn truyện xen giữa -> tách lại theo đúng các dòng thoại nguồn.
 */
export function realignParagraphStructure(sourceText: string, translatedText: string): string {
  const srcParas = splitParagraphsPreservingOrder(sourceText);
  const transParas = splitParagraphsPreservingOrder(translatedText);
  if (srcParas.length === 0 || transParas.length === 0) {
    return (translatedText || '').trim();
  }

  if (srcParas.length === transParas.length) {
    return transParas.join('\n\n');
  }

  const srcSplit = splitTitleAndBodyParagraphs(srcParas);
  const transSplit = splitTitleAndBodyParagraphs(transParas);

  if (srcSplit.body.length === transSplit.body.length) {
    return transParas.join('\n\n');
  }

  let nextBody = [...transSplit.body];

  // Trường hợp 1: Bản gốc thân bài chỉ có 1 đoạn đơn nhưng AI tách thành 2-4 dòng ngắn
  if (
    srcSplit.body.length === 1 &&
    !isSceneDividerParagraph(srcSplit.body[0]) &&
    nextBody.length > 1 &&
    nextBody.length <= 4 &&
    nextBody.every((p) => !isSceneDividerParagraph(p) && !isTitleParagraph(p))
  ) {
    nextBody = [nextBody.join(' ')];
  } else if (nextBody.length < srcSplit.body.length) {
    // Trường hợp 2: Tách các dòng chỉ chứa nhiều cặp thoại thuần túy dính liền ("..." "...")
    // CHỈ tách khi vị trí tương ứng trong bản gốc thực sự là nhiều dòng thoại độc lập liên tiếp
    const expanded: string[] = [];
    for (const para of nextBody) {
      if (ADJACENT_PURE_DIALOGUES_RE.test(para)) {
        const quotedSegments = para.match(/"[^"\n]+"/g);
        const startIdx = expanded.length;
        if (
          quotedSegments &&
          quotedSegments.length > 1 &&
          startIdx + quotedSegments.length <= srcSplit.body.length &&
          extractParagraphSignature(srcSplit.body[startIdx], 'zh').dialogueQuoteCount < quotedSegments.length &&
          quotedSegments.every((_, offset) =>
            extractParagraphSignature(srcSplit.body[startIdx + offset], 'zh').hasDirectDialogue
          )
        ) {
          expanded.push(...quotedSegments.map((s) => s.trim()));
          continue;
        }
      }
      expanded.push(para);
    }

    if (expanded.length === srcSplit.body.length) {
      nextBody = expanded;
    }
  }

  const finalParas = transSplit.hasTitle && transSplit.title ? [transSplit.title, ...nextBody] : nextBody;
  return finalParas.join('\n\n');
}

function alignBodyParagraphs(sourceText: string, translatedText: string): {
  sourceParas: string[];
  targetParas: string[];
  sourceBody: string[];
  targetBody: string[];
  sourceOffset: number;
  targetOffset: number;
} {
  const sourceParas = splitParagraphsPreservingOrder(sourceText);
  const targetParas = splitParagraphsPreservingOrder(translatedText);

  // Ưu tiên khớp tổng số đoạn 1-1 trước khi trừ offset tiêu đề (tránh phụ thuộc regex tiêu đề)
  if (sourceParas.length === targetParas.length) {
    return {
      sourceParas,
      targetParas,
      sourceBody: sourceParas,
      targetBody: targetParas,
      sourceOffset: 0,
      targetOffset: 0,
    };
  }

  const srcSplit = splitTitleAndBodyParagraphs(sourceParas);
  const tgtSplit = splitTitleAndBodyParagraphs(targetParas);

  return {
    sourceParas,
    targetParas,
    sourceBody: srcSplit.body,
    targetBody: tgtSplit.body,
    sourceOffset: srcSplit.hasTitle ? 1 : 0,
    targetOffset: tgtSplit.hasTitle ? 1 : 0,
  };
}

/**
 * Đối chiếu cấu trúc 1-1 giữa văn bản nguồn và văn bản đích trên mọi đơn vị đoạn/dòng.
 */
export function analyzeStructureParity(sourceText: string, translatedText: string): StructureParityReport {
  const {
    sourceParas,
    targetParas,
    sourceBody,
    targetBody,
    targetOffset,
  } = alignBodyParagraphs(sourceText, translatedText);

  const discrepancies: ParagraphParityDiscrepancy[] = [];
  let leftoverCjkPunctuationCount = 0;

  // 1. Kiểm tra sót dấu câu toàn giác tiếng Trung trên mọi đoạn đích
  targetParas.forEach((para, idx) => {
    const matches = para.match(CJK_PUNCTUATION_CHAR_RE);
    const count = matches ? matches.length : 0;
    if (count > 0) {
      leftoverCjkPunctuationCount += count;
      discrepancies.push({
        paragraphIndex: idx,
        kind: 'cjk_punctuation_leak',
        severity: 'critical',
        description: `Đoạn ${idx + 1} còn sót ${count} ký tự dấu câu tiếng Trung (${matches!.slice(0, 3).join(' ')}).`,
      });
    }
  });

  const paragraphCountDelta = Math.abs(sourceBody.length - targetBody.length);
  const isParagraphCountExact = paragraphCountDelta === 0 && targetParas.length > 0 === (sourceParas.length > 0);

  if (paragraphCountDelta > 0) {
    const firstBodyIdx = Math.min(Math.max(0, targetParas.length - 1), targetOffset);
    discrepancies.push({
      paragraphIndex: firstBodyIdx,
      kind: 'paragraph_count_mismatch',
      severity: 'critical',
      description: `Số đoạn/dòng thân bài bị lệch so với bản gốc (${targetBody.length} đoạn so với ${sourceBody.length} đoạn gốc).`,
    });
  }

  // 2. Đối chiếu chữ ký cấu trúc 1-1 khi số lượng khớp (hoặc từng cặp đầu tương ứng)
  const compareLimit = paragraphCountDelta === 0 ? sourceBody.length : Math.min(sourceBody.length, targetBody.length);
  for (let i = 0; i < compareLimit; i++) {
    const srcPara = sourceBody[i];
    const tgtPara = targetBody[i];
    const srcSig = extractParagraphSignature(srcPara, 'zh', i);
    const tgtSig = extractParagraphSignature(tgtPara, 'vi', i + targetOffset);
    const targetParaIndex = i + targetOffset;

    if (srcSig.isTitle || srcSig.isSceneDivider) {
      continue;
    }

    // Mất hoàn toàn dấu ngoặc thoại trực tiếp
    if (srcSig.hasDirectDialogue && !tgtSig.hasDirectDialogue) {
      discrepancies.push({
        paragraphIndex: targetParaIndex,
        sourceParagraphIndex: i,
        kind: 'dialogue_quote_loss',
        severity: 'critical',
        description: `Đoạn ${targetParaIndex + 1} làm mất dấu ngoặc lời thoại trực tiếp từ bản gốc.`,
      });
    }

    // Sai lệch dấu ngữ khí kết đoạn (hỏi / cảm thán / ba chấm / gạch ngang bị đổi thành dấu chấm thường)
    const expressiveTerminals: TerminalPunctuationKind[] = ['question', 'exclamation', 'ellipsis', 'dash'];
    if (
      expressiveTerminals.includes(srcSig.terminalKind) &&
      tgtSig.terminalKind !== srcSig.terminalKind &&
      tgtSig.terminalKind === 'period'
    ) {
      discrepancies.push({
        paragraphIndex: targetParaIndex,
        sourceParagraphIndex: i,
        kind: 'terminal_punctuation_mismatch',
        severity: 'warning',
        description: `Đoạn ${targetParaIndex + 1} có dấu kết đoạn (${srcSig.terminalKind}) ở bản gốc nhưng bị chuyển thành dấu chấm thường.`,
      });
    } else if (
      (srcSig.questionCount > 0 && tgtSig.questionCount === 0) ||
      (srcSig.exclamationCount > 0 && tgtSig.exclamationCount === 0) ||
      (srcSig.ellipsisCount > 0 && tgtSig.ellipsisCount === 0)
    ) {
      discrepancies.push({
        paragraphIndex: targetParaIndex,
        sourceParagraphIndex: i,
        kind: 'expressive_punctuation_loss',
        severity: 'warning',
        description: `Đoạn ${targetParaIndex + 1} bị thiếu dấu ngữ khí (?, ! hoặc ...) so với bản gốc.`,
      });
    }

    // Độ lệch số câu (ngắt câu) trong đoạn — chỉ đối chiếu khi số đoạn khớp 1-1
    if (paragraphCountDelta === 0) {
      const allowedSentenceDelta = srcSig.sentenceCount <= 3 ? 0 : 1;
      const sentenceDelta = Math.abs(srcSig.sentenceCount - tgtSig.sentenceCount);
      if (sentenceDelta > allowedSentenceDelta) {
        discrepancies.push({
          paragraphIndex: targetParaIndex,
          sourceParagraphIndex: i,
          kind: 'sentence_count_divergence',
          severity: 'warning',
          description: `Đoạn ${targetParaIndex + 1} bị đổi cách ngắt câu (${tgtSig.sentenceCount} câu so với ${srcSig.sentenceCount} câu gốc).`,
        });
      }
    }
  }

  const penaltyScore = discrepancies.reduce(
    (sum, d) => sum + (d.severity === 'critical' ? 10 : 3),
    0
  );

  return {
    sourceParagraphCount: sourceParas.length,
    targetParagraphCount: targetParas.length,
    sourceBodyCount: sourceBody.length,
    targetBodyCount: targetBody.length,
    isParagraphCountExact,
    paragraphCountDelta,
    leftoverCjkPunctuationCount,
    discrepancies,
    penaltyScore,
  };
}

/**
 * Kiểm định nghiêm ngặt khớp 1-1 số đoạn thân bài (áp dụng cho cả chương ngắn < 5 đoạn).
 * Ném `PARAGRAPH_STRUCTURE_DIVERGENCE` để kích hoạt chia nhỏ thích ứng khi bị gộp/tách đoạn.
 */
export function validateStrictStructureParity(
  referenceText: string,
  targetText: string,
  options?: {
    requireChineseSource?: boolean;
    referenceRawText?: string;
  }
): void {
  if (!referenceText || !targetText) return;

  if (options?.requireChineseSource !== false && countChineseCharacters(referenceText) === 0) {
    return;
  }

  const srcAligned = alignBodyParagraphs(referenceText, targetText);
  let expectedBodyCount = srcAligned.sourceBody.length;
  let actualBodyCount = srcAligned.targetBody.length;

  if (options?.referenceRawText) {
    const rawAligned = alignBodyParagraphs(options.referenceRawText, targetText);
    if (srcAligned.sourceBody.length !== rawAligned.sourceBody.length) {
      expectedBodyCount = rawAligned.sourceBody.length;
      actualBodyCount = rawAligned.targetBody.length;
    }
  }

  if (expectedBodyCount === 0) return;

  if (actualBodyCount !== expectedBodyCount) {
    throw new Error(
      `PARAGRAPH_STRUCTURE_DIVERGENCE: Cấu trúc phân đoạn không khớp 1-1 với bản gốc (${actualBodyCount} đoạn so với ${expectedBodyCount} đoạn chuẩn).`
    );
  }
}

/**
 * Sinh danh sách lỗi kiểm duyệt tất định cho các sai lệch cấu trúc 1-1 còn tồn tại.
 */
export function checkStructureParityIssues(params: {
  sourceText: string;
  translatedText: string;
  isPartialFallback?: boolean;
}): DirectQaCritiqueIssue[] {
  const { sourceText, translatedText, isPartialFallback } = params;
  if (isPartialFallback || !sourceText?.trim() || !translatedText?.trim()) {
    return [];
  }

  const report = analyzeStructureParity(sourceText, translatedText);
  if (report.discrepancies.length === 0) {
    return [];
  }

  const targetParas = splitParagraphsPreservingOrder(translatedText);
  const directIssues: DirectQaCritiqueIssue[] = [];
  const otherByParagraph = new Map<number, { severity: 'critical' | 'warning'; descriptions: string[] }>();

  for (const d of report.discrepancies) {
    const targetText = targetParas[d.paragraphIndex] || '';
    if (d.kind === 'cjk_punctuation_leak') {
      directIssues.push({
        type: 'raw_leak',
        severity: 'critical',
        targetText,
        description: `[Cấu trúc 1-1] ${d.description}`,
        paragraphIndex: d.paragraphIndex,
        source: 'deterministic',
      });
      continue;
    }

    if (d.kind === 'paragraph_count_mismatch') {
      const isFewer = report.targetBodyCount < report.sourceBodyCount;
      directIssues.push({
        type: isFewer ? 'omission' : 'addition',
        severity: 'critical',
        targetText,
        description: `[Cấu trúc 1-1] ${d.description}`,
        paragraphIndex: d.paragraphIndex,
        source: 'deterministic',
      });
      continue;
    }

    const bucket = otherByParagraph.get(d.paragraphIndex) || { severity: d.severity, descriptions: [] };
    if (d.severity === 'critical') {
      bucket.severity = 'critical';
    }
    bucket.descriptions.push(d.description);
    otherByParagraph.set(d.paragraphIndex, bucket);
  }

  for (const [paragraphIndex, bucket] of otherByParagraph.entries()) {
    directIssues.push({
      type: 'other',
      severity: bucket.severity,
      targetText: targetParas[paragraphIndex] || '',
      description: `[Cấu trúc 1-1] ${bucket.descriptions.join(' ')}`,
      paragraphIndex,
      source: 'deterministic',
    });
  }

  return directIssues;
}
