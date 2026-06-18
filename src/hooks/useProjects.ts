import { useState, useEffect } from 'react';
import { StoryProject, GlossaryItem, PendingGlossaryItem } from '../types';
import { getProjectsFromDB, saveProjectToDB, deleteProjectFromDB } from '../services/db';

const DEFAULT_PROJECTS: StoryProject[] = [
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
                setProjects(DEFAULT_PROJECTS);
                setActiveProjectId(DEFAULT_PROJECTS[0].id);
            }
            setIsLoading(false);
        }
        loadData();
    }, []);

    const getActiveProject = (): StoryProject | undefined => {
        return projects.find(p => p.id === activeProjectId);
    };

    const handleUpdateProject = async (updatedProj: StoryProject) => {
        setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));
        await saveProjectToDB(updatedProj);
    };

    const handleSelectProject = (id: string) => {
        setActiveProjectId(id);
    };

    const handleDeleteProject = async (id: string) => {
        const remaining = projects.filter(p => p.id !== id);
        await deleteProjectFromDB(id);

        if (remaining.length > 0) {
            setProjects(remaining);
            setActiveProjectId(remaining[0].id);
        } else {
            for (const p of DEFAULT_PROJECTS) {
                await saveProjectToDB(p);
            }
            setProjects(DEFAULT_PROJECTS);
            setActiveProjectId(DEFAULT_PROJECTS[0].id);
        }
    };

    const handleCreateProject = async (newProjData: Omit<StoryProject, 'id' | 'createdAt'>) => {
        const newProj: StoryProject = {
            ...newProjData,
            id: 'proj_' + Date.now(),
            glossary: newProjData.glossary || [],
            chapters: newProjData.chapters || [],
            createdAt: new Date().toISOString()
        };
        setProjects(prev => [newProj, ...prev]);
        setActiveProjectId(newProj.id);
        await saveProjectToDB(newProj);
    };

    const handleAddGlossaryItem = (newItem: Omit<GlossaryItem, 'id'>) => {
        const activeP = getActiveProject();
        if (!activeP) return;

        const cleanChinese = (newItem.chinese || '').replace(/\s+/g, '').trim();
        const cleanVietnamese = (newItem.vietnamese || '').trim().toLowerCase();
        const alreadyExists = activeP.glossary.some(
            (g) =>
                g.chinese.replace(/\s+/g, '').trim() === cleanChinese ||
                (cleanVietnamese && g.vietnamese.trim().toLowerCase() === cleanVietnamese)
        );
        if (alreadyExists) return;

        const completeItem: GlossaryItem = {
            ...newItem,
            id: 'glo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            createdAt: newItem.createdAt || new Date().toISOString()
        };
        const updated: StoryProject = { ...activeP, glossary: [completeItem, ...activeP.glossary] };
        handleUpdateProject(updated);
    };

    const handleAddGlossaryItems = (newItems: Omit<GlossaryItem, 'id'>[]) => {
        const activeP = getActiveProject();
        if (!activeP) return;

        const existingChinese = new Set(activeP.glossary.map((g) => g.chinese.replace(/\s+/g, '').trim()));
        const existingVietnamese = new Set(activeP.glossary.map((g) => g.vietnamese.trim().toLowerCase()));

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
        if (completeItems.length === 0) return;
        const updated: StoryProject = { ...activeP, glossary: [...completeItems, ...activeP.glossary] };
        handleUpdateProject(updated);
    };

    const handleUpdateGlossaryItem = (id: string, updatedItem: GlossaryItem) => {
        const activeP = getActiveProject();
        if (!activeP) return;

        const updatedGlossary = activeP.glossary.map(item => item.id === id ? updatedItem : item);
        const updated: StoryProject = { ...activeP, glossary: updatedGlossary };
        handleUpdateProject(updated);
    };

    const handleDeleteGlossaryItem = (id: string) => {
        const activeP = getActiveProject();
        if (!activeP) return;

        const updatedGlossary = activeP.glossary.filter(item => item.id !== id);
        const updated: StoryProject = { ...activeP, glossary: updatedGlossary };
        handleUpdateProject(updated);
    };

    const handleDeleteChapterHistory = (chapId: string) => {
        const activeP = getActiveProject();
        if (!activeP) return;

        const updatedChapters = activeP.chapters.filter(c => c.id !== chapId);
        const updated: StoryProject = { ...activeP, chapters: updatedChapters };
        handleUpdateProject(updated);
    };

    const handleAddToPendingGlossary = (item: PendingGlossaryItem) => {
        const activeP = getActiveProject();
        if (!activeP) return;
        handleUpdateProject({ ...activeP, pendingGlossary: [...(activeP.pendingGlossary || []), item] });
    };

    const handleConfirmPendingItem = (pendingId: string, override?: Partial<GlossaryItem>) => {
        const activeP = getActiveProject();
        if (!activeP) return;

        const pendingItem = (activeP.pendingGlossary || []).find(p => p.id === pendingId);
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
        handleUpdateProject({
            ...activeP,
            glossary: [confirmed, ...activeP.glossary],
            pendingGlossary: (activeP.pendingGlossary || []).filter(p => p.id !== pendingId)
        });
    };

    const handleDiscardPendingItem = (pendingId: string) => {
        const activeP = getActiveProject();
        if (!activeP) return;
        handleUpdateProject({
            ...activeP,
            pendingGlossary: (activeP.pendingGlossary || []).filter(p => p.id !== pendingId)
        });
    };

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
        handleDiscardPendingItem
    };
}
