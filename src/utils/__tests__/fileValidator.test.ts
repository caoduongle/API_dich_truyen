import { describe, it, expect } from "vitest";
import { validateUploadFile, isZipMagicBytes, MAX_UPLOAD_FILE_SIZE_BYTES } from "../fileValidator";

describe("File Upload Security Validator (User Story 4 - Pentest Hardening)", () => {
  it("should recognize ZIP magic bytes correctly", () => {
    const validZipHeader = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    expect(isZipMagicBytes(validZipHeader)).toBe(true);

    const invalidHeader = new Uint8Array([0x47, 0x49, 0x46, 0x38]); // GIF8
    expect(isZipMagicBytes(invalidHeader)).toBe(false);

    const emptyHeader = new Uint8Array([]);
    expect(isZipMagicBytes(emptyHeader)).toBe(false);
  });

  it("should accept valid .txt files under 20MB", async () => {
    const textBlob = new Blob(["Chương 1: Khởi đầu tiểu thuyết"], { type: "text/plain" });
    const file = new File([textBlob], "novel.txt", { type: "text/plain" });

    await expect(validateUploadFile(file)).resolves.not.toThrow();
  });

  it("should reject files exceeding 20MB limit", async () => {
    // Tạo dummy file với kích thước > 20MB
    const oversizedFile = {
      name: "huge_novel.txt",
      size: MAX_UPLOAD_FILE_SIZE_BYTES + 1024,
      slice: () => new Blob([]),
    } as unknown as File;

    await expect(validateUploadFile(oversizedFile)).rejects.toThrow("vượt quá giới hạn tối đa cho phép là 20MB");
  });

  it("should reject files with unsupported extensions", async () => {
    const file = new File([new Blob(["exec"])], "malicious.exe", { type: "application/octet-stream" });
    await expect(validateUploadFile(file)).rejects.toThrow("Chỉ hỗ trợ định dạng tệp .txt hoặc .epub");
  });

  it("should reject .epub files with invalid magic bytes", async () => {
    // File text bình thường nhưng đổi đuôi thành .epub
    const fakeEpubBlob = new Blob(["Đây là text không phải zip"], { type: "text/plain" });
    const fakeEpub = new File([fakeEpubBlob], "fake.epub", { type: "application/epub+zip" });

    await expect(validateUploadFile(fakeEpub)).rejects.toThrow("sai cấu trúc magic bytes định dạng ZIP");
  });

  it("should accept .epub files with authentic ZIP magic bytes", async () => {
    const validZipBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
    const validEpub = new File([validZipBytes], "valid.epub", { type: "application/epub+zip" });

    await expect(validateUploadFile(validEpub)).resolves.not.toThrow();
  });
});
