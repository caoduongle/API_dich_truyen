import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { DiffModal, renderHighlightedText } from '../DiffModal';
import { Chapter, GlossaryItem } from '../../../types';

describe('DiffModal & renderHighlightedText Security Suite (US6 / T057)', () => {
  const mockGlossary: GlossaryItem[] = [
    {
      id: 'g1',
      chinese: '萧炎',
      pinyin: 'Tiêu Viêm',
      vietnamese: 'Tiêu Viêm',
      type: 'character',
      note: 'Nhân vật chính',
      createdAt: '2026-09-14T00:00:00Z',
    },
    {
      id: 'g2',
      chinese: '斗气',
      pinyin: 'Đấu Khí',
      vietnamese: 'Đấu Khí',
      type: 'term',
      note: 'Hệ thống tu luyện',
      createdAt: '2026-09-14T00:00:00Z',
    },
  ];

  describe('renderHighlightedText()', () => {
    it('returns null or empty text when input is empty', () => {
      expect(renderHighlightedText('', mockGlossary)).toBeNull();
    });

    it('returns raw text when glossary has no matching terms', () => {
      const result = renderHighlightedText('Văn bản không chứa thuật ngữ', []);
      expect(result).toBe('Văn bản không chứa thuật ngữ');
    });

    it('wraps matched glossary terms into <mark> React elements', () => {
      const text = 'Hôm nay Tiêu Viêm tu luyện Đấu Khí.';
      const element = renderHighlightedText(text, mockGlossary);
      const html = renderToString(<div>{element}</div>);

      expect(html).toContain('<mark class="bg-polish/20 text-polish border border-polish/40 rounded-[2px] px-1 font-bold">Tiêu Viêm</mark>');
      expect(html).toContain('<mark class="bg-polish/20 text-polish border border-polish/40 rounded-[2px] px-1 font-bold">Đấu Khí</mark>');
    });

    it('safely escapes HTML / XSS payloads without executing raw HTML', () => {
      const maliciousText = '<img src=x onerror=alert(1)> <script>alert("xss")</script> Tiêu Viêm <a href="javascript:alert(1)">click</a>';
      const element = renderHighlightedText(maliciousText, mockGlossary);
      const html = renderToString(<div>{element}</div>);

      // React escapes raw HTML tags into entities
      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
      expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(html).toContain('&lt;a href=&quot;javascript:alert(1)&quot;&gt;click&lt;/a&gt;');
      // Must NOT contain unescaped executable tags
      expect(html).not.toContain('<img src=x');
      expect(html).not.toContain('<script>');
      expect(html).not.toContain('<a href=');
      // Glossary term must still be highlighted properly
      expect(html).toContain('<mark class="bg-polish/20 text-polish border border-polish/40 rounded-[2px] px-1 font-bold">Tiêu Viêm</mark>');
    });
  });

  describe('DiffModal Component Rendering', () => {
    const mockChapters: Chapter[] = [
      {
        id: 'c1',
        projectId: 'p1',
        title: 'Chương 1: Khởi nguồn',
        sourceText: '萧炎来到了这里。',
        processedSourceText: 'Tiêu Viêm đã đến nơi này. <script>evil()</script>',
        rawTranslation: '',
        polishedTranslation: '',
        paragraphs: [],
        translatedLines: [],
        status: 'completed',
        createdAt: '2026-09-14T00:00:00Z',
        updatedAt: '2026-09-14T00:00:00Z',
      },
    ];

    it('returns null when no processed chapters exist', () => {
      const unprocessedChapters: Chapter[] = [
        {
          id: 'c2',
          projectId: 'p1',
          title: 'Chương 2',
          sourceText: '原文',
          rawTranslation: '',
          polishedTranslation: '',
          paragraphs: [],
          translatedLines: [],
          status: 'not_started',
          createdAt: '2026-09-14T00:00:00Z',
          updatedAt: '2026-09-14T00:00:00Z',
        },
      ];

      const html = renderToString(
        <DiffModal
          chapters={unprocessedChapters}
          glossary={mockGlossary}
          diffModalChapterIndex={0}
          setDiffModalChapterIndex={() => {}}
          onClose={() => {}}
        />
      );

      expect(html).toBe('');
    });

    it('renders modal safely and neutralizes XSS payloads in processedSourceText', () => {
      const html = renderToString(
        <DiffModal
          chapters={mockChapters}
          glossary={mockGlossary}
          diffModalChapterIndex={0}
          setDiffModalChapterIndex={() => {}}
          onClose={() => {}}
        />
      );

      // Verify title and chapter info
      expect(html).toContain('Chương 1: Khởi nguồn');
      expect(html).toContain('Thuật ngữ được thay trong chương này');
      expect(html).toContain('Tiêu Viêm');

      // Verify XSS neutralization: <script> becomes &lt;script&gt;
      expect(html).toContain('&lt;script&gt;evil()&lt;/script&gt;');
      expect(html).not.toContain('<script>evil()</script>');

      // Verify term highlight inside DiffModal
      expect(html).toContain('<mark class="bg-polish/20 text-polish border border-polish/40 rounded-[2px] px-1 font-bold">Tiêu Viêm</mark>');
    });
  });
});
