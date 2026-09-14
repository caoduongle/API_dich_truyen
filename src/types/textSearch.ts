/**
 * Type definitions for Find and Replace functionality
 * Feature: 136-find-and-replace
 */

export interface MatchLocation {
  /** Chỉ số ký tự bắt đầu trong chuỗi văn bản (0-indexed) */
  start: number;
  /** Chỉ số ký tự kết thúc trong chuỗi văn bản (exclusive) */
  end: number;
}

export interface ReplaceAllResult {
  /** Chuỗi văn bản sau khi đã thay thế toàn bộ */
  newText: string;
  /** Số lượng vị trí đã được thay thế */
  count: number;
}

export interface FindReplaceModalProps {
  /** Trạng thái hiển thị của hộp thoại */
  isOpen: boolean;
  /** Callback đóng hộp thoại */
  onClose: () => void;
  /** Nội dung văn bản hiện tại của phân vùng đang soạn thảo */
  targetText: string;
  /** Callback cập nhật văn bản mới vào state phân vùng dịch */
  onTextChange: (newText: string) => void;
  /** Tham chiếu đến textarea đang hoạt động để bôi đen và cuộn */
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  /** Từ khóa khởi tạo nếu người dùng đã bôi đen sẵn một đoạn văn */
  initialSearchTerm?: string;
  /** Tên phân vùng dịch đang áp dụng (ví dụ "Biên tập (2)" hoặc "Dịch thô (1)") */
  stageLabel?: string;
}
