import path from "path";

export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  sanitizedFilename?: string;
}

/**
 * Khử trùng tên tệp tin tải lên, loại bỏ triệt để các ký tự Directory Traversal (..\ và /) (Tiêu chuẩn 16)
 */
export function sanitizeFilename(rawFilename: string): string {
  if (!rawFilename || typeof rawFilename !== "string") {
    return `upload_${Date.now()}`;
  }

  // Lấy tên tệp cơ bản, loại bỏ thư mục cha
  const baseName = path.basename(rawFilename).trim();
  // Loại bỏ các ký tự điều khiển hoặc ký tự nguy hiểm
  const sanitized = baseName.replace(/[^a-zA-Z0-9_\-\. \u00C0-\u024F\u1EA0-\u1EF9\u4E00-\u9FFF]/g, "_");

  return sanitized || `upload_${Date.now()}`;
}

/**
 * Kiểm tra Magic Bytes của tệp EPUB (định dạng ZIP: 0x50 0x4B 0x03 0x04)
 */
export function isValidEpubBuffer(buffer: Buffer | Uint8Array): boolean {
  if (!buffer || buffer.length < 4) return false;
  return (
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  );
}

/**
 * Kiểm tra tính an toàn của nội dung tệp văn bản thô (TXT)
 * Không chứa null bytes hoặc các chuỗi thực thi nhị phân.
 */
export function isValidTextContent(content: string): boolean {
  if (typeof content !== "string") return false;
  // Null byte injection check
  if (content.includes("\x00")) return false;
  return true;
}

/**
 * Kiểm định toàn diện tệp tin truyện tải lên hệ thống
 */
export function validateUploadedFile(
  filename: string,
  sizeBytes: number,
  buffer?: Buffer | Uint8Array,
  maxSizeBytes: number = MAX_FILE_SIZE_BYTES
): FileValidationResult {
  if (sizeBytes > maxSizeBytes) {
    return {
      valid: false,
      error: `Dung lượng tệp tin (${(sizeBytes / (1024 * 1024)).toFixed(1)}MB) vượt quá giới hạn cho phép (tối đa ${(maxSizeBytes / (1024 * 1024)).toFixed(0)}MB).`,
    };
  }

  const cleanName = sanitizeFilename(filename);
  const ext = path.extname(cleanName).toLowerCase();

  const allowedExtensions = new Set([".txt", ".epub", ".json"]);
  if (!allowedExtensions.has(ext)) {
    return {
      valid: false,
      error: `Định dạng tệp "${ext}" không được hỗ trợ. Chỉ chấp nhận các tệp: .txt, .epub, .json.`,
    };
  }

  if (ext === ".epub" && buffer) {
    if (!isValidEpubBuffer(buffer)) {
      return {
        valid: false,
        error: "Tệp EPUB không hợp lệ hoặc bị lỗi cấu trúc nén ZIP (Magic Header không khớp).",
      };
    }
  }

  return {
    valid: true,
    sanitizedFilename: cleanName,
  };
}
