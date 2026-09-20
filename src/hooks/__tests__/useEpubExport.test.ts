import { describe, it, expect, vi, beforeEach } from 'vitest';
import JSZip from 'jszip';
import { useEpubExport, loadChaptersBatch } from '../useEpubExport';
import { escapeHtml } from '../../lib/text';
import type { StoryProject, Chapter } from '../../types';
import * as db from '../../services/db';
import * as downloadUtils from '../../utils/download';

const mockShowToast = vi.fn();

vi.mock('../../context/NotificationContext', () => ({
  useNotifications: () => ({
    showToast: mockShowToast,
    showConfirm: vi.fn(),
  }),
}));

vi.mock('../../services/db', () => ({
  getChapterFromDB: vi.fn(),
}));

vi.mock('../../utils/download', () => ({
  triggerDownload: vi.fn(),
}));

let stateSlots: any[] = [];
let stateIndex = 0;

vi.mock('react', () => ({
  useState: (initial: any) => {
    const idx = stateIndex++;
    if (stateSlots.length <= idx) {
      stateSlots[idx] = typeof initial === 'function' ? initial() : initial;
    }
    const setState = (val: any) => {
      stateSlots[idx] = typeof val === 'function' ? val(stateSlots[idx]) : val;
    };
    return [stateSlots[idx], setState];
  },
}));

function renderEpubHook() {
  stateIndex = 0;
  return useEpubExport();
}

describe('useEpubExport & XML Well-Formedness Suite', () => {
  let capturedBlobs: Blob[] = [];

  beforeEach(() => {
    stateSlots = [];
    stateIndex = 0;
    capturedBlobs = [];
    vi.clearAllMocks();

    if (typeof globalThis.URL.createObjectURL !== 'function') {
      globalThis.URL.createObjectURL = vi.fn((blob: any) => {
        capturedBlobs.push(blob);
        return `blob:mock-url-${capturedBlobs.length}`;
      });
    } else {
      vi.spyOn(globalThis.URL, 'createObjectURL').mockImplementation((blob: any) => {
        capturedBlobs.push(blob);
        return `blob:mock-url-${capturedBlobs.length}`;
      });
    }

    if (typeof globalThis.URL.revokeObjectURL !== 'function') {
      globalThis.URL.revokeObjectURL = vi.fn();
    } else {
      vi.spyOn(globalThis.URL, 'revokeObjectURL').mockImplementation(() => {});
    }
  });

  describe('XML Well-Formedness & Escaping', () => {
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

  describe('loadChaptersBatch', () => {
    it('loads chapters in batches according to concurrency limit', async () => {
      const mockDbChapters: Record<string, Chapter> = {
        'c-1': {
          id: 'c-1',
          projectId: 'p-1',
          title: 'Ch 1',
          sourceText: 'source 1',
          rawTranslation: 'raw 1',
          polishedTranslation: 'polished 1',
          paragraphs: ['source 1'],
          translatedLines: ['polished 1'],
          status: 'completed',
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
        'c-2': {
          id: 'c-2',
          projectId: 'p-1',
          title: 'Ch 2',
          sourceText: 'source 2',
          rawTranslation: 'raw 2',
          polishedTranslation: 'polished 2',
          paragraphs: ['source 2'],
          translatedLines: ['polished 2'],
          status: 'completed',
          createdAt: '2026-01-02',
          updatedAt: '2026-01-02',
        },
        'c-3': {
          id: 'c-3',
          projectId: 'p-1',
          title: 'Ch 3',
          sourceText: 'source 3',
          rawTranslation: 'raw 3',
          polishedTranslation: 'polished 3',
          paragraphs: ['source 3'],
          translatedLines: ['polished 3'],
          status: 'completed',
          createdAt: '2026-01-03',
          updatedAt: '2026-01-03',
        },
      };

      vi.spyOn(db, 'getChapterFromDB').mockImplementation(async (id: string) => mockDbChapters[id] || null);

      const result = await loadChaptersBatch(['c-1', 'c-2', 'c-3'], 2);
      expect(result).toHaveLength(3);
      expect(result.map(c => c.id)).toEqual(['c-1', 'c-2', 'c-3']);
      expect(db.getChapterFromDB).toHaveBeenCalledTimes(3);
    });

    it('filters out null/missing chapters gracefully', async () => {
      vi.spyOn(db, 'getChapterFromDB').mockImplementation(async (id: string) => {
        if (id === 'missing-c') return null;
        return {
          id,
          projectId: 'p-1',
          title: `Ch ${id}`,
          sourceText: 'text',
          rawTranslation: 'raw',
          polishedTranslation: 'polished',
          paragraphs: ['text'],
          translatedLines: ['polished'],
          status: 'completed',
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        };
      });

      const result = await loadChaptersBatch(['c-1', 'missing-c', 'c-2'], 8);
      expect(result).toHaveLength(2);
      expect(result.map(c => c.id)).toEqual(['c-1', 'c-2']);
    });
  });

  describe('handleExportEpub Integration', () => {
    it('shows a warning toast and aborts if the project has no chapters', async () => {
      const hook = renderEpubHook();
      const emptyProject: StoryProject = {
        id: 'proj-empty',
        title: 'Empty Novel',
        author: 'Anonymous',
        genre: 'Tiên Hiệp',
        tone: 'Chuẩn',
        description: '',
        glossary: [],
        pendingGlossary: [],
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        chapters: [],
      };

      await hook.handleExportEpub(emptyProject);

      expect(mockShowToast).toHaveBeenCalledWith({
        message: 'Không có chương truyện nào để xuất bản EPUB.',
        type: 'warning',
      });
      expect(downloadUtils.triggerDownload).not.toHaveBeenCalled();
    });

    it('generates a valid EPUB ZIP structure and triggers download', async () => {
      const hook = renderEpubHook();

      const sampleChapters: Chapter[] = [
        {
          id: 'chap-1',
          projectId: 'proj-101',
          title: 'Chương 1: Mở Đầu & Hỗn Loạn',
          sourceText: 'Nội dung tiếng Trung',
          rawTranslation: 'Bản dịch thô 1',
          polishedTranslation: 'Đoạn 1: Thiên địa sơ khai.\nĐoạn 2: Nhân gian vô đạo.',
          paragraphs: ['Nội dung tiếng Trung'],
          translatedLines: ['Bản dịch thô 1'],
          status: 'completed',
          createdAt: '2026-01-01T10:00:00Z',
          updatedAt: '2026-01-01T10:00:00Z',
        },
        {
          id: 'chap-2',
          projectId: 'proj-101',
          title: 'Chương 2: Quyết Chiến <Đỉnh Núi>',
          sourceText: 'Nội dung tiếng Trung 2',
          rawTranslation: 'Đoạn 1: Gió gầm gào & mây đen kéo đến.',
          polishedTranslation: '',
          paragraphs: ['Nội dung tiếng Trung 2'],
          translatedLines: ['Đoạn 1: Gió gầm gào & mây đen kéo đến.'],
          status: 'completed',
          createdAt: '2026-01-02T10:00:00Z',
          updatedAt: '2026-01-02T10:00:00Z',
        },
      ];

      vi.spyOn(db, 'getChapterFromDB').mockImplementation(async (id: string) => {
        return sampleChapters.find(c => c.id === id) || null;
      });

      const project: StoryProject = {
        id: 'proj-101',
        title: 'Tiên Nghịch <Bản Dịch>',
        author: 'Nhĩ Căn & Dịch Giả',
        genre: 'Tiên Hiệp',
        tone: 'Trang trọng',
        description: 'Câu chuyện tu tiên nghịch mệnh.\nKhắc họa bi tráng.',
        glossary: [],
        pendingGlossary: [],
        createdAt: '2026-01-01',
        updatedAt: '2026-01-02',
        chapters: [
          { id: 'chap-1', title: 'Chương 1: Mở Đầu & Hỗn Loạn', status: 'completed', createdAt: '2026-01-01T10:00:00Z', updatedAt: '2026-01-01T10:00:00Z' },
          { id: 'chap-2', title: 'Chương 2: Quyết Chiến <Đỉnh Núi>', status: 'completed', createdAt: '2026-01-02T10:00:00Z', updatedAt: '2026-01-02T10:00:00Z' },
        ],
      };

      await hook.handleExportEpub(project);

      // Verify download trigger
      expect(downloadUtils.triggerDownload).toHaveBeenCalledTimes(1);
      const [downloadUrl, filename] = vi.mocked(downloadUtils.triggerDownload).mock.calls[0];
      expect(downloadUrl).toMatch(/^blob:mock-url/);
      expect(filename).toBe('Tiên_Nghịch_Bản_Dịch_.epub');

      // Verify success notification
      expect(mockShowToast).toHaveBeenCalledWith({
        message: 'Xuất bản và đóng gói EPUB thành công!',
        type: 'success',
      });

      // Verify the generated ZIP package structure
      expect(capturedBlobs.length).toBe(1);
      const generatedBlob = capturedBlobs[0];
      const arrayBuffer = await generatedBlob.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);

      // 1. mimetype check
      const mimetypeFile = zip.file('mimetype');
      expect(mimetypeFile).not.toBeNull();
      const mimetypeText = await mimetypeFile!.async('string');
      expect(mimetypeText.trim()).toBe('application/epub+zip');

      // 2. META-INF/container.xml check
      const containerFile = zip.file('META-INF/container.xml');
      expect(containerFile).not.toBeNull();
      const containerXml = await containerFile!.async('string');
      expect(containerXml).toContain('full-path="OEBPS/content.opf"');
      expect(containerXml).toContain('media-type="application/oebps-package+xml"');

      // 3. OEBPS/style.css check
      const styleFile = zip.file('OEBPS/style.css');
      expect(styleFile).not.toBeNull();
      const styleCss = await styleFile!.async('string');
      expect(styleCss).toContain('font-family:');

      // 4. OEBPS/cover.xhtml check
      const coverFile = zip.file('OEBPS/cover.xhtml');
      expect(coverFile).not.toBeNull();
      const coverHtml = await coverFile!.async('string');
      expect(coverHtml).toContain('&lt;Bản Dịch&gt;');
      expect(coverHtml).toContain('Nhĩ Căn &amp; Dịch Giả');
      expect(coverHtml).toContain('Tiên Hiệp');
      expect(coverHtml).toContain('Trang trọng');
      expect(coverHtml).toContain('<br/>Khắc họa bi tráng.');

      // 5. OEBPS/content.opf check
      const opfFile = zip.file('OEBPS/content.opf');
      expect(opfFile).not.toBeNull();
      const opfXml = await opfFile!.async('string');
      expect(opfXml).toContain('<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">');
      expect(opfXml).toContain('<dc:title>Tiên Nghịch &lt;Bản Dịch&gt;</dc:title>');
      expect(opfXml).toContain('<dc:creator>Nhĩ Căn &amp; Dịch Giả</dc:creator>');
      expect(opfXml).toContain('<dc:identifier id="bookid">urn:uuid:proj-101</dc:identifier>');
      expect(opfXml).toContain('<dc:language>vi</dc:language>');
      expect(opfXml).toContain('<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>');
      expect(opfXml).toContain('<item id="chap_1" href="chap_1.xhtml" media-type="application/xhtml+xml"/>');
      expect(opfXml).toContain('<item id="chap_2" href="chap_2.xhtml" media-type="application/xhtml+xml"/>');
      expect(opfXml).toContain('<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>');
      expect(opfXml).toContain('<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>');

      // 6. OEBPS/nav.xhtml check
      const navFile = zip.file('OEBPS/nav.xhtml');
      expect(navFile).not.toBeNull();
      const navHtml = await navFile!.async('string');
      expect(navHtml).toContain('<nav epub:type="toc" id="toc">');
      expect(navHtml).toContain('<a href="cover.xhtml">Giới thiệu tác phẩm</a>');
      expect(navHtml).toContain('<a href="chap_1.xhtml">Chương 1: Mở Đầu &amp; Hỗn Loạn</a>');
      expect(navHtml).toContain('<a href="chap_2.xhtml">Chương 2: Quyết Chiến &lt;Đỉnh Núi&gt;</a>');

      // 7. OEBPS/toc.ncx check
      const ncxFile = zip.file('OEBPS/toc.ncx');
      expect(ncxFile).not.toBeNull();
      const ncxXml = await ncxFile!.async('string');
      expect(ncxXml).toContain('<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">');
      expect(ncxXml).toContain('<text>Tiên Nghịch &lt;Bản Dịch&gt;</text>');
      expect(ncxXml).toContain('<content src="cover.xhtml"/>');
      expect(ncxXml).toContain('<content src="chap_1.xhtml"/>');
      expect(ncxXml).toContain('<content src="chap_2.xhtml"/>');

      // 8. Chapter XHTMLs check
      const chap1File = zip.file('OEBPS/chap_1.xhtml');
      expect(chap1File).not.toBeNull();
      const chap1Html = await chap1File!.async('string');
      expect(chap1Html).toContain('<h1>Chương 1: Mở Đầu &amp; Hỗn Loạn</h1>');
      expect(chap1Html).toContain('<p>Đoạn 1: Thiên địa sơ khai.</p>');
      expect(chap1Html).toContain('<p>Đoạn 2: Nhân gian vô đạo.</p>');

      const chap2File = zip.file('OEBPS/chap_2.xhtml');
      expect(chap2File).not.toBeNull();
      const chap2Html = await chap2File!.async('string');
      expect(chap2Html).toContain('<h1>Chương 2: Quyết Chiến &lt;Đỉnh Núi&gt;</h1>');
      expect(chap2Html).toContain('<p>Đoạn 1: Gió gầm gào &amp; mây đen kéo đến.</p>');
    });
  });
});
