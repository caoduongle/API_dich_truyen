export const LITERARY_TRANSLATION_FRAMING =
  "[BỐI CẢNH DỰ ÁN VÀ QUY ĐỊNH AN TOÀN]\n" +
  "Bạn đang hỗ trợ dịch thuật văn học hợp pháp từ tiếng Trung sang tiếng Việt cho mục đích nghiên cứu, giáo dục và xuất bản văn học nghệ thuật. " +
  "Nội dung tác phẩm là thế giới giả tưởng hư cấu (fiction), có thể chứa các mô tả về xung đột, chiến đấu, võ thuật, phép thuật hoặc các yếu tố kỳ ảo đặc trưng của thể loại văn học. " +
  "Đây hoàn toàn là nội dung sáng tạo nghệ thuật hư cấu được phép theo quy định xuất bản.\n\n";

export function getGenreStyleGuide(genre: string): string {
  const g = (genre || "").trim();
  if (g === "Tiên Hiệp" || g === "Võ Hiệp")
    return "Thể loại Tiên Hiệp/Võ Hiệp: dùng từ phong vị cổ phong thanh cao, kiếm khí dạt dào, xưng hô ta-ngươi-huynh-muội, tiền bối-hậu bối.";
  if (g === "Ngôn Tình")
    return "Thể loại Ngôn Tình: uyển chuyển lắng đọng lãng mạn, chú trọng cảm xúc nội tâm, xưng hô chàng-nàng-anh-em tự nhiên.";
  if (g === "Đô Thị")
    return "Thể loại Đô Thị: tinh gọn thực tế hiện đại, từ ngữ đời thường dễ cảm, không dùng từ cổ phong.";
  if (g === "Huyền Huyễn" )
    return "Thể loại Huyền Huyễn: kết hợp yếu tố cổ phong và kỳ ảo, linh hoạt xưng hô theo ngữ cảnh, giữ không khí huyền bí.";
  if (g === "Huyền Huyễn Phương Tây")
    return "Thể loại Huyền Huyễn Phương Tây: phong cách fantasy Âu Mỹ, tên nhân vật/địa danh giữ nguyên tiếng Anh hoặc phiên âm, xưng hô tôi-bạn-ngài tự nhiên, không dùng từ Hán Việt cổ phong.";
  if (g === "Vô Hạn Lưu")
    return "Thể loại Vô Hạn Lưu: nhịp văn nhanh dồn dập, không khí căng thẳng sinh tồn, từ ngữ sắc bén rõ ràng, mô tả hành động chiến đấu chi tiết kịch tính.";
  if (g === "Lịch Sử / Quân Sự")
    return "Thể loại Lịch Sử/Quân Sự: văn phong trầm hùng, mang tính dã sử trang nghiêm; sử dụng từ ngữ chương hồi, xưng hô tôn kính hoàng triều/quân thần (bệ hạ, thần, vi thần, khanh, tướng quân, bản soái...).";
  if (g === "Khoa Huyễn / Võng Du")
    return "Thể loại Khoa Huyễn/Võng Du: phong cách hiện đại công nghệ cao kết hợp thế giới ảo; dùng thuật ngữ số hóa, robot, cơ giáp, hệ thống ảo, chỉ số sức mạnh cụ thể, xưng hô tôi-anh hoặc ta-ngươi tùy hoàn cảnh.";
  if (g === "Linh Dị / Thần Quái")
    return "Thể loại Linh Dị/Thần Quái: văn phong u ám huyền bí, kích thích sự tò mò rùng rợn; tập trung mô tả bối cảnh âm trầm, tâm lý hoang mang sợ hãi, các hiện tượng tâm linh kì bí.";
  if (g === "Hệ Thống / Điền Văn")
    return "Thể loại Hệ Thống/Điền Văn: văn phong nhẹ nhàng ấm áp, chậm rãi; mô tả cuộc sống làm ruộng sinh hoạt bình dị thường ngày xen lẫn các nhiệm vụ vui nhộn của hệ thống phụ tá.";
  return `Thể loại ${g}: dịch tự nhiên phù hợp văn phong thể loại, ưu tiên từ ngữ thuần Việt dễ hiểu.`;
}

export function safeParseJson(text: string): any {
  if (!text) return null;
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch (err) {
    // Thử làm sạch các khối markdown code block nếu bị kẹp đầu đuôi
    let cleaned = trimmed
      .replace(/^```(?:json)?\s*/im, "")
      .replace(/```\s*$/im, "")
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch (err2) {
      // Tìm vị trí mở ngoặc nhọn hoặc vuông đầu tiên để cô lập JSON
      const startIdx = trimmed.search(/[\{\[]/);
      if (startIdx !== -1) {
        const startChar = trimmed[startIdx];
        const endChar = startChar === '{' ? '}' : ']';
        let depth = 0;
        let inString = false;
        let escape = false;
        let endIdx = -1;

        for (let i = startIdx; i < trimmed.length; i++) {
          const char = trimmed[i];
          if (escape) { escape = false; continue; }
          if (char === '\\') { escape = true; continue; }
          if (char === '"') { inString = !inString; continue; }

          if (!inString) {
            if (char === startChar) depth++;
            else if (char === endChar) {
              depth--;
              if (depth === 0) {
                endIdx = i;
                break;
              }
            }
          }
        }

        if (endIdx !== -1) {
          try {
            const cleanJsonStr = trimmed.substring(startIdx, endIdx + 1);
            return JSON.parse(cleanJsonStr);
          } catch (err3) {
            const regex = startChar === '{' ? /\{[\s\S]*\}/ : /\[[\s\S]*\]/;
            const match = trimmed.match(regex);
            if (match) {
              return JSON.parse(match[0]);
            }
          }
        }
      }
      throw err2;
    }
  }
}

// Định vị điểm phân tách văn bản an toàn không làm đứt câu
export function findSplitPoint(text: string): number {
  const mid = Math.floor(text.length / 2);
  const searchRange = Math.floor(text.length * 0.3);
  let bestIdx = -1;
  let minDiff = Infinity;
  for (let i = mid - searchRange; i <= mid + searchRange; i++) {
    if (i < 0 || i >= text.length) continue;
    if (text[i] === '\n') {
      const diff = Math.abs(i - mid);
      if (diff < minDiff) {
        minDiff = diff;
        bestIdx = i;
      }
    }
  }

  if (bestIdx === -1) {
    minDiff = Infinity;
    for (let i = mid - searchRange; i <= mid + searchRange; i++) {
      if (i < 0 || i >= text.length) continue;
      if (text[i] === '.' || text[i] === '。' || text[i] === '?' || text[i] === '？' || text[i] === '!' || text[i] === '！') {
        const diff = Math.abs(i - mid);
        if (diff < minDiff) {
          minDiff = diff;
          bestIdx = i + 1;
        }
      }
    }
  }

  if (bestIdx === -1) {
    minDiff = Infinity;
    for (let i = mid - searchRange; i <= mid + searchRange; i++) {
      if (i < 0 || i >= text.length) continue;
      if (text[i] === ' ' || text[i] === '\t') {
        const diff = Math.abs(i - mid);
        if (diff < minDiff) {
          minDiff = diff;
          bestIdx = i;
        }
      }
    }
  }

  return bestIdx !== -1 ? bestIdx : mid;
}

/**
 * Ước lượng số lượng token thực tế cho các mô hình Gemini (SentencePiece BPE):
 * - Ký tự Hán (Chinese / Hanzi): ~1.35 tokens / ký tự
 * - Tiếng Việt / Latin có dấu: ~1.1 - 1.25 tokens / từ
 * - Tiếng Anh / Ký tự ASCII / Số: ~4 ký tự / token
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;

  // Đếm ký tự chữ Hán (Hanzi / CJK Unified Ideographs)
  const hanMatches = trimmed.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g);
  const hanCount = hanMatches ? hanMatches.length : 0;

  // Tách phần văn bản còn lại thành các từ
  const nonHanText = trimmed.replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g, ' ');
  const words = nonHanText.trim().split(/\s+/).filter(Boolean);

  const nonHanTokens = words.reduce((acc, word) => {
    if (word.length > 6) return acc + Math.ceil(word.length / 3.5);
    return acc + 1.15;
  }, 0);

  return Math.ceil(hanCount * 1.35 + nonHanTokens);
}

/**
 * Phân chia văn bản thích ứng (Token-aware Adaptive Split):
 * - Ưu tiên phân tách theo khối đoạn văn (\n\n), sau đó tới dòng (\n), câu kết (. 。 ? ！ !), rồi khoảng trắng.
 * - Cân bằng các phần dựa trên ước lượng Token thực tế thay vì độ dài ký tự thô.
 * - Hỗ trợ chia thành 2 phần (depth < 2) hoặc 3 phần (depth >= 2) để cô lập nhanh phân đoạn bị bộ lọc chặn.
 */
export function splitTextAdaptively(text: string, partsCount: number = 2): string[] {
  if (!text) return [];
  const trimmed = text.trim();
  if (!trimmed) return [];
  
  const totalTokens = estimateTokenCount(trimmed);
  // Nếu dung lượng quá nhỏ (<60 tokens ≈ 45 chữ Hán), không bóc tách thêm để tránh vỡ ngữ nghĩa
  if (partsCount <= 1 || totalTokens < 60) return [trimmed];

  // 1. Thử chia theo đoạn văn kép \n\n
  const doubleNewlineParagraphs = trimmed.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  if (doubleNewlineParagraphs.length >= partsCount) {
    return partitionItems(doubleNewlineParagraphs, partsCount, "\n\n");
  }

  // 2. Thử chia theo từng dòng đơn \n
  const singleNewlineLines = trimmed.split(/\n+/).map(l => l.trim()).filter(Boolean);
  if (singleNewlineLines.length >= partsCount) {
    return partitionItems(singleNewlineLines, partsCount, "\n");
  }

  // 3. Fallback: Nếu là 1 đoạn văn liền dài, tìm điểm cắt theo dấu câu / khoảng trắng / vị trí
  return splitLongParagraph(trimmed, partsCount);
}

function partitionItems(items: string[], targetParts: number, delimiter: string): string[] {
  const itemTokens = items.map(item => estimateTokenCount(item));
  const totalTokens = itemTokens.reduce((acc, count) => acc + count, 0);
  const targetTokensPerChunk = totalTokens / targetParts;
  
  const result: string[] = [];
  let currentGroup: string[] = [];
  let currentTokens = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const tokens = itemTokens[i];
    currentGroup.push(item);
    currentTokens += tokens;

    const remainingPartsNeeded = targetParts - result.length;
    const remainingItems = items.length - (i + 1);

    // Nếu đã gom đủ số token lý tưởng hoặc số items còn lại vừa đủ cho các phần còn lại
    if (
      (currentTokens >= targetTokensPerChunk && remainingPartsNeeded > 1 && remainingItems >= remainingPartsNeeded - 1) ||
      (remainingItems === remainingPartsNeeded - 1 && remainingPartsNeeded > 1)
    ) {
      result.push(currentGroup.join(delimiter).trim());
      currentGroup = [];
      currentTokens = 0;
    }
  }

  if (currentGroup.length > 0) {
    result.push(currentGroup.join(delimiter).trim());
  }

  return result.filter(r => r.length > 0);
}

function splitLongParagraph(text: string, targetParts: number): string[] {
  if (targetParts === 2) {
    const splitIdx = findSplitPoint(text);
    const p1 = text.substring(0, splitIdx).trim();
    const p2 = text.substring(splitIdx).trim();
    if (p1 && p2) return [p1, p2];
    return [text];
  }

  // targetParts >= 3 (chia 3)
  const cuts: number[] = [];
  const targets = [text.length * (1 / 3), text.length * (2 / 3)];

  for (let t = 0; t < targets.length; t++) {
    const targetIdx = Math.floor(targets[t]);
    const range = Math.floor(text.length * 0.15);
    let bestIdx = -1;
    let minDiff = Infinity;

    // Tìm dấu kết câu quanh target
    for (let i = targetIdx - range; i <= targetIdx + range; i++) {
      if (i <= 0 || i >= text.length) continue;
      const ch = text[i];
      if (ch === '.' || ch === '。' || ch === '?' || ch === '？' || ch === '!' || ch === '！' || ch === '…') {
        const diff = Math.abs(i - targetIdx);
        if (diff < minDiff) {
          minDiff = diff;
          bestIdx = i + 1;
        }
      }
    }

    // Tìm khoảng trắng / phẩy nếu không có dấu kết câu
    if (bestIdx === -1) {
      for (let i = targetIdx - range; i <= targetIdx + range; i++) {
        if (i <= 0 || i >= text.length) continue;
        const ch = text[i];
        if (ch === ' ' || ch === '\t' || ch === ',' || ch === '，' || ch === ';' || ch === '；') {
          const diff = Math.abs(i - targetIdx);
          if (diff < minDiff) {
            minDiff = diff;
            bestIdx = i + 1;
          }
        }
      }
    }

    cuts.push(bestIdx !== -1 ? bestIdx : targetIdx);
  }

  // Đảm bảo cuts tăng dần
  cuts.sort((a, b) => a - b);
  const p1 = text.substring(0, cuts[0]).trim();
  const p2 = text.substring(cuts[0], cuts[1]).trim();
  const p3 = text.substring(cuts[1]).trim();

  const parts = [p1, p2, p3].filter(p => p.length > 0);
  return parts.length >= 2 ? parts : [text];
}

export function escapeRegex(str: string): string {
  return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '$&');
}

export function redactApiKey(message: string, keys: string[]): string {
  if (!message || !Array.isArray(keys)) return message;
  let result = message;
  for (const key of keys) {
    if (key && key.trim().length > 5) {
      result = result.split(key).join('***REDACTED***');
    }
  }
  return result;
}
