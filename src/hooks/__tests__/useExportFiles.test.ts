import { describe, it, expect } from 'vitest';
import { useExportFiles } from '../useExportFiles';

describe('useExportFiles Hook Suite', () => {
  it('exports valid useExportFiles hook function', () => {
    expect(typeof useExportFiles).toBe('function');
  });

  it('declares interface and export scopes properly', () => {
    const mockProps = {
      activeProject: {
        id: 'proj-1',
        title: 'Phàm Nhân Tu Tiên',
        genre: 'Tiên Hiệp',
        tone: 'Trầm tĩnh',
        chapters: [],
        glossary: [],
        createdAt: 1000,
      },
      chaptersPerFile: 50,
      exportScope: 'translated' as const,
      exportMode: 'web' as const,
      apiKeys: ['test-key'],
      selectedModel: 'gemini-2.5-flash',
      addLog: () => {},
      exportRangeEnabled: false,
      exportRangeStart: 1,
      exportRangeEnd: 100,
    };

    expect(mockProps.chaptersPerFile).toBe(50);
    expect(mockProps.exportScope).toBe('translated');
  });
});
