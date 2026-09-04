/**
 * Tiêu chuẩn an toàn kiểm tra tệp tải lên (File Upload Security Validator)
 * Kiểm tra:
 * 1. Kích thước tệp tin (tối đa 20MB chống tràn bộ nhớ / OOM Denial of Service).
 * 2. Định dạng phần mở rộng hợp lệ (.txt, .epub).
 * 3. Thẩm định Magic Bytes nhị phân (Header ZIP PK\x03\x04 cho file EPUB).
 */

export const MAX_UPLOAD_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

export function isZipMagicBytes(header: Uint8Array): boolean {
  if (!header || header.length < 4) return false;
  // ZIP Local File Header: 0x50 0x4B 0x03 0x04 (PK\x03\x04)
  return header[0] === 0x50 && header[1] === 0x4b && header[2] === 0x03 && header[3] === 0x04;
}

export async function validateUploadFile(file: File): Promise<void> {
  if (!file) {
    throw new Error("Không có tệp tin được chọn.");
  }

  // 1. Kiểm tra kích thước tệp
  if (file.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
    const sizeInMb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(
      `Dung lượng tệp (${sizeInMb}MB) vượt quá giới hạn tối đa cho phép là 20MB. Vui lòng chia nhỏ tệp truyện.`
    );
  }

  const lowerName = file.name.toLowerCase();

  // 2. Kiểm tra phần mở rộng
  if (!lowerName.endsWith(".txt") && !lowerName.endsWith(".epub")) {
    throw new Error("Chỉ hỗ trợ định dạng tệp .txt hoặc .epub.");
  }

  // 3. Kiểm tra Magic Bytes cho định dạng EPUB
  if (lowerName.endsWith(".epub")) {
    try {
      const slice = file.slice(0, 4);
      const buffer = await slice.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      if (!isZipMagicBytes(bytes)) {
        throw new Error(
          "Tệp EPUB không hợp lệ (sai cấu trúc magic bytes định dạng ZIP). Vui lòng kiểm tra lại tệp."
        );
      }
    } catch (err: any) {
      if (err.message && err.message.includes("magic bytes")) {
        throw err;
      }
      throw new Error(`Không thể đọc cấu trúc tệp tin: ${err.message || err}`);
    }
  }
}
