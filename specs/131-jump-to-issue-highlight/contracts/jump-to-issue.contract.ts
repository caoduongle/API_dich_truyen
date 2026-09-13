/**
 * Contract: Định Vị & Làm Nổi Bật Đoạn Lỗi Khi Mở Bàn Dịch
 * Feature: 131-jump-to-issue-highlight
 */

export interface OpenInTranslatorOptions {
  /** Đoạn trích bản dịch lỗi cần tìm và bôi chọn */
  snippet?: string;
  /** Mã định danh lỗi (tùy chọn) */
  issueId?: string;
  /** Ưu tiên giai đoạn dịch */
  stage?: 'raw' | 'polished';
}

export type OpenInTranslatorHandler = (
  chapterId: string,
  options?: OpenInTranslatorOptions
) => void;

export interface EnhancedScrollAndSelectResult {
  success: boolean;
  startIndex?: number;
  endIndex?: number;
  matchMethod?: 'exact' | 'quote_trimmed' | 'whitespace_normalized';
}

/**
 * Hợp đồng hàm tìm vị trí và bôi chọn mở rộng trong textarea
 */
export type ScrollAndSelectFn = (
  textareaEl: HTMLTextAreaElement | null | undefined,
  targetText: string | null | undefined,
  options?: {
    bufferLines?: number;
    focus?: boolean;
  }
) => EnhancedScrollAndSelectResult;
