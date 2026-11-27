// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGlossaryState } from '../useGlossaryState';
import { formatGlossaryCreatedDate } from '../../services/glossaryIO';
import { GlossaryItem, StoryProject } from '../../types';

const mockShowToast = vi.fn();

vi.mock('../../context/NotificationContext', () => ({
  useNotifications: () => ({ showToast: mockShowToast }),
}));

vi.mock('../../utils/download', () => ({
  triggerDownload: vi.fn(),
}));

vi.mock('../../services/directGlossaryEngine', () => ({
  analyzeGuidelinesDirect: vi.fn(),
}));

vi.mock('../useGlossaryContextSearch', () => ({
  useGlossaryContextSearch: () => ({
    fullChapters: [],
    searchContextMatches: [],
    setSearchContextMatches: vi.fn(),
    contextFilterType: 'all',
    setContextFilterType: vi.fn(),
    findLiveContext: vi.fn(),
    scanOccurrences: vi.fn(),
  }),
}));

describe('useGlossaryState import & export flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    global.URL.createObjectURL = vi.fn(() => 'blob:mock');
    global.URL.revokeObjectURL = vi.fn();
  });

  function renderHookHarness(props: Parameters<typeof useGlossaryState>[0]) {
    let latest: ReturnType<typeof useGlossaryState>;
    function Harness() {
      latest = useGlossaryState(props);
      return null;
    }
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => {
      root.render(React.createElement(Harness));
    });
    return {
      get current() {
        return latest;
      },
      unmount: () => {
        act(() => {
          root.unmount();
        });
      },
    };
  }

  it('imports structured .md offline, preserves Ngày thêm, and batches overwrite via onUpdateProject', async () => {
    const existingGlossary: GlossaryItem[] = [
      {
        id: 'glo_1',
        chinese: '萧炎',
        pinyin: 'Tiêu Viêm',
        vietnamese: 'Tiêu Viêm',
        type: 'character',
        note: 'Cũ',
        createdAt: '2026-01-10T00:00:00.000Z',
      },
    ];
    const activeProject: StoryProject = {
      id: 'proj_1',
      title: 'Đấu Phá',
      author: 'Thiên Tằm Thổ Đậu',
      description: 'Test project',
      genre: 'huyền huyễn',
      tone: 'hào sảng',
      glossary: existingGlossary,
      pendingGlossary: [],
      chapters: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      ignoredDuplicatePairs: [],
    };
    const onAddGlossaryItems = vi.fn();
    const onUpdateProject = vi.fn();

    const hook = renderHookHarness({
      projectId: 'proj_1',
      glossary: existingGlossary,
      activeProject,
      onAddGlossaryItem: vi.fn(),
      onAddGlossaryItems,
      onUpdateGlossaryItem: vi.fn(),
      onDeleteGlossaryItem: vi.fn(),
      onUpdateProject,
    });

    const mdContent = [
      '# Từ Điển Dự Án',
      '',
      '## Nhân vật (2)',
      '',
      '| Tiếng Trung | Phiên âm | Tiếng Việt | Ghi chú | Ngày thêm |',
      '|---|---|---|---|---|',
      '| 萧炎 | Tiêu Viêm | Tiêu Viêm (Mới) | Đã cập nhật | 15/11/2026 |',
      '| 药老 | Dược Lão | Dược Trần | Sư phụ | 20/11/2026 |',
    ].join('\n');

    const mockFile = {
      name: 'tu-dien.md',
      size: mdContent.length,
      text: async () => mdContent,
    } as unknown as File;

    await act(async () => {
      await hook.current.handleImportFile(mockFile);
    });

    expect(hook.current.importPreview).not.toBeNull();
    expect(hook.current.importPreview?.mode).toBe('direct');
    expect(hook.current.importPreview?.cleanItems).toHaveLength(1);
    expect(hook.current.importPreview?.conflicts).toHaveLength(1);

    act(() => {
      hook.current.confirmImport('overwrite');
    });

    expect(onAddGlossaryItems).toHaveBeenCalledTimes(1);
    expect(onAddGlossaryItems.mock.calls[0][0][0]).toMatchObject({
      chinese: '药老',
      vietnamese: 'Dược Trần',
    });
    expect(formatGlossaryCreatedDate(onAddGlossaryItems.mock.calls[0][0][0].createdAt)).toBe('20/11/2026');

    expect(onUpdateProject).toHaveBeenCalledTimes(1);
    const updatedProject = onUpdateProject.mock.calls[0][0] as StoryProject;
    expect(updatedProject.glossary[0]).toMatchObject({
      id: 'glo_1',
      vietnamese: 'Tiêu Viêm (Mới)',
      note: 'Đã cập nhật',
    });
    expect(formatGlossaryCreatedDate(updatedProject.glossary[0].createdAt)).toBe('15/11/2026');

    hook.unmount();
  });

  it('replaces entire main glossary while preserving pendingGlossary when importMode is replace_all', async () => {
    const existingGlossary: GlossaryItem[] = [
      { id: 'old_1', chinese: '旧词一', pinyin: 'Cũ 1', vietnamese: 'Cũ 1', type: 'term', note: '' },
      { id: 'old_2', chinese: '旧词二', pinyin: 'Cũ 2', vietnamese: 'Cũ 2', type: 'character', note: '' },
    ];
    const pendingItem = {
      id: 'pend_keep_1',
      chinese: '待定',
      pinyin: 'Đãi Định',
      vietnamese: 'Đợi duyệt',
      type: 'other' as const,
      note: '',
      reason: 'Duplicate Chinese' as const,
      originalValue: '',
      importedAt: '2026-11-01T00:00:00.000Z',
    };
    const activeProject: StoryProject = {
      id: 'proj_replace',
      title: 'Replace Test',
      author: 'Tester',
      description: '',
      genre: 'Tiên Hiệp',
      tone: 'Hào sảng',
      glossary: existingGlossary,
      pendingGlossary: [pendingItem],
      chapters: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      ignoredDuplicatePairs: [],
    };

    const onUpdateProject = vi.fn();
    const hook = renderHookHarness({
      projectId: 'proj_replace',
      glossary: existingGlossary,
      pendingGlossary: [pendingItem],
      activeProject,
      onAddGlossaryItem: vi.fn(),
      onAddGlossaryItems: vi.fn(),
      onUpdateGlossaryItem: vi.fn(),
      onDeleteGlossaryItem: vi.fn(),
      onUpdateProject,
    });

    const mdContent = [
      '| Tiếng Trung | Phiên âm | Tiếng Việt | Ghi chú |',
      '|---|---|---|---|',
      '| 新词甲 | Tân Từ Giáp | Tân Từ Giáp | Mới 1 |',
      '| 新词乙 | Tân Từ Ất | Tân Từ Ất | Mới 2 |',
    ].join('\n');

    const mockFile = {
      name: 'replace.md',
      size: mdContent.length,
      text: async () => mdContent,
    } as unknown as File;

    await act(async () => {
      await hook.current.handleImportFile(mockFile);
    });

    expect(hook.current.importPreview?.allValidItems).toHaveLength(2);

    act(() => {
      hook.current.confirmImport('skip', 'replace_all');
    });

    expect(onUpdateProject).toHaveBeenCalledTimes(1);
    const updated = onUpdateProject.mock.calls[0][0] as StoryProject;
    expect(updated.glossary.map((g) => g.chinese)).toEqual(['新词甲', '新词乙']);
    expect(updated.pendingGlossary).toEqual([pendingItem]);

    hook.unmount();
  });
});
