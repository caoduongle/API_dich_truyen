/**
 * Module chuẩn hóa định dạng văn bản xuất bản chương truyện (Web, Audio, Align)
 */

export type ExportMode = 'web' | 'audio' | 'align_jsonl';

export interface FormattedChapterInput {
  index: number;
  chapterTitle: string;
  sourceText?: string;
  translatedText: string;
}

export interface WebExportResult {
  formattedTitle: string;
  cleanBody: string;
  fullOutput: string;
}

const TITLE_REGEX = /^(?:Chương|Chapter|Quyển|Tập|Hồi|Thứ)\s+(?:\d+|[IVXLCDM]+|một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười|trăm|ngàn|vạn|nhất|nhị|tam|tứ|ngũ|lục|thất|bát|cửu|thập)/i;
const CHINESE_TITLE_REGEX = /^第\s*[\d零一二三四五六七八九十百千万]+\s*[章节回卷]/;
const PART_INDICATOR_REGEX_G = /[\(\[（【]\s*(?:\d+\s*[\/|／]\s*\d+|phần\s*\d+|đoạn\s*\d+)\s*[\)\]）】]/gi;
const STAR_OR_HASH_PREFIX_REGEX = /^[\s*#\-—_=:]+/;
const DIVIDER_LINE_REGEX = /^(?:[\*\-_=~#]{3,}|(?:\*\s*){3,})$/;

/**
 * Chuẩn hóa tiêu đề chương thành chuỗi sạch không chứa tiền tố sao, số phần thừa
 */
export function normalizeChapterTitle(title: string, defaultIndex: number): string {
  let clean = title.replace(STAR_OR_HASH_PREFIX_REGEX, '').trim();
  clean = clean.replace(PART_INDICATOR_REGEX_G, '').trim();

  // Kiểm tra nếu là tiêu đề tiếng Trung dạng 第X章 -> Chương X
  const chineseMatch = clean.match(/^第\s*([\d零一二三四五六七八九十百千万]+)\s*[章节回卷]\s*(.*)$/);
  if (chineseMatch) {
    const num = chineseMatch[1];
    const subTitle = chineseMatch[2]?.trim();
    return subTitle ? `Chương ${num}: ${subTitle}` : `Chương ${num}`;
  }

  // Nếu tiêu đề bắt đầu bằng từ khóa tiêu đề tiếng Việt chuẩn
  if (TITLE_REGEX.test(clean)) {
    return clean;
  }

  // Nếu tiêu đề chỉ là số hoặc tên tùy chỉnh không có chữ "Chương"
  if (/^\d+/.test(clean)) {
    return `Chương ${clean}`;
  }

  if (clean.length > 0) {
    return `Chương ${defaultIndex}: ${clean}`;
  }

  return `Chương ${defaultIndex}`;
}

/**
 * Định dạng một chương truyện cho chế độ xuất bản Web
 * Chuẩn đầu ra:
 * *** [Tên chương]
 * [Nội dung dòng 1]
 * [Nội dung dòng 2]
 */
export function formatChapterForWeb(input: FormattedChapterInput): WebExportResult {
  const rawContent = (input.translatedText || '').trim();
  const rawLines = rawContent.split('\n');

  let detectedTitle = '';
  const cleanLines: string[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) {
      if (cleanLines.length > 0 && cleanLines[cleanLines.length - 1] !== '') {
        cleanLines.push('');
      }
      continue;
    }

    // Bỏ qua các dòng phân cách rác như *** hoặc ---
    if (DIVIDER_LINE_REGEX.test(line)) {
      continue;
    }

    const isTitlePattern = TITLE_REGEX.test(line) || CHINESE_TITLE_REGEX.test(line);

    // Kiểm tra dòng đầu tiên (trong 3 dòng đầu) có phải là tiêu đề bị lặp lại trong nội dung không
    if (i < 3 && isTitlePattern && !detectedTitle) {
      detectedTitle = line;
      continue; // Bỏ qua không đưa vào cleanLines để tránh lặp tiêu đề
    }

    cleanLines.push(rawLines[i].trimEnd());
  }

  // Xác định tiêu đề cuối cùng
  const finalTitle = detectedTitle
    ? normalizeChapterTitle(detectedTitle, input.index)
    : normalizeChapterTitle(input.chapterTitle, input.index);

  // Chuẩn hóa phần thân nội dung
  let cleanBody = cleanLines.join('\n').trim();
  // Xóa các cụm dấu sao thừa phân cách trong thân
  cleanBody = cleanBody.replace(/(?:\*\s*){3,}/g, '').trim();

  const fullOutput = `*** ${finalTitle}\n${cleanBody}`;

  return {
    formattedTitle: finalTitle,
    cleanBody,
    fullOutput,
  };
}

/**
 * Định dạng một chương truyện cho chế độ xuất Audio (không cần tiền tố ***)
 */
export function formatChapterForAudio(input: FormattedChapterInput): string {
  const webResult = formatChapterForWeb(input);
  return `${webResult.formattedTitle}\n\n${webResult.cleanBody}`.trim();
}

/**
 * Ghép nối danh sách các chương thành nội dung của một tệp xuất bản hoàn chỉnh
 */
export function buildExportFileContent(chapters: FormattedChapterInput[], mode: ExportMode): string {
  if (chapters.length === 0) return '';

  if (mode === 'web') {
    return chapters
      .map((c) => formatChapterForWeb(c).fullOutput)
      .join('\n\n');
  }

  if (mode === 'audio') {
    return chapters
      .map((c) => formatChapterForAudio(c))
      .join('\n\n');
  }

  return chapters
    .map((c) => (c.translatedText || '').trim())
    .join('\n\n');
}
