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

/**
 * Dò tìm một phân đoạn (substring) thật trong văn bản gốc (haystack)
 * khớp với chuỗi đích (needle) sau khi cả hai đã được chuẩn hóa Phồn -> Giản.
 * 
 * Sử dụng cửa sổ trượt Unicode character (code point) để tránh cắt sai ký tự Hán.
 * 
 * @param haystack Văn bản gốc (chứa ký tự thật cần lấy)
 * @param needle Cụm từ đích (do AI trả về, có thể lệch Phồn/Giản)
 * @returns Phân đoạn substring thật trong haystack, hoặc null nếu không khớp
 */
export function findCanonicalSubstring(haystack: string, needle: string): string | null {
  if (!haystack || !needle) return null;
  const needleNorm = canonicalizeHan(needle.trim());
  if (!needleNorm) return null;

  const haystackChars = Array.from(haystack);
  const needleChars = Array.from(needle.trim());
  const needleLen = needleChars.length;

  for (let i = 0; i <= haystackChars.length - needleLen; i++) {
    const windowStr = haystackChars.slice(i, i + needleLen).join('');
    if (canonicalizeHan(windowStr) === needleNorm) {
      return windowStr;
    }
  }
  return null;
}

/**
 * Rà soát và tự sửa (snap-back) cụm chữ Hán trong trường 'chinese' của từng entity.
 * Nếu không khớp hoàn toàn cả dạng exact lẫn canonical, thêm `needsReview: true` vào entity.
 * 
 * @param entities Danh sách các thuật ngữ do AI trích xuất (chứa field chinese)
 * @param rawText Văn bản gốc tiếng Trung dùng để đối chiếu
 * @returns Danh sách thực thể đã được chuẩn hóa / sửa đổi
 */
export function validateAndSnapBackEntities(entities: any[], rawText: string): any[] {
  if (!Array.isArray(entities) || !rawText) return entities || [];

  return entities.map((item: any) => {
    if (!item || typeof item.chinese !== "string") return item;

    const chineseVal = item.chinese.trim();
    // 1. Nếu rawSourceText.includes(entity.chinese.trim()) -> giữ nguyên
    if (rawText.includes(chineseVal)) {
      return item;
    }

    const normRaw = canonicalizeHan(rawText);
    const normChinese = canonicalizeHan(chineseVal);

    // 2. Else if canonicalizeHan(rawSourceText).includes(canonicalizeHan(entity.chinese))
    if (normRaw.includes(normChinese)) {
      const realSubstring = findCanonicalSubstring(rawText, chineseVal);
      if (realSubstring) {
        item.chinese = realSubstring;
      } else {
        item.needsReview = true;
      }
    } else {
      // 3. Else -> needsReview: true
      item.needsReview = true;
    }

    return item;
  });
}

export interface FuzzyCandidate {
  text: string;
  similarity: number;
  index: number;
}

/**
 * Finds substring candidates in haystack that are fuzzy-similar to needle.
 * Uses bigram (Dice coefficient) similarity on normalized characters.
 */
export function findFuzzyCandidates(haystack: string, needle: string, topN = 3): FuzzyCandidate[] {
  if (!haystack || !needle) return [];
  const needleTrim = needle.trim();
  if (!needleTrim) return [];

  const safeHaystack = haystack.length > 50000 ? haystack.substring(0, 50000) : haystack;
  const haystackChars = Array.from(safeHaystack);
  const needleNorm = canonicalizeHan(needleTrim);
  const needleChars = Array.from(needleNorm);
  const needleLen = needleChars.length;

  const candidates: FuzzyCandidate[] = [];
  const seenTexts = new Set<string>();

  const minLen = Math.max(1, needleLen - 2);
  const maxLen = needleLen + 2;

  const getBigrams = (str: string): Set<string> => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  };

  const needleBigrams = getBigrams(needleNorm);

  const calculateSimilarity = (wNorm: string): number => {
    if (wNorm === needleNorm) return 1.0;
    if (wNorm.length < 2 || needleNorm.length < 2) {
      if (wNorm.length === 1 && needleNorm.length === 1) {
        return wNorm === needleNorm ? 1.0 : 0.0;
      }
      return 0.0;
    }
    const wBigrams = getBigrams(wNorm);
    let intersection = 0;
    wBigrams.forEach((bg) => {
      if (needleBigrams.has(bg)) {
        intersection++;
      }
    });
    return (2.0 * intersection) / (wBigrams.size + needleBigrams.size);
  };

  for (let wLen = minLen; wLen <= maxLen; wLen++) {
    for (let i = 0; i <= haystackChars.length - wLen; i++) {
      const windowStr = haystackChars.slice(i, i + wLen).join('');
      if (seenTexts.has(windowStr)) continue;
      seenTexts.add(windowStr);

      const windowNorm = canonicalizeHan(windowStr);
      const similarity = calculateSimilarity(windowNorm);
      const pct = Math.round(similarity * 100);

      if (pct >= 40) {
        candidates.push({
          text: windowStr,
          similarity: pct,
          index: i
        });
      }
    }
  }

  candidates.sort((a, b) => {
    if (b.similarity !== a.similarity) {
      return b.similarity - a.similarity;
    }
    const diffA = Math.abs(Array.from(a.text).length - needleLen);
    const diffB = Math.abs(Array.from(b.text).length - needleLen);
    if (diffA !== diffB) {
      return diffA - diffB;
    }
    return a.index - b.index;
  });

  return candidates.slice(0, topN);
}
