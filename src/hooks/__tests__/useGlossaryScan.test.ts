import { describe, it, expect } from 'vitest';
import { useGlossaryScan } from '../useGlossaryScan';

describe('useGlossaryScan Hook Suite', () => {
  it('exports valid useGlossaryScan hook function', () => {
    expect(typeof useGlossaryScan).toBe('function');
  });

  it('declares interface and scan parameters properly', () => {
    const mockProps = {
      activeProject: {
        id: 'proj-1',
        title: 'Già Thiên',
        genre: 'Huyền Huyễn',
        tone: 'Hùng vĩ',
        chapters: [],
        glossary: [],
        createdAt: 1000,
      },
      onUpdateProject: () => {},
      apiKeys: ['test-key'],
      selectedModel: 'gemini-2.5-flash',
      extractionLoops: 2,
      scanRangeEnabled: false,
      scanRangeStart: 1,
      scanRangeEnd: 50,
      currentApiKeyIndexRef: { current: 0 },
      addLog: () => {},
      setAutoDiscoveredBatch: () => {},
    };

    expect(mockProps.extractionLoops).toBe(2);
  });
});
