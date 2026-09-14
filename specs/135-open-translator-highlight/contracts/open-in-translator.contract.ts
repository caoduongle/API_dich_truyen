/**
 * Contract: Giao diện điều hướng sâu và định vị đoạn lỗi trong Bàn Dịch
 * Feature: 135-open-translator-highlight
 */

export interface HighlightIntent {
  /** ID của chương mục tiêu cần mở */
  chapterId: string;
  /** Đoạn trích văn bản tiếng Việt làm bằng chứng vi phạm cần bôi đen */
  snippet: string;
  /** ID của issue để đồng bộ trên UnifiedAuditPanel (nếu có) */
  issueId?: string;
  /** Dấu thời gian tạo yêu cầu (ms) */
  timestamp: number;
}

export interface OpenInTranslatorOptions {
  /** Đoạn trích văn bản cần định vị */
  snippet?: string;
  /** Định danh lỗi */
  issueId?: string;
}

export interface TextareaMatchLocation {
  start: number;
  end: number;
}

export interface TextareaHighlightHandlers {
  /**
   * Tìm kiếm tọa độ bắt đầu và kết thúc của snippet trong fullText.
   * Hỗ trợ exact match, trimmed quotes, normalized whitespace.
   */
  findSnippetLocationInText(
    fullText: string,
    targetText: string | null | undefined
  ): TextareaMatchLocation | null;

  /**
   * Định vị, cuộn mượt và bôi đen vùng chọn trong phần tử textarea.
   * Trả về true nếu bôi chọn thành công, false nếu thất bại.
   */
  scrollAndSelectInTextarea(
    textareaEl: HTMLTextAreaElement | null | undefined,
    targetText: string | null | undefined
  ): boolean;
}
