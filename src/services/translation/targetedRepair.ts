/**
 * Targeted Paragraph Repair Service (Phase 3 Repair)
 * Dịch sửa có mục tiêu chỉ những đoạn văn có lỗi nghiêm trọng (`severity === 'critical'`),
 * giữ nguyên 100% từng ký tự của các đoạn không liên quan và tự động rollback nếu phát sinh lỗi mới.
 */

import { GlossaryItem } from '../../types';
import { filterGlossaryForChapter } from '../../lib/glossaryMatch';
import { getIncludePinnedGlossaryPreference, hasActiveAICredentials } from '../../utils/aiProviderStorage';
import {
  LITERARY_TRANSLATION_FRAMING,
  getGenreStyleGuide,
  getToneStyleGuide,
  parseGeminiStructuredResponse,
  sanitizePromptInput,
} from '../../lib/text';
import { callGeminiDirect } from '../directGeminiClient';
import type { GeminiWaitStatusInfo } from '../gemini/types';
import {
  mapTranslatedParagraphToSourceWindow,
  runDeterministicTranslationChecks,
  splitNonEmptyParagraphs,
} from './translationValidation';
import {
  analyzeStructureParity,
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
  onWaitStatus?: (info: GeminiWaitStatusInfo) => void;
}

export interface TargetedParagraphRepairResult {
  repairedTranslatedText: string;
  updatedIssues: DirectQaCritiqueIssue[];
  repairedParagraphIndices: number[];
  rejectedParagraphIndices: number[];
  rejectionReasons?: Record<number, string>;
  recoveredOmissionCount?: number;
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
  correctiveFeedback?: string;
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
    correctiveFeedback,
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
    'THỨ TỰ ƯU TIÊN TUYỆT ĐỐI:\n' +
    '- ƯU TIÊN #1: Trung thành 100% nguyên tác, bảng từ điển và cấu trúc câu/ngoặc thoại 1-1.\n' +
    '- ƯU TIÊN #2: Quy tắc dịch riêng của dự án > Quy chuẩn Tông giọng biên tập > Chỉ dẫn Thể loại chính.\n' +
    'QUY TẮC TUYỆT ĐỐI:\n' +
    '1. Chỉ viết lại DUY NHẤT [ĐOẠN CẦN SỬA] thành 1 đoạn văn tiếng Việt hoàn chỉnh.\n' +
    '2. KHÔNG lặp lại hay gộp [ĐOẠN TRƯỚC - CHỈ ĐỌC] và [ĐOẠN SAU - CHỈ ĐỌC].\n' +
    '3. Khắc phục triệt để các lỗi đã chỉ ra, tuân thủ 100% nguyên tác, bảng từ điển và xưng hô.\n' +
    `4. Giữ nguyên 1-1 cách ngắt câu, dấu câu ngữ khí (?, !, ..., —) và lời thoại trực tiếp trong ngoặc "..." khớp với [CÂU / ĐOẠN NGUỒN TRỌNG TÂM].\n` +
    `5. Giữ tông giọng ${cleanTone} (${getToneStyleGuide(cleanTone)}) và văn phong thể loại ${cleanGenre} (${getGenreStyleGuide(cleanGenre)}), KHÔNG để sót chữ Hán, dấu câu tiếng Trung hay ngoặc vuông [...].\n` +
    (cleanDesc ? `6. Quy tắc truyện (ƯU TIÊN CAO NHẤT VỀ XƯNG HÔ & CẤM KỴ): ${cleanDesc}\n` : '');

  const feedbackBlock = correctiveFeedback
    ? `\n\n--- PHẢN HỒI SỬA LẠI BẮT BUỘC (LƯỢT TRƯỚC VỪA BỊ TỪ CHỐI) ---\n${sanitizePromptInput(correctiveFeedback).slice(0, 240)}`
    : '';

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
${issueLines}${feedbackBlock}`;

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
    onWaitStatus,
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

  const hasRecoverableOmissions =
    sourceParas.length > spans.length &&
    issues.some(
      (issue, idx) =>
        issue &&
        issue.type === 'omission' &&
        issue.severity === 'critical' &&
        !issue.repaired &&
        !selectedIndices.has(idx) &&
        typeof issue.paragraphIndex !== 'number'
    );

  if ((issuesByParagraph.size === 0 && !hasRecoverableOmissions) || !hasActiveAICredentials(apiKeys)) {
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
  const rejectionReasons: Record<number, string> = {};
  const replacementByParagraph = new Map<number, string>();
  let currentKeyIndex = startKeyIndex;

  for (const [pIdx, entries] of issuesByParagraph.entries()) {
    if (signal?.aborted) {
      rejectedParagraphIndices.push(pIdx);
      rejectionReasons[pIdx] = 'Quá trình sửa bị hủy theo yêu cầu.';
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

    const { entries: relevantGlossary } = filterGlossaryForChapter(sourceWindow, glossary || [], {
      includePinned: getIncludePinnedGlossaryPreference(),
    });
    const paragraphIssues = entries.map((e) => e.issue);
    const baselineViolations = runDeterministicTranslationChecks({
      sourceText: primarySourcePara,
      translatedText: span.trimmed,
      glossary,
    });
    const baselineSigs = new Set(baselineViolations.map(formatIssueSignature));
    const srcSig = extractParagraphSignature(primarySourcePara, 'zh');

    let repairedTextForPara: string | null = null;
    let lastRejectReason = 'Không đạt kiểm tra an toàn chất lượng.';
    let feedbackForRetry: string | undefined;

    for (let attempt = 1; attempt <= 2; attempt++) {
      if (signal?.aborted) {
        lastRejectReason = 'Quá trình sửa bị hủy theo yêu cầu.';
        break;
      }

      const { systemInstruction, prompt, schema } = buildTargetedRepairPayload({
        sourceWindow,
        primarySourceParagraph: primarySourcePara,
        prevContext,
        targetParagraph: span.trimmed,
        nextContext,
        issuesForParagraph: paragraphIssues,
        relevantGlossary,
        genre,
        tone,
        description,
        ...(feedbackForRetry ? { correctiveFeedback: feedbackForRetry } : {}),
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
          enableProactivePacing: true,
          autoWaitForCooldown: true,
          ...(onWaitStatus ? { onWaitStatus } : {}),
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
          lastRejectReason = 'Bản sửa trả về rỗng.';
          feedbackForRetry = lastRejectReason;
          continue;
        }

        const candSig = extractParagraphSignature(candidatePara, 'vi');
        if (candSig.cjkPunctuationCount > 0) {
          lastRejectReason = 'Bản sửa còn sót dấu câu tiếng Trung.';
          feedbackForRetry = `${lastRejectReason} Hãy chuyển toàn bộ dấu câu sang chuẩn tiếng Việt.`;
          continue;
        }
        if (srcSig.hasDirectDialogue && !candSig.hasDirectDialogue) {
          lastRejectReason = 'Bản sửa làm mất dấu ngoặc lời thoại trực tiếp ("...").';
          feedbackForRetry = `${lastRejectReason} Bắt buộc giữ nguyên cặp dấu ngoặc kép "..." của lời thoại.`;
          continue;
        }

        const candidateViolations = runDeterministicTranslationChecks({
          sourceText: primarySourcePara,
          translatedText: candidatePara,
          glossary,
        });
        const newViolation = candidateViolations.find(
          (v) => !baselineSigs.has(formatIssueSignature(v))
        );
        if (newViolation || candidateViolations.length > baselineViolations.length) {
          lastRejectReason = newViolation
            ? `Phát sinh vi phạm mới: ${newViolation.description}`
            : 'Làm tăng số lỗi từ điển hoặc sót chữ Hán so với bản trước sửa.';
          feedbackForRetry = `${lastRejectReason} Hãy sửa mà giữ nguyên thuật ngữ bắt buộc và không để sót chữ Hán.`;
          continue;
        }

        // Nếu đang sửa lỗi terminology / raw_leak mục tiêu nhưng lượt 1 vẫn chưa khắc phục được, cho phép 1 lượt nhắc lại
        if (attempt === 1) {
          const unresolvedTargetedTerm = paragraphIssues.find(
            (iss) =>
              iss.type === 'terminology' &&
              iss.expectedTerm?.vietnamese &&
              !candidatePara.toLowerCase().includes(iss.expectedTerm.vietnamese.trim().toLowerCase())
          );
          if (unresolvedTargetedTerm?.expectedTerm) {
            lastRejectReason = `Chưa dùng đúng tên quy ước "${unresolvedTargetedTerm.expectedTerm.vietnamese}".`;
            feedbackForRetry = `Bắt buộc phải sử dụng chính xác tên "${unresolvedTargetedTerm.expectedTerm.vietnamese}" cho "${unresolvedTargetedTerm.expectedTerm.chinese}".`;
            continue;
          }
        }

        repairedTextForPara = candidatePara;
        break;
      } catch (err: any) {
        if (err?.name === 'AbortError' || signal?.aborted) {
          throw err;
        }
        lastRejectReason = `Lỗi gọi AI khi sửa đoạn (${err?.message || 'không xác định'}).`;
        break;
      }
    }

    if (repairedTextForPara) {
      replacementByParagraph.set(pIdx, repairedTextForPara);
      repairedParagraphIndices.push(pIdx);
    } else {
      rejectedParagraphIndices.push(pIdx);
      rejectionReasons[pIdx] = lastRejectReason;
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
  const recoveredOmissionIssueIndices = new Set<number>();
  let recoveredOmissionCount = 0;

  // Pha riêng an toàn: khôi phục đoạn văn gốc bị bỏ sót hoàn toàn (omission) khi tổng số đoạn dịch < số đoạn gốc
  const currentSpans = scanParagraphSpans(repairedTranslatedText);
  let currentParagraphDelta =
    sourceParas.length > 0 && currentSpans.length > 0
      ? analyzeStructureParity(sourceText, repairedTranslatedText).paragraphCountDelta
      : 0;
  if (
    !signal?.aborted &&
    sourceParas.length > currentSpans.length &&
    sourceParas.length > 0
  ) {
    const omissionCandidates = issues
      .map((issue, idx) => ({ issue, idx }))
      .filter(
        ({ issue, idx }) =>
          issue &&
          issue.type === 'omission' &&
          issue.severity === 'critical' &&
          !issue.repaired &&
          !selectedIndices.has(idx) &&
          typeof issue.paragraphIndex !== 'number'
      );

    for (const { issue, idx } of omissionCandidates) {
      if (signal?.aborted) break;
      const hanExcerptMatch = /'([^']*[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]{4,}[^']*)'/.exec(
        issue.description || ''
      );
      const hanExcerpt = hanExcerptMatch?.[1]?.trim();
      if (!hanExcerpt) continue;

      const matchedSrcIndices = sourceParas
        .map((sp, sIdx) => ({ sp, sIdx }))
        .filter(({ sp }) => sp.includes(hanExcerpt) || hanExcerpt.includes(sp));
      if (matchedSrcIndices.length !== 1) continue;

      const omittedSrcIdx = matchedSrcIndices[0].sIdx;
      const omittedSrcPara = sourceParas[omittedSrcIdx];
      const latestSpans = scanParagraphSpans(repairedTranslatedText);
      const afterExcerptMatch = /ngay sau đoạn\s*'([^']+)'/i.exec(issue.description || '');
      const afterNeedle = afterExcerptMatch?.[1]?.trim().toLowerCase() || '';

      let insertAfterIdx = Math.min(latestSpans.length - 1, omittedSrcIdx - 1);
      if (afterNeedle) {
        const foundAnchor = latestSpans.findIndex((sp) =>
          sp.trimmed.toLowerCase().includes(afterNeedle)
        );
        if (foundAnchor >= 0) {
          insertAfterIdx = foundAnchor;
        }
      }

      const prevWindow = omittedSrcIdx > 0 ? sourceParas[omittedSrcIdx - 1] : '';
      const nextWindow = omittedSrcIdx + 1 < sourceParas.length ? sourceParas[omittedSrcIdx + 1] : '';
      const sourceWindow = [prevWindow, omittedSrcPara, nextWindow].filter(Boolean).join('\n\n');
      const { entries: relevantGlossary } = filterGlossaryForChapter(sourceWindow, glossary || [], {
      includePinned: getIncludePinnedGlossaryPreference(),
    });

      const prevTrans = insertAfterIdx >= 0 ? latestSpans[insertAfterIdx]?.trimmed || '' : '';
      const nextTrans =
        insertAfterIdx + 1 < latestSpans.length ? latestSpans[insertAfterIdx + 1]?.trimmed || '' : '';

      const { systemInstruction, prompt, schema } = buildTargetedRepairPayload({
        sourceWindow,
        primarySourceParagraph: omittedSrcPara,
        prevContext: prevTrans,
        targetParagraph: `(Đoạn này bị bỏ sót chưa có trong bản dịch. Hãy dịch trọn vẹn 1-1 từ [CÂU / ĐOẠN NGUỒN TRỌNG TÂM]: ${omittedSrcPara})`,
        nextContext: nextTrans,
        issuesForParagraph: [issue],
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
          enableProactivePacing: true,
          autoWaitForCooldown: true,
          ...(onWaitStatus ? { onWaitStatus } : {}),
        });
        if (typeof response.successKeyIndex === 'number') {
          currentKeyIndex = response.successKeyIndex;
        }
        const parsed = parseGeminiStructuredResponse<TargetedRepairAiResponse>(response.text, {
          validator: isTargetedRepairResponse,
          contextName: 'targetedRepair',
        });
        const insertedPara = normalizeTranslatedPunctuation(parsed.repairedParagraph)
          .replace(/[\r\n]+/g, ' ')
          .trim();
        if (!insertedPara) continue;

        const insertedSig = extractParagraphSignature(insertedPara, 'vi');
        const omittedSrcSig = extractParagraphSignature(omittedSrcPara, 'zh');
        if (
          insertedSig.cjkPunctuationCount > 0 ||
          (omittedSrcSig.hasDirectDialogue && !insertedSig.hasDirectDialogue)
        ) {
          continue;
        }

        const insertedCheck = runDeterministicTranslationChecks({
          sourceText: omittedSrcPara,
          translatedText: insertedPara,
          glossary,
        });
        if (insertedCheck.some((v) => v.type === 'raw_leak')) {
          continue;
        }

        let candidateWithInsert: string;
        if (insertAfterIdx < 0) {
          candidateWithInsert = latestSpans.length > 0 ? `${insertedPara}\n\n${repairedTranslatedText}` : insertedPara;
        } else {
          const anchorSpan = latestSpans[insertAfterIdx];
          candidateWithInsert =
            repairedTranslatedText.slice(0, anchorSpan.end) +
            `\n\n${insertedPara}` +
            repairedTranslatedText.slice(anchorSpan.end);
        }

        const nextParity = analyzeStructureParity(sourceText, candidateWithInsert);
        if (nextParity.paragraphCountDelta < currentParagraphDelta) {
          repairedTranslatedText = candidateWithInsert;
          currentParagraphDelta = nextParity.paragraphCountDelta;
          recoveredOmissionIssueIndices.add(idx);
          recoveredOmissionCount++;
        }
      } catch (omissionErr: any) {
        if (omissionErr?.name === 'AbortError' || signal?.aborted) {
          throw omissionErr;
        }
        // Bỏ qua an toàn nếu gọi API phục hồi đoạn thiếu thất bại
      }
    }
  }

  const parityRestoredByOmissionRecovery = recoveredOmissionCount > 0 && currentParagraphDelta === 0;
  const updatedIssues: DirectQaCritiqueIssue[] = issues.map((issue, idx) => {
    if (recoveredOmissionIssueIndices.has(idx)) {
      return { ...issue, repaired: true };
    }
    if (
      parityRestoredByOmissionRecovery &&
      issue &&
      issue.type === 'omission' &&
      issue.severity === 'critical' &&
      issue.source === 'deterministic' &&
      issue.description?.startsWith('[Cấu trúc 1-1]')
    ) {
      return { ...issue, repaired: true };
    }
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
    ...(Object.keys(rejectionReasons).length > 0 ? { rejectionReasons } : {}),
    ...(recoveredOmissionCount > 0 ? { recoveredOmissionCount } : {}),
    successKeyIndex: currentKeyIndex,
  };
}
