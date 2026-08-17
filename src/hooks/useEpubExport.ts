import { useState } from 'react';
import JSZip from 'jszip';
import { StoryProject, Chapter } from '../types';
import { getChapterFromDB } from '../services/db';
import { triggerDownload } from '../utils/download';
import { useNotifications } from '../components/NotificationSystem';

export function useEpubExport() {
  const { showToast } = useNotifications();
  const [isExportingEpub, setIsExportingEpub] = useState<string | null>(null);

  const handleExportEpub = async (proj: StoryProject) => {
    setIsExportingEpub(proj.id);
    try {
      const fullChapters: Chapter[] = [];
      if (proj.chapters && Array.isArray(proj.chapters)) {
        for (const meta of proj.chapters) {
          const chap = await getChapterFromDB(meta.id);
          if (chap) {
            fullChapters.push(chap);
          }
        }
      }

      if (fullChapters.length === 0) {
        showToast({ message: "Không có chương truyện nào để xuất bản EPUB.", type: "warning" });
        setIsExportingEpub(null);
        return;
      }

      const sortedChapters = [...fullChapters].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      const zip = new JSZip();

      zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

      zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

      zip.file('OEBPS/style.css', `body {
  font-family: "Georgia", "Times New Roman", serif;
  margin: 10%;
  line-height: 1.6;
  font-size: 1.1em;
  color: #111111;
  background-color: #fcfcfc;
}
h1 {
  text-align: center;
  font-size: 1.6em;
  margin-bottom: 1.5em;
  color: #0b1a30;
  border-bottom: 1px solid #eaeaea;
  padding-bottom: 0.5em;
}
p {
  text-indent: 1.5em;
  margin-top: 0;
  margin-bottom: 0.8em;
  text-align: justify;
}
.author {
  text-align: center;
  font-style: italic;
  margin-bottom: 2em;
}
.description {
  margin: 2em 10%;
  padding: 1em;
  border-left: 3px solid #ccc;
  background-color: #f5f5f5;
  font-size: 0.95em;
  line-height: 1.5;
}
`);

      const spineItems: string[] = [];
      const manifestItems: string[] = [];
      const navLinks: string[] = [];
      const ncxPoints: string[] = [];

      const coverHtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${proj.title}</title>
  <link rel="stylesheet" href="style.css" type="text/css"/>
</head>
<body>
  <div style="text-align: center; margin-top: 25%;">
    <h1 style="border: none; margin-bottom: 0.2em; font-size: 2.2em;">${proj.title}</h1>
    <p class="author" style="font-size: 1.2em; margin-top: 0.5em;">Tác giả: ${proj.author || "Khuyết Danh"}</p>
    <div style="margin-top: 10%; font-size: 0.9em; color: #555;">
      <p style="text-align: center; text-indent: 0;">Thể loại: ${proj.genre || "Chưa phân loại"}</p>
      <p style="text-align: center; text-indent: 0;">Tông giọng dịch: ${proj.tone || "Chuẩn"}</p>
    </div>
    ${proj.description ? `
    <div class="description">
      <h3 style="margin-top:0; font-size: 1.1em; color: #333;">Giới thiệu tác phẩm:</h3>
      <p style="text-indent: 0; text-align: left;">${proj.description.replace(/\n+/g, '<br/>')}</p>
    </div>` : ''}
  </div>
</body>
</html>`;
      zip.file('OEBPS/cover.xhtml', coverHtml);
      manifestItems.push(`<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>`);
      spineItems.push(`<itemref idref="cover"/>`);
      navLinks.push(`<li><a href="cover.xhtml">Giới thiệu tác phẩm</a></li>`);
      ncxPoints.push(`<navPoint id="navPoint-cover" playOrder="1">
        <navLabel><text>Giới thiệu tác phẩm</text></navLabel>
        <content src="cover.xhtml"/>
      </navPoint>`);

      sortedChapters.forEach((chap, idx) => {
        const chapId = `chap_${idx + 1}`;
        const filename = `${chapId}.xhtml`;
        
        const textContent = chap.polishedTranslation || chap.rawTranslation || "Chưa dịch";
        const paragraphs = textContent.split(/\r?\n/).map(p => p.trim()).filter(p => p.length > 0);
        const pTags = paragraphs.map(p => `<p>${p}</p>`).join('\n  ');

        const chapHtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${chap.title}</title>
  <link rel="stylesheet" href="style.css" type="text/css"/>
</head>
<body>
  <h1>${chap.title}</h1>
  ${pTags}
</body>
</html>`;

        zip.file(`OEBPS/${filename}`, chapHtml);
        manifestItems.push(`<item id="${chapId}" href="${filename}" media-type="application/xhtml+xml"/>`);
        spineItems.push(`<itemref idref="${chapId}"/>`);
        navLinks.push(`<li><a href="${filename}">${chap.title}</a></li>`);
        ncxPoints.push(`<navPoint id="navPoint-${chapId}" playOrder="${idx + 2}">
          <navLabel><text>${chap.title}</text></navLabel>
          <content src="${filename}"/>
        </navPoint>`);
      });

      const navHtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Mục lục</title>
  <link rel="stylesheet" href="style.css" type="text/css"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Mục lục sách</h1>
    <ol>
      ${navLinks.join('\n      ')}
    </ol>
  </nav>
</body>
</html>`;
      zip.file('OEBPS/nav.xhtml', navHtml);
      manifestItems.push(`<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`);

      const ncxXml = `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${proj.id}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>${proj.title}</text>
  </docTitle>
  <navMap>
    ${ncxPoints.join('\n    ')}
  </navMap>
</ncx>`;
      zip.file('OEBPS/toc.ncx', ncxXml);
      manifestItems.push(`<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`);

      const opfXml = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${proj.title}</dc:title>
    <dc:creator>${proj.author || "Khuyết Danh"}</dc:creator>
    <dc:identifier id="bookid">urn:uuid:${proj.id}</dc:identifier>
    <dc:language>vi</dc:language>
    <dc:date>${new Date().toISOString()}</dc:date>
    <dc:description>${proj.description || ""}</dc:description>
  </metadata>
  <manifest>
    <item id="style" href="style.css" media-type="text/css"/>
    ${manifestItems.join('\n    ')}
  </manifest>
  <spine toc="ncx">
    ${spineItems.join('\n    ')}
  </spine>
</package>`;
      zip.file('OEBPS/content.opf', opfXml);

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      triggerDownload(url, `${proj.title.replace(/[\s\/:*?"<>|]+/g, '_')}.epub`);
      URL.revokeObjectURL(url);
      showToast({ message: "Xuất bản và đóng gói EPUB thành công!", type: "success" });
    } catch (err: any) {
      console.error(err);
      showToast({ message: "Lỗi đóng gói EPUB: " + err.message, type: "error" });
    } finally {
      setIsExportingEpub(null);
    }
  };

  return {
    isExportingEpub,
    handleExportEpub,
  };
}
