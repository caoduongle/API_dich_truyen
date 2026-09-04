import { describe, it, expect } from "vitest";
import {
  validateUploadedFile,
  sanitizeFilename,
  isValidEpubBuffer,
  isValidTextContent,
  MAX_FILE_SIZE_BYTES,
} from "../fileValidation";

describe("fileValidation Utility", () => {
  it("should sanitize directory traversal and dangerous characters in filenames", () => {
    expect(sanitizeFilename("../../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("..\\..\\windows\\system32\\cmd.exe")).toBe("cmd.exe");
    expect(sanitizeFilename("my novel.txt")).toBe("my novel.txt");
    expect(sanitizeFilename("truyện_tiên_hiệp_123.epub")).toBe("truyện_tiên_hiệp_123.epub");
  });

  it("should validate epub magic bytes correctly", () => {
    const validZipHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
    const invalidHeader = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]); // GIF header

    expect(isValidEpubBuffer(validZipHeader)).toBe(true);
    expect(isValidEpubBuffer(invalidHeader)).toBe(false);
    expect(isValidEpubBuffer(Buffer.alloc(0))).toBe(false);
  });

  it("should detect null byte injection in text content", () => {
    expect(isValidTextContent("Nội dung chương 1 bình thường")).toBe(true);
    expect(isValidTextContent("Nội dung có ký tự độc hại \x00 đằng sau")).toBe(false);
  });

  it("should reject files exceeding max file size", () => {
    const result = validateUploadedFile("novel.txt", MAX_FILE_SIZE_BYTES + 1024);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("vượt quá giới hạn cho phép");
  });

  it("should reject disallowed extensions", () => {
    const result = validateUploadedFile("malicious.exe", 1024);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("không được hỗ trợ");
  });

  it("should validate valid epub file with correct magic bytes", () => {
    const validZipHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
    const result = validateUploadedFile("book.epub", 2048, validZipHeader);
    expect(result.valid).toBe(true);
    expect(result.sanitizedFilename).toBe("book.epub");
  });

  it("should reject fake epub file with invalid magic bytes", () => {
    const fakeZipHeader = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    const result = validateUploadedFile("fake_book.epub", 2048, fakeZipHeader);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Magic Header không khớp");
  });
});
