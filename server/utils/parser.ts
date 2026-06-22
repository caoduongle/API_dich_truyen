export function parseGlossaryFromMd(text: string): Array<{
  chinese: string;
  pinyin: string;
  vietnamese: string;
  type: string;
  note: string;
}> {
  if (!text) return [];
  const results: Array<{
    chinese: string;
    pinyin: string;
    vietnamese: string;
    type: string;
    note: string;
  }> = [];
  const SECTION_TYPE_MAP: Array<[RegExp, string]> = [
    [/Nhân\s*vật|CHARACTER|TỔ\s*CHỨC|NHÂN\s*VẬT/i, "character"],
    [/Địa\s*danh|LOCATION|ĐỊA\s*DANH/i, "location"],
    [/Bí\s*kíp|Vật\s*phẩm|CHỦNG\s*TỘC|QUÁI\s*VẬT|HỆ\s*THỐNG|KHÁI\s*NIỆM|KỸ\s*NĂNG/i, "term"],
    [/Thành\s*ngữ|Cụm\s*từ|PHRASE/i, "phrase"],
    [/Thuật\s*ngữ\s*khác|OTHER/i, "other"],
  ];
  const HAN_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;
  let currentType = "term";

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("|") && line.endsWith("|")) {
      const cells = line.split("|").map((c) => c.trim()).filter((c) => c !== "");
      if (cells.length < 3) continue;

      const chinese    = cells[0].replace(/\\\|/g, "|");
      const pinyin     = cells[1].replace(/\\\|/g, "|");
      const vietnamese = cells[2].replace(/\\\|/g, "|");
      const note       = (cells[3] ?? "").replace(/\\\|/g, "|");
      if (!HAN_REGEX.test(chinese)) continue;
      if (!chinese || !vietnamese) continue;

      results.push({ chinese, pinyin, vietnamese, type: currentType, note });
      continue;
    }

    if (line.includes("->")) {
      const stripped = line.replace(/^[\s*\-•·]+/, "").trim();
      const arrowIdx = stripped.indexOf("->");
      if (arrowIdx < 1) continue;

      const chinese    = stripped.slice(0, arrowIdx).trim();
      const vietnamese = stripped.slice(arrowIdx + 2).trim();

      if (!chinese || !vietnamese || !HAN_REGEX.test(chinese)) continue;
      const noteMatch = vietnamese.match(/\(([^)]+)\)\s*$/);
      const note = noteMatch ? noteMatch[1] : "";

      results.push({ chinese, pinyin: "", vietnamese, type: currentType, note });
      continue;
    }

    for (const [pattern, t] of SECTION_TYPE_MAP) {
      if (pattern.test(line)) {
        currentType = t;
        break;
      }
    }
  }

  return results;
}
