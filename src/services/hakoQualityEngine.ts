/**
 * Quality Inspection Engine for Moderator Project Quality Checker
 * Feature: 075-moderator-quality-checker
 *
 * Implements:
 * 1. Fast rule-based heuristics (raw leaks, repetition, placeholder markers)
 * 2. AI semantic quality critique via Gemini (name consistency, pronoun/gender, terminology drift, bilingual raw alignment)
 * 3. Structured quality report generator
 */

import {
  QualityIssue,
  QualityIssueCategory,
  QualityIssueSeverity,
  QualityReviewSession,
  QualityReport,
  QualityReportStats,
  IssueReconciliationResult,
} from '../types/hakoChecker';
import { callGeminiDirect } from './directGeminiClient';
import { LITERARY_TRANSLATION_FRAMING, sanitizePromptInput } from '../lib/text';

/**
 * Chuẩn hóa đoạn trích văn bản tiếng Việt để so khớp ổn định giữa các lần quét:
 * - Bỏ dấu ba chấm cuối câu (...)
 * - Co cụm khoảng trắng liên tiếp
 * - Chuyển chữ thường
 * - Trích xuất token CJK nếu là lỗi raw_leak
 */
export function normalizeIssueSnippet(category: QualityIssueCategory, snippet: string): string {
  if (!snippet) return '';
  let cleaned = snippet.trim().replace(/\.{2,}$/, '').trim().toLowerCase();
  cleaned = cleaned.replace(/\s+/g, ' ');

  // Đối với lỗi raw_leak: trích xuất các ký tự CJK cụ thể để so khớp chính xác
  if (category === 'raw_leak') {
    const cjkMatches = snippet.match(/[\u4e00-\u9fa5\u3040-\u30ff]/g);
    if (cjkMatches && cjkMatches.length > 0) {
      return `cjk:${cjkMatches.join('')}`;
    }
  }

  return cleaned.slice(0, 120);
}

/**
 * Sinh chuỗi fingerprint định danh duy nhất cho một lỗi dựa trên chương, loại lỗi và snippet
 */
export function generateIssueFingerprint(
  chapterId: string,
  category: QualityIssueCategory,
  snippet: string
): string {
  const normSnippet = normalizeIssueSnippet(category, snippet);
  return `${String(chapterId || '').trim()}::${category}::${normSnippet}`;
}

/**
 * Kiểm tra xem đoạn văn bản vi phạm (snippet) còn tồn tại trong nội dung chương hay không
 */
export function isSnippetStillPresentInContent(
  category: QualityIssueCategory,
  snippet: string,
  content: string
): boolean {
  if (!content || !snippet) return false;
  const lowerContent = content.toLowerCase();

  if (category === 'raw_leak') {
    const cjkMatches = snippet.match(/[\u4e00-\u9fa5\u3040-\u30ff]/g);
    if (cjkMatches && cjkMatches.length > 0) {
      return cjkMatches.some((cjk) => content.includes(cjk));
    }
  }

  // Loại bỏ dấu ngoặc kép, khoảng trắng thừa và dấu chấm lửng
  const cleaned = snippet
    .replace(/^["'“”„«]+|["'“”»]+$/g, '')
    .trim()
    .replace(/\.{2,}$/, '')
    .trim()
    .toLowerCase();

  if (cleaned.length < 3) return false;
  // So khớp tối đa 50 ký tự đầu tiên của snippet
  const searchChunk = cleaned.slice(0, 50);
  return lowerContent.includes(searchChunk);
}

/**
 * Hòa giải danh sách lỗi mới quét được với các quyết định kiểm định đã có trong phiên
 */
export function reconcileIssuesWithDecisions(
  previousIssues: QualityIssue[],
  scannedIssues: QualityIssue[],
  scannedChapterIds: string[],
  chaptersContentMap?: Map<string, string> | Record<string, string>
): IssueReconciliationResult {
  const scannedChapterIdSet = new Set(scannedChapterIds.map(String));

  // 1. Phân chia previousIssues thành:
  // - Lỗi thuộc các chương KHÔNG quét lần này (giữ nguyên vẹn)
  // - Lỗi thuộc các chương ĐƯỢC quét lần này (tham gia hòa giải)
  const untouchedIssues: QualityIssue[] = [];
  const activePreviousIssues: QualityIssue[] = [];

  for (const issue of previousIssues || []) {
    if (scannedChapterIdSet.has(String(issue.chapterId))) {
      activePreviousIssues.push(issue);
    } else {
      untouchedIssues.push(issue);
    }
  }

  // 2. Lập bản đồ tra cứu fingerprint cho activePreviousIssues
  const prevMapByFingerprint = new Map<string, QualityIssue>();
  for (const prev of activePreviousIssues) {
    const fp = generateIssueFingerprint(prev.chapterId, prev.category, prev.vietnameseSnippet);
    // Ưu tiên giữ lại issue có quyết định người dùng (confirmed, review_needed, dismissed, resolved)
    if (!prevMapByFingerprint.has(fp) || prev.decision !== 'pending') {
      prevMapByFingerprint.set(fp, prev);
    }
  }

  const matchedPrevIds = new Set<string>();
  const reconciledFromScanned: QualityIssue[] = [];
  let newCount = 0;
  let unresolvedCount = 0;
  let dismissedCount = 0;

  // 3. Duyệt qua từng lỗi mới quét được
  for (const scanned of scannedIssues || []) {
    const fp = generateIssueFingerprint(scanned.chapterId, scanned.category, scanned.vietnameseSnippet);
    const existing = prevMapByFingerprint.get(fp);

    if (existing) {
      matchedPrevIds.add(existing.id);

      // Kế thừa quyết định và ghi chú từ lỗi cũ
      const inheritedDecision = existing.decision === 'resolved' ? 'confirmed' : existing.decision;
      if (inheritedDecision === 'confirmed') unresolvedCount++;
      if (inheritedDecision === 'dismissed') dismissedCount++;

      reconciledFromScanned.push({
        ...scanned,
        id: existing.id,
        decision: inheritedDecision,
        moderatorNote: existing.moderatorNote || scanned.moderatorNote,
        isNew: false,
        createdAt: existing.createdAt || scanned.createdAt,
      });
    } else {
      // Lỗi mới phát sinh chưa từng xuất hiện
      newCount++;
      reconciledFromScanned.push({
        ...scanned,
        decision: 'pending',
        isNew: true,
      });
    }
  }

  // 4. Kiểm tra các lỗi cũ không còn xuất hiện trong lần quét mới (đã được sửa trong bản dịch)
  let resolvedCount = 0;
  const resolvedIssues: QualityIssue[] = [];

  for (const prev of activePreviousIssues) {
    if (!matchedPrevIds.has(prev.id)) {
      if (prev.decision === 'confirmed' || prev.decision === 'review_needed') {
        const currentContent = chaptersContentMap
          ? chaptersContentMap instanceof Map
            ? chaptersContentMap.get(String(prev.chapterId))
            : (chaptersContentMap as Record<string, string>)[String(prev.chapterId)]
          : undefined;

        // Nếu có cung cấp content và đoạn vi phạm vẫn còn trong văn bản -> chưa sửa, không được chuyển sang resolved
        const isStillInContent =
          typeof currentContent === 'string'
            ? isSnippetStillPresentInContent(prev.category, prev.vietnameseSnippet, currentContent)
            : false;

        if (isStillInContent) {
          // Bảo lưu quyết định của moderator vì vi phạm vẫn tồn tại trong văn bản
          if (prev.decision === 'confirmed') unresolvedCount++;
          resolvedIssues.push(prev);
        } else {
          // Người dùng đã sửa bản dịch khiến lỗi biến mất -> chuyển sang resolved
          resolvedCount++;
          resolvedIssues.push({
            ...prev,
            decision: 'resolved',
            resolvedAt: new Date().toISOString(),
            isNew: false,
          });
        }
      } else if (prev.decision === 'resolved') {
        // Đã resolved từ trước và vẫn không xuất hiện lại
        resolvedIssues.push(prev);
      } else if (prev.decision === 'dismissed') {
        // Đã bác bỏ và nay đoạn văn đó cũng không vi phạm
        dismissedCount++;
        resolvedIssues.push(prev);
      }
      // Nếu prev.decision === 'pending' mà biến mất thì không cần giữ lại
    }
  }

  const finalIssues = [...untouchedIssues, ...reconciledFromScanned, ...resolvedIssues];
  const activeUnresolved = finalIssues.filter(
    (i) => i.decision === 'confirmed' || i.decision === 'pending' || i.decision === 'review_needed'
  ).length;

  return {
    reconciledIssues: finalIssues,
    diffSummary: {
      resolvedCount,
      unresolvedCount,
      dismissedCount,
      newCount,
      totalCurrent: activeUnresolved,
    },
  };
}

/**
 * Tạo UUID ngẫu nhiên cho lỗi phát hiện
 */
export function generateIssueId(): string {
  return `issue-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export interface HeuristicQualityScanInput {
  chapterId?: string;
  url?: string;
  title: string;
  chapterNumber: number;
  vietnameseContent: string;
  rawChineseContent?: string;
  translationType?: 'polished' | 'raw' | 'none';
}

/**
 * 1. HEURISTIC SCAN: Quét quy tắc nhanh trên văn bản tiếng Việt và đối chiếu độ dài với raw
 */
export function runHeuristicQualityScan(chapter: HeuristicQualityScanInput): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const text = chapter.vietnameseContent || '';
  if (!text.trim()) return issues;

  const chapterId = chapter.chapterId || chapter.url || '';
  const paragraphs = text.split(/\n+/).map((p) => p.trim()).filter(Boolean);

  // --- Rule 1: Phát hiện ký tự tiếng Trung / Hán tự chưa dịch (Raw Leak) ---
  const CJK_REGEX = /[\u4e00-\u9fa5\u3040-\u30ff]/g;
  paragraphs.forEach((p, pIdx) => {
    const cjkMatches = p.match(CJK_REGEX);
    if (cjkMatches && cjkMatches.length > 0) {
      const matchCount = cjkMatches.length;
      const snippet = p.length > 250 ? `${p.substring(0, 250)}...` : p;
      const severity: QualityIssueSeverity = matchCount >= 5 ? 'critical' : 'major';

      issues.push({
        id: generateIssueId(),
        chapterId,
        chapterTitle: chapter.title,
        chapterNumber: chapter.chapterNumber,
        category: 'raw_leak',
        severity,
        vietnameseSnippet: snippet,
        explanation: `Phát hiện ${matchCount} ký tự Hán tự / Raw chưa được dịch (ví dụ: "${cjkMatches.slice(0, 5).join('')}") tại đoạn #${pIdx + 1}.`,
        suggestedFix: 'Dịch hoặc loại bỏ các ký tự tiếng Trung còn sót lại trong bản dịch.',
        decision: 'pending',
        detectedBy: 'heuristic',
        createdAt: new Date().toISOString(),
      });
    }
  });

  // --- Rule 2: Phát hiện đoạn văn trùng lặp liên tiếp (Repetition / Đăng nhầm) ---
  for (let i = 0; i < paragraphs.length - 1; i++) {
    const curr = paragraphs[i];
    const next = paragraphs[i + 1];

    if (curr.length > 25 && curr === next) {
      issues.push({
        id: generateIssueId(),
        chapterId,
        chapterTitle: chapter.title,
        chapterNumber: chapter.chapterNumber,
        category: 'repetition',
        severity: 'major',
        vietnameseSnippet: curr.length > 200 ? `${curr.substring(0, 200)}...` : curr,
        explanation: `Đoạn văn tại vị trí #${i + 1} bị lặp lại y hệt ở đoạn tiếp theo #${i + 2}. Có thể do lỗi copy-paste hoặc đăng trùng đoạn.`,
        suggestedFix: 'Xóa đoạn văn bị trùng lặp.',
        decision: 'pending',
        detectedBy: 'heuristic',
        createdAt: new Date().toISOString(),
      });
    }
  }

  // --- Rule 3: Phát hiện placeholder / ghi chú dịch giả chưa xóa ---
  const PLACEHOLDER_REGEX = /\[(chưa dịch|sót raw|cần sửa|todo|fixme|raw thiếu)\]/gi;
  paragraphs.forEach((p, pIdx) => {
    const match = p.match(PLACEHOLDER_REGEX);
    if (match) {
      issues.push({
        id: generateIssueId(),
        chapterId,
        chapterTitle: chapter.title,
        chapterNumber: chapter.chapterNumber,
        category: 'other',
        severity: 'warning',
        vietnameseSnippet: p.length > 200 ? `${p.substring(0, 200)}...` : p,
        explanation: `Phát hiện thẻ ghi chú/placeholder biên tập "${match[0]}" chưa được xóa tại đoạn #${pIdx + 1}.`,
        suggestedFix: 'Hoàn thiện bản dịch và xóa thẻ ghi chú tạm thời.',
        decision: 'pending',
        detectedBy: 'heuristic',
        createdAt: new Date().toISOString(),
      });
    }
  });

  // --- Rule 4: Phát hiện chương bị cắt cụt / thiếu hụt nội dung nghiêm trọng (Omission / Truncation) ---
  const cleanVi = text.trim();
  const wordCount = cleanVi ? cleanVi.split(/\s+/).filter(Boolean).length : 0;
  const rawText = (chapter.rawChineseContent || '').trim();

  if (rawText && rawText.length > 150) {
    const rawParagraphs = rawText.split(/\n+/).map((p) => p.trim()).filter(Boolean);
    const viParagraphs = paragraphs.length;
    const ratio = (cleanVi.length / rawText.length) * 100;

    // Trường hợp 4A: Bản dịch quá ngắn so với raw (< 35% độ dài raw)
    if (cleanVi.length < rawText.length * 0.35) {
      const lastSentence = paragraphs[paragraphs.length - 1] || cleanVi;
      const viSnippet = lastSentence.length > 200 ? lastSentence.slice(-200) : lastSentence;
      const rawCutIndex = Math.floor(rawText.length * 0.35);
      const rawSnippet = rawText.slice(rawCutIndex, rawCutIndex + 200);

      issues.push({
        id: generateIssueId(),
        chapterId,
        chapterTitle: chapter.title,
        chapterNumber: chapter.chapterNumber,
        category: 'omission',
        severity: 'critical',
        vietnameseSnippet: viSnippet,
        rawSnippet: rawSnippet ? `${rawSnippet}...` : undefined,
        explanation: `Bản dịch bị thiếu hụt nội dung nghiêm trọng so với nguyên tác: Độ dài bản dịch chỉ có ${wordCount} từ (~${cleanVi.length} ký tự) so với ${rawText.length} ký tự Hán của bản gốc (tỷ lệ chỉ đạt ${ratio.toFixed(1)}%). Có dấu hiệu bị cắt cụt giữa chừng do lỗi AI hoặc gián đoạn mạng.`,
        suggestedFix: 'Dịch lại toàn bộ chương từ bản gốc hoặc dịch bổ sung các phần raw bị bỏ sót.',
        decision: 'pending',
        detectedBy: 'heuristic',
        createdAt: new Date().toISOString(),
      });
    }
    // Trường hợp 4B: Bản gốc nhiều đoạn (>= 3) nhưng bản dịch chỉ có 1 đoạn và độ dài dưới 50%
    else if (rawParagraphs.length >= 3 && viParagraphs <= 1 && cleanVi.length < rawText.length * 0.5) {
      const lastSentence = paragraphs[0] || cleanVi;
      const viSnippet = lastSentence.length > 200 ? lastSentence.slice(-200) : lastSentence;
      const rawSnippet = rawParagraphs[1] ? rawParagraphs[1].slice(0, 200) : rawText.slice(0, 200);

      issues.push({
        id: generateIssueId(),
        chapterId,
        chapterTitle: chapter.title,
        chapterNumber: chapter.chapterNumber,
        category: 'omission',
        severity: 'critical',
        vietnameseSnippet: viSnippet,
        rawSnippet: rawSnippet ? `${rawSnippet}...` : undefined,
        explanation: `Bản dịch có cấu trúc đoạn văn bất thường: Bản gốc có ${rawParagraphs.length} đoạn văn nhưng bản dịch chỉ có đúng 1 đoạn duy nhất và độ dài chưa tới 50% bản gốc (${wordCount} từ so với ${rawText.length} chữ Hán, tỷ lệ ${ratio.toFixed(1)}%).`,
        suggestedFix: 'Rà soát và dịch bổ sung các đoạn văn còn thiếu.',
        decision: 'pending',
        detectedBy: 'heuristic',
        createdAt: new Date().toISOString(),
      });
    }
  } else if (!rawText && (chapter.translationType === 'polished' || chapter.translationType === 'raw') && wordCount < 150) {
    // Trường hợp 4C: Không có raw tiếng Trung nhưng chương đã dịch có độ dài bất thường quá ngắn (< 150 từ)
    const viSnippet = paragraphs[paragraphs.length - 1] || cleanVi;
    issues.push({
      id: generateIssueId(),
      chapterId,
      chapterTitle: chapter.title,
      chapterNumber: chapter.chapterNumber,
      category: 'omission',
      severity: 'major',
      vietnameseSnippet: viSnippet.length > 200 ? viSnippet.slice(-200) : viSnippet,
      explanation: `Nghi vấn thiếu hụt nội dung: Chương này đã có bản dịch (${chapter.translationType === 'polished' ? 'đã biên tập' : 'đã dịch thô'}) nhưng chỉ có ${wordCount} từ, quá ngắn so với độ dài thông thường của một chương tiểu thuyết (thường từ 800 - 3.000 từ). Có thể bản dịch đã bị kết thúc sớm hoặc lỗi cắt cụt.`,
      suggestedFix: 'Kiểm tra lại xem bản dịch đã hoàn chỉnh toàn bộ chương chưa, hoặc nạp raw tiếng Trung để đối chiếu chính xác.',
      decision: 'pending',
      detectedBy: 'heuristic',
      createdAt: new Date().toISOString(),
    });
  }

  return issues;
}

export interface AiQualityScanInput {
  apiKeys: string[];
  model?: string;
  projectTitle: string;
  chapters: Array<{
    chapterId?: string;
    url?: string;
    title: string;
    chapterNumber: number;
    vietnameseContent: string;
    rawChineseContent?: string;
  }>;
  onProgress?: (chapterIndex: number, total: number, message: string) => void;
  signal?: AbortSignal;
}

/**
 * 2. AI SEMANTIC SCAN: Phân tích chất lượng văn phong, nhất quán tên riêng, giới tính và đối chiếu raw
 */
export async function runAiQualityScan(input: AiQualityScanInput): Promise<QualityIssue[]> {
  const { apiKeys, model, projectTitle, chapters, onProgress, signal } = input;
  const allAiIssues: QualityIssue[] = [];

  const rawKeys = Array.isArray(apiKeys) ? apiKeys.filter((k) => k && k.trim()) : [];
  if (rawKeys.length === 0) {
    throw new Error('Chưa cấu hình API Key cá nhân. Vui lòng thêm API Key trong phần "Cấu hình AI".');
  }

  const totalChapters = chapters.length;

  for (let idx = 0; idx < chapters.length; idx++) {
    const chapter = chapters[idx];
    const chapterId = chapter.chapterId || chapter.url || '';
    const hasRaw = !!chapter.rawChineseContent && chapter.rawChineseContent.trim().length > 0;

    if (onProgress) {
      onProgress(
        idx + 1,
        totalChapters,
        `Đang kiểm định AI chương ${idx + 1}/${totalChapters}: "${chapter.title}"${hasRaw ? ' (kèm đối chiếu Raw)' : ''}...`
      );
    }

    // Giới hạn độ dài văn bản an toàn để không tràn token context (25,000 ký tự)
    const maxChars = 25000;
    const truncatedVi = chapter.vietnameseContent.length > maxChars
      ? `${chapter.vietnameseContent.substring(0, maxChars)}\n[...Văn bản dài đã được rút gọn cho lượt phân tích này...]`
      : chapter.vietnameseContent;

    const truncatedRaw = hasRaw && chapter.rawChineseContent!.length > maxChars
      ? `${chapter.rawChineseContent!.substring(0, maxChars)}\n[...Raw dài đã được rút gọn...]`
      : chapter.rawChineseContent || '';

    const sanitizedVi = sanitizePromptInput(truncatedVi);
    const sanitizedRaw = hasRaw ? sanitizePromptInput(truncatedRaw) : '';

    const systemInstruction =
      LITERARY_TRANSLATION_FRAMING +
      `Bạn là chuyên gia kiểm định chất lượng bản dịch văn học Trung - Việt hàng đầu.\n` +
      `Nhiệm vụ của bạn là rà soát chương truyện "${chapter.title}" thuộc bộ truyện "${projectTitle}" và chỉ ra các lỗi chất lượng thực sự nghiêm trọng hoặc gây khó chịu cho độc giả.\n\n` +
      `Các danh mục lỗi cần phát hiện:\n` +
      `1. "inconsistent_name": Tên nhân vật, địa danh, môn phái bị đổi cách dịch hoặc mâu thuẫn giữa các đoạn.\n` +
      `2. "pronoun_gender": Đại từ xưng hô, nhân xưng hoặc giới tính nhân vật bị mâu thuẫn bất thường (ví dụ: nhân vật nữ nhưng xưng "hắn", "anh" biến thành "cô").\n` +
      `3. "terminology_drift": Thuật ngữ tu luyện, chiêu thức hoặc danh từ chuyên môn bị dịch không nhất quán.\n` +
      `4. "repetition": Đoạn văn lặp ý nghiêm trọng hoặc đăng nhầm văn bản.\n` +
      (hasRaw
        ? `5. "mistranslation": Dịch sai lệch nghĩa gốc tiếng Trung một cách nghiêm trọng.\n` +
          `6. "omission": Bỏ sót câu, đoạn hoặc bản dịch bị cắt cụt/kết thúc dở dang so với raw tiếng Trung. ĐẶC BIỆT: Nếu raw tiếng Trung còn nhiều nội dung mà bản dịch đã kết thúc, BẮT BUỘC phải tạo lỗi "omission" mức "critical" và trích dẫn phần raw bị bỏ sót trong "rawSnippet".\n` +
          `7. "hallucination": Bịa thêm nội dung dài không hề có trong raw tiếng Trung.\n`
        : '') +
      `8. "other": Lỗi hành văn lủng củng nghiêm trọng hoặc dùng sai từ ngữ Hán-Việt.\n\n` +
      `Quy định đánh giá:\n` +
      `- severity: "critical" (lỗi rất nặng gây hiểu sai cốt truyện hoặc thiếu hụt nội dung lớn), "major" (lỗi lớn làm giảm trải nghiệm đọc), "minor" (lỗi nhỏ), "warning" (nghi vấn cần xem xét).\n` +
      `- Chỉ đưa ra những lỗi có bằng chứng xác đáng, trích dẫn chính xác đoạn văn chứa lỗi trong "vietnameseSnippet" (và "rawSnippet" nếu có đối chiếu raw). Với lỗi omission do thiếu đoạn, trích dẫn câu cuối của bản dịch làm mốc.\n` +
      `- Không bịa đặt lỗi nếu văn bản trôi chảy và chuẩn xác.`;

    const schema = {
      type: 'object',
      properties: {
        issues: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              category: {
                type: 'string',
                enum: [
                  'inconsistent_name',
                  'pronoun_gender',
                  'terminology_drift',
                  'repetition',
                  'wrong_chapter',
                  'mistranslation',
                  'omission',
                  'hallucination',
                  'other',
                ],
              },
              severity: {
                type: 'string',
                enum: ['critical', 'major', 'minor', 'warning'],
              },
              vietnameseSnippet: { type: 'string' },
              rawSnippet: { type: 'string' },
              explanation: { type: 'string' },
              suggestedFix: { type: 'string' },
            },
            required: ['category', 'severity', 'explanation'],
          },
        },
      },
      required: ['issues'],
    };

    let userPrompt = `TÊN TRUYỆN: ${projectTitle}\nTIÊU ĐỀ CHƯƠNG: ${chapter.title}\n\n`;
    if (hasRaw) {
      userPrompt += `--- VĂN BẢN RAW TIẾNG TRUNG GỐC ---\n${sanitizedRaw}\n\n`;
    }
    userPrompt += `--- BẢN DỊCH TIẾNG VIỆT CẦN KIỂM ĐỊNH ---\n${sanitizedVi}\n\nHãy phân tích và trả về danh sách các lỗi chất lượng phát hiện được.`;

    try {
      const res = await callGeminiDirect({
        apiKeys: rawKeys,
        model,
        prompt: userPrompt,
        systemInstruction,
        schema,
        temperature: 0.1,
        signal,
      });

      const parsed = JSON.parse(res.text);
      const rawIssues = Array.isArray(parsed?.issues) ? parsed.issues : [];

      for (const item of rawIssues) {
        if (!item.explanation) continue;
        const hasViSnippet = typeof item.vietnameseSnippet === 'string' && item.vietnameseSnippet.trim().length > 0;
        if (!hasViSnippet && item.category !== 'omission') continue;

        const viSnippet = hasViSnippet
          ? String(item.vietnameseSnippet).trim()
          : (chapter.vietnameseContent.trim().slice(-150) || 'Đoạn kết thúc bản dịch');

        allAiIssues.push({
          id: generateIssueId(),
          chapterId,
          chapterTitle: chapter.title,
          chapterNumber: chapter.chapterNumber,
          category: (item.category as QualityIssueCategory) || 'other',
          severity: (item.severity as QualityIssueSeverity) || 'major',
          vietnameseSnippet: viSnippet,
          rawSnippet: item.rawSnippet ? String(item.rawSnippet).trim() : undefined,
          explanation: String(item.explanation).trim(),
          suggestedFix: item.suggestedFix ? String(item.suggestedFix).trim() : undefined,
          decision: 'pending',
          detectedBy: 'ai',
          createdAt: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
      console.warn(`[hakoQualityEngine] AI scan failed for chapter "${chapter.title}":`, err);

      if (err?.code === 'ALL_KEYS_EXHAUSTED') {
        allAiIssues.push({
          id: generateIssueId(),
          chapterId,
          chapterTitle: chapter.title,
          chapterNumber: chapter.chapterNumber,
          category: 'other',
          severity: 'warning',
          vietnameseSnippet: chapter.title,
          explanation: `Toàn bộ API Key đã hết hạn mức (429 RESOURCE_EXHAUSTED). Dừng phân tích AI cho các chương còn lại.`,
          decision: 'pending',
          detectedBy: 'ai',
          createdAt: new Date().toISOString(),
        });
        break;
      }

      allAiIssues.push({
        id: generateIssueId(),
        chapterId,
        chapterTitle: chapter.title,
        chapterNumber: chapter.chapterNumber,
        category: 'other',
        severity: 'warning',
        vietnameseSnippet: chapter.title,
        explanation: `Không thể hoàn tất phân tích AI cho chương này: ${err.message || 'Lỗi gọi AI'}.`,
        decision: 'pending',
        detectedBy: 'ai',
        createdAt: new Date().toISOString(),
      });
    }
  }

  return allAiIssues;
}

/**
 * 3. REPORT GENERATOR: Tính toán số liệu thống kê và định dạng Markdown báo cáo
 */
export function generateQualityReport(session: QualityReviewSession): QualityReport {
  const confirmedIssues = session.issues.filter((i) => i.decision === 'confirmed');
  const reviewNeededIssues = session.issues.filter((i) => i.decision === 'review_needed');
  const dismissedIssues = session.issues.filter((i) => i.decision === 'dismissed');
  const pendingIssues = session.issues.filter((i) => i.decision === 'pending');
  const resolvedIssues = session.issues.filter((i) => i.decision === 'resolved');

  const bySeverity: Record<QualityIssueSeverity, number> = {
    critical: 0,
    major: 0,
    minor: 0,
    warning: 0,
  };

  const byCategory: Record<QualityIssueCategory, number> = {
    inconsistent_name: 0,
    pronoun_gender: 0,
    terminology_drift: 0,
    raw_leak: 0,
    repetition: 0,
    wrong_chapter: 0,
    mistranslation: 0,
    omission: 0,
    hallucination: 0,
    other: 0,
  };

  confirmedIssues.forEach((issue) => {
    if (bySeverity[issue.severity] !== undefined) bySeverity[issue.severity]++;
    if (byCategory[issue.category] !== undefined) byCategory[issue.category]++;
  });

  const stats: QualityReportStats = {
    totalIssues: session.issues.length,
    confirmedCount: confirmedIssues.length,
    reviewNeededCount: reviewNeededIssues.length,
    dismissedCount: dismissedIssues.length,
    pendingCount: pendingIssues.length,
    resolvedCount: resolvedIssues.length,
    bySeverity,
    byCategory,
  };

  const projectTitle = session.projectTitle || 'Dự án dịch';
  const totalChapters = session.selectedChapterIds ? session.selectedChapterIds.length : 0;
  const dateStr = new Date().toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  let md = `# BÁO CÁO KIỂM ĐỊNH CHẤT LƯỢNG BẢN DỊCH\n\n`;
  md += `- **Dự án**: ${projectTitle}\n`;
  md += `- **Thời gian kiểm định**: ${dateStr}\n`;
  md += `- **Số chương rà soát**: ${totalChapters} chương\n`;
  md += `- **Tổng số lỗi đã xác nhận**: ${confirmedIssues.length} lỗi (Nghiêm trọng: ${bySeverity.critical}, Lớn: ${bySeverity.major}, Nhẹ: ${bySeverity.minor}, Cảnh báo: ${bySeverity.warning})\n`;
  if (resolvedIssues.length > 0) {
    md += `- **Số lỗi đã khắc phục thành công**: ${resolvedIssues.length} lỗi\n`;
  }
  md += `\n`;

  if (confirmedIssues.length === 0) {
    md += `> ✅ **Kết quả**: Không có lỗi nào được xác nhận trong đợt kiểm định này. Bản dịch đạt chuẩn chất lượng xuất bản.\n\n`;
  } else {
    // Nhóm lỗi theo từng chương và sort theo chapterNumber tăng dần
    interface ChapterGroup {
      chapterNumber: number;
      chapterTitle: string;
      issues: QualityIssue[];
    }
    const chapterMap = new Map<string, ChapterGroup>();
    confirmedIssues.forEach((issue) => {
      const key = `${issue.chapterNumber ?? 1}__${issue.chapterTitle}`;
      const group = chapterMap.get(key) || {
        chapterNumber: issue.chapterNumber ?? 1,
        chapterTitle: issue.chapterTitle,
        issues: [],
      };
      group.issues.push(issue);
      chapterMap.set(key, group);
    });

    const sortedGroups = Array.from(chapterMap.values()).sort(
      (a, b) => a.chapterNumber - b.chapterNumber
    );

    md += `## DANH SÁCH LỖI ĐÃ XÁC NHẬN THEO CHƯƠNG\n\n`;

    sortedGroups.forEach((group) => {
      md += `### Chương #${group.chapterNumber} — ${group.chapterTitle}\n\n`;

      group.issues.forEach((issue, idx) => {
        const severityLabel =
          issue.severity === 'critical' ? '[NGHIÊM TRỌNG]' :
          issue.severity === 'major' ? '[LỚN]' :
          issue.severity === 'minor' ? '[NHẸ]' : '[CẢNH BÁO]';

        const categoryLabel =
          issue.category === 'inconsistent_name' ? 'Tên riêng không nhất quán' :
          issue.category === 'pronoun_gender' ? 'Xưng hô / Giới tính mâu thuẫn' :
          issue.category === 'terminology_drift' ? 'Thuật ngữ không đồng bộ' :
          issue.category === 'raw_leak' ? 'Sót Hán tự / Raw chưa dịch' :
          issue.category === 'repetition' ? 'Trùng lặp đoạn văn' :
          issue.category === 'mistranslation' ? 'Dịch sai nghĩa gốc' :
          issue.category === 'omission' ? 'Bỏ sót câu/đoạn' :
          issue.category === 'hallucination' ? 'Dịch thừa / Bịa nghĩa' : 'Lỗi biên tập khác';

        md += `${idx + 1}. **${severityLabel} ${categoryLabel}**\n`;
        md += `   - **Trích đoạn bản dịch**: "${issue.vietnameseSnippet}"\n`;
        if (issue.rawSnippet) {
          md += `   - **Trích đoạn raw đối ứng**: "${issue.rawSnippet}"\n`;
        }
        md += `   - **Giải thích**: ${issue.explanation}\n`;
        if (issue.suggestedFix) {
          md += `   - **Gợi ý sửa**: ${issue.suggestedFix}\n`;
        }
        if (issue.moderatorNote) {
          md += `   - **Ghi chú Moderator**: ${issue.moderatorNote}\n`;
        }
        md += `\n`;
      });
    });
  }

  if (reviewNeededIssues.length > 0) {
    const sortedReviewIssues = [...reviewNeededIssues].sort(
      (a, b) => (a.chapterNumber ?? 1) - (b.chapterNumber ?? 1)
    );
    md += `## CÁC ĐIỂM CẦN HỘI Ý THÊM VỚI DỊCH GIẢ (${sortedReviewIssues.length})\n\n`;
    sortedReviewIssues.forEach((issue, idx) => {
      md += `${idx + 1}. **[Chương #${issue.chapterNumber ?? 1} · ${issue.chapterTitle}]**: "${issue.vietnameseSnippet}"\n`;
      md += `   - ${issue.explanation}\n`;
      if (issue.moderatorNote) {
        md += `   - **Ghi chú**: ${issue.moderatorNote}\n`;
      }
      md += `\n`;
    });
  }

  return {
    sessionId: session.id,
    projectTitle,
    projectId: session.projectId || '',
    generatedAt: new Date().toISOString(),
    totalChaptersReviewed: totalChapters,
    stats,
    confirmedIssues,
    formattedMarkdown: md,
  };
}
