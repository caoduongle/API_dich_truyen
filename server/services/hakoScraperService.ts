/**
 * Hako & Docln Public HTML Scraper Service
 * Feature: 075-moderator-quality-checker
 *
 * Strictly read-only public fetching without cookies or credentials.
 * Handles rate limits (429), bot challenges (403/Cloudflare), and network errors gracefully.
 */

export interface HakoScraperError {
  code: 'INVALID_HAKO_URL' | 'HAKO_RATE_LIMITED' | 'HAKO_BOT_CHALLENGE' | 'HAKO_NOVEL_NOT_FOUND' | 'HAKO_NETWORK_ERROR' | 'HAKO_PARSE_ERROR';
  message: string;
  retryAfterSeconds?: number;
}

export interface ParsedHakoChapter {
  url: string;
  title: string;
  order: number;
}

export interface ParsedHakoVolume {
  volumeTitle: string;
  chapters: ParsedHakoChapter[];
}

export interface ParsedHakoNovelMeta {
  url: string;
  title: string;
  author: string;
  artist: string;
  description: string;
  coverUrl?: string;
  volumes: ParsedHakoVolume[];
  fetchedAt: string;
}

export interface ParsedHakoChapterContent {
  url: string;
  title: string;
  volumeTitle: string;
  content: string;
  wordCount: number;
  fetchedAt: string;
}

const HAKO_URL_REGEX = /^https?:\/\/(ln\.hako\.vn|docln\.net|hako\.vn|docln\.vn)\/truyen\/[\w-]+/i;
const HAKO_CHAPTER_URL_REGEX = /^https?:\/\/(ln\.hako\.vn|docln\.net|hako\.vn|docln\.vn)\/truyen\/[\w-]+\/c\d+[\w-]*/i;

export function isValidHakoNovelUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return HAKO_URL_REGEX.test(url.trim());
}

export function isValidHakoChapterUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return HAKO_CHAPTER_URL_REGEX.test(url.trim());
}

const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  copy: '©',
  reg: '®',
  trade: '™',
  hellip: '…',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  laquo: '«',
  raquo: '»',
  aacute: 'á', Aacute: 'Á',
  agrave: 'à', Agrave: 'À',
  acirc: 'â', Acirc: 'Â',
  atilde: 'ã', Atilde: 'Ã',
  eacute: 'é', Eacute: 'É',
  egrave: 'è', Egrave: 'È',
  ecirc: 'ê', Ecirc: 'Ê',
  iacute: 'í', Iacute: 'Í',
  igrave: 'ì', Igrave: 'Ì',
  oacute: 'ó', Oacute: 'Ó',
  ograve: 'ò', Ograve: 'Ò',
  ocirc: 'ô', Ocirc: 'Ô',
  otilde: 'õ', Otilde: 'Õ',
  uacute: 'ú', Uacute: 'Ú',
  ugrave: 'ù', Ugrave: 'Ù',
  yacute: 'ý', Yacute: 'Ý',
};

export function decodeHtmlEntities(html: string): string {
  if (!html) return '';
  return html
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&([a-zA-Z]+);/g, (match, entity) => NAMED_HTML_ENTITIES[entity] || match);
}

export function stripHtmlTags(html: string): string {
  if (!html) return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Fetch HTML từ Hako với timeout và User-Agent
 */
async function fetchHakoHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 429) {
      const err: HakoScraperError = {
        code: 'HAKO_RATE_LIMITED',
        message: 'Hako đang tạm thời giới hạn tần suất truy cập. Vui lòng chờ 1-2 phút rồi thử lại.',
        retryAfterSeconds: 60,
      };
      throw err;
    }

    if (response.status === 403) {
      const err: HakoScraperError = {
        code: 'HAKO_BOT_CHALLENGE',
        message: 'Hako đang kích hoạt cơ chế bảo vệ chống bot (Cloudflare). Vui lòng thử lại sau ít phút.',
        retryAfterSeconds: 90,
      };
      throw err;
    }

    if (response.status === 404) {
      const err: HakoScraperError = {
        code: 'HAKO_NOVEL_NOT_FOUND',
        message: 'Không tìm thấy trang truyện trên Hako hoặc truyện đã bị chuyển sang chế độ riêng tư.',
      };
      throw err;
    }

    if (!response.ok) {
      const err: HakoScraperError = {
        code: 'HAKO_NETWORK_ERROR',
        message: `Lỗi kết nối đến Hako (HTTP ${response.status} ${response.statusText}).`,
      };
      throw err;
    }

    const html = await response.text();

    // Kiểm tra trang có dính Cloudflare challenge trong body không
    if (
      html.includes('cf-browser-verification') ||
      html.includes('challenge-platform') ||
      html.includes('Attention Required! | Cloudflare') ||
      (html.includes('Just a moment...') && html.includes('Cloudflare'))
    ) {
      const err: HakoScraperError = {
        code: 'HAKO_BOT_CHALLENGE',
        message: 'Hako đang kích hoạt cơ chế bảo vệ chống bot (Cloudflare). Vui lòng thử lại sau ít phút.',
        retryAfterSeconds: 90,
      };
      throw err;
    }

    return html;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.code && err.message) {
      throw err;
    }
    if (err.name === 'AbortError') {
      const timeoutErr: HakoScraperError = {
        code: 'HAKO_NETWORK_ERROR',
        message: 'Thời gian kết nối đến Hako quá hạn (timeout sau 12 giây). Vui lòng kiểm tra lại mạng và thử lại.',
      };
      throw timeoutErr;
    }
    const networkErr: HakoScraperError = {
      code: 'HAKO_NETWORK_ERROR',
      message: `Không thể kết nối đến Hako: ${err.message || 'Lỗi mạng'}`,
    };
    throw networkErr;
  }
}

/**
 * Trích xuất metadata bộ truyện và mục lục từ HTML
 */
export function parseNovelHtml(html: string, originalUrl: string): ParsedHakoNovelMeta {
  // 1. Tiêu đề truyện
  let title = '';
  const titleMatch = html.match(/<span class="series-name">\s*<a[^>]*>(.*?)<\/a>/i) ||
                     html.match(/<span class="series-name"[^>]*>(.*?)<\/span>/i) ||
                     html.match(/<meta property="og:title" content="(.*?)"/i);
  if (titleMatch) {
    title = decodeHtmlEntities(stripHtmlTags(titleMatch[1])).trim();
  }

  // 2. Tác giả
  let author = 'Chưa rõ';
  const authorMatch = html.match(/<span class="info-name">Tác giả:<\/span>[\s\S]*?<span class="info-value">[\s\S]*?<a[^>]*>(.*?)<\/a>/i) ||
                      html.match(/Tác giả:[\s\S]*?<a[^>]*>(.*?)<\/a>/i);
  if (authorMatch) {
    author = decodeHtmlEntities(stripHtmlTags(authorMatch[1])).trim();
  }

  // 3. Họa sĩ
  let artist = 'Chưa rõ';
  const artistMatch = html.match(/<span class="info-name">Họa sĩ:<\/span>[\s\S]*?<span class="info-value">[\s\S]*?<a[^>]*>(.*?)<\/a>/i) ||
                      html.match(/Họa sĩ:[\s\S]*?<a[^>]*>(.*?)<\/a>/i);
  if (artistMatch) {
    artist = decodeHtmlEntities(stripHtmlTags(artistMatch[1])).trim();
  }

  // 4. Tóm tắt
  let description = '';
  const summaryMatch = html.match(/<div class="summary-content"[^>]*>([\s\S]*?)<\/div>/i) ||
                       html.match(/<meta property="og:description" content="(.*?)"/i);
  if (summaryMatch) {
    description = decodeHtmlEntities(stripHtmlTags(summaryMatch[1])).trim();
  }

  // 5. Ảnh bìa
  let coverUrl = '';
  const coverMatch = html.match(/style="background-image:\s*url\('?([^'"]+)'?\)"/i) ||
                     html.match(/<meta property="og:image" content="(.*?)"/i);
  if (coverMatch) {
    coverUrl = coverMatch[1].trim();
  }

  // 6. Danh mục tập & chương
  const volumes: ParsedHakoVolume[] = [];
  const baseDomainMatch = originalUrl.match(/^(https?:\/\/[^\/]+)/i);
  const baseDomain = baseDomainMatch ? baseDomainMatch[1] : 'https://ln.hako.vn';

  // Tách từng section volume
  const volumeSections = html.match(/<section class="volume-list[^"]*"[\s\S]*?<\/section>/gi) ||
                         html.match(/<section class="volume-list[\s\S]*?<\/section>/gi) ||
                         [];

  let totalChapterIndex = 1;

  for (const volSec of volumeSections) {
    let volumeTitle = 'Tập truyện';
    const volTitleMatch = volSec.match(/<span class="sect-title">([\s\S]*?)<\/span>/i) ||
                          volSec.match(/<header class="sect-header">[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i);
    if (volTitleMatch) {
      volumeTitle = decodeHtmlEntities(stripHtmlTags(volTitleMatch[1])).trim();
    }

    const chapters: ParsedHakoChapter[] = [];
    const chapterMatches = volSec.matchAll(/<div class="chapter-name">[\s\S]*?<a href="([^"]+)"[^>]*title="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi);

    for (const match of chapterMatches) {
      let href = match[1].trim();
      if (!href.startsWith('http')) {
        href = `${baseDomain}${href.startsWith('/') ? '' : '/'}${href}`;
      }
      const rawTitle = match[3] || match[2] || 'Chương không tên';
      const cleanChapterTitle = decodeHtmlEntities(stripHtmlTags(rawTitle)).trim();

      chapters.push({
        url: href,
        title: cleanChapterTitle,
        order: totalChapterIndex++,
      });
    }

    // Fallback regex nếu class format khác
    if (chapters.length === 0) {
      const fallbackMatches = volSec.matchAll(/<li[^>]*>[\s\S]*?<a href="([^"]*\/c\d+[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi);
      for (const fMatch of fallbackMatches) {
        let href = fMatch[1].trim();
        if (!href.startsWith('http')) {
          href = `${baseDomain}${href.startsWith('/') ? '' : '/'}${href}`;
        }
        const cleanChapterTitle = decodeHtmlEntities(stripHtmlTags(fMatch[2])).trim();
        chapters.push({
          url: href,
          title: cleanChapterTitle,
          order: totalChapterIndex++,
        });
      }
    }

    if (chapters.length > 0) {
      volumes.push({
        volumeTitle,
        chapters,
      });
    }
  }

  // Fallback nếu không chia theo section volume mà toàn bộ chương nằm trong 1 list
  if (volumes.length === 0) {
    const allChapters: ParsedHakoChapter[] = [];
    const allChapterMatches = html.matchAll(/<a href="([^"]*\/c\d+[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi);
    for (const match of allChapterMatches) {
      let href = match[1].trim();
      if (!href.startsWith('http')) {
        href = `${baseDomain}${href.startsWith('/') ? '' : '/'}${href}`;
      }
      const cleanTitle = decodeHtmlEntities(stripHtmlTags(match[2])).trim();
      if (cleanTitle && !allChapters.some((c) => c.url === href)) {
        allChapters.push({
          url: href,
          title: cleanTitle,
          order: totalChapterIndex++,
        });
      }
    }

    if (allChapters.length > 0) {
      volumes.push({
        volumeTitle: 'Toàn bộ chương',
        chapters: allChapters,
      });
    }
  }

  if (!title && volumes.length === 0) {
    const err: HakoScraperError = {
      code: 'HAKO_PARSE_ERROR',
      message: 'Không thể trích xuất thông tin mục lục truyện từ trang này. Vui lòng kiểm tra lại đường dẫn truyện.',
    };
    throw err;
  }

  return {
    url: originalUrl,
    title: title || 'Bộ truyện chưa đặt tên',
    author,
    artist,
    description,
    coverUrl,
    volumes,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Trích xuất nội dung văn bản một chương từ HTML
 */
export function parseChapterHtml(html: string, originalUrl: string): ParsedHakoChapterContent {
  // 1. Tiêu đề chương
  let title = 'Chương truyện';
  const titleMatch = html.match(/<h2 class="title-item[^"]*"[^>]*>([\s\S]*?)<\/h2>/i) ||
                     html.match(/<h1 class="title-item[^"]*"[^>]*>([\s\S]*?)<\/h1>/i) ||
                     html.match(/<meta property="og:title" content="(.*?)"/i);
  if (titleMatch) {
    title = decodeHtmlEntities(stripHtmlTags(titleMatch[1])).trim();
  }

  // 2. Tên tập
  let volumeTitle = '';
  const volMatch = html.match(/<h4 class="sub-title[^"]*"[^>]*>([\s\S]*?)<\/h4>/i) ||
                   html.match(/<h5 class="sub-title[^"]*"[^>]*>([\s\S]*?)<\/h5>/i);
  if (volMatch) {
    volumeTitle = decodeHtmlEntities(stripHtmlTags(volMatch[1])).trim();
  }

  // 3. Nội dung văn bản
  let rawContent = '';
  const contentMatch = html.match(/<div id="chapter-content"[^>]*>([\s\S]*?)<\/div>\s*<div class="note-reg"/i) ||
                       html.match(/<div id="chapter-content"[^>]*>([\s\S]*?)<\/div>/i) ||
                       html.match(/<div class="reading-content"[^>]*>([\s\S]*?)<\/div>/i);
  if (contentMatch) {
    rawContent = contentMatch[1];
  }

  const cleanContent = decodeHtmlEntities(stripHtmlTags(rawContent)).trim();

  if (!cleanContent) {
    const err: HakoScraperError = {
      code: 'HAKO_PARSE_ERROR',
      message: 'Không tìm thấy nội dung văn bản của chương này hoặc chương chỉ chứa ảnh minh họa.',
    };
    throw err;
  }

  // Tính số lượng từ
  const wordCount = cleanContent.split(/\s+/).filter(Boolean).length;

  return {
    url: originalUrl,
    title,
    volumeTitle,
    content: cleanContent,
    wordCount,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Service API: Fetch & Parse Novel Metadata
 */
export async function fetchNovelMeta(url: string): Promise<ParsedHakoNovelMeta> {
  const cleanUrl = url?.trim();
  if (!isValidHakoNovelUrl(cleanUrl)) {
    const err: HakoScraperError = {
      code: 'INVALID_HAKO_URL',
      message: 'URL truyện không hợp lệ. Vui lòng nhập liên kết hợp lệ từ ln.hako.vn hoặc docln.net (ví dụ: https://ln.hako.vn/truyen/1234-ten-truyen).',
    };
    throw err;
  }

  const html = await fetchHakoHtml(cleanUrl);
  return parseNovelHtml(html, cleanUrl);
}

/**
 * Service API: Fetch & Parse Chapter Content
 */
export async function fetchChapterContent(url: string): Promise<ParsedHakoChapterContent> {
  const cleanUrl = url?.trim();
  if (!isValidHakoChapterUrl(cleanUrl)) {
    const err: HakoScraperError = {
      code: 'INVALID_HAKO_URL',
      message: 'URL chương không hợp lệ. Vui lòng nhập liên kết chương hợp lệ từ ln.hako.vn hoặc docln.net (ví dụ: https://ln.hako.vn/truyen/1234-ten-truyen/c12345-ten-chuong).',
    };
    throw err;
  }

  const html = await fetchHakoHtml(cleanUrl);
  return parseChapterHtml(html, cleanUrl);
}
