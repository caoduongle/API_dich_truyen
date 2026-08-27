import { describe, it, expect } from 'vitest';
import { saveOrUpdateChapter } from '../useWorkspaceState';
import { StoryProject, Chapter } from '../../../types';

describe('Translator Workspace Upsert Logic (saveOrUpdateChapter)', () => {
  const createMockProject = (chapters: Chapter[] = []): StoryProject => ({
    id: 'proj_test_1',
    title: 'Đấu Phá Thương Khung',
    author: 'Thiên Tàm Thổ Đậu',
    genre: 'Tiên Hiệp',
    tone: 'Hùng tráng',
    description: 'Mô tả truyện',
    glossary: [],
    pendingGlossary: [],
    chapters,
    createdAt: '2026-08-20T00:00:00.000Z',
  });

  describe('US1: Update Existing Chapter In-Place', () => {
    it('updates existing chapter in-place when currentChapterId matches an existing chapter', () => {
      const existingChap: Chapter = {
        id: 'chap_100',
        title: 'Chương 1: Khởi đầu',
        sourceText: '这是第一章。',
        rawTranslation: 'Đây là chương một.',
        polishedTranslation: 'Đây là chương đầu tiên.',
        paragraphs: ['这是第一章。'],
        translatedLines: ['Đây là chương đầu tiên.'],
        status: 'completed',
        createdAt: '2026-08-20T00:00:00.000Z',
        updatedAt: '2026-08-20T00:00:00.000Z',
      };

      const project = createMockProject([existingChap]);

      const result = saveOrUpdateChapter({
        currentChapterId: 'chap_100',
        activeProject: project,
        sourceText: '这是第一章。修改版。',
        chapterTitle: 'Chương 1: Khởi đầu (Sửa)',
        rawTranslation: 'Đây là chương một. Bản sửa.',
        polishedTranslation: 'Đây là chương đầu tiên sau khi chuốt lại.',
      });

      expect(result).not.toBeNull();
      expect(result!.isUpdate).toBe(true);
      expect(result!.savedChapter.id).toBe('chap_100');
      expect(result!.savedChapter.createdAt).toBe('2026-08-20T00:00:00.000Z');
      expect(result!.savedChapter.title).toBe('Chương 1: Khởi đầu (Sửa)');
      expect(result!.savedChapter.sourceText).toBe('这是第一章。修改版。');
      expect(result!.savedChapter.polishedTranslation).toBe('Đây là chương đầu tiên sau khi chuốt lại.');
      expect(result!.savedChapter.status).toBe('completed');
      expect(new Date(result!.savedChapter.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(existingChap.updatedAt).getTime()
      );

      // Verify array size remains 1 and no duplicate is prepended
      expect(result!.updatedProject.chapters.length).toBe(1);
      expect(result!.updatedProject.chapters[0].id).toBe('chap_100');
      expect(result!.updatedProject.chapters[0].title).toBe('Chương 1: Khởi đầu (Sửa)');
    });

    it('updates the correct chapter in a multi-chapter project preserving list order', () => {
      const chap1: Chapter = {
        id: 'chap_1',
        title: 'Chương 1',
        sourceText: '第一章',
        rawTranslation: 'Chương 1',
        polishedTranslation: 'Chương 1 hoàn thiện',
        status: 'completed',
        paragraphs: ['第一章'],
        translatedLines: ['Chương 1'],
        createdAt: '2026-08-20T00:00:00.000Z',
        updatedAt: '2026-08-20T00:00:00.000Z',
      };
      const chap2: Chapter = {
        id: 'chap_2',
        title: 'Chương 2',
        sourceText: '第二章',
        rawTranslation: 'Chương 2 thô',
        polishedTranslation: '',
        status: 'in_progress',
        paragraphs: ['第二章'],
        translatedLines: ['Chương 2'],
        createdAt: '2026-08-21T00:00:00.000Z',
        updatedAt: '2026-08-21T00:00:00.000Z',
      };
      const chap3: Chapter = {
        id: 'chap_3',
        title: 'Chương 3',
        sourceText: '第三章',
        rawTranslation: '',
        polishedTranslation: '',
        status: 'not_started',
        paragraphs: ['第三章'],
        translatedLines: [],
        createdAt: '2026-08-22T00:00:00.000Z',
        updatedAt: '2026-08-22T00:00:00.000Z',
      };

      const project = createMockProject([chap1, chap2, chap3]);

      const result = saveOrUpdateChapter({
        currentChapterId: 'chap_2',
        activeProject: project,
        sourceText: '第二章内容',
        chapterTitle: 'Chương 2: Cập Nhật',
        rawTranslation: 'Nội dung chương 2',
        polishedTranslation: 'Nội dung chương 2 trau chuốt',
      });

      expect(result).not.toBeNull();
      expect(result!.isUpdate).toBe(true);
      expect(result!.updatedProject.chapters.length).toBe(3);
      expect(result!.updatedProject.chapters[0].id).toBe('chap_1');
      expect(result!.updatedProject.chapters[1].id).toBe('chap_2');
      expect(result!.updatedProject.chapters[1].title).toBe('Chương 2: Cập Nhật');
      expect(result!.updatedProject.chapters[1].status).toBe('completed');
      expect(result!.updatedProject.chapters[2].id).toBe('chap_3');
    });

    it('sets status correctly to in_progress if only rawTranslation exists', () => {
      const existingChap: Chapter = {
        id: 'chap_101',
        title: 'Chương 2',
        sourceText: '原文',
        rawTranslation: '',
        polishedTranslation: '',
        status: 'not_started',
        paragraphs: ['原文'],
        translatedLines: [],
        createdAt: '2026-08-20T00:00:00.000Z',
        updatedAt: '2026-08-20T00:00:00.000Z',
      };

      const project = createMockProject([existingChap]);

      const result = saveOrUpdateChapter({
        currentChapterId: 'chap_101',
        activeProject: project,
        sourceText: '原文',
        chapterTitle: 'Chương 2',
        rawTranslation: 'Bản dịch thô',
        polishedTranslation: '',
      });

      expect(result!.savedChapter.status).toBe('in_progress');
      expect(result!.savedChapter.translatedLines).toEqual(['Bản dịch thô']);
    });
  });

  describe('US2: Create New Chapter and Re-save binding', () => {
    it('creates a new chapter when currentChapterId is null and prepends it', () => {
      const project = createMockProject();

      const result = saveOrUpdateChapter({
        currentChapterId: null,
        activeProject: project,
        sourceText: '新的第一章内容。',
        chapterTitle: 'Chương 1: Tân Thế Giới',
        rawTranslation: 'Nội dung chương một mới.',
        polishedTranslation: 'Nội dung chương một mới hoàn toàn.',
      });

      expect(result).not.toBeNull();
      expect(result!.isUpdate).toBe(false);
      expect(result!.savedChapter.id).toMatch(/^chap_\d+/);
      expect(result!.savedChapter.title).toBe('Chương 1: Tân Thế Giới');
      expect(result!.updatedProject.chapters.length).toBe(1);
      expect(result!.updatedProject.chapters[0].id).toBe(result!.savedChapter.id);
    });

    it('subsequent save using newly created chapter ID performs in-place update without creating duplicate', () => {
      const project = createMockProject();

      // First save: Create new chapter
      const firstSave = saveOrUpdateChapter({
        currentChapterId: null,
        activeProject: project,
        sourceText: '第一章草稿',
        chapterTitle: 'Chương 1: Bản nháp',
        rawTranslation: 'Bản dịch thô nháp',
        polishedTranslation: '',
      });

      expect(firstSave!.isUpdate).toBe(false);
      const newId = firstSave!.savedChapter.id;
      const projectAfterFirstSave = firstSave!.updatedProject;
      expect(projectAfterFirstSave.chapters.length).toBe(1);

      // Second save (simulating Ctrl+S again in same editing session): Use newId
      const secondSave = saveOrUpdateChapter({
        currentChapterId: newId,
        activeProject: projectAfterFirstSave,
        sourceText: '第一章草稿 (hoàn thiện)',
        chapterTitle: 'Chương 1: Bản hoàn thiện',
        rawTranslation: 'Bản dịch thô nháp',
        polishedTranslation: 'Bản dịch biên tập hoàn chỉnh',
      });

      expect(secondSave!.isUpdate).toBe(true);
      expect(secondSave!.savedChapter.id).toBe(newId);
      expect(secondSave!.updatedProject.chapters.length).toBe(1);
      expect(secondSave!.updatedProject.chapters[0].title).toBe('Chương 1: Bản hoàn thiện');
      expect(secondSave!.updatedProject.chapters[0].status).toBe('completed');
    });

    it('falls back safely to create new chapter if currentChapterId is not found in chapters list', () => {
      const existingChap: Chapter = {
        id: 'chap_existing',
        title: 'Chương cũ',
        sourceText: '旧章节',
        rawTranslation: 'Chương cũ thô',
        polishedTranslation: 'Chương cũ',
        status: 'completed',
        paragraphs: ['旧章节'],
        translatedLines: ['Chương cũ'],
        createdAt: '2026-08-20T00:00:00.000Z',
        updatedAt: '2026-08-20T00:00:00.000Z',
      };
      const project = createMockProject([existingChap]);

      // currentChapterId is a deleted chapter ID 'chap_deleted'
      const result = saveOrUpdateChapter({
        currentChapterId: 'chap_deleted',
        activeProject: project,
        sourceText: '这是新章节内容',
        chapterTitle: 'Chương Mới',
        rawTranslation: 'Bản dịch thô mới',
        polishedTranslation: '',
      });

      expect(result).not.toBeNull();
      expect(result!.isUpdate).toBe(false);
      expect(result!.updatedProject.chapters.length).toBe(2);
      expect(result!.updatedProject.chapters[0].id).toMatch(/^chap_\d+/);
      expect(result!.updatedProject.chapters[1].id).toBe('chap_existing');
    });
  });

  describe('US3 & Edge Cases', () => {
    it('returns null when sourceText is empty or whitespace-only', () => {
      const project = createMockProject();

      const result1 = saveOrUpdateChapter({
        currentChapterId: null,
        activeProject: project,
        sourceText: '',
        chapterTitle: 'Chương 1',
        rawTranslation: '',
        polishedTranslation: '',
      });
      expect(result1).toBeNull();

      const result2 = saveOrUpdateChapter({
        currentChapterId: 'chap_1',
        activeProject: project,
        sourceText: '   \n\t  ',
        chapterTitle: 'Chương 1',
        rawTranslation: '',
        polishedTranslation: '',
      });
      expect(result2).toBeNull();
    });

    it('generates fallback title if chapterTitle is empty', () => {
      const project = createMockProject();

      const result = saveOrUpdateChapter({
        currentChapterId: null,
        activeProject: project,
        sourceText: '有些内容',
        chapterTitle: '   ',
        rawTranslation: '',
        polishedTranslation: '',
      });

      expect(result!.savedChapter.title).toBe('Chương 1: Chưa đặt tên');
    });
  });
});
