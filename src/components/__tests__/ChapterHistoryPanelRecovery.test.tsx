import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import ChapterHistoryPanel, { isChapterMissingSource } from '../ChapterHistoryPanel';
import { createMockChapter } from '../../services/__tests__/storageFixtures';
import { StoryProject } from '../../types';

// Mock Notification Context
vi.mock('../NotificationSystem', () => ({
  useNotifications: () => ({
    showToast: vi.fn(),
    showConfirm: vi.fn().mockResolvedValue(true),
  }),
}));

// Mock DB
vi.mock('../../services/db', () => ({
  getChapterFromDB: vi.fn(),
  saveChapterToDB: vi.fn(),
}));

// Mock VirtualList to return all items
vi.mock('../../hooks/useVirtualList', () => ({
  useVirtualList: ({ items }: any) => ({
    visibleItems: (items || []).map((item: any, index: number) => ({ item, index })),
    totalHeight: (items || []).length * 40,
    onScroll: vi.fn(),
  }),
}));

describe('User Story 3: Missing Source Data Detection & Safe Recovery (T017)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('correctly identifies chapters with missing or whitespace-only sourceText', () => {
    expect(isChapterMissingSource({ sourceText: '' })).toBe(true);
    expect(isChapterMissingSource({ sourceText: '   ' })).toBe(true);
    expect(isChapterMissingSource({ sourceText: undefined })).toBe(true);
    expect(isChapterMissingSource({ sourceText: '第一章 陨落的天才' })).toBe(false);
  });

  it('restores source text without touching completed polished translation', () => {
    const corruptedChapter = createMockChapter({
      id: 'chap_corrupted_56',
      sourceText: '',
      rawTranslation: '',
      polishedTranslation: 'Chương 56: Cuộc gặp gỡ định mệnh giữa hai người.',
      paragraphs: [],
    });

    const newSourceInput = '第五十六章 命中注定的相遇。\n两人相视一笑。';
    const paragraphs = newSourceInput.split(/\n+/).map((l) => l.trim()).filter(Boolean);

    const recoveredChapter = {
      ...corruptedChapter,
      sourceText: newSourceInput.trim(),
      paragraphs,
      updatedAt: new Date().toISOString(),
    };

    expect(recoveredChapter.sourceText).toBe(newSourceInput.trim());
    expect(recoveredChapter.paragraphs.length).toBe(2);
    expect(recoveredChapter.polishedTranslation).toBe(
      'Chương 56: Cuộc gặp gỡ định mệnh giữa hai người.'
    );
  });

  it('renders ChapterHistoryPanel markup without throwing', () => {
    const mockProject: StoryProject = {
      id: 'proj_rec_1',
      title: 'Đấu Phá Thương Khung',
      author: 'Thiên Tằm Thổ Đậu',
      genre: 'xianxia',
      tone: 'epic',
      description: 'Test',
      glossary: [],
      pendingGlossary: [],
      chapters: [
        {
          id: 'chap_rec_1',
          title: 'Chương 1',
          status: 'completed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const html = renderToString(
      <ChapterHistoryPanel
        activeProject={mockProject}
        onUpdateProject={() => {}}
        onDeleteChapterHistory={() => {}}
        onGoToTranslate={() => {}}
        onResetChapters={async () => {}}
      />
    );

    expect(html).toContain('Lịch Sử Lưu Trữ Dịch Thuật');
    expect(html).toContain('Chương 1');
  });
});
