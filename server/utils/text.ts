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
