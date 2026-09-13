import { describe, it, expect, vi, beforeEach } from 'vitest';
import { escapeHtml } from '../../lib/text';

describe('useEpubExport & XML Well-Formedness Suite', () => {
  it('escapes special characters so XHTML documents remain strictly well-formed', () => {
    const rawTitle = 'Đấu Phá & Thương Khung <Phần 1>';
    const rawAuthor = 'Thiên Tằm & Thổ Đậu <Author>';
    const rawGenre = 'Tiên Hiệp & Huyền Huyễn <Chính Thống>';
    const rawTone = 'Hào sảng & "Trang nghiêm"';
    const rawDescription = 'Giới thiệu: <Nhân vật A> & "Nhân vật B"\nDòng 2: test & <br>';
    const rawChapterTitle = 'Chương 1: Khởi đầu <Mới> & "Bí ẩn"';
    const rawParagraph = 'Hắn nói: "Ngươi dám cản ta sao? <Kiếm quang> lóe lên & chém xuống!"';

    // 1. Cover XHTML generation simulation
    const escapedTitle = escapeHtml(rawTitle);
    const escapedAuthor = escapeHtml(rawAuthor);
    const escapedGenre = escapeHtml(rawGenre);
    const escapedTone = escapeHtml(rawTone);
    const escapedDescription = escapeHtml(rawDescription).replace(/\n+/g, '<br/>');

    const coverHtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${escapedTitle}</title>
</head>
<body>
  <h1>${escapedTitle}</h1>
  <p>Tác giả: ${escapedAuthor}</p>
  <p>Thể loại: ${escapedGenre}</p>
  <p>Tông giọng dịch: ${escapedTone}</p>
  <div class="description">
    <p>${escapedDescription}</p>
  </div>
</body>
</html>`;

    // Assert that raw unescaped delimiters are not in text nodes
    expect(coverHtml).not.toContain('<Phần 1>');
    expect(coverHtml).not.toContain('& Thương Khung');
    expect(coverHtml).toContain('&amp; Thương Khung');
    expect(coverHtml).toContain('&lt;Phần 1&gt;');
    expect(coverHtml).toContain('&lt;Nhân vật A&gt; &amp; &quot;Nhân vật B&quot;');
    // Verify <br/> was NOT double escaped into &lt;br/&gt;
    expect(coverHtml).toContain('<br/>');
    expect(coverHtml).not.toContain('&lt;br/&gt;');

    // 2. Chapter XHTML generation simulation
    const escapedChapTitle = escapeHtml(rawChapterTitle);
    const escapedP = escapeHtml(rawParagraph);
    const chapHtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${escapedChapTitle}</title>
</head>
<body>
  <h1>${escapedChapTitle}</h1>
  <p>${escapedP}</p>
</body>
</html>`;

    expect(chapHtml).not.toContain('<Mới>');
    expect(chapHtml).not.toContain('<Kiếm quang>');
    expect(chapHtml).toContain('&lt;Mới&gt; &amp; &quot;Bí ẩn&quot;');
    expect(chapHtml).toContain('&lt;Kiếm quang&gt; lóe lên &amp; chém xuống!');

    // 3. OPF Package XML simulation
    const opfXml = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${escapedTitle}</dc:title>
    <dc:creator>${escapedAuthor}</dc:creator>
    <dc:description>${escapeHtml(rawDescription)}</dc:description>
  </metadata>
</package>`;

    expect(opfXml).not.toContain('<Phần 1>');
    expect(opfXml).toContain('&lt;Phần 1&gt;');
    expect(opfXml).toContain('&amp; Thương Khung');
  });
});
