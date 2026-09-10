/**
 * Tiện ích định vị, cuộn và bôi chọn (native selection) đoạn trích trong phần tử HTMLTextAreaElement.
 */

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

  const start = textareaEl.value.indexOf(targetText);
  if (start === -1) {
    return false;
  }

  const end = start + targetText.length;

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
