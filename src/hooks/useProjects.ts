import { useState, useEffect, useCallback } from 'react';
import { StoryProject, GlossaryItem, PendingGlossaryItem, Chapter, ChapterMetadata } from '../types';
import { getProjectsFromDB, saveProjectToDB, deleteProjectFromDB, saveChapterToDB, deleteChapterFromDB, getChapterFromDB } from '../services/db';

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

    const getActiveProject = (): StoryProject | undefined => {
        return projects.find(p => p.id === activeProjectId);
    };

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
        if (project && project.chapters) {
            for (const c of project.chapters) {
                await deleteChapterFromDB(c.id);
            }
        }
        await deleteProjectFromDB(id);
        setProjects(prev => {
            const remaining = prev.filter(p => p.id !== id);
            if (remaining.length > 0) {
                setActiveProjectId(remaining[0].id);
                return remaining;
            } else {
                (async () => {
                    for (const p of DEFAULT_PROJECTS) {
                        await saveProjectToDB(p);
                    }
                })();
                const normalized = DEFAULT_PROJECTS.map(normalizeProject);
                setActiveProjectId(normalized[0].id);
                return normalized;
            }
        });
    }, [projects]);

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

    const handleAddGlossaryItem = useCallback((newItem: Omit<GlossaryItem, 'id'>) => {
        setProjects(prev => {
            const activeProj = prev.find(p => p.id === activeProjectId);
            if (!activeProj) return prev;

            const cleanChinese = (newItem.chinese || '').replace(/\s+/g, '').trim();
            const cleanVietnamese = (newItem.vietnamese || '').trim().toLowerCase();
            const alreadyExists = activeProj.glossary.some(
                (g) =>
                    g.chinese.replace(/\s+/g, '').trim() === cleanChinese ||
                    (cleanVietnamese && g.vietnamese.trim().toLowerCase() === cleanVietnamese)
            );
            if (alreadyExists) return prev;

            const completeItem: GlossaryItem = {
                ...newItem,
                id: 'glo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                createdAt: newItem.createdAt || new Date().toISOString()
            };
            const updated: StoryProject = { ...activeProj, glossary: [completeItem, ...activeProj.glossary] };
            saveProjectToDB(updated);

            return prev.map(p => p.id === updated.id ? updated : p);
        });
    }, [activeProjectId]);

    const handleAddGlossaryItems = useCallback((newItems: Omit<GlossaryItem, 'id'>[]) => {
        setProjects(prev => {
            const activeProj = prev.find(p => p.id === activeProjectId);
            if (!activeProj) return prev;

            const existingChinese = new Set(activeProj.glossary.map((g) => g.chinese.replace(/\s+/g, '').trim()));
            const existingVietnamese = new Set(activeProj.glossary.map((g) => g.vietnamese.trim().toLowerCase()));

            const completeItems: GlossaryItem[] = [];
            newItems.forEach((item, idx) => {
                const cleanChinese = (item.chinese || '').replace(/\s+/g, '').trim();
                const cleanVietnamese = (item.vietnamese || '').trim().toLowerCase();
                if (existingChinese.has(cleanChinese)) return;
                if (cleanVietnamese && existingVietnamese.has(cleanVietnamese)) return;
                existingChinese.add(cleanChinese);
                if (cleanVietnamese) existingVietnamese.add(cleanVietnamese);

                completeItems.push({
                    ...item,
                    id: `glo_md_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`,
                    createdAt: item.createdAt || new Date().toISOString()
                });
            });
            if (completeItems.length === 0) return prev;
            const updated: StoryProject = { ...activeProj, glossary: [...completeItems, ...activeProj.glossary] };
            saveProjectToDB(updated);

            return prev.map(p => p.id === updated.id ? updated : p);
        });
    }, [activeProjectId]);

    const handleUpdateGlossaryItem = useCallback((id: string, updatedItem: GlossaryItem) => {
        setProjects(prev => {
            const activeProj = prev.find(p => p.id === activeProjectId);
            if (!activeProj) return prev;

            const updatedGlossary = activeProj.glossary.map(item => item.id === id ? updatedItem : item);
            const updated: StoryProject = { ...activeProj, glossary: updatedGlossary };
            saveProjectToDB(updated);

            return prev.map(p => p.id === updated.id ? updated : p);
        });
    }, [activeProjectId]);

    const handleDeleteGlossaryItem = useCallback((id: string) => {
        setProjects(prev => {
            const activeProj = prev.find(p => p.id === activeProjectId);
            if (!activeProj) return prev;

            const updatedGlossary = activeProj.glossary.filter(item => item.id !== id);
            const updated: StoryProject = { ...activeProj, glossary: updatedGlossary };
            saveProjectToDB(updated);

            return prev.map(p => p.id === updated.id ? updated : p);
        });
    }, [activeProjectId]);

    const handleDeleteChapterHistory = useCallback(async (chapId: string) => {
        await deleteChapterFromDB(chapId);
        setProjects(prev => {
            const activeProj = prev.find(p => p.id === activeProjectId);
            if (!activeProj) return prev;

            const updatedChapters = activeProj.chapters.filter(c => c.id !== chapId);
            const updated: StoryProject = { ...activeProj, chapters: updatedChapters };
            saveProjectToDB(updated);

            return prev.map(p => p.id === updated.id ? updated : p);
        });
    }, [activeProjectId]);

    const handleAddToPendingGlossary = useCallback((item: PendingGlossaryItem) => {
        setProjects(prev => {
            const activeProj = prev.find(p => p.id === activeProjectId);
            if (!activeProj) return prev;

            const updated: StoryProject = { ...activeProj, pendingGlossary: [...(activeProj.pendingGlossary || []), item] };
            saveProjectToDB(updated);

            return prev.map(p => p.id === updated.id ? updated : p);
        });
    }, [activeProjectId]);

    const handleConfirmPendingItem = useCallback((pendingId: string, override?: Partial<GlossaryItem>) => {
        setProjects(prev => {
            const activeProj = prev.find(p => p.id === activeProjectId);
            if (!activeProj) return prev;

            const pendingItem = (activeProj.pendingGlossary || []).find(p => p.id === pendingId);
            if (!pendingItem) return prev;
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
            saveProjectToDB(updated);

            return prev.map(p => p.id === updated.id ? updated : p);
        });
    }, [activeProjectId]);

    const handleDiscardPendingItem = useCallback((pendingId: string) => {
        setProjects(prev => {
            const activeProj = prev.find(p => p.id === activeProjectId);
            if (!activeProj) return prev;

            const updated: StoryProject = {
                ...activeProj,
                pendingGlossary: (activeProj.pendingGlossary || []).filter(p => p.id !== pendingId)
            };
            saveProjectToDB(updated);

            return prev.map(p => p.id === updated.id ? updated : p);
        });
    }, [activeProjectId]);

    const handleResetChapters = useCallback(async (projectId: string, chapIds: string[]) => {
        for (const chapId of chapIds) {
            const chap = await getChapterFromDB(chapId);
            if (chap) {
                const updatedChap: Chapter = {
                    ...chap,
                    rawTranslation: '',
                    polishedTranslation: '',
                    translatedLines: [],
                    status: 'not_started',
                    updatedAt: new Date().toISOString()
                };
                await saveChapterToDB(updatedChap);
            }
        }

        setProjects(prev => {
            return prev.map(p => {
                if (p.id !== projectId) return p;
                const updatedChapters = p.chapters.map(c => {
                    if (chapIds.includes(c.id)) {
                        return {
                            ...c,
                            status: 'not_started' as const,
                            updatedAt: new Date().toISOString()
                        };
                    }
                    return c;
                });
                const updatedProj = { ...p, chapters: updatedChapters };
                saveProjectToDB(updatedProj);
                return updatedProj;
            });
        });
    }, []);

    return {
        projects,
        activeProjectId,
        activeProject: getActiveProject(),
        isLoading,
        handleUpdateProject,
        handleSelectProject,
        handleDeleteProject,
        handleCreateProject,
        handleAddGlossaryItem,
        handleAddGlossaryItems,
        handleUpdateGlossaryItem,
        handleDeleteGlossaryItem,
        handleDeleteChapterHistory,
        handleAddToPendingGlossary,
        handleConfirmPendingItem,
        handleDiscardPendingItem,
        handleResetChapters
    };
}
