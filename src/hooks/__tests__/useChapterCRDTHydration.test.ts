import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useChapterCRDT } from '../useChapterCRDT';
import { Chapter } from '../../types';
import { createMockChapter } from '../../services/__tests__/storageFixtures';
import { createChapterYDoc, exportDocUpdate } from '../../services/crdtDocManager';

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
      // Ignore
    }
  }
  effectCleanups = [];
}

describe('User Story 2: Editor CRDT State Hydration on Undo Reopening (T010)', () => {
  let mockProjectsStore: Map<string, any> = new Map();
  let mockChaptersStore: Map<string, Chapter> = new Map();
  let mockCrdtStatesStore: Map<string, any> = new Map();

  beforeEach(() => {
    resetHookHarness();
    mockProjectsStore.clear();
    mockChaptersStore.clear();
    mockCrdtStatesStore.clear();

    const mockDB: any = {
      objectStoreNames: {
        contains: (name: string) => ['projects', 'chapters', 'crdt_states'].includes(name),
      },
      transaction: (storeNames: string | string[], mode: string) => {
        let activeRequests = 0;
        let isCommitted = false;
        const tx: any = {
          oncomplete: null,
          onerror: null,
          onabort: null,
        };

        const tryComplete = () => {
          if (activeRequests === 0 && !isCommitted) {
            isCommitted = true;
            queueMicrotask(() => tx.oncomplete?.());
          }
        };

        const schedule = (cb: () => void) => {
          activeRequests++;
          queueMicrotask(() => {
            cb();
            activeRequests--;
            tryComplete();
          });
        };

        setTimeout(() => tryComplete(), 50);

        tx.objectStore = (name: string) => {
          if (name === 'projects') {
            return {
              get: (id: string) => {
                const req: any = { result: undefined, onsuccess: null, onerror: null };
                schedule(() => {
                  req.result = mockProjectsStore.get(id);
                  req.onsuccess?.({ target: req });
                });
                return req;
              },
              put: (item: any) => {
                const req: any = { result: item.id, onsuccess: null, onerror: null };
                schedule(() => {
                  mockProjectsStore.set(item.id, item);
                  req.onsuccess?.({ target: req });
                });
                return req;
              },
            };
          }
          if (name === 'crdt_states') {
            return {
              get: (id: string) => {
                const req: any = { result: undefined, onsuccess: null, onerror: null };
                schedule(() => {
                  req.result = mockCrdtStatesStore.get(id);
                  req.onsuccess?.({ target: req });
                });
                return req;
              },
              put: (item: any) => {
                const req: any = { result: item.chapterId, onsuccess: null, onerror: null };
                schedule(() => {
                  mockCrdtStatesStore.set(item.chapterId, item);
                  req.onsuccess?.({ target: req });
                });
                return req;
              },
            };
          }
          return {
            get: (id: string) => {
              const req: any = { result: undefined, onsuccess: null, onerror: null };
              schedule(() => {
                const item = mockChaptersStore.get(id);
                req.result = item ? JSON.parse(JSON.stringify(item)) : undefined;
                req.onsuccess?.({ target: req });
              });
              return req;
            },
            put: (item: any) => {
              const req: any = { result: item.id, onsuccess: null, onerror: null };
              schedule(() => {
                mockChaptersStore.set(item.id, JSON.parse(JSON.stringify(item)));
                req.onsuccess?.({ target: req });
              });
              return req;
            },
          };
        };
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

  it('hydrates Y.Doc from stored crdt_states snapshot upon opening a chapter session', async () => {
    const { saveCrdtState, saveProjectToDB, saveChapterToDB, resetDBInstanceForTesting, getCrdtState } = await import('../../services/db');
    resetDBInstanceForTesting();

    // 1. Setup parent project and chapter
    await saveProjectToDB({ id: 'p_hydrate_test', title: 'Hydrate Project', chapters: [] } as any);
    const chapter = createMockChapter({
      id: 'chap_hydrate_1',
      projectId: 'p_hydrate_test',
      title: 'Chương 1',
      sourceText: '原文内容',
      rawTranslation: '',
      polishedTranslation: '',
    });
    await saveChapterToDB(chapter);

    // 2. Generate a valid CRDT snapshot with translated text
    const session = createChapterYDoc('p_hydrate_test', 'chap_hydrate_1', {
      ...chapter,
      rawTranslation: 'Bản dịch thô đã khôi phục',
      polishedTranslation: 'Bản dịch mượt đã khôi phục',
    });
    const snapshotUpdate = exportDocUpdate(session.doc);

    await saveCrdtState({
      chapterId: 'chap_hydrate_1',
      projectId: 'p_hydrate_test',
      state: snapshotUpdate,
      updatedAt: new Date().toISOString(),
    });

    stateIndex = 0;
    refIndex = 0;
    effectIdx = 0;
    callbackIdx = 0;

    let receivedRemoteChange: any = null;
    const onRemoteChange = vi.fn((updated) => {
      receivedRemoteChange = updated;
    });

    // 3. Mount useChapterCRDT
    useChapterCRDT({
      projectId: 'p_hydrate_test',
      chapterId: 'chap_hydrate_1',
      initialChapter: chapter,
      onRemoteChange,
    });
    flushEffects();

    // 4. Wait for async crdt_states hydration to complete
    await new Promise((r) => setTimeout(r, 60));

    expect(onRemoteChange).toHaveBeenCalled();
    expect(receivedRemoteChange).not.toBeNull();
    expect(receivedRemoteChange.rawTranslation).toBe('Bản dịch thô đã khôi phục');
    expect(receivedRemoteChange.polishedTranslation).toBe('Bản dịch mượt đã khôi phục');
  });
});
