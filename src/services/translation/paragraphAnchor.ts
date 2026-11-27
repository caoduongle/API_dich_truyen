/**
 * Explicit 1-1 Paragraph Anchor Utilities (`<<P1>>`..`<<PN>>`)
 * Bảo toàn ranh giới và thứ tự từng đoạn văn qua GĐ1/GĐ2 cho mô hình nhẹ tốc độ cao
 * mà vẫn tương thích ngược 100% với JSON schema hiện có (`string`).
 */

export interface AnchoredParagraphEncoding {
  encodedText: string;
  sourceParagraphs: string[];
  expectedCount: number;
}

export interface AnchoredParagraphParseResult {
  paragraphs: string[];
  paragraphsByIndex: Record<number, string>;
  usedAnchors: boolean;
  missingIndices: number[];
  duplicateIndices: number[];
  extraCount: number;
}

const LINE_START_ANCHOR_RE = /^[ \t]*<<P(\d+)>>[ \t]*/gm;
const ANY_ANCHOR_TOKEN_RE = /<<P\d+>>[ \t]*/g;

function splitAnchorParagraphs(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Gỡ sạch toàn bộ thẻ neo `<<Pk>>` khỏi chuỗi mà không làm hỏng cấu trúc xuống dòng.
 */
export function stripParagraphAnchors(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text.replace(ANY_ANCHOR_TOKEN_RE, '');
}

/**
 * Gắn nhãn neo `<<P1>>`..`<<PN>>` ở đầu từng đoạn văn không rỗng.
 */
export function encodeAnchoredParagraphs(text: string): AnchoredParagraphEncoding {
  const sourceParagraphs = splitAnchorParagraphs(text);
  const expectedCount = sourceParagraphs.length;
  if (expectedCount === 0) {
    return { encodedText: '', sourceParagraphs: [], expectedCount: 0 };
  }

  const encodedText = sourceParagraphs
    .map((para, idx) => `<<P${idx + 1}>> ${para}`)
    .join('\n\n');

  return {
    encodedText,
    sourceParagraphs,
    expectedCount,
  };
}

/**
 * Tách và đối chiếu đầu ra AI dựa trên thẻ neo ở đầu dòng `<<Pk>>` (`1 <= k <= expectedCount`).
 * Chỉ khớp thẻ hợp lệ nằm ở đầu dòng để chuỗi `<<...>>` giữa câu trong truyện không làm gãy đoạn.
 */
export function parseAnchoredParagraphs(
  aiOutput: string,
  expectedCount: number
): AnchoredParagraphParseResult {
  const raw = typeof aiOutput === 'string' ? aiOutput : '';
  if (!raw.trim() || expectedCount <= 0) {
    return {
      paragraphs: [],
      paragraphsByIndex: {},
      usedAnchors: false,
      missingIndices: [],
      duplicateIndices: [],
      extraCount: 0,
    };
  }

  const normalized = raw.replace(/\r\n/g, '\n');
  const markers: Array<{
    oneBasedIndex: number;
    matchStart: number;
    contentStart: number;
  }> = [];
  let extraOutOfRangeMarkers = 0;

  LINE_START_ANCHOR_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = LINE_START_ANCHOR_RE.exec(normalized)) !== null) {
    const parsedNum = Number(match[1]);
    if (Number.isInteger(parsedNum) && parsedNum >= 1 && parsedNum <= expectedCount) {
      markers.push({
        oneBasedIndex: parsedNum,
        matchStart: match.index,
        contentStart: match.index + match[0].length,
      });
    } else if (Number.isInteger(parsedNum) && parsedNum > expectedCount) {
      extraOutOfRangeMarkers++;
    }
  }

  if (markers.length === 0) {
    const plainParagraphs = splitAnchorParagraphs(stripParagraphAnchors(normalized));
    const paragraphsByIndex: Record<number, string> = {};
    plainParagraphs.forEach((p, idx) => {
      if (idx < expectedCount) paragraphsByIndex[idx] = p;
    });
    return {
      paragraphs: plainParagraphs,
      paragraphsByIndex,
      usedAnchors: false,
      missingIndices: [],
      duplicateIndices: [],
      extraCount: Math.max(0, plainParagraphs.length - expectedCount),
    };
  }

  const paragraphsByIndex: Record<number, string> = {};
  const seenCounts = new Map<number, number>();
  const duplicateSet = new Set<number>();

  // Nếu đoạn đầu tiên nằm ngay trước <<P2>> nhưng model lỡ quên ghi <<P1>>
  if (markers[0].oneBasedIndex === 2 && markers[0].matchStart > 0) {
    const leadingText = stripParagraphAnchors(normalized.slice(0, markers[0].matchStart))
      .replace(/\s*\n+\s*/g, ' ')
      .trim();
    if (leadingText) {
      paragraphsByIndex[0] = leadingText;
      seenCounts.set(0, 1);
    }
  }

  for (let i = 0; i < markers.length; i++) {
    const cur = markers[i];
    const zeroIdx = cur.oneBasedIndex - 1;
    const endPos = i + 1 < markers.length ? markers[i + 1].matchStart : normalized.length;
    const rawSegment = normalized.slice(cur.contentStart, endPos);
    const cleanedSegment = rawSegment
      .replace(LINE_START_ANCHOR_RE, '')
      .replace(/\s*\n+\s*/g, ' ')
      .trim();

    const prevCount = seenCounts.get(zeroIdx) || 0;
    seenCounts.set(zeroIdx, prevCount + 1);
    if (prevCount >= 1) {
      duplicateSet.add(zeroIdx);
    }

    if (cleanedSegment) {
      paragraphsByIndex[zeroIdx] = paragraphsByIndex[zeroIdx]
        ? `${paragraphsByIndex[zeroIdx]} ${cleanedSegment}`.trim()
        : cleanedSegment;
    } else if (paragraphsByIndex[zeroIdx] === undefined) {
      paragraphsByIndex[zeroIdx] = '';
    }
  }

  const missingIndices: number[] = [];
  const paragraphs: string[] = [];

  for (let idx = 0; idx < expectedCount; idx++) {
    const content = paragraphsByIndex[idx];
    if (typeof content === 'string' && content.length > 0) {
      paragraphs.push(content);
    } else {
      missingIndices.push(idx);
      delete paragraphsByIndex[idx];
    }
  }

  return {
    paragraphs,
    paragraphsByIndex,
    usedAnchors: true,
    missingIndices,
    duplicateIndices: Array.from(duplicateSet).sort((a, b) => a - b),
    extraCount: extraOutOfRangeMarkers,
  };
}
