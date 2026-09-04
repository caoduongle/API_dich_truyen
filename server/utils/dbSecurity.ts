/**
 * Tiện ích an ninh cơ sở dữ liệu: Chuẩn hóa Prepared Statements và kiểm tra tham số hóa (SQLi Defense)
 * Feature 088 - AppSec Vulnerability Hardening
 */

export interface ParameterizedQuery {
  text: string;
  values: any[];
}

export interface QueryValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Kiểm tra câu truy vấn cơ sở dữ liệu để bảo đảm tuyệt đối tuân thủ Prepared Statements.
 * Chặn đứng mọi nỗ lực ghép chuỗi trực tiếp (string interpolation / concatenation).
 */
export function validateParameterizedQuery(
  queryText: string,
  values: any[] = []
): QueryValidationResult {
  if (!queryText || typeof queryText !== "string" || !queryText.trim()) {
    return { valid: false, error: "Câu truy vấn SQL không được để trống." };
  }

  const trimmed = queryText.trim();

  // Phát hiện nháy đơn trong câu truy vấn (dấu hiệu string interpolation thay vì tham số hóa $1, $2)
  if (trimmed.includes("'")) {
    return {
      valid: false,
      error: "Phát hiện ký tự unparameterized string literal trong câu truy vấn. Bắt buộc dùng Prepared Statement với placeholder $1, $2.",
    };
  }

  // Phát hiện dấu chấm phẩy nhiều lệnh (ngăn chặn Multiple Statements / Piggybacked Queries)
  if (trimmed.includes(";") && trimmed.indexOf(";") !== trimmed.length - 1) {
    return {
      valid: false,
      error: "Không cho phép nhiều câu lệnh SQL trong cùng một truy vấn (Chống SQL Injection Stacked Queries).",
    };
  }

  // Đếm số lượng placeholder $1, $2, ...
  const matches = trimmed.match(/\$\d+/g) || [];
  const uniquePlaceholders = new Set(matches);

  if (uniquePlaceholders.size > values.length) {
    return {
      valid: false,
      error: `Số lượng tham số truyền vào (${values.length}) ít hơn số lượng placeholder trong câu lệnh (${uniquePlaceholders.size}).`,
    };
  }

  return { valid: true };
}

/**
 * Tạo câu lệnh Prepared Statement an toàn có kiểm định tham số
 */
export function createSafeQuery(
  text: string,
  values: any[] = []
): ParameterizedQuery {
  const validation = validateParameterizedQuery(text, values);
  if (!validation.valid) {
    throw new Error(`[DBSecurity] Vi phạm tiêu chuẩn an ninh truy vấn: ${validation.error}`);
  }
  return { text: text.trim(), values };
}
