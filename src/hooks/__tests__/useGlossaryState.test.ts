// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGlossaryState } from '../useGlossaryState';
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

describe('useGlossaryState Health Filter, Bulk Actions & Metadata Preservation (Feature 169)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  });

  function mountState(initialGlossary: GlossaryItem[]) {
    let latest!: ReturnType<typeof useGlossaryState>;
    const currentProject: StoryProject = {
      id: 'proj_state_test',
      title: 'Test',
      author: 'Author',
      description: '',
      genre: 'Tiên Hiệp',
      tone: 'Trang nghiêm',
      glossary: initialGlossary,
      pendingGlossary: [],
      chapters: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      ignoredDuplicatePairs: [],
    };
    const onUpdateProject = vi.fn((updated: StoryProject) => {
      currentProject.glossary = updated.glossary;
    });
    const onUpdateGlossaryItem = vi.fn();
    const onDeleteGlossaryItem = vi.fn();

    function Harness({ items }: { items: GlossaryItem[] }) {
      latest = useGlossaryState({
        projectId: 'proj_state_test',
        glossary: items,
        activeProject: currentProject,
        onAddGlossaryItem: vi.fn(),
        onUpdateGlossaryItem,
        onDeleteGlossaryItem,
        onUpdateProject,
      });
      return null;
    }

    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => {
      root.render(React.createElement(Harness, { items: initialGlossary }));
    });

    return {
      get current() {
        return latest;
      },
      rerender: (items: GlossaryItem[]) => {
        act(() => {
          root.render(React.createElement(Harness, { items }));
        });
      },
      onUpdateProject,
      onUpdateGlossaryItem,
      onDeleteGlossaryItem,
      unmount: () => {
        act(() => {
          root.unmount();
        });
      },
    };
  }

  it('filters glossary cleanly by healthFilter and clears filters with clearAllFilters', () => {
    const items: GlossaryItem[] = [
      { id: 'c1', chinese: '林风', pinyin: 'Lâm Phong', vietnamese: 'Lâm Phong', type: 'character', note: '' },
      {
        id: 'c2',
        chinese: '苏雪',
        pinyin: 'Tô Tuyết',
        vietnamese: 'Tô Tuyết',
        type: 'character',
        note: '',
        characterProfile: { gender: 'female' },
      },
      { id: 'inc', chinese: '缺词', pinyin: '', vietnamese: '', type: 'other', note: '' },
    ];

    const harness = mountState(items);
    expect(harness.current.healthReport.missingProfileCharIds).toEqual(['c1']);
    expect(harness.current.healthReport.incompleteViIds).toEqual(['inc']);

    act(() => {
      harness.current.setHealthFilter('missing_profile');
    });
    expect(harness.current.filteredGlossary.map((g) => g.id)).toEqual(['c1']);

    act(() => {
      harness.current.clearAllFilters();
    });
    expect(harness.current.healthFilter).toBe('all');
    expect(harness.current.filteredGlossary).toHaveLength(3);

    harness.unmount();
  });

  it('preserves isPinned, variants, and characterProfile when saving inline edit', () => {
    const item: GlossaryItem = {
      id: 'g_meta',
      chinese: '萧炎',
      pinyin: 'Tiêu Viêm',
      vietnamese: 'Tiêu Viêm',
      type: 'character',
      note: 'Ghi chú cũ',
      isPinned: true,
      variants: ['蕭炎'],
      characterProfile: { gender: 'male', defaultSelfPronoun: 'ta' },
      sourceChapterId: 'chap_1',
      origin: 'manual',
    };

    const harness = mountState([item]);

    act(() => {
      harness.current.saveEdit('g_meta', '萧炎', 'Tiêu Viêm', 'Tiêu Viêm Mới', 'character', 'Ghi chú cũ');
    });

    expect(harness.onUpdateGlossaryItem).toHaveBeenCalledTimes(1);
    const saved = harness.onUpdateGlossaryItem.mock.calls[0][1] as GlossaryItem;
    expect(saved.vietnamese).toBe('Tiêu Viêm Mới');
    expect(saved.isPinned).toBe(true);
    expect(saved.variants).toEqual(['蕭炎']);
    expect(saved.characterProfile).toEqual({ gender: 'male', defaultSelfPronoun: 'ta' });
    expect(saved.sourceChapterId).toBe('chap_1');

    harness.unmount();
  });

  it('supports multi-select, auto-prune, and all 4 bulk actions while preserving existing pronouns/relations', () => {
    const items: GlossaryItem[] = [
      {
        id: 'char_1',
        chinese: '林风',
        pinyin: 'Lâm Phong',
        vietnamese: 'Lâm Phong',
        type: 'character',
        note: '',
        characterProfile: {
          gender: 'unknown',
          defaultSelfPronoun: 'tại hạ',
          relations: [{ targetName: 'Sư phụ', selfPronoun: 'đệ tử', targetPronoun: 'sư tôn' }],
        },
      },
      { id: 'loc_1', chinese: '青城', pinyin: 'Thanh Thành', vietnamese: 'Thanh Thành', type: 'location', note: '' },
      { id: 'term_1', chinese: '灵剑', pinyin: 'Linh Kiếm', vietnamese: 'Linh Kiếm', type: 'term', note: '' },
    ];

    const harness = mountState(items);

    act(() => {
      harness.current.toggleSelectPage([items[0], items[1]]);
    });
    expect(harness.current.selectedIds).toEqual(['char_1', 'loc_1']);

    // Bulk pin
    act(() => {
      harness.current.bulkSetPinnedSelected(true);
    });
    let latestGlossary = harness.onUpdateProject.mock.calls.at(-1)?.[0].glossary as GlossaryItem[];
    expect(latestGlossary.find((i) => i.id === 'char_1')?.isPinned).toBe(true);
    expect(latestGlossary.find((i) => i.id === 'loc_1')?.isPinned).toBe(true);
    expect(latestGlossary.find((i) => i.id === 'term_1')?.isPinned).toBeUndefined();

    // Rerender with updated glossary and test mixed-selection bulk gender assignment
    harness.rerender(latestGlossary);
    act(() => {
      harness.current.bulkSetGenderSelected('male');
    });
    latestGlossary = harness.onUpdateProject.mock.calls.at(-1)?.[0].glossary as GlossaryItem[];
    const updatedChar = latestGlossary.find((i) => i.id === 'char_1');
    expect(updatedChar?.characterProfile?.gender).toBe('male');
    expect(updatedChar?.characterProfile?.defaultSelfPronoun).toBe('tại hạ');
    expect(updatedChar?.characterProfile?.relations).toHaveLength(1);
    // Location entry must NOT receive characterProfile
    expect(latestGlossary.find((i) => i.id === 'loc_1')?.characterProfile).toBeUndefined();

    // Bulk type change
    harness.rerender(latestGlossary);
    act(() => {
      harness.current.bulkSetTypeSelected('term');
    });
    latestGlossary = harness.onUpdateProject.mock.calls.at(-1)?.[0].glossary as GlossaryItem[];
    expect(latestGlossary.find((i) => i.id === 'loc_1')?.type).toBe('term');

    // Select all filtered and bulk delete
    harness.rerender(latestGlossary);
    act(() => {
      harness.current.selectAllFiltered();
    });
    expect(harness.current.selectedIds).toHaveLength(3);

    act(() => {
      harness.current.bulkDeleteSelected();
    });
    latestGlossary = harness.onUpdateProject.mock.calls.at(-1)?.[0].glossary as GlossaryItem[];
    expect(latestGlossary).toEqual([]);
    expect(harness.current.selectedIds).toEqual([]);

    harness.unmount();
  });

  it('auto-prunes selectedIds when an external glossary update removes a selected item', () => {
    const items: GlossaryItem[] = [
      { id: 'a', chinese: '甲', pinyin: 'Giáp', vietnamese: 'Giáp', type: 'other', note: '' },
      { id: 'b', chinese: '乙', pinyin: 'Ất', vietnamese: 'Ất', type: 'other', note: '' },
    ];
    const harness = mountState(items);

    act(() => {
      harness.current.selectAllFiltered();
    });
    expect(harness.current.selectedIds).toEqual(['a', 'b']);

    harness.rerender([items[1]]);
    expect(harness.current.selectedIds).toEqual(['b']);

    harness.unmount();
  });
});
