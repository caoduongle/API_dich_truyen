import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Chapter } from '../../types';
import { createMockChapter } from './storageFixtures';
import { mergeSafeguardChapter } from '../db';
import { mergeChapterCrdt } from '../crdtDocManager';

describe('Storage & CRDT Safeguard Guards (T003, T004, T005, T006)', () => {
  let mockChaptersStore: Map<string, Chapter> = new Map();

  beforeEach(() => {
    mockChaptersStore.clear();

    const mockDB: any = {
      transaction: (_storeNames: string | string[], _mode: string) => {
        const tx: any = {
          oncomplete: null,
          onerror: null,
          objectStore: (_name: string) => {
            return {
              get: (id: string) => {
                const item = mockChaptersStore.get(id);
                const req: any = { result: item ? JSON.parse(JSON.stringify(item)) : undefined, onsuccess: null, onerror: null };
                setTimeout(() => req.onsuccess?.({ target: req }), 0);
                return req;
              },
              put: (item: any) => {
                mockChaptersStore.set(item.id, JSON.parse(JSON.stringify(item)));
                const req: any = { result: item.id, onsuccess: null, onerror: null };
                setTimeout(() => req.onsuccess?.({ target: req }), 0);
                return req;
              },
            };
          },
        };
        setTimeout(() => tx.oncomplete?.(), 5);
        return tx;
      },
    };

    vi.stubGlobal('indexedDB', {
      open: () => {
        const req: any = { result: mockDB, onsuccess: null, onerror: null };
        setTimeout(() => req.onsuccess?.({ target: req }), 0);
        return req;
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('mergeSafeguardChapter helper', () => {
    it('returns incoming unchanged when existing is undefined', () => {
      const incoming = createMockChapter({ id: 'chap_new' });
      const result = mergeSafeguardChapter(undefined, incoming);
      expect(result).toEqual(incoming);
    });

    it('preserves existing sourceText and paragraphs when incoming has empty string', () => {
      const existing = createMockChapter({
        id: 'chap_1',
        sourceText: '第一章 陨落的天才',
        paragraphs: ['第一章 陨落的天才'],
      });
      const incoming = {
        ...existing,
        sourceText: '',
        paragraphs: [],
        polishedTranslation: 'Chương 1: Thiên tài sa sút (Đã chỉnh sửa)',
      };

      const result = mergeSafeguardChapter(existing, incoming);
      expect(result.sourceText).toBe('第一章 陨落的天才');
      expect(result.paragraphs).toEqual(['第一章 陨落的天才']);
      expect(result.polishedTranslation).toBe('Chương 1: Thiên tài sa sút (Đã chỉnh sửa)');
    });

    it('preserves existing rawTranslation when incoming rawTranslation is empty or undefined', () => {
      const existing = createMockChapter({
        id: 'chap_2',
        rawTranslation: 'Đệ nhất chương vẫn lạc đích thiên tài',
      });
      const incomingWithEmpty = {
        ...existing,
        rawTranslation: '',
        polishedTranslation: 'Bản dịch mới',
      };
      const incomingWithUndefined = {
        ...existing,
        rawTranslation: undefined as any,
        polishedTranslation: 'Bản dịch mới',
      };

      expect(mergeSafeguardChapter(existing, incomingWithEmpty).rawTranslation).toBe(
        'Đệ nhất chương vẫn lạc đích thiên tài'
      );
      expect(mergeSafeguardChapter(existing, incomingWithUndefined).rawTranslation).toBe(
        'Đệ nhất chương vẫn lạc đích thiên tài'
      );
    });

    it('allows valid updates to sourceText and rawTranslation when provided', () => {
      const existing = createMockChapter({
        id: 'chap_3',
        sourceText: '旧原文',
        rawTranslation: 'Cũ',
      });
      const incoming = {
        ...existing,
        sourceText: '新原文',
        rawTranslation: 'Mới',
      };

      const result = mergeSafeguardChapter(existing, incoming);
      expect(result.sourceText).toBe('新原文');
      expect(result.rawTranslation).toBe('Mới');
    });
  });

  describe('saveChapterToDB safeguard', () => {
    it('saves a new chapter cleanly when no record exists in DB', async () => {
      const { saveChapterToDB, getChapterFromDB } = await import('../db');
      const newChap = createMockChapter({ id: 'chap_unique_1' });

      await saveChapterToDB(newChap);
      const saved = await getChapterFromDB('chap_unique_1');
      expect(saved).not.toBeNull();
      expect(saved?.sourceText).toBe(newChap.sourceText);
    });

    it('prevents empty sourceText and rawTranslation from wiping existing data in DB', async () => {
      const { saveChapterToDB, getChapterFromDB } = await import('../db');
      const original = createMockChapter({
        id: 'chap_preserve_1',
        sourceText: '斗之力，三段！',
        rawTranslation: 'Đấu chi lực, tam đoạn!',
        polishedTranslation: 'Đấu lực, tam đoạn!',
      });
      await saveChapterToDB(original);

      const corruptUpdate: Chapter = {
        ...original,
        sourceText: '',
        rawTranslation: '',
        polishedTranslation: 'Đấu lực, tam đoạn! [Bản sửa mới]',
      };
      await saveChapterToDB(corruptUpdate);

      const retrieved = await getChapterFromDB('chap_preserve_1');
      expect(retrieved?.sourceText).toBe('斗之力，三段！');
      expect(retrieved?.rawTranslation).toBe('Đấu chi lực, tam đoạn!');
      expect(retrieved?.polishedTranslation).toBe('Đấu lực, tam đoạn! [Bản sửa mới]');
    });
  });

  describe('saveChaptersToDB batch safeguard', () => {
    it('applies safeguard to every chapter in a batch write', async () => {
      const { saveChaptersToDB, getChapterFromDB, saveChapterToDB } = await import('../db');
      const c1 = createMockChapter({ id: 'batch_1', sourceText: '原文1', rawTranslation: 'Thô 1' });
      const c2 = createMockChapter({ id: 'batch_2', sourceText: '原文2', rawTranslation: 'Thô 2' });
      await saveChapterToDB(c1);
      await saveChapterToDB(c2);

      const batchUpdate: Chapter[] = [
        { ...c1, sourceText: '', rawTranslation: '', polishedTranslation: 'Mới 1' },
        { ...c2, sourceText: '原文2 cập nhật', rawTranslation: '', polishedTranslation: 'Mới 2' },
      ];
      await saveChaptersToDB(batchUpdate);

      const retrieved1 = await getChapterFromDB('batch_1');
      const retrieved2 = await getChapterFromDB('batch_2');

      expect(retrieved1?.sourceText).toBe('原文1');
      expect(retrieved1?.rawTranslation).toBe('Thô 1');
      expect(retrieved1?.polishedTranslation).toBe('Mới 1');

      expect(retrieved2?.sourceText).toBe('原文2 cập nhật');
      expect(retrieved2?.rawTranslation).toBe('Thô 2');
      expect(retrieved2?.polishedTranslation).toBe('Mới 2');
    });
  });

  describe('crdtDocManager.mergeChapterCrdt nullish fix (T005)', () => {
    it('does not allow empty string snapshot in YDoc to wipe localChapter rawTranslation or polishedTranslation', () => {
      const localChapter = createMockChapter({
        id: 'crdt_1',
        rawTranslation: 'Bản dịch thô cục bộ',
        polishedTranslation: 'Bản mượt cục bộ',
      });
      const remoteChapter = createMockChapter({
        id: 'crdt_1',
        rawTranslation: '',
        polishedTranslation: '',
      });

      const mergeResult = mergeChapterCrdt({
        chapterId: 'crdt_1',
        projectId: 'proj_1',
        localChapter,
        remoteChapter,
      });

      expect(mergeResult.mergedChapter.rawTranslation).toBe('Bản dịch thô cục bộ');
      expect(mergeResult.mergedChapter.polishedTranslation).toBe('Bản mượt cục bộ');
    });
  });
});
