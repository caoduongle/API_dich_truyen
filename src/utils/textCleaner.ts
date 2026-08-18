/**
 * Utility functions to clean Chinese raw text before translation.
 * Filters common web novel advertisements, website watermarks, and cleans spacing.
 */

export function cleanChineseText(text: string): string {
  if (!text) return "";
  let cleaned = text;

  // 1. Remove HTML tags and HTML entities
  cleaned = cleaned.replace(/<[^>]+>/g, "");
  cleaned = cleaned.replace(/&nbsp;/g, " ");
  cleaned = cleaned.replace(/&amp;/g, "&");
  cleaned = cleaned.replace(/&lt;/g, "<");
  cleaned = cleaned.replace(/&gt;/g, ">");

  // 2. Remove URLs (http, https, www...)
  cleaned = cleaned.replace(/https?:\/\/[^\s]+/gi, "");
  cleaned = cleaned.replace(/www\.[a-zA-Z0-9-]+\.[a-z]{2,6}(\/[^\s]*)?/gi, "");
  cleaned = cleaned.replace(/[a-zA-Z0-9-]+\.(com|net|org|cn|cc|info|xyz)(\/[^\s]*)?/gi, "");

  // 3. Remove common novel scraper ads/watermarks
  const adsPatterns = [
    /uu看书\s*(?:www\.)?uukanshu\.(?:com|net)/gi,
    /顶点小说\s*(?:www\.)?[a-zA-Z0-9-]+\.(?:com|net|org|co|cc)/gi,
    /笔趣阁\s*(?:www\.)?[a-zA-Z0-9-]+\.(?:com|net|org|co|cc)/gi,
    /请记住本书首发域名[：:]\s*[^\s]+/g,
    /最新章节[：:]\s*[^\s]+/g,
    /手机版阅读网址[：:]\s*[^\s]+/g,
    /三五第一\s*小说网/g,
    /www\.35xs\.com/gi,
    /uukanshu\.com/gi,
    /uukanshu\.net/gi,
    /biqiuge/gi,
    /biquge/gi,
    /m\.biquge\.com/gi,
    /www\.biquge\.com/gi,
    /【.*阅读.*】/g,
    /（.*阅读.*）/g,
    /【.*下载.*】/g,
    /点击下载本站app/gi,
    /【.*看书.*】/g
  ];

  for (const pattern of adsPatterns) {
    cleaned = cleaned.replace(pattern, "");
  }

  // 4. Normalize spacing & blank lines
  const lines = cleaned.split(/\r?\n/);
  const processedLines = lines
    .map(line => {
      // Trim leading/trailing spaces, including full-width ideographic spaces (\u3000)
      return line.replace(/^[\s\u3000]+|[\s\u3000]+$/g, "");
    })
    .filter(line => {
      if (line.length === 0) return true; // Keep empty lines for spacing
      const lowerLine = line.toLowerCase();
      // Filter out lines that are just advertising noise
      if (
        lowerLine.includes("uukanshu") || 
        lowerLine.includes("biquge") || 
        lowerLine.includes("顶点小说") || 
        lowerLine.includes("笔趣阁")
      ) {
        return false;
      }
      return true;
    });

  // Remove duplicate successive empty lines
  const finalLines: string[] = [];
  let prevEmpty = false;
  for (const line of processedLines) {
    if (line === "") {
      if (!prevEmpty) {
        finalLines.push("");
        prevEmpty = true;
      }
    } else {
      finalLines.push(line);
      prevEmpty = false;
    }
  }

  return finalLines.join("\n").trim();
}

/**
 * Tự động phát hiện và tách dòng nếu tiêu đề chương bị dính liền với câu văn mở đầu
 */
export function separateChapterTitleAndBody(text: string): string {
  if (!text || typeof text !== "string") return "";
  const trimmed = text.trim();
  const lines = trimmed.split('\n');
  if (lines.length === 0) return trimmed;

  const firstLine = lines[0].trim();

  // Dò tìm mẫu tiêu đề dính câu mở đầu:
  // "Chương 1: Đài Phát Thanh Kinh Hoàng. Đôi môi đỏ thắm..."
  // "Chương 1. Đôi môi đỏ thắm..."
  // "Chương 1: Đài Phát Thanh Kinh Hoàng! Đôi môi đỏ thắm..."
  const titleSeparationRegex = /^((?:Chương|Chapter|Hồi|Quyển|Tập|Thứ\s+\d+\s*chương|第\s*[\d零一二三四五六七八九十百千万]+\s*[章节回卷])\s*(?:\d+|[IVXLCDM]+|[a-zA-ZÀ-ỹ0-9零一二三四五六七八九十百千万]+)?\s*(?:[:.\-—]\s*[^.!?\n]+)?)([.?!\-])\s+([A-ZÀ-Ỹ0-9"“'‘\p{L}].*)$/u;

  const match = firstLine.match(titleSeparationRegex);
  if (match) {
    const detectedTitle = match[1].trim();
    const firstSentence = match[3].trim();
    const remainingLines = lines.slice(1);
    return [detectedTitle, "", firstSentence, ...remainingLines].join('\n');
  }

  return trimmed;
}
