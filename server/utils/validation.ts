import { MAX_API_KEYS_PER_REQUEST } from "../constants/models";

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Kiểm tra tính hợp lệ của Request Body cho endpoint đăng nhập POST /api/auth/login
 */
export function validateLoginBody(body: any): ValidationResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { valid: false, error: "Dữ liệu yêu cầu không hợp lệ." };
  }
  const { password } = body;
  if (!password || typeof password !== "string" || password.trim().length === 0) {
    return { valid: false, error: "Vui lòng cung cấp mật khẩu truy cập máy chủ." };
  }
  if (password.length > 256) {
    return { valid: false, error: "Mật khẩu vượt quá độ dài cho phép (tối đa 256 ký tự)." };
  }
  return { valid: true };
}

/**
 * Kiểm tra tính hợp lệ của Request Body cho endpoint tạo session POST /api/session-keys
 */
export function validateSessionKeysBody(body: any): ValidationResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { valid: false, error: "Dữ liệu yêu cầu không hợp lệ." };
  }
  const { keyHashes } = body;
  if (!Array.isArray(keyHashes)) {
    return { valid: false, error: "Trường 'keyHashes' phải là một mảng chuỗi hash." };
  }
  if (keyHashes.length === 0) {
    return { valid: false, error: "Danh sách mã băm API key không được để trống." };
  }
  if (keyHashes.length > MAX_API_KEYS_PER_REQUEST) {
    return { valid: false, error: `Quá nhiều mã băm API key trong một phiên (tối đa ${MAX_API_KEYS_PER_REQUEST}).` };
  }
  const hex64Regex = /^[0-9a-f]{64}$/;
  for (let i = 0; i < keyHashes.length; i++) {
    const hash = keyHashes[i];
    if (typeof hash !== "string" || !hex64Regex.test(hash.trim())) {
      return { valid: false, error: `Mã băm API key thứ ${i + 1} không hợp lệ (phải là chuỗi SHA-256 hex 64 ký tự).` };
    }
  }
  return { valid: true };
}

/**
 * Kiểm tra tính hợp lệ của Request Body cho POST /api/translate-raw
 */
export function validateTranslateRawBody(body: any): ValidationResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { valid: false, error: "Dữ liệu yêu cầu không hợp lệ." };
  }
  const { text, glossary, startKeyIndex } = body;
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return { valid: false, error: "Văn bản gốc không hợp lệ hoặc đang để trống." };
  }
  if (text.length > 1_000_000) {
    return { valid: false, error: "Văn bản gốc vượt quá giới hạn cho phép (tối đa 1,000,000 ký tự)." };
  }
  if (glossary !== undefined && !Array.isArray(glossary)) {
    return { valid: false, error: "Trường 'glossary' phải là một mảng nếu được cung cấp." };
  }
  if (startKeyIndex !== undefined && (typeof startKeyIndex !== "number" || startKeyIndex < 0 || !Number.isInteger(startKeyIndex))) {
    return { valid: false, error: "Trường 'startKeyIndex' phải là số nguyên không âm." };
  }
  return { valid: true };
}

/**
 * Kiểm tra tính hợp lệ của Request Body cho POST /api/polish-translation
 */
export function validatePolishBody(body: any): ValidationResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { valid: false, error: "Dữ liệu yêu cầu không hợp lệ." };
  }
  const { rawTranslation, glossary } = body;
  if (!rawTranslation || typeof rawTranslation !== "string" || rawTranslation.trim().length === 0) {
    return { valid: false, error: "Bản dịch thô không hợp lệ hoặc đang để trống." };
  }
  if (glossary !== undefined && !Array.isArray(glossary)) {
    return { valid: false, error: "Trường 'glossary' phải là một mảng nếu được cung cấp." };
  }
  return { valid: true };
}

/**
 * Kiểm tra tính hợp lệ của Request Body cho POST /api/qa-critique
 */
export function validateQABody(body: any): ValidationResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { valid: false, error: "Dữ liệu yêu cầu không hợp lệ." };
  }
  const { rawTranslation, polishedTranslation } = body;
  if (!rawTranslation || typeof rawTranslation !== "string" || rawTranslation.trim().length === 0) {
    return { valid: false, error: "Bản dịch thô không hợp lệ hoặc đang để trống." };
  }
  if (!polishedTranslation || typeof polishedTranslation !== "string" || polishedTranslation.trim().length === 0) {
    return { valid: false, error: "Bản chuốt không hợp lệ hoặc đang để trống." };
  }
  return { valid: true };
}

/**
 * Kiểm tra tính hợp lệ của Request Body cho POST /api/analyze-glossary và POST /api/extract-glossary
 */
export function validateGlossaryTextBody(body: any): ValidationResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { valid: false, error: "Dữ liệu yêu cầu không hợp lệ." };
  }
  const { text } = body;
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return { valid: false, error: "Văn bản phân tích thuật ngữ không hợp lệ hoặc đang để trống." };
  }
  return { valid: true };
}

/**
 * Kiểm tra tính hợp lệ của Request Body cho POST /api/quick-translate-term
 */
export function validateQuickTranslateTermBody(body: any): ValidationResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { valid: false, error: "Dữ liệu yêu cầu không hợp lệ." };
  }
  const { term } = body;
  if (!term || typeof term !== "string" || term.trim().length === 0) {
    return { valid: false, error: "Thuật ngữ cần dịch không hợp lệ hoặc đang để trống." };
  }
  if (term.length > 500) {
    return { valid: false, error: "Thuật ngữ vượt quá độ dài cho phép (tối đa 500 ký tự)." };
  }
  return { valid: true };
}

/**
 * Kiểm tra tính hợp lệ của Request Body cho POST /api/analyze-guidelines
 */
export function validateGuidelinesBody(body: any): ValidationResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { valid: false, error: "Dữ liệu yêu cầu không hợp lệ." };
  }
  const { content } = body;
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return { valid: false, error: "Nội dung cẩm nang không hợp lệ hoặc đang để trống." };
  }
  return { valid: true };
}

/**
 * Kiểm tra tính hợp lệ của Request Body cho POST /api/align-chapter
 */
export function validateAlignmentBody(body: any): ValidationResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { valid: false, error: "Dữ liệu yêu cầu không hợp lệ." };
  }
  const sourceText = body.sourceText || body.originalText;
  const translatedText = body.translatedText;
  if (!sourceText || typeof sourceText !== "string" || sourceText.trim().length === 0) {
    return { valid: false, error: "Văn bản gốc không hợp lệ hoặc đang để trống." };
  }
  if (!translatedText || typeof translatedText !== "string" || translatedText.trim().length === 0) {
    return { valid: false, error: "Văn bản dịch không hợp lệ hoặc đang để trống." };
  }
  return { valid: true };
}
