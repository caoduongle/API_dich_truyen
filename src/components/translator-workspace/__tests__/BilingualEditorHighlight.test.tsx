import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { BilingualEditor, BilingualEditorProps } from '../BilingualEditor';
import { HighlightIntent } from '../../../types/audit';
import { StoryProject } from '../../../types';
import { findSnippetLocationInText, scrollAndSelectInTextarea } from '../../../utils/textareaHighlight';
import { NotificationProvider } from '../../NotificationSystem';

describe('BilingualEditor Highlight Intent & Race Condition Suite (T005)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockProject: StoryProject = {
    id: 'proj-1',
    title: 'Test Project',
    author: 'Author',
    genre: 'Tiên Hiệp',
    tone: 'Trang trọng',
    description: '',
    chapters: [],
    glossary: [],
    pendingGlossary: [],
    createdAt: '2026-09-10T12:00:00Z',
    updatedAt: '2026-09-10T12:00:00Z',
  };

  const createBaseProps = (overrides: Partial<BilingualEditorProps> = {}): BilingualEditorProps => ({
    sourceText: '原文段落',
    setSourceText: vi.fn(),
    originalSourceText: '原文段落',
    setOriginalSourceText: vi.fn(),
    isGlossaryApplied: false,
    setIsGlossaryApplied: vi.fn(),
    isExtractionEnabled: false,
    setIsExtractionEnabled: vi.fn(),
    rawTranslation: 'Bản dịch thô ban đầu.',
    setRawTranslation: vi.fn(),
    polishedTranslation: 'Bản dịch đã biên tập mượt mà.',
    setPolishedTranslation: vi.fn(),
    additionalInstructions: '',
    setAdditionalInstructions: vi.fn(),
    chapterTitle: 'Chương 1: Khởi đầu',
    setChapterTitle: vi.fn(),
    untranslatedChapters: [],
    handleLoadChapterById: vi.fn(),
    handleLoadExample: vi.fn(),
    handleAnalyzeGlossary: vi.fn(),
    isAnalyzing: false,
    handleTranslateRaw: vi.fn(),
    isTranslating: false,
    handlePolishTranslation: vi.fn(),
    isPolishing: false,
    handleSaveChapter: vi.fn(),
    handleApplyGlossaryToSource: vi.fn(),
    copiedRaw: false,
    copiedPolished: false,
    handleCopyText: vi.fn(),
    activeStage: 'polished',
    setActiveStage: vi.fn(),
    autoDiscoveredTerms: [],
    isApplyingGlossaryToSource: false,
    applyGlossarySourceCount: null,
    glossaryLength: 0,
    activeProject: mockProject,
    onUpdateProject: vi.fn(),
    apiKeys: ['test-key'],
    selectedModel: 'gemini-1.5-flash',
    warningParagraphMismatch: false,
    enableAiQaCritique: true,
    enableSegmentTranslation: false,
    qaIssues: [],
    hakoIssues: [],
    isCheckingQa: false,
    onRunAiQaCritique: vi.fn(),
    ...overrides,
  });

  describe('SSR and Component Structure', () => {
    it('renders editor markup without throwing when highlightIntent is provided', () => {
      const intent: HighlightIntent = {
        chapterId: 'chap-1',
        snippet: 'Bản dịch đã biên tập',
        issueId: 'issue-101',
        timestamp: Date.now(),
      };

      const props = createBaseProps({
        currentChapterId: 'chap-1',
        highlightIntent: intent,
      });

      const html = renderToString(
        <NotificationProvider>
          <BilingualEditor {...props} />
        </NotificationProvider>
      );

      expect(html).toContain('Chương 1: Khởi đầu');
      expect(html).toContain('Bản dịch đã biên tập mượt mà.');
    });

    it('renders cleanly when highlightIntent points to a pending unread chapter', () => {
      const intent: HighlightIntent = {
        chapterId: 'chap-2',
        snippet: 'Đoạn trích thuộc chương 2 đang đợi nạp',
        issueId: 'issue-102',
        timestamp: Date.now(),
      };

      // currentChapterId is still chap-1
      const props = createBaseProps({
        currentChapterId: 'chap-1',
        highlightIntent: intent,
      });

      const html = renderToString(
        <NotificationProvider>
          <BilingualEditor {...props} />
        </NotificationProvider>
      );
      expect(html).toBeDefined();
    });
  });

  describe('Target Stage Detection & Intent Resolution', () => {
    it('correctly detects snippet inside polishedTranslation', () => {
      const polished = 'Lỗ mũi Jill phì ra từng luồng khí nóng bỏng, trừng trừng nhìn Tô Bạch.';
      const raw = 'Cự tích dịch thô.';
      const snippet = 'Lỗ mũi Jill phì ra từng luồng khí nóng bỏng';

      const foundInPolished = findSnippetLocationInText(polished, snippet);
      const foundInRaw = findSnippetLocationInText(raw, snippet);

      expect(foundInPolished).not.toBeNull();
      expect(foundInRaw).toBeNull();
    });

    it('correctly detects snippet inside rawTranslation when absent from polished', () => {
      const polished = 'Bản dịch biên tập hoàn toàn khác.';
      const raw = 'hắn há hốc mồm thở ra một ngàn khói trắng, gương mặt đờ đẫn ngẩn ngơ.';
      const snippet = 'hắn há hốc mồm thở ra một ngàn khói trắng';

      const foundInPolished = findSnippetLocationInText(polished, snippet);
      const foundInRaw = findSnippetLocationInText(raw, snippet);

      expect(foundInPolished).toBeNull();
      expect(foundInRaw).not.toBeNull();
      expect(foundInRaw?.start).toBe(0);
      expect(foundInRaw?.end).toBe(snippet.length);
    });

    it('handles stripped quotes in evidence snippet when full text does not have quotes', () => {
      const polished = 'Tiêu Viêm thở dài: Con đường này quả thực gian nan vô cùng.';
      const snippetWithQuotes = '"Con đường này quả thực gian nan vô cùng."';

      const match = findSnippetLocationInText(polished, snippetWithQuotes);
      expect(match).not.toBeNull();
      expect(polished.substring(match!.start, match!.end)).toBe('Con đường này quả thực gian nan vô cùng.');
    });
  });

  describe('Integration with Textarea Selection DOM Helpers', () => {
    it('selects and focuses text in mocked textarea element', () => {
      let focused = false;
      let selectionStart = 0;
      let selectionEnd = 0;

      const mockTextarea = {
        value: 'Câu trước. Đoạn văn bị lặp lại nội dung hoàn toàn. Câu sau.',
        focus: vi.fn(() => {
          focused = true;
        }),
        setSelectionRange: vi.fn((start: number, end: number) => {
          selectionStart = start;
          selectionEnd = end;
        }),
        getBoundingClientRect: () => ({ top: 100, height: 200 }),
        scrollHeight: 500,
        clientHeight: 200,
        scrollTop: 0,
      } as unknown as HTMLTextAreaElement;

      const snippet = 'Đoạn văn bị lặp lại nội dung hoàn toàn.';
      const success = scrollAndSelectInTextarea(mockTextarea, snippet);

      expect(success).toBe(true);
      expect(mockTextarea.focus).toHaveBeenCalled();
      expect(focused).toBe(true);
      expect(selectionStart).toBe(11);
      expect(selectionEnd).toBe(11 + snippet.length);
    });

    it('returns false when snippet is absent from textarea', () => {
      const mockTextarea = {
        value: 'Nội dung khác hoàn toàn không có snippet.',
        focus: vi.fn(),
        setSelectionRange: vi.fn(),
      } as unknown as HTMLTextAreaElement;

      const success = scrollAndSelectInTextarea(mockTextarea, 'Đoạn không tồn tại');
      expect(success).toBe(false);
      expect(mockTextarea.focus).not.toHaveBeenCalled();
    });
  });
});
