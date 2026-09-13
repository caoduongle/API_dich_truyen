import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useChapterCRDT } from '../useChapterCRDT';
import { Chapter } from '../../types';
import { createMockChapter } from '../../services/__tests__/storageFixtures';

// React hooks mock state
let stateSlots: any[] = [];
let stateIndex = 0;
let refSlots: any[] = [];
let refIndex = 0;
let registeredEffects: Array<() => void | (() => void)> = [];
let effectCleanups: Array<() => void> = [];
const prevDepsMap = new Map<number, any[] | undefined>();
let effectIdx = 0;
const callbackDepsMap = new Map<number, { fn: any; deps: any[] }>();
let callbackIdx = 0;

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
  useRef: (initial: any) => {
    const idx = refIndex++;
    if (refSlots.length <= idx) {
      refSlots[idx] = { current: initial };
    }
    return refSlots[idx];
  },
  useCallback: (fn: any, deps?: any[]) => {
    const currentIdx = callbackIdx++;
    const prev = callbackDepsMap.get(currentIdx);
    const hasChanged = !prev || !deps || deps.some((dep, i) => dep !== prev.deps[i]);
    if (hasChanged) {
      callbackDepsMap.set(currentIdx, { fn, deps: deps ? [...deps] : [] });
      return fn;
    }
    return prev.fn;
  },
  useEffect: (effect: any, deps?: any[]) => {
    const currentIdx = effectIdx++;
    const prevDeps = prevDepsMap.get(currentIdx);
    const hasChanged = !prevDeps || !deps || deps.some((dep, i) => dep !== prevDeps[i]);
    if (hasChanged) {
      prevDepsMap.set(currentIdx, deps ? [...deps] : undefined);
      registeredEffects.push(effect);
    }
  },
}));

function resetHookHarness() {
  stateSlots = [];
  stateIndex = 0;
  refSlots = [];
  refIndex = 0;
  registeredEffects = [];
  effectCleanups = [];
  prevDepsMap.clear();
  effectIdx = 0;
  callbackDepsMap.clear();
  callbackIdx = 0;
}

function flushEffects() {
  const effectsToRun = [...registeredEffects];
  registeredEffects = [];
  for (const eff of effectsToRun) {
    const cleanup = eff();
    if (typeof cleanup === 'function') {
      effectCleanups.push(cleanup);
    }
  }
}

function cleanupEffects() {
  for (const cleanup of effectCleanups) {
    try {
      cleanup();
    } catch {
      // Ignore cleanup error
    }
  }
  effectCleanups = [];
}

describe('User Story 1: Total Text Preservation During Translation & Editing (T007)', () => {
  let mockChaptersStore: Map<string, Chapter> = new Map();

  beforeEach(() => {
    resetHookHarness();
    mockChaptersStore.clear();

    const mockDB: any = {
      transaction: (storeNames: string | string[], mode: string) => {
        const tx: any = {
          oncomplete: null,
          onerror: null,
          objectStore: (name: string) => {
            return {
              get: (id: string) => {
                const item = mockChaptersStore.get(id);
                const req: any = {
                  result: item ? JSON.parse(JSON.stringify(item)) : undefined,
                  onsuccess: null,
                  onerror: null,
                };
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
    cleanupEffects();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('preserves sourceText and rawTranslation when updating polished translation', async () => {
    const { saveChapterToDB, getChapterFromDB } = await import('../../services/db');
    const originalChapter = createMockChapter({
      id: 'chap_us1_1',
      projectId: 'proj_test',
      sourceText: '天蚕土豆著',
      rawTranslation: 'Thiên Tằm Thổ Đậu trứ',
      polishedTranslation: 'Tác giả: Thiên Tằm Thổ Đậu',
    });
    await saveChapterToDB(originalChapter);

    stateIndex = 0;
    refIndex = 0;
    effectIdx = 0;
    callbackIdx = 0;

    const hookResult = useChapterCRDT({
      projectId: 'proj_test',
      chapterId: 'chap_us1_1',
      initialChapter: originalChapter,
    });
    flushEffects();

    // Live edit on polished translation
    hookResult.updatePolishedTranslation('Tác giả: Thiên Tằm Thổ Đậu (Bản hiệu đính chuẩn)');

    // Wait for debounced auto-save (500ms debounce + IDB async)
    await new Promise((r) => setTimeout(r, 650));

    const saved = await getChapterFromDB('chap_us1_1');
    expect(saved).not.toBeNull();
    expect(saved?.sourceText).toBe('天蚕土豆著');
    expect(saved?.rawTranslation).toBe('Thiên Tằm Thổ Đậu trứ');
    expect(saved?.polishedTranslation).toBe('Tác giả: Thiên Tằm Thổ Đậu (Bản hiệu đính chuẩn)');
  });

  it('hydrates YDoc from IndexedDB when initialChapter is null and prevents data loss', async () => {
    const { saveChapterToDB, getChapterFromDB } = await import('../../services/db');
    const storedChapter = createMockChapter({
      id: 'chap_us1_2',
      projectId: 'proj_test',
      sourceText: '药老微笑道：“小家伙，不错嘛。”',
      rawTranslation: 'Dược Lão vi tiếu đạo: "Tiểu gia hỏa, bất thác ma."',
      polishedTranslation: 'Dược Lão mỉm cười nói: "Nhóc con, khá đấy chứ."',
    });
    await saveChapterToDB(storedChapter);

    stateIndex = 0;
    refIndex = 0;
    effectIdx = 0;
    callbackIdx = 0;

    // Mount without initialChapter (e.g., loaded by dropdown / clearLoadedChapter)
    const hookResult = useChapterCRDT({
      projectId: 'proj_test',
      chapterId: 'chap_us1_2',
      initialChapter: null,
    });
    flushEffects();

    // Wait for async hydration to complete
    await new Promise((r) => setTimeout(r, 60));

    // Simulate an audit fix / minor edit on polished translation
    hookResult.updatePolishedTranslation('Dược Lão cười khẽ bảo: "Nhóc con, khá đấy chứ."');

    // Wait for debounced auto-save
    await new Promise((r) => setTimeout(r, 650));

    const updated = await getChapterFromDB('chap_us1_2');
    expect(updated?.sourceText).toBe('药老微笑道：“小家伙，不错嘛。”');
    expect(updated?.rawTranslation).toBe('Dược Lão vi tiếu đạo: "Tiểu gia hỏa, bất thác ma."');
    expect(updated?.polishedTranslation).toBe('Dược Lão cười khẽ bảo: "Nhóc con, khá đấy chứ."');
  });

  it('stores sourceText in metadataMap when updateMetadata is called', async () => {
    const { getChapterFromDB } = await import('../../services/db');

    stateIndex = 0;
    refIndex = 0;
    effectIdx = 0;
    callbackIdx = 0;

    const hookResult = useChapterCRDT({
      projectId: 'proj_test',
      chapterId: 'chap_us1_3',
      initialChapter: null,
    });
    flushEffects();

    hookResult.updateMetadata({
      sourceText: '新添加的原文内容',
      title: 'Chương mới tạo',
    });
    hookResult.updateRawTranslation('Nội dung dịch thô mới');

    await new Promise((r) => setTimeout(r, 650));

    const saved = await getChapterFromDB('chap_us1_3');
    expect(saved?.sourceText).toBe('新添加的原文内容');
    expect(saved?.title).toBe('Chương mới tạo');
    expect(saved?.rawTranslation).toBe('Nội dung dịch thô mới');
  });
});
