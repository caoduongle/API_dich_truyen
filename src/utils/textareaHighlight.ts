/**
 * Tiện ích định vị, cuộn và bôi chọn (native selection) đoạn trích trong phần tử HTMLTextAreaElement.
 */

export interface TextareaMatchLocation {
  start: number;
  end: number;
}

/**
 * Tìm vị trí bắt đầu và kết thúc của snippet trong văn bản với cơ chế chuẩn hóa thông minh:
 * 1. Exact match
 * 2. Lược bỏ dấu ngoặc kép ("...", “...”, '...'), dấu ngoặc «...», và dấu ba chấm (...)
 * 3. Chuẩn hóa khoảng trắng liên tiếp và so khớp đoạn đầu
 */
export function findSnippetLocationInText(
  fullText: string,
  targetText: string | null | undefined
): TextareaMatchLocation | null {
  if (!fullText || !targetText || targetText.trim() === '') {
    return null;
  }

  // 1. So khớp chính xác 100%
  const exactIndex = fullText.indexOf(targetText);
  if (exactIndex !== -1) {
    return { start: exactIndex, end: exactIndex + targetText.length };
  }

  // 2. Lược bỏ dấu ngoặc kép và dấu chấm lửng bao quanh nhiều lớp
  let trimmedSnippet = targetText.trim();
  let prev = '';
  while (trimmedSnippet !== prev) {
    prev = trimmedSnippet;
    trimmedSnippet = trimmedSnippet
      .replace(/^["'“”„«\s]+/, '')
      .replace(/["'“”»\s]+$/, '')
      .replace(/\.{2,}$|…+$/, '')
      .trim();
  }

  if (trimmedSnippet.length >= 3) {
    const trimmedIndex = fullText.indexOf(trimmedSnippet);
    if (trimmedIndex !== -1) {
      return { start: trimmedIndex, end: trimmedIndex + trimmedSnippet.length };
    }
  }

  // 3. Chuẩn hóa khoảng trắng / so khớp đoạn đầu nếu snippet dài
  if (trimmedSnippet.length >= 10) {
    const headChunk = trimmedSnippet.slice(0, 35).trim();
    if (headChunk.length >= 6) {
      const headIndex = fullText.indexOf(headChunk);
      if (headIndex !== -1) {
        const approxLength = Math.min(trimmedSnippet.length, fullText.length - headIndex);
        return { start: headIndex, end: headIndex + approxLength };
      }
    }
  }

  return null;
}

/**
 * Định vị đoạn văn bản trong textarea, cuộn mượt và bôi chọn đoạn khớp.
 *
 * @param textareaEl - Tham chiếu tới phần tử HTMLTextAreaElement cần thao tác.
 * @param targetText - Đoạn trích văn bản cần tìm kiếm và bôi chọn.
 * @returns boolean - `true` nếu tìm thấy và bôi chọn thành công; `false` nếu không tìm thấy hoặc input không hợp lệ.
 */
export function scrollAndSelectInTextarea(
  textareaEl: HTMLTextAreaElement | null | undefined,
  targetText: string | null | undefined
): boolean {
  if (!textareaEl || !targetText || targetText.trim() === '') {
    return false;
  }

  const match = findSnippetLocationInText(textareaEl.value, targetText);
  if (!match) {
    return false;
  }

  const { start, end } = match;

  // 1. Focus và bôi chọn đoạn văn bản khớp
  try {
    textareaEl.focus();
    textareaEl.setSelectionRange(start, end);
  } catch {
    // Tránh ngoại lệ nếu textarea bị ẩn hoặc không thể focus trong môi trường DOM đặc biệt
  }

  // 2. Tính toán vị trí cuộn: đếm số dòng trước vị trí start
  const textBefore = textareaEl.value.slice(0, start);
  const lineCount = textBefore.split('\n').length - 1;

  // 3. Đọc line-height thực tế từ computed style, fallback an toàn nếu không đọc được
  let lineHeight = 21; // Giá trị fallback hợp lý mặc định
  if (typeof window !== 'undefined' && window.getComputedStyle) {
    try {
      const computed = window.getComputedStyle(textareaEl);
      const parsedLineHeight = parseFloat(computed.lineHeight);
      if (!isNaN(parsedLineHeight) && parsedLineHeight > 0) {
        lineHeight = parsedLineHeight;
      } else {
        const parsedFontSize = parseFloat(computed.fontSize);
        if (!isNaN(parsedFontSize) && parsedFontSize > 0) {
          lineHeight = parsedFontSize * 1.5;
        }
      }
    } catch {
      // Giữ nguyên lineHeight mặc định nếu getComputedStyle gặp lỗi
    }
  }

  // 4. Thiết lập vị trí cuộn có khoảng đệm 2 dòng để đoạn chọn không dính sát mép trên
  const bufferLines = 2;
  const targetScrollTop = Math.max(0, (lineCount - bufferLines) * lineHeight);
  textareaEl.scrollTop = targetScrollTop;

  return true;
}
