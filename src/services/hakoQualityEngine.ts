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
} from '../types/hakoChecker';
import { callGeminiDirect } from './directGeminiClient';
import { LITERARY_TRANSLATION_FRAMING, sanitizePromptInput } from '@shared/text';

/**
 * Tạo UUID ngẫu nhiên cho lỗi phát hiện
 */
export function generateIssueId(): string {
  return `issue-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * 1. HEURISTIC SCAN: Quét quy tắc nhanh trên văn bản tiếng Việt
 */
export function runHeuristicQualityScan(chapter: {
  chapterId?: string;
  url?: string;
  title: string;
  vietnameseContent: string;
}): QualityIssue[] {
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
          `6. "omission": Bỏ sót câu, đoạn có ý nghĩa quan trọng trong raw tiếng Trung.\n` +
          `7. "hallucination": Bịa thêm nội dung dài không hề có trong raw tiếng Trung.\n`
        : '') +
      `8. "other": Lỗi hành văn lủng củng nghiêm trọng hoặc dùng sai từ ngữ Hán-Việt.\n\n` +
      `Quy định đánh giá:\n` +
      `- severity: "critical" (lỗi rất nặng gây hiểu sai cốt truyện), "major" (lỗi lớn làm giảm trải nghiệm đọc), "minor" (lỗi nhỏ), "warning" (nghi vấn cần xem xét).\n` +
      `- Chỉ đưa ra những lỗi có bằng chứng xác đáng, trích dẫn chính xác đoạn văn chứa lỗi trong "vietnameseSnippet" (và "rawSnippet" nếu có đối chiếu raw).\n` +
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
            required: ['category', 'severity', 'vietnameseSnippet', 'explanation'],
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
        if (!item.vietnameseSnippet || !item.explanation) continue;

        allAiIssues.push({
          id: generateIssueId(),
          chapterId,
          chapterTitle: chapter.title,
          category: (item.category as QualityIssueCategory) || 'other',
          severity: (item.severity as QualityIssueSeverity) || 'major',
          vietnameseSnippet: String(item.vietnameseSnippet).trim(),
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
      allAiIssues.push({
        id: generateIssueId(),
        chapterId,
        chapterTitle: chapter.title,
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
  md += `- **Tổng số lỗi đã xác nhận**: ${confirmedIssues.length} lỗi (Nghiêm trọng: ${bySeverity.critical}, Lớn: ${bySeverity.major}, Nhẹ: ${bySeverity.minor}, Cảnh báo: ${bySeverity.warning})\n\n`;

  if (confirmedIssues.length === 0) {
    md += `> ✅ **Kết quả**: Không có lỗi nào được xác nhận trong đợt kiểm định này. Bản dịch đạt chuẩn chất lượng xuất bản.\n\n`;
  } else {
    // Nhóm lỗi theo từng chương
    const chapterMap = new Map<string, QualityIssue[]>();
    confirmedIssues.forEach((issue) => {
      const list = chapterMap.get(issue.chapterTitle) || [];
      list.push(issue);
      chapterMap.set(issue.chapterTitle, list);
    });

    md += `## DANH SÁCH LỖI ĐÃ XÁC NHẬN THEO CHƯƠNG\n\n`;

    let chapterIndex = 1;
    chapterMap.forEach((issuesList, chapterTitle) => {
      md += `### ${chapterIndex++}. ${chapterTitle}\n\n`;

      issuesList.forEach((issue, idx) => {
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
    md += `## CÁC ĐIỂM CẦN HỘI Ý THÊM VỚI DỊCH GIẢ (${reviewNeededIssues.length})\n\n`;
    reviewNeededIssues.forEach((issue, idx) => {
      md += `${idx + 1}. **[${issue.chapterTitle}]**: "${issue.vietnameseSnippet}"\n`;
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
