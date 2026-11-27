// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GlossaryHealthBar } from '../glossary-manager/GlossaryHealthBar';
import { GlossaryBulkActionBar } from '../glossary-manager/GlossaryBulkActionBar';
import { ImportGuidelinesModal } from '../glossary-manager/ImportGuidelinesModal';
import { GlossaryTable } from '../glossary-manager/GlossaryTable';
import { GlossaryItem } from '../../types';

const mockShowConfirm = vi.fn();
const mockShowToast = vi.fn();

vi.mock('../NotificationSystem', () => ({
  useNotifications: () => ({
    showConfirm: mockShowConfirm,
    showToast: mockShowToast,
  }),
}));

describe('GlossaryManager UI components (Feature 169)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    mockShowConfirm.mockResolvedValue(true);
  });

  function mount(node: React.ReactElement) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(node);
    });
    return {
      container,
      rerender: (next: React.ReactElement) => {
        act(() => {
          root.render(next);
        });
      },
      unmount: () => {
        act(() => {
          root.unmount();
        });
        container.remove();
      },
    };
  }

  it('renders GlossaryHealthBar diagnostic pills and toggles filter on click', () => {
    const onSelectFilter = vi.fn();
    const view = mount(
      <GlossaryHealthBar
        healthReport={{
          conflictGroupCount: 2,
          conflictItemIds: ['a', 'b'],
          missingProfileCharIds: ['c'],
          incompleteViIds: ['d'],
          formatIssueIds: ['e', 'f'],
          totalIssueItems: 6,
        }}
        healthFilter="all"
        onSelectFilter={onSelectFilter}
        totalGlossaryCount={10}
      />
    );

    const conflictBtn = view.container.querySelector('#btn-health-filter-conflicts') as HTMLButtonElement;
    const missingBtn = view.container.querySelector('#btn-health-filter-missing-profile') as HTMLButtonElement;
    const incompleteBtn = view.container.querySelector('#btn-health-filter-incomplete') as HTMLButtonElement;
    const formatBtn = view.container.querySelector('#btn-health-filter-format-issues') as HTMLButtonElement;

    expect(conflictBtn.textContent).toContain('(2 nhóm)');
    expect(missingBtn.textContent).toContain('(1)');
    expect(incompleteBtn.textContent).toContain('(1)');
    expect(formatBtn.textContent).toContain('(2)');

    act(() => {
      conflictBtn.click();
      formatBtn.click();
    });
    expect(onSelectFilter).toHaveBeenCalledWith('conflicts');
    expect(onSelectFilter).toHaveBeenCalledWith('format_issues');

    view.unmount();
  });

  it('renders GlossaryBulkActionBar and triggers pin, type, gender, and confirmed delete callbacks', async () => {
    const onBulkPin = vi.fn();
    const onBulkUnpin = vi.fn();
    const onBulkChangeType = vi.fn();
    const onBulkChangeGender = vi.fn();
    const onBulkDelete = vi.fn();

    const view = mount(
      <GlossaryBulkActionBar
        selectedCount={3}
        totalFilteredCount={10}
        selectedCharacterCount={2}
        onSelectAllFiltered={vi.fn()}
        onClearSelection={vi.fn()}
        onBulkPin={onBulkPin}
        onBulkUnpin={onBulkUnpin}
        onBulkChangeType={onBulkChangeType}
        onBulkChangeGender={onBulkChangeGender}
        onBulkDelete={onBulkDelete}
      />
    );

    act(() => {
      (view.container.querySelector('#btn-bulk-pin') as HTMLButtonElement).click();
      (view.container.querySelector('#btn-bulk-apply-type') as HTMLButtonElement).click();
      (view.container.querySelector('#btn-bulk-apply-gender') as HTMLButtonElement).click();
    });

    expect(onBulkPin).toHaveBeenCalledTimes(1);
    expect(onBulkChangeType).toHaveBeenCalledWith('character');
    expect(onBulkChangeGender).toHaveBeenCalledWith('male');

    await act(async () => {
      (view.container.querySelector('#btn-bulk-delete') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    expect(mockShowConfirm).toHaveBeenCalledTimes(1);
    expect(onBulkDelete).toHaveBeenCalledTimes(1);

    view.unmount();
  });

  it('supports row selection checkbox without opening sidebar and renders clear-filters action on empty filtered table', () => {
    const sample: GlossaryItem[] = [
      { id: '1', chinese: '林风', pinyin: 'Lâm Phong', vietnamese: 'Lâm Phong', type: 'character', note: '' },
    ];
    const handleSelectItem = vi.fn();
    const onToggleSelectItem = vi.fn();
    const onClearFilters = vi.fn();

    const view = mount(
      <GlossaryTable
        filteredGlossary={sample}
        selectedItem={null}
        handleSelectItem={handleSelectItem}
        editingId={null}
        startEdit={vi.fn()}
        cancelEdit={vi.fn()}
        saveEdit={vi.fn()}
        onDeleteGlossaryItem={vi.fn()}
        getOriginBadge={() => null}
        getBadgeColor={() => ''}
        getTypeName={() => 'Nhân vật'}
        pageSize={20}
        currentPage={1}
        setCurrentPage={vi.fn()}
        selectedIdSet={new Set()}
        onToggleSelectItem={onToggleSelectItem}
        onToggleSelectPage={vi.fn()}
      />
    );

    const rowCheckbox = view.container.querySelector('input[aria-label="Chọn thuật ngữ 林风"]') as HTMLInputElement;
    act(() => {
      rowCheckbox.click();
    });
    expect(onToggleSelectItem).toHaveBeenCalledWith('1');
    expect(handleSelectItem).not.toHaveBeenCalled();

    view.rerender(
      <GlossaryTable
        filteredGlossary={[]}
        selectedItem={null}
        handleSelectItem={handleSelectItem}
        editingId={null}
        startEdit={vi.fn()}
        cancelEdit={vi.fn()}
        saveEdit={vi.fn()}
        onDeleteGlossaryItem={vi.fn()}
        getOriginBadge={() => null}
        getBadgeColor={() => ''}
        getTypeName={() => 'Nhân vật'}
        pageSize={20}
        currentPage={1}
        setCurrentPage={vi.fn()}
        hasActiveFilter={true}
        onClearFilters={onClearFilters}
      />
    );

    const clearBtn = Array.from(view.container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Xóa bộ lọc')
    ) as HTMLButtonElement;
    expect(clearBtn).toBeDefined();
    act(() => {
      clearBtn.click();
    });
    expect(onClearFilters).toHaveBeenCalledTimes(1);

    view.unmount();
  });

  it('switches between append and replace_all in ImportGuidelinesModal with confirmation and empty-file block', async () => {
    const confirmImport = vi.fn();
    const view = mount(
      <ImportGuidelinesModal
        isImporting={true}
        setIsImporting={vi.fn()}
        mdFileName="dict.md"
        isAnalyzingMd={false}
        mdInputRef={{ current: null }}
        handleMdImportFileChange={vi.fn()}
        handleImportFile={vi.fn()}
        importPreview={{
          fileName: 'dict.md',
          mode: 'direct',
          sourceFormat: 'md',
          cleanItems: [{ chinese: '新词', pinyin: 'Tân Từ', vietnamese: 'Tân Từ', type: 'term', note: '' }],
          conflicts: [],
          allValidItems: [{ chinese: '新词', pinyin: 'Tân Từ', vietnamese: 'Tân Từ', type: 'term', note: '' }],
          skippedRows: 0,
          warnings: [],
        }}
        importError={null}
        confirmImport={confirmImport}
        retryImportWithAi={vi.fn()}
        resetImportPreview={vi.fn()}
        existingGlossaryCount={25}
      />
    );

    act(() => {
      (document.querySelector('#btn-import-mode-replace_all') as HTMLButtonElement).click();
    });

    const warning = document.querySelector('#import-replace-all-warning');
    expect(warning?.textContent).toContain('25');
    expect(warning?.textContent).toContain('1');

    await act(async () => {
      (document.querySelector('#btn-confirm-import-glossary') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(mockShowConfirm).toHaveBeenCalledTimes(1);
    expect(confirmImport).toHaveBeenCalledWith('overwrite', 'replace_all');

    // Verify zero valid items disables confirmation
    view.rerender(
      <ImportGuidelinesModal
        isImporting={true}
        setIsImporting={vi.fn()}
        mdFileName="empty.md"
        isAnalyzingMd={false}
        mdInputRef={{ current: null }}
        handleMdImportFileChange={vi.fn()}
        handleImportFile={vi.fn()}
        importPreview={{
          fileName: 'empty.md',
          mode: 'direct',
          sourceFormat: 'md',
          cleanItems: [],
          conflicts: [],
          allValidItems: [],
          skippedRows: 2,
          warnings: [],
        }}
        importError={null}
        confirmImport={confirmImport}
        retryImportWithAi={vi.fn()}
        resetImportPreview={vi.fn()}
        existingGlossaryCount={25}
      />
    );

    const confirmBtn = document.querySelector('#btn-confirm-import-glossary') as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);

    view.unmount();
  });
});
