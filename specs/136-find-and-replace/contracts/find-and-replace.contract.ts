/**
 * Hợp đồng giao diện (Interface Contracts) cho tính năng Tìm và Thay Thế Văn Bản
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
  /** Tên phân vùng dịch đang áp dụng (ví dụ "Bản chuốt mịn" hoặc "Bản dịch thô") */
  stageLabel?: string;
}

/**
 * Thuật toán thuần túy tìm kiếm danh sách các vị trí xuất hiện của từ khóa
 */
export type FindMatchesFunction = (
  fullText: string,
  searchTerm: string,
  matchCase?: boolean
) => MatchLocation[];

/**
 * Thuật toán thay thế một vị trí duy nhất trong văn bản
 */
export type ReplaceSingleFunction = (
  fullText: string,
  match: MatchLocation,
  replaceTerm: string
) => string;

/**
 * Thuật toán thay thế toàn bộ các vị trí trùng khớp trong một lần xử lý
 */
export type ReplaceAllFunction = (
  fullText: string,
  searchTerm: string,
  replaceTerm: string,
  matchCase?: boolean
) => ReplaceAllResult;
