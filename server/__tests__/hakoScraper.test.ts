import { describe, it, expect } from 'vitest';
import {
  isValidHakoNovelUrl,
  isValidHakoChapterUrl,
  decodeHtmlEntities,
  stripHtmlTags,
  parseNovelHtml,
  parseChapterHtml,
} from '../services/hakoScraperService';

describe('hakoScraperService Unit Tests', () => {
  describe('URL validation', () => {
    it('validates Hako/Docln novel URLs correctly', () => {
      expect(isValidHakoNovelUrl('https://ln.hako.vn/truyen/1234-dau-pha-thuong-khung')).toBe(true);
      expect(isValidHakoNovelUrl('https://docln.net/truyen/5678-pham-nhan-tu-tien')).toBe(true);
      expect(isValidHakoNovelUrl('http://hako.vn/truyen/999-kiem-hiep')).toBe(true);
      expect(isValidHakoNovelUrl('https://google.com')).toBe(false);
      expect(isValidHakoNovelUrl('https://ln.hako.vn/thanh-vien/123')).toBe(false);
      expect(isValidHakoNovelUrl('')).toBe(false);
    });

    it('validates Hako chapter URLs correctly', () => {
      expect(isValidHakoChapterUrl('https://ln.hako.vn/truyen/1234-ten-truyen/c12345-chuong-1')).toBe(true);
      expect(isValidHakoChapterUrl('https://docln.net/truyen/1234-ten-truyen/c999-mo-man')).toBe(true);
      expect(isValidHakoChapterUrl('https://ln.hako.vn/truyen/1234-ten-truyen')).toBe(false);
      expect(isValidHakoChapterUrl('')).toBe(false);
    });
  });

  describe('HTML entities & Tag stripping', () => {
    it('decodes HTML entities properly', () => {
      const encoded = 'Ti&ecirc;u Vi&ecirc;m &amp; Hu&acirc;n Nhi &quot;Thi&ecirc;n T&agrave;i&quot; &#39;test&#39;';
      const decoded = decodeHtmlEntities(encoded);
      expect(decoded).toContain('Tiêu Viêm');
      expect(decoded).toContain('&');
      expect(decoded).toContain('"Thiên Tài"');
      expect(decoded).toContain("'test'");
    });

    it('strips HTML tags and preserves line breaks', () => {
      const html = '<p>Đoạn 1<br/>Dòng 2</p><p>Đoạn 2</p><script>alert(1)</script>';
      const stripped = stripHtmlTags(html);
      expect(stripped).toContain('Đoạn 1\nDòng 2');
      expect(stripped).toContain('Đoạn 2');
      expect(stripped).not.toContain('<p>');
      expect(stripped).not.toContain('alert');
    });
  });

  describe('parseNovelHtml', () => {
    it('extracts novel metadata and volume/chapter list from sample HTML', () => {
      const sampleHtml = `
        <html>
          <head>
            <meta property="og:title" content="Đấu Phá Thương Khung - Hako" />
          </head>
          <body>
            <span class="series-name"><a href="/truyen/123-dau-pha">Đấu Phá Thương Khung</a></span>
            <span class="info-name">Tác giả:</span> <span class="info-value"><a href="#">Thiên Tằm Thổ Đậu</a></span>
            <span class="info-name">Họa sĩ:</span> <span class="info-value"><a href="#">Đang cập nhật</a></span>
            <div class="summary-content">
              <p>Đây là câu chuyện về Tiêu Viêm trên con đường trở thành Đấu Khí đỉnh phong.</p>
            </div>
            <div class="series-cover">
              <div class="a6-ratio">
                <div class="content img-in-ratio" style="background-image: url('https://i.docln.net/cover.jpg')"></div>
              </div>
            </div>
            <section class="volume-list">
              <span class="sect-title">Tập 01 - Ô Thản Thành</span>
              <div class="chapter-name">
                <a href="/truyen/123-dau-pha/c1001-chuong-1" title="Chương 01: Thiên tài biến phế vật">Chương 01: Thiên tài biến phế vật</a>
              </div>
              <div class="chapter-name">
                <a href="/truyen/123-dau-pha/c1002-chuong-2" title="Chương 02: Đấu Khí Các">Chương 02: Đấu Khí Các</a>
              </div>
            </section>
            <section class="volume-list">
              <span class="sect-title">Tập 02 - Ma Thú Sơn Mạch</span>
              <div class="chapter-name">
                <a href="/truyen/123-dau-pha/c1003-chuong-3" title="Chương 03: Dược Lão xuất hiện">Chương 03: Dược Lão xuất hiện</a>
              </div>
            </section>
          </body>
        </html>
      `;

      const result = parseNovelHtml(sampleHtml, 'https://ln.hako.vn/truyen/123-dau-pha');
      expect(result.title).toBe('Đấu Phá Thương Khung');
      expect(result.author).toBe('Thiên Tằm Thổ Đậu');
      expect(result.artist).toBe('Đang cập nhật');
      expect(result.coverUrl).toBe('https://i.docln.net/cover.jpg');
      expect(result.description).toContain('Đây là câu chuyện về Tiêu Viêm');
      expect(result.volumes.length).toBe(2);
      expect(result.volumes[0].volumeTitle).toBe('Tập 01 - Ô Thản Thành');
      expect(result.volumes[0].chapters.length).toBe(2);
      expect(result.volumes[0].chapters[0].title).toBe('Chương 01: Thiên tài biến phế vật');
      expect(result.volumes[0].chapters[0].url).toBe('https://ln.hako.vn/truyen/123-dau-pha/c1001-chuong-1');
      expect(result.volumes[1].chapters[0].title).toBe('Chương 03: Dược Lão xuất hiện');
    });
  });

  describe('parseChapterHtml', () => {
    it('extracts chapter title and content from sample HTML', () => {
      const sampleHtml = `
        <html>
          <body>
            <h4 class="sub-title">Tập 01 - Ô Thản Thành</h4>
            <h2 class="title-item">Chương 01: Thiên tài biến phế vật</h2>
            <div id="chapter-content">
              <p>Đấu Khí đại lục, lấy đấu khí làm tôn.</p>
              <p>Tiêu gia tại Ô Thản Thành là một trong tam đại gia tộc.</p>
              <p>Tiêu Viêm đứng trước bia đá trắc nghiệm, bàn tay nắm chặt.</p>
            </div>
          </body>
        </html>
      `;

      const result = parseChapterHtml(sampleHtml, 'https://ln.hako.vn/truyen/123/c1001');
      expect(result.title).toBe('Chương 01: Thiên tài biến phế vật');
      expect(result.volumeTitle).toBe('Tập 01 - Ô Thản Thành');
      expect(result.content).toContain('Đấu Khí đại lục, lấy đấu khí làm tôn.');
      expect(result.content).toContain('Tiêu Viêm đứng trước bia đá trắc nghiệm');
      expect(result.wordCount).toBeGreaterThan(15);
    });
  });
});
