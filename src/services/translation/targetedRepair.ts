/**
 * Targeted Paragraph Repair Service (Phase 3 Repair)
 * Dịch sửa có mục tiêu chỉ những đoạn văn có lỗi nghiêm trọng (`severity === 'critical'`),
 * giữ nguyên 100% từng ký tự của các đoạn không liên quan và tự động rollback nếu phát sinh lỗi mới.
 */

import { GlossaryItem } from '../../types';
import { selectRelevantGlossary } from '../../lib/glossaryMatch';
import { LITERARY_TRANSLATION_FRAMING, parseGeminiStructuredResponse, sanitizePromptInput } from '../../lib/text';
import { callGeminiDirect } from '../directGeminiClient';
import {
  mapTranslatedParagraphToSourceWindow,
  runDeterministicTranslationChecks,
  splitNonEmptyParagraphs,
} from './translationValidation';
import {
  extractParagraphSignature,
  normalizeTranslatedPunctuation,
} from './structureParity';
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
  targetIssueIndices?: number[];
}

export interface TargetedParagraphRepairResult {
  repairedTranslatedText: string;
  updatedIssues: DirectQaCritiqueIssue[];
  repairedParagraphIndices: number[];
  rejectedParagraphIndices: number[];
  successKeyIndex: number;
}

interface ParagraphSpan {
  index: number;
  start: number;
  end: number;
  trimmed: string;
}

interface TargetedRepairAiResponse {
  repairedParagraph: string;
}

function isTargetedRepairResponse(val: unknown): val is TargetedRepairAiResponse {
  return (
    typeof val === 'object' &&
    val !== null &&
    typeof (val as TargetedRepairAiResponse).repairedParagraph === 'string'
  );
}

/**
 * Quét vị trí bắt đầu/kết thúc từng đoạn (dòng khác rỗng) theo đúng chuẩn phân tách của `splitNonEmptyParagraphs`
 * để khi ghép lại giữ nguyên 100% các đoạn còn lại và toàn bộ dấu xuống dòng gốc.
 */
function scanParagraphSpans(text: string): ParagraphSpan[] {
  const spans: ParagraphSpan[] = [];
  const normalized = text || '';
  const lineRe = /[^\r\n]+/g;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = lineRe.exec(normalized)) !== null) {
    const raw = match[0];
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const leadingWs = raw.indexOf(trimmed);
    const start = match.index + leadingWs;
    const end = start + trimmed.length;
    spans.push({
      index: idx++,
      start,
      end,
      trimmed,
    });
  }

  return spans;
}

function formatIssueSignature(issue: DirectQaCritiqueIssue): string {
  return `${issue.type}::${issue.expectedTerm?.chinese || ''}::${issue.description}`;
}

function buildTargetedRepairPayload(params: {
  sourceWindow: string;
  primarySourceParagraph: string;
  prevContext: string;
  targetParagraph: string;
  nextContext: string;
  issuesForParagraph: DirectQaCritiqueIssue[];
  relevantGlossary: GlossaryItem[];
  genre: string;
  tone: string;
  description?: string;
}) {
  const {
    sourceWindow,
    primarySourceParagraph,
    prevContext,
    targetParagraph,
    nextContext,
    issuesForParagraph,
    relevantGlossary,
    genre,
    tone,
    description,
  } = params;

  const cleanGenre = sanitizePromptInput(genre || 'Tiên Hiệp');
  const cleanTone = sanitizePromptInput(tone || 'Trang nghiêm cổ phong');
  const cleanDesc = sanitizePromptInput(description || '');

  const glossaryBlock =
    relevantGlossary.length > 0
      ? relevantGlossary
          .map((g) => `- [${g.chinese}] -> [${g.vietnamese}] (Loại: ${g.type || 'other'}${g.note ? `, ${sanitizePromptInput(g.note)}` : ''})`)
          .join('\n')
      : '(Không có thuật ngữ cố định trong đoạn này)';

  const issueLines = issuesForParagraph
    .map((iss, i) => {
      const termHint = iss.expectedTerm
        ? ` [Bắt buộc dùng: ${iss.expectedTerm.chinese} -> ${iss.expectedTerm.vietnamese}]`
        : '';
      return `${i + 1}. [${iss.type.toUpperCase()}] ${sanitizePromptInput(iss.description)}${termHint}`;
    })
    .join('\n');

  const systemInstruction =
    LITERARY_TRANSLATION_FRAMING +
    'Bạn là biên tập viên hiệu đính Trung - Việt chuyên sửa lỗi cục bộ.\n' +
    'QUY TẮC TUYỆT ĐỐI:\n' +
    '1. Chỉ viết lại DUY NHẤT [ĐOẠN CẦN SỬA] thành 1 đoạn văn tiếng Việt hoàn chỉnh.\n' +
    '2. KHÔNG lặp lại hay gộp [ĐOẠN TRƯỚC - CHỈ ĐỌC] và [ĐOẠN SAU - CHỈ ĐỌC].\n' +
    '3. Khắc phục triệt để các lỗi đã chỉ ra, tuân thủ 100% nguyên tác, bảng từ điển và xưng hô.\n' +
    `4. Giữ nguyên 1-1 cách ngắt câu, dấu câu ngữ khí (?, !, ..., —) và lời thoại trực tiếp trong ngoặc "..." khớp với [CÂU / ĐOẠN NGUỒN TRỌNG TÂM].\n` +
    `5. Giữ tông giọng ${cleanTone}, văn phong thể loại ${cleanGenre}, KHÔNG để sót chữ Hán, dấu câu tiếng Trung hay ngoặc vuông [...].\n` +
    (cleanDesc ? `6. Quy tắc truyện: ${cleanDesc}\n` : '');

  const prompt = `--- VĂN BẢN TIẾNG TRUNG ĐỐI CHIẾU ---
${sanitizePromptInput(sourceWindow)}

[CÂU / ĐOẠN NGUỒN TRỌNG TÂM]
${sanitizePromptInput(primarySourceParagraph)}

--- TỪ ĐIỂN BẮT BUỘC ---
${glossaryBlock}

--- NGỮ CẢNH BẢN DỊCH (CHỈ ĐỌC ĐỂ GIỮ MẠCH VĂN, KHÔNG TRẢ VỀ) ---
${prevContext ? `[ĐOẠN TRƯỚC - CHỈ ĐỌC]:\n${sanitizePromptInput(prevContext)}\n\n` : ''}[ĐOẠN CẦN SỬA]:
${sanitizePromptInput(targetParagraph)}
${nextContext ? `\n[ĐOẠN SAU - CHỈ ĐỌC]:\n${sanitizePromptInput(nextContext)}` : ''}

--- DANH SÁCH LỖI CẦN KHẮC PHỤC ---
${issueLines}`;

  const schema = {
    type: 'OBJECT',
    properties: {
      repairedParagraph: {
        type: 'STRING',
        description: 'Chỉ chứa duy nhất đoạn văn tiếng Việt đã được sửa lỗi hoàn chỉnh (1 đoạn đơn, không kèm đoạn trước/sau).',
      },
    },
    required: ['repairedParagraph'],
  };

  return { systemInstruction, prompt, schema };
}

/**
 * Dịch lại chỉ các đoạn văn có lỗi nghiêm trọng thông qua callGeminiDirect,
 * kèm 1 đoạn trước và 1 đoạn sau làm ngữ cảnh chỉ-đọc (FR-016, FR-017, FR-018).
 * Bảo đảm 100% các đoạn không nằm trong repairedParagraphIndices giữ nguyên từng ký tự.
 */
export async function repairChapterCriticalIssuesDirect(
  params: TargetedParagraphRepairParams
): Promise<TargetedParagraphRepairResult> {
  const {
    sourceText,
    translatedText,
    issues = [],
    glossary = [],
    genre,
    tone,
    description,
    apiKeys,
    model = 'gemini-2.5-flash',
    startKeyIndex = 0,
    signal,
    targetIssueIndices,
  } = params;

  const spans = scanParagraphSpans(translatedText || '');
  const sourceParas = splitNonEmptyParagraphs(sourceText || '');
  const transParas = spans.map((s) => s.trimmed);

  const selectedIndices = new Set<number>();
  if (Array.isArray(targetIssueIndices) && targetIssueIndices.length > 0) {
    for (const idx of targetIssueIndices) {
      if (Number.isInteger(idx) && idx >= 0 && idx < issues.length) {
        selectedIndices.add(idx);
      }
    }
  } else {
    issues.forEach((issue, idx) => {
      if (
        issue &&
        issue.severity === 'critical' &&
        typeof issue.paragraphIndex === 'number' &&
        issue.paragraphIndex >= 0 &&
        issue.paragraphIndex < spans.length
      ) {
        selectedIndices.add(idx);
      }
    });
  }

  // Nhóm các lỗi cần sửa theo paragraphIndex (mỗi đoạn tối đa 1 lần gọi sửa / lượt)
  const issuesByParagraph = new Map<number, Array<{ issueIdx: number; issue: DirectQaCritiqueIssue }>>();
  for (const issueIdx of selectedIndices) {
    const issue = issues[issueIdx];
    const pIdx = issue?.paragraphIndex;
    if (typeof pIdx !== 'number' || pIdx < 0 || pIdx >= spans.length) {
      continue;
    }
    const list = issuesByParagraph.get(pIdx) || [];
    list.push({ issueIdx, issue });
    issuesByParagraph.set(pIdx, list);
  }

  if (issuesByParagraph.size === 0 || !Array.isArray(apiKeys) || apiKeys.length === 0) {
    return {
      repairedTranslatedText: translatedText,
      updatedIssues: issues.map((it) => ({ ...it })),
      repairedParagraphIndices: [],
      rejectedParagraphIndices: [],
      successKeyIndex: startKeyIndex,
    };
  }

  const repairedParagraphIndices: number[] = [];
  const rejectedParagraphIndices: number[] = [];
  const replacementByParagraph = new Map<number, string>();
  let currentKeyIndex = startKeyIndex;

  for (const [pIdx, entries] of issuesByParagraph.entries()) {
    if (signal?.aborted) {
      rejectedParagraphIndices.push(pIdx);
      continue;
    }

    const span = spans[pIdx];
    const prevContext = pIdx > 0 ? spans[pIdx - 1].trimmed : '';
    const nextContext = pIdx < spans.length - 1 ? spans[pIdx + 1].trimmed : '';

    const alignment = mapTranslatedParagraphToSourceWindow(pIdx, sourceParas, transParas);
    const primarySourcePara = sourceParas[alignment.primarySourceIndex] || sourceText || '';
    const sourceWindow =
      sourceParas.length > 0
        ? sourceParas.slice(alignment.windowStartIndex, alignment.windowEndIndex + 1).join('\n\n')
        : sourceText || '';

    const { entries: relevantGlossary } = selectRelevantGlossary(sourceWindow, glossary || []);

    const { systemInstruction, prompt, schema } = buildTargetedRepairPayload({
      sourceWindow,
      primarySourceParagraph: primarySourcePara,
      prevContext,
      targetParagraph: span.trimmed,
      nextContext,
      issuesForParagraph: entries.map((e) => e.issue),
      relevantGlossary,
      genre,
      tone,
      description,
    });

    try {
      const response = await callGeminiDirect({
        apiKeys,
        model,
        prompt,
        systemInstruction,
        schema,
        temperature: 0.2,
        startKeyIndex: currentKeyIndex,
        signal,
      });

      if (typeof response.successKeyIndex === 'number') {
        currentKeyIndex = response.successKeyIndex;
      }

      const parsed = parseGeminiStructuredResponse<TargetedRepairAiResponse>(response.text, {
        validator: isTargetedRepairResponse,
        contextName: 'targetedRepair',
      });

      const candidatePara = normalizeTranslatedPunctuation(parsed.repairedParagraph)
        .replace(/[\r\n]+/g, ' ')
        .trim();
      if (!candidatePara) {
        rejectedParagraphIndices.push(pIdx);
        continue;
      }

      // Hậu kiểm cấu trúc cục bộ trên đoạn đã sửa (0 sót dấu câu CJK, không mất ngoặc thoại nguồn)
      const srcSig = extractParagraphSignature(primarySourcePara, 'zh');
      const candSig = extractParagraphSignature(candidatePara, 'vi');
      if (candSig.cjkPunctuationCount > 0 || (srcSig.hasDirectDialogue && !candSig.hasDirectDialogue)) {
        rejectedParagraphIndices.push(pIdx);
        continue;
      }

      // Hậu kiểm tất định đối chiếu trên đoạn nguồn chính xác: bác bỏ ngay nếu bản sửa phát sinh thêm vi phạm mới
      const baselineViolations = runDeterministicTranslationChecks({
        sourceText: primarySourcePara,
        translatedText: span.trimmed,
        glossary,
      });
      const candidateViolations = runDeterministicTranslationChecks({
        sourceText: primarySourcePara,
        translatedText: candidatePara,
        glossary,
      });

      const baselineSigs = new Set(baselineViolations.map(formatIssueSignature));
      const introducedNewViolation = candidateViolations.some(
        (v) => !baselineSigs.has(formatIssueSignature(v))
      );

      if (
        introducedNewViolation ||
        candidateViolations.length > baselineViolations.length
      ) {
        rejectedParagraphIndices.push(pIdx);
        continue;
      }

      replacementByParagraph.set(pIdx, candidatePara);
      repairedParagraphIndices.push(pIdx);
    } catch {
      rejectedParagraphIndices.push(pIdx);
    }
  }

  // Ghép ngược từ cuối về đầu theo đúng char offset để các đoạn không sửa giữ nguyên từng ký tự
  let repairedTranslatedText = translatedText;
  const sortedParaIndices = [...replacementByParagraph.keys()].sort((a, b) => b - a);
  for (const pIdx of sortedParaIndices) {
    const span = spans[pIdx];
    const replacement = replacementByParagraph.get(pIdx);
    if (!span || replacement === undefined) continue;
    repairedTranslatedText =
      repairedTranslatedText.slice(0, span.start) +
      replacement +
      repairedTranslatedText.slice(span.end);
  }

  const repairedSet = new Set(repairedParagraphIndices);
  const updatedIssues: DirectQaCritiqueIssue[] = issues.map((issue) => {
    if (
      issue &&
      typeof issue.paragraphIndex === 'number' &&
      repairedSet.has(issue.paragraphIndex)
    ) {
      return { ...issue, repaired: true };
    }
    return { ...issue };
  });

  return {
    repairedTranslatedText,
    updatedIssues,
    repairedParagraphIndices,
    rejectedParagraphIndices,
    successKeyIndex: currentKeyIndex,
  };
}
