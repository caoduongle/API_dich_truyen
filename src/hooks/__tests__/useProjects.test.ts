import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useProjects } from '../useProjects';
import { GlossaryItem } from '../../types';

import * as db from '../../services/db';

const mockShowToast = vi.fn();

// Mock dependencies
vi.mock('../../services/db', () => ({
    getProjectsFromDB: vi.fn(),
    saveProjectToDB: vi.fn(),
    deleteProjectFromDB: vi.fn(),
    saveChapterToDB: vi.fn(),
    deleteChapterFromDB: vi.fn(),
    getChapterFromDB: vi.fn(),
    getChaptersByProjectFromDB: vi.fn(),
    deleteChaptersByProjectFromDB: vi.fn(),
    saveChaptersToDB: vi.fn(),
    getCrdtStatesByProject: vi.fn(),
    saveCrdtStates: vi.fn(),
    getCrdtState: vi.fn(),
    saveCrdtState: vi.fn(),
}));

vi.mock('../../context/NotificationContext', () => ({
    useNotifications: () => ({
        showToast: mockShowToast,
    }),
}));

vi.mock('../../lib/sinoNormalize', () => ({
    isHanEquivalent: (a: string, b: string) => a === b,
}));

let mockState = {
    projects: [] as any[],
    activeProjectId: '',
    isLoading: true,
};

let refCurrent: any[] = [];

const mockSetProjectsState = vi.fn((updater) => {
    if (typeof updater === 'function') {
        mockState.projects = updater(mockState.projects);
    } else {
        mockState.projects = updater;
    }
    refCurrent = mockState.projects;
});

const mockSetActiveProjectId = vi.fn((val) => {
    mockState.activeProjectId = val;
});

const mockSetIsLoading = vi.fn((val) => {
    mockState.isLoading = val;
});

vi.mock('react', () => {
    return {
        useState: (initial: any) => {
            if (Array.isArray(initial)) {
                return [mockState.projects, mockSetProjectsState];
            } else if (typeof initial === 'string') {
                return [mockState.activeProjectId, mockSetActiveProjectId];
            } else {
                return [mockState.isLoading, mockSetIsLoading];
            }
        },
        useEffect: vi.fn(),
        useCallback: (fn: any) => fn,
        useMemo: (fn: any) => fn(),
        useRef: (initial: any) => {
            return {
                get current() {
                    return refCurrent;
                },
                set current(val) {
                    refCurrent = val;
                }
            };
        },
    };
});

describe('useProjects - State management hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockState.projects = [
            {
                id: 'proj_1',
                title: 'Test Project',
                glossary: [
                    { id: 'glo_1', chinese: '测试1', pinyin: 'test1', vietnamese: 'test1', type: 'term', note: '' },
                    { id: 'glo_2', chinese: '测试2', pinyin: 'test2', vietnamese: 'test2', type: 'term', note: '' },
                ],
                chapters: [],
                pendingGlossary: [],
                createdAt: new Date().toISOString(),
            }
        ];
        mockState.activeProjectId = 'proj_1';
        mockState.isLoading = false;
        refCurrent = mockState.projects;
    });

    it('should correctly update multiple glossary items synchronously in the same tick', async () => {
        const hook = useProjects();

        const updatedItem1: GlossaryItem = { id: 'glo_1', chinese: '测试1', pinyin: 'test1', vietnamese: 'updated_test1', type: 'term', note: 'new note 1' };
        const updatedItem2: GlossaryItem = { id: 'glo_2', chinese: '测试2', pinyin: 'test2', vietnamese: 'updated_test2', type: 'term', note: 'new note 2' };

        // Call updates synchronously back-to-back
        hook.handleUpdateGlossaryItem('glo_1', updatedItem1);
        hook.handleUpdateGlossaryItem('glo_2', updatedItem2);

        // Check the final state
        const activeProj = mockState.projects.find(p => p.id === 'proj_1');
        expect(activeProj).toBeDefined();
        
        const item1 = activeProj.glossary.find((g: any) => g.id === 'glo_1');
        const item2 = activeProj.glossary.find((g: any) => g.id === 'glo_2');

        expect(item1.vietnamese).toBe('updated_test1');
        expect(item2.vietnamese).toBe('updated_test2');
        expect(item1.note).toBe('new note 1');
        expect(item2.note).toBe('new note 2');
    });

    it('restores project, chapters, and CRDT states upon project delete undo (US7)', async () => {
        const dummyProject = { id: 'proj_del', title: 'Delete Test', chapters: [], glossary: [] };
        const dummyChapters = [{ id: 'c1', projectId: 'proj_del', title: 'C1' }];
        const dummyCrdtStates = [{ chapterId: 'c1', projectId: 'proj_del', state: new Uint8Array([1]) }];

        mockState.projects = [dummyProject];
        refCurrent = mockState.projects;

        vi.mocked(db.getChaptersByProjectFromDB).mockResolvedValue(dummyChapters as any);
        vi.mocked(db.getCrdtStatesByProject).mockResolvedValue(dummyCrdtStates as any);

        const hook = useProjects();
        await hook.handleDeleteProject('proj_del');

        expect(mockShowToast).toHaveBeenCalled();
        const toastCall = mockShowToast.mock.calls[0][0];
        expect(toastCall.onUndo).toBeDefined();

        // Trigger undo callback
        await toastCall.onUndo();

        expect(db.saveProjectToDB).toHaveBeenCalledWith(dummyProject);
        expect(db.saveChaptersToDB).toHaveBeenCalledWith(dummyChapters);
        expect(db.saveCrdtStates).toHaveBeenCalledWith(dummyCrdtStates);
    });

    it('restores chapter and CRDT state upon single chapter delete undo (US7)', async () => {
        const dummyProject = {
            id: 'proj_1',
            title: 'Test',
            chapters: [{ id: 'chap_1', title: 'Chapter 1' }],
            glossary: [],
        };
        const dummyChapter = { id: 'chap_1', projectId: 'proj_1', title: 'Chapter 1' };
        const dummyCrdt = { chapterId: 'chap_1', projectId: 'proj_1', state: new Uint8Array([2]) };

        mockState.projects = [dummyProject];
        mockState.activeProjectId = 'proj_1';
        refCurrent = mockState.projects;

        vi.mocked(db.getChapterFromDB).mockResolvedValue(dummyChapter as any);
        vi.mocked(db.getCrdtState).mockResolvedValue(dummyCrdt as any);

        const hook = useProjects();
        await hook.handleDeleteChapterHistory('chap_1');

        expect(db.deleteChapterFromDB).toHaveBeenCalledWith('chap_1', 'proj_1');
        expect(mockShowToast).toHaveBeenCalled();
        const toastCall = mockShowToast.mock.calls[0][0];
        expect(toastCall.onUndo).toBeDefined();

        // Trigger undo callback
        await toastCall.onUndo();

        expect(db.saveChapterToDB).toHaveBeenCalledWith(dummyChapter);
        expect(db.saveCrdtState).toHaveBeenCalledWith(dummyCrdt);
    });
});
