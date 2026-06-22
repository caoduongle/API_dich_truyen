import { useState, useEffect, useCallback, useMemo } from 'react';
import { StoryProject, GlossaryItem, PendingGlossaryItem, Chapter, ChapterMetadata } from '../types';
import { getProjectsFromDB, saveProjectToDB, deleteProjectFromDB, saveChapterToDB, deleteChapterFromDB, getChapterFromDB, getChaptersByProjectFromDB, deleteChaptersByProjectFromDB, saveChaptersToDB } from '../services/db';
import { useNotifications } from '../components/NotificationSystem';
import { isHanEquivalent } from '@shared/sinoNormalize';

const DEFAULT_PROJECTS: any[] = [
    {
        id: 'proj_dau_pha',
        title: 'Đấu Phá Thương Khung (Đại Lục Đấu Khí)',
        author: 'Thiên Tàm Thổ Đậu',
        genre: 'Tiên Hiệp',
        tone: 'Trang nghiêm cổ phong',
        description: 'Bộ tiểu thuyết huyền huyễn huyền thoại. Tập trung miêu tả thế giới đấu khí, dị hỏa hùng vĩ, cuộc hành trình quật khởi đầy chông gai của thiếu niên bị phế bỏ.',
        glossary: [
            { id: 'glo_1', chinese: '萧炎', pinyin: 'Tiêu Viêm', vietnamese: 'Tiêu Viêm', type: 'character', note: 'Nhân vật nam chính bướng bỉnh chí khí, sở hữu dị hỏa dung hợp huyền công', createdAt: new Date().toISOString() },
            { id: 'glo_2', chinese: '药老', pinyin: 'Dược Lão', vietnamese: 'Dược Lão', type: 'character', note: 'Sư phụ linh hồn vĩ đại của Tiêu Viêm ẩn dật trong giới chỉ', createdAt: new Date().toISOString() },
            { id: 'glo_3', chinese: '熏儿', pinyin: 'Huân Nhi', vietnamese: 'Huân Nhi', type: 'character', note: 'Nhân vật nữ chính xinh đẹp, cao quý, xuất thân gia tộc thượng cổ', createdAt: new Date().toISOString() },
            { id: 'glo_4', chinese: '青莲地心火', pinyin: 'Thanh Liên Địa Tâm Hỏa', vietnamese: 'Thanh Liên Địa Tâm Hỏa', type: 'term', note: 'Dị hỏa xếp hạng thứ 19, kết tinh ở địa tâm dung nham', createdAt: new Date().toISOString() },
            { id: 'glo_5', chinese: '乌坦城', pinyin: 'Ô Thản Thành', vietnamese: 'thành Ô Thản', type: 'location', note: 'Một ngôi thành nhỏ biên thùy nơi Tiêu Viêm sinh ra và bị ghẻ lạnh lúc đầu', createdAt: new Date().toISOString() },
            { id: 'glo_6', chinese: '斗之气', pinyin: 'Đấu Chi Khí', vietnamese: 'Đấu Chi Khí', type: 'term', note: 'Giai đoạn tu luyện đấu khí căn bản sơ khai', createdAt: new Date().toISOString() }
        ],
        chapters: [
            {
                id: 'chap_sample_1',
                title: 'Chương tóm lược mẫu: Hành Trình Bắt Đầu',
                sourceText: '在斗气大陆，弱者无容身之地。萧炎望着双手，内心燃起熊熊烈火：“药老，我定要成为强者！”',
                rawTranslation: 'Tại đấu khí đại lục, kẻ yếu không có chỗ dung thân. Tiêu Viêm nhìn lấy hai tay, nội tâm dấy lên hùng hùng liệt hỏa: "Dược Lão, ta nhất định phải trở thành cường giả!"',
                polishedTranslation: 'Trên Đại Lục Đấu Khí, kẻ yếu hèn không bao giờ có chỗ dung thân. Tiêu Viêm nhìn chăm chăm vào đôi bàn tay gầy gò của mình, ngọn lửa của ý chí bùng cháy dữ dội trong thâm tâm: "Dược Lão, ta thề nhất định phải tự mình rèn luyện thành cường giả tối cao!"',
                paragraphs: ['在斗气大陆，弱者无容身之地。', '萧炎望着双手，内心燃起熊熊烈火："药老，我定要成为强者！"'],
                translatedLines: ['Trên Đại Lục Đấu Khí, kẻ yếu hèn không bao giờ có chỗ dung thân.', '"Dược Lão, ta thề nhất định phải trở thành cường giả!"'],
                status: 'completed',
                createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
                updatedAt: new Date(Date.now() - 3600000 * 24).toISOString()
            }
        ],
        pendingGlossary: [],
        createdAt: new Date().toISOString()
    }
];

function normalizeProject(project: any): StoryProject {
    return {
        ...project,
        chapters: (project.chapters || []).map((c: any) => {
            if ('sourceText' in c) {
                return {
                    id: c.id,
                    title: c.title,
                    status: c.status || 'not_started',
                    createdAt: c.createdAt,
                    updatedAt: c.updatedAt
                };
            }
            return c;
        })
    };
}

export function useProjects() {
    const [projects, setProjects] = useState<StoryProject[]>([]);
    const [activeProjectId, setActiveProjectId] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const { showToast } = useNotifications();

    useEffect(() => {
        async function loadData() {
            const stored = await getProjectsFromDB();
            if (stored.length > 0) {
                setProjects(stored);
                setActiveProjectId(stored[0].id);
            } else {
                for (const p of DEFAULT_PROJECTS) {
                    await saveProjectToDB(p);
                }
                const normalized = DEFAULT_PROJECTS.map(normalizeProject);
                setProjects(normalized);
                setActiveProjectId(normalized[0].id);
            }
            setIsLoading(false);
        }
        loadData();
    }, []);

    const activeProject = useMemo(() => {
        return projects.find(p => p.id === activeProjectId);
    }, [projects, activeProjectId]);

    const handleUpdateProject = useCallback(async (updatedProj: StoryProject) => {
        await saveProjectToDB(updatedProj);

        const normalizedProj: StoryProject = {
            ...updatedProj,
            chapters: updatedProj.chapters.map(c => {
                if ('sourceText' in c) {
                    return {
                        id: c.id,
                        title: c.title,
                        status: c.status || 'not_started',
                        createdAt: c.createdAt,
                        updatedAt: c.updatedAt
                    };
                }
                return c as ChapterMetadata;
            })
        };

        setProjects(prev => prev.map(p => p.id === normalizedProj.id ? normalizedProj : p));
    }, []);

    const handleSelectProject = useCallback((id: string) => {
        setActiveProjectId(id);
    }, []);

    const handleDeleteProject = useCallback(async (id: string) => {
        const project = projects.find(p => p.id === id);
        if (!project) return;

        // 1. Load full chapter bodies for backup before deleting
        const backedUpChapters = await getChaptersByProjectFromDB(id);

        // 2. Perform DB deletion atomically (deletes project and its chapters)
        await deleteProjectFromDB(id);

        const oldProjects = [...projects];

        setProjects(prev => {
            const remaining = prev.filter(p => p.id !== id);
            if (remaining.length > 0) {
                setActiveProjectId(remaining[0].id);
                return remaining;
            }
            return remaining; // Avoid regenerating defaults if not needed
        });

        // 3. Show undoable toast
        showToast({
            message: `Đã xóa dự án "${project.title}" vĩnh viễn khỏi bộ nhớ.`,
            type: 'info',
            onUndo: async () => {
                // Restore in IndexedDB
                await saveProjectToDB(project);
                await saveChaptersToDB(backedUpChapters);
                // Restore in React state
                setProjects(oldProjects);
                setActiveProjectId(project.id);
                showToast({
                    message: `Đã khôi phục thành công dự án "${project.title}".`,
                    type: 'success'
                });
            }
        });
    }, [projects, showToast]);

    const handleCreateProject = useCallback(async (newProjData: Omit<StoryProject, 'id' | 'createdAt'>) => {
        const id = 'proj_' + Date.now();
        const newProj: StoryProject = {
            ...newProjData,
            id,
            glossary: newProjData.glossary || [],
            chapters: newProjData.chapters || [],
            createdAt: new Date().toISOString()
        };
        await saveProjectToDB(newProj);

        const normalizedProj: StoryProject = {
            ...newProj,
            chapters: newProj.chapters.map(c => {
                if ('sourceText' in c) {
                    return {
                        id: c.id,
                        title: c.title,
                        status: c.status || 'not_started',
                        createdAt: c.createdAt,
                        updatedAt: c.updatedAt
                    };
                }
                return c as ChapterMetadata;
            })
        };

        setProjects(prev => [normalizedProj, ...prev]);
        setActiveProjectId(id);
    }, []);

    const handleAddGlossaryItem = useCallback(async (newItem: Omit<GlossaryItem, 'id'>, force = false) => {
        const activeProj = projects.find(p => p.id === activeProjectId);
        if (!activeProj) return;

        const cleanVietnamese = (newItem.vietnamese || '').trim().toLowerCase();
        const alreadyExists = activeProj.glossary.some(
            (g) => {
                if (force) {
                    return g.chinese.trim() === newItem.chinese.trim();
                }
                return isHanEquivalent(g.chinese, newItem.chinese) ||
                       (cleanVietnamese && g.vietnamese.trim().toLowerCase() === cleanVietnamese);
            }
        );
        if (alreadyExists) return;

        const completeItem: GlossaryItem = {
            ...newItem,
            id: 'glo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            createdAt: newItem.createdAt || new Date().toISOString()
        };
        const updated: StoryProject = { ...activeProj, glossary: [completeItem, ...activeProj.glossary] };
        await saveProjectToDB(updated);

        setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
    }, [activeProjectId, projects]);

    const handleAddGlossaryItems = useCallback(async (newItems: Omit<GlossaryItem, 'id'>[]) => {
        const activeProj = projects.find(p => p.id === activeProjectId);
        if (!activeProj) return;

        const completeItems: GlossaryItem[] = [];
        newItems.forEach((item, idx) => {
            const cleanVietnamese = (item.vietnamese || '').trim().toLowerCase();
            
            // Check if item's Chinese already exists in activeProj.glossary or completeItems
            const chineseExists = activeProj.glossary.some(g => isHanEquivalent(g.chinese, item.chinese)) ||
                                  completeItems.some(g => isHanEquivalent(g.chinese, item.chinese));
            if (chineseExists) return;

            // Check if item's Vietnamese already exists in activeProj.glossary or completeItems
            const vietnameseExists = (cleanVietnamese && activeProj.glossary.some(g => g.vietnamese.trim().toLowerCase() === cleanVietnamese)) ||
                                     (cleanVietnamese && completeItems.some(g => g.vietnamese.trim().toLowerCase() === cleanVietnamese));
            if (vietnameseExists) return;

            completeItems.push({
                ...item,
                id: `glo_md_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`,
                createdAt: item.createdAt || new Date().toISOString()
            });
        });
        if (completeItems.length === 0) return;
        const updated: StoryProject = { ...activeProj, glossary: [...completeItems, ...activeProj.glossary] };
        await saveProjectToDB(updated);

        setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
    }, [activeProjectId, projects]);

    const handleUpdateGlossaryItem = useCallback(async (id: string, updatedItem: GlossaryItem) => {
        const activeProj = projects.find(p => p.id === activeProjectId);
        if (!activeProj) return;

        const updatedGlossary = activeProj.glossary.map(item => item.id === id ? updatedItem : item);
        const updated: StoryProject = { ...activeProj, glossary: updatedGlossary };
        await saveProjectToDB(updated);

        setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
    }, [activeProjectId, projects]);

    const handleDeleteGlossaryItem = useCallback(async (id: string) => {
        const activeProj = projects.find(p => p.id === activeProjectId);
        if (!activeProj) return;

        const updatedGlossary = activeProj.glossary.filter(item => item.id !== id);
        const updated: StoryProject = { ...activeProj, glossary: updatedGlossary };
        await saveProjectToDB(updated);

        setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
    }, [activeProjectId, projects]);

    const handleMergeGlossaryItems = useCallback(async (
        primaryId: string,
        mergedPayload: Partial<GlossaryItem>,
        idsToDelete: string[]
    ) => {
        const activeProj = projects.find(p => p.id === activeProjectId);
        if (!activeProj) return;

        const updatedGlossary = activeProj.glossary.map(item => {
            if (item.id === primaryId) {
                return {
                    ...item,
                    ...mergedPayload
                } as GlossaryItem;
            }
            return item;
        }).filter(item => !idsToDelete.includes(item.id));

        const updated: StoryProject = { ...activeProj, glossary: updatedGlossary };
        await saveProjectToDB(updated);

        setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
    }, [activeProjectId, projects]);

    const handleDeleteChapterHistory = useCallback(async (chapId: string) => {
        const activeProj = projects.find(p => p.id === activeProjectId);
        if (!activeProj) return;

        const chapterMeta = activeProj.chapters.find(c => c.id === chapId);
        if (!chapterMeta) return;

        // 1. Back up full chapter data
        const fullChapter = await getChapterFromDB(chapId);
        if (!fullChapter) return;

        // 2. Perform deletion
        await deleteChapterFromDB(chapId);

        const updatedChapters = activeProj.chapters.filter(c => c.id !== chapId);
        const updated: StoryProject = { ...activeProj, chapters: updatedChapters };
        await saveProjectToDB(updated);

        const oldProjects = [...projects];
        setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));

        // 3. Show undoable toast
        showToast({
            message: `Đã xóa chương "${chapterMeta.title}" khỏi lịch sử dịch.`,
            type: 'info',
            onUndo: async () => {
                // Restore in IndexedDB
                await saveChapterToDB(fullChapter);
                await saveProjectToDB(activeProj);
                // Restore in React state
                setProjects(oldProjects);
                showToast({
                    message: `Đã khôi phục chương "${chapterMeta.title}" thành công.`,
                    type: 'success'
                });
            }
        });
    }, [activeProjectId, projects, showToast]);

    const handleAddToPendingGlossary = useCallback(async (item: PendingGlossaryItem) => {
        const activeProj = projects.find(p => p.id === activeProjectId);
        if (!activeProj) return;

        const updated: StoryProject = { ...activeProj, pendingGlossary: [...(activeProj.pendingGlossary || []), item] };
        await saveProjectToDB(updated);

        setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
    }, [activeProjectId, projects]);

    const handleConfirmPendingItem = useCallback(async (pendingId: string, override?: Partial<GlossaryItem>) => {
        const activeProj = projects.find(p => p.id === activeProjectId);
        if (!activeProj) return;

        const pendingItem = (activeProj.pendingGlossary || []).find(p => p.id === pendingId);
        if (!pendingItem) return;
        const confirmed: GlossaryItem = {
            id: 'glo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            chinese: override?.chinese ?? pendingItem.chinese,
            pinyin: override?.pinyin ?? pendingItem.pinyin,
            vietnamese: override?.vietnamese ?? pendingItem.vietnamese,
            type: override?.type ?? pendingItem.type,
            note: override?.note ?? pendingItem.note,
            createdAt: new Date().toISOString()
        };
        const updated: StoryProject = {
            ...activeProj,
            glossary: [confirmed, ...activeProj.glossary],
            pendingGlossary: (activeProj.pendingGlossary || []).filter(p => p.id !== pendingId)
        };
        await saveProjectToDB(updated);

        setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
    }, [activeProjectId, projects]);

    const handleDiscardPendingItem = useCallback(async (pendingId: string) => {
        const activeProj = projects.find(p => p.id === activeProjectId);
        if (!activeProj) return;

        const updated: StoryProject = {
            ...activeProj,
            pendingGlossary: (activeProj.pendingGlossary || []).filter(p => p.id !== pendingId)
        };
        await saveProjectToDB(updated);

        setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
    }, [activeProjectId, projects]);

    const handleResetChapters = useCallback(async (projectId: string, chapIds: string[]) => {
        const backedUpChapters: Chapter[] = [];
        for (const chapId of chapIds) {
            const chap = await getChapterFromDB(chapId);
            if (chap) {
                backedUpChapters.push(chap);
            }
        }

        if (backedUpChapters.length === 0) return;

        // 1. Perform reset on IndexedDB chapters
        const resetChaptersList = backedUpChapters.map(chap => ({
            ...chap,
            rawTranslation: '',
            polishedTranslation: '',
            translatedLines: [],
            status: 'not_started' as const,
            updatedAt: new Date().toISOString()
        }));
        await saveChaptersToDB(resetChaptersList);

        const oldProjects = [...projects];

        // 2. Perform reset on React state
        const activeProj = projects.find(p => p.id === projectId);
        if (activeProj) {
            const updatedChapters = activeProj.chapters.map(c => {
                if (chapIds.includes(c.id)) {
                    return {
                        ...c,
                        status: 'not_started' as const,
                        updatedAt: new Date().toISOString()
                    };
                }
                return c;
            });
            const updatedProj = { ...activeProj, chapters: updatedChapters };
            await saveProjectToDB(updatedProj);
            setProjects(prev => prev.map(p => p.id === projectId ? updatedProj : p));
        }

        // 3. Show undoable toast
        const count = chapIds.length;
        showToast({
            message: `Đã reset ${count} chương về trạng thái bản gốc tiếng Trung.`,
            type: 'info',
            onUndo: async () => {
                // Restore all chapters in IndexedDB
                await saveChaptersToDB(backedUpChapters);
                // Restore in React state
                setProjects(oldProjects);
                const oldProj = oldProjects.find(p => p.id === projectId);
                if (oldProj) {
                    await saveProjectToDB(oldProj);
                }
                showToast({
                    message: `Đã khôi phục hoàn chỉnh bản dịch cho ${count} chương.`,
                    type: 'success'
                });
            }
        });
    }, [projects, showToast]);

    return {
        projects,
        activeProjectId,
        activeProject,
        isLoading,
        handleUpdateProject,
        handleSelectProject,
        handleDeleteProject,
        handleCreateProject,
        handleAddGlossaryItem,
        handleAddGlossaryItems,
        handleUpdateGlossaryItem,
        handleDeleteGlossaryItem,
        handleMergeGlossaryItems,
        handleDeleteChapterHistory,
        handleAddToPendingGlossary,
        handleConfirmPendingItem,
        handleDiscardPendingItem,
        handleResetChapters
    };
}
