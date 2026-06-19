import * as OpenCC from 'opencc-js';

// Khởi tạo bộ chuyển đổi từ chữ Phồn thể sang Giản thể.
// Chú ý: Ta dùng 't' (Traditional) -> 'cn' (Simplified) làm cấu hình chuẩn.
// Converter được tạo một lần duy nhất ở cấp module để tối ưu hiệu năng.
const t2sConverter = OpenCC.Converter({ from: 't', to: 'cn' });

/**
 * Chuẩn hóa chữ Hán: Chuyển đổi toàn bộ ký tự Hán Phồn thể về dạng Giản thể.
 * 
 * LƯU Ý QUAN TRỌNG:
 * - Hàm này CHỈ dùng để SO SÁNH (matching, validation, deduplication).
 * - TUYỆT ĐỐI KHÔNG dùng kết quả của hàm này để thay thế (substitute) văn bản gốc,
 *   không dùng để lưu vào DB hay hiển thị kết quả dịch cuối cùng cho người dùng.
 * 
 * @param text Văn bản chữ Hán cần chuẩn hóa
 * @returns Văn bản đã được chuyển thành Giản thể
 */
export function canonicalizeHan(text: string): string {
  if (!text) return "";
  return t2sConverter(text);
}

/**
 * So sánh tương đương giữa hai chuỗi chữ Hán.
 * Tự động cắt khoảng trắng ở hai đầu chuỗi và so sánh sau khi chuẩn hóa về Giản thể.
 * 
 * LƯU Ý QUAN TRỌNG:
 * - Hàm này CHỈ dùng để so sánh khớp/trùng lặp (matching, validation, deduplication).
 * - TUYỆT ĐỐI KHÔNG dùng kết quả của hàm này để thay thế text trong bản dịch.
 * 
 * @param a Chuỗi thứ nhất
 * @param b Chuỗi thứ hai
 * @returns true nếu hai chuỗi tương đương nhau sau khi đưa về Giản thể
 */
export function isHanEquivalent(a: string, b: string): boolean {
  return canonicalizeHan(a.trim()) === canonicalizeHan(b.trim());
}
