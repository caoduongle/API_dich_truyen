import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as db from '../db';
import { zuminovelRestClient } from '../zuminovel/zuminovelRestClient';
import {
  buildChapterHtmlContent,
  buildCreatePayload,
  buildUpdatePayload,
  publishChapterToZuminovel,
  deleteChapterFromZuminovel,
  mergeZuminovelStatusIntoProject,
  clearZuminovelStatusInProject,
} from '../zuminovelPublishService';
import { Chapter, StoryProject } from '../../types';

function makeChapter(overrides: Partial<Chapter> = {}): Chapter {
  return {
    id: 'chap_1',
    title: 'Chương 1',
    sourceText: '第一章 文本',
    rawTranslation: '',
    polishedTranslation: 'Chương 1: Khởi đầu mới\n\nĐây là đoạn văn đầu tiên.\nĐây là đoạn thứ hai có ký tự < và > cùng dấu &.',
    paragraphs: [],
    translatedLines: [],
    status: 'completed',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as Chapter;
}

function makeProject(overrides: Partial<StoryProject> = {}): StoryProject {
  return {
    id: 'proj_1',
    title: 'Dự án test',
    author: '',
    genre: '',
    tone: '',
    description: '',
    glossary: [],
    pendingGlossary: [],
    chapters: [{ id: 'chap_1', title: 'Chương 1', status: 'completed', createdAt: '', updatedAt: '' }],
    createdAt: new Date().toISOString(),
    ...overrides,
  } as StoryProject;
}

describe('buildChapterHtmlContent', () => {
  it('reuses formatChapterForWeb to strip the duplicated title line and wraps remaining paragraphs in escaped <p> tags', () => {
    const { title, html } = buildChapterHtmlContent(makeChapter(), 1);

    expect(title).toBe('Chương 1: Khởi đầu mới');
    expect(html).toBe(
      '<p>Đây là đoạn văn đầu tiên.</p><p>Đây là đoạn thứ hai có ký tự &lt; và &gt; cùng dấu &amp;.</p>'
    );
  });
});

describe('buildCreatePayload / buildUpdatePayload', () => {
  it('prefers novelSlug over novelId when both are present on the project', () => {
    const project = makeProject({ zuminovelNovelSlug: 'hao-mon-kinh-mong', zuminovelNovelId: 'novel_1' });
    const payload = buildCreatePayload(project, makeChapter(), 1);

    expect(payload.novelSlug).toBe('hao-mon-kinh-mong');
    expect(payload.novelId).toBeUndefined();
  });

  it('falls back to novelId when novelSlug is absent', () => {
    const project = makeProject({ zuminovelNovelId: 'novel_1' });
    const payload = buildCreatePayload(project, makeChapter(), 1);

    expect(payload.novelId).toBe('novel_1');
    expect(payload.novelSlug).toBeUndefined();
  });

  it('merges bulk overrides (isVIP/price) into the create payload', () => {
    const project = makeProject({ zuminovelNovelId: 'novel_1' });
    const payload = buildCreatePayload(project, makeChapter(), 1, { isVIP: true, price: 15 });

    expect(payload.isVIP).toBe(true);
    expect(payload.price).toBe(15);
  });

  it('update payload never includes novelSlug/novelId (not accepted by PUT /external/chapters/{id})', () => {
    const payload = buildUpdatePayload(makeChapter(), 1, { price: 20 });

    expect(payload).not.toHaveProperty('novelSlug');
    expect(payload).not.toHaveProperty('novelId');
    expect(payload.price).toBe(20);
  });
});

describe('publishChapterToZuminovel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(db, 'saveChapterToDB').mockResolvedValue(undefined as any);
  });

  it('throws before calling the API when the project is not linked to any ZumiNovel novel', async () => {
    const project = makeProject();
    await expect(publishChapterToZuminovel('key', project, makeChapter(), 1)).rejects.toThrow(/chưa được liên kết/);
  });

  it('creates a new chapter when the local Chapter has no zuminovelChapterId, then persists synced status', async () => {
    const project = makeProject({ zuminovelNovelSlug: 'hao-mon-kinh-mong' });
    const createSpy = vi
      .spyOn(zuminovelRestClient, 'createChapter')
      .mockResolvedValue({ id: 'remote_99', slug: 'chuong-1', order: 1 });
    const saveSpy = vi.spyOn(db, 'saveChapterToDB').mockResolvedValue(undefined as any);

    const result = await publishChapterToZuminovel('key', project, makeChapter(), 1);

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(result.action).toBe('created');
    expect(result.chapter.zuminovelChapterId).toBe('remote_99');
    expect(result.chapter.zuminovelSyncStatus).toBe('synced');
    expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ zuminovelChapterId: 'remote_99', zuminovelSyncStatus: 'synced' }));
  });

  it('updates an existing chapter when the local Chapter already has a zuminovelChapterId', async () => {
    const project = makeProject({ zuminovelNovelSlug: 'hao-mon-kinh-mong' });
    const updateSpy = vi
      .spyOn(zuminovelRestClient, 'updateChapter')
      .mockResolvedValue({ id: 'remote_99', title: 'Chương 1' });
    const createSpy = vi.spyOn(zuminovelRestClient, 'createChapter');

    const chapter = makeChapter({ zuminovelChapterId: 'remote_99' });
    const result = await publishChapterToZuminovel('key', project, chapter, 1);

    expect(updateSpy).toHaveBeenCalledWith('key', 'remote_99', expect.any(Object));
    expect(createSpy).not.toHaveBeenCalled();
    expect(result.action).toBe('updated');
  });

  it('marks the chapter as errored and rethrows when the API call fails', async () => {
    const project = makeProject({ zuminovelNovelSlug: 'hao-mon-kinh-mong' });
    vi.spyOn(zuminovelRestClient, 'createChapter').mockRejectedValue(new Error('boom'));
    const saveSpy = vi.spyOn(db, 'saveChapterToDB').mockResolvedValue(undefined as any);

    await expect(publishChapterToZuminovel('key', project, makeChapter(), 1)).rejects.toThrow('boom');
    expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ zuminovelSyncStatus: 'error' }));
  });
});

describe('deleteChapterFromZuminovel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(db, 'saveChapterToDB').mockResolvedValue(undefined as any);
  });

  it('throws without calling the API when the chapter was never published', async () => {
    const deleteSpy = vi.spyOn(zuminovelRestClient, 'deleteChapter');
    await expect(deleteChapterFromZuminovel('key', makeChapter())).rejects.toThrow(/chưa được đăng/);
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('deletes on ZumiNovel then clears local zuminovelChapterId/status back to never_published', async () => {
    const deleteSpy = vi.spyOn(zuminovelRestClient, 'deleteChapter').mockResolvedValue(undefined);
    const saveSpy = vi.spyOn(db, 'saveChapterToDB').mockResolvedValue(undefined as any);
    const chapter = makeChapter({ zuminovelChapterId: 'remote_99', zuminovelSyncStatus: 'synced', zuminovelPublishedAt: '2026-01-01T00:00:00Z' });

    const result = await deleteChapterFromZuminovel('key', chapter);

    expect(deleteSpy).toHaveBeenCalledWith('key', 'remote_99');
    expect(result.zuminovelChapterId).toBeUndefined();
    expect(result.zuminovelSyncStatus).toBe('never_published');
    expect(result.zuminovelPublishedAt).toBeUndefined();
    expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ zuminovelChapterId: undefined, zuminovelSyncStatus: 'never_published' }));
  });

  it('does not swallow the original API error when ZumiNovel rejects the delete', async () => {
    vi.spyOn(zuminovelRestClient, 'deleteChapter').mockRejectedValue(new Error('UNAUTHORIZED_ACCESS'));
    const chapter = makeChapter({ zuminovelChapterId: 'remote_99' });

    await expect(deleteChapterFromZuminovel('key', chapter)).rejects.toThrow('UNAUTHORIZED_ACCESS');
  });
});

describe('mergeZuminovelStatusIntoProject', () => {
  it('merges updated sync status into matching ChapterMetadata entries only', () => {
    const project = makeProject({
      chapters: [
        { id: 'chap_1', title: 'C1', status: 'completed', createdAt: '', updatedAt: '' },
        { id: 'chap_2', title: 'C2', status: 'completed', createdAt: '', updatedAt: '' },
      ] as any,
    });

    const merged = mergeZuminovelStatusIntoProject(project, [
      { id: 'chap_1', zuminovelChapterId: 'remote_1', zuminovelSyncStatus: 'synced' },
    ]);

    expect(merged.chapters[0].zuminovelChapterId).toBe('remote_1');
    expect(merged.chapters[0].zuminovelSyncStatus).toBe('synced');
    expect(merged.chapters[1].zuminovelChapterId).toBeUndefined();
  });
});

describe('clearZuminovelStatusInProject', () => {
  it('resets only the targeted chapter back to never_published, leaving others untouched', () => {
    const project = makeProject({
      chapters: [
        { id: 'chap_1', title: 'C1', status: 'completed', createdAt: '', updatedAt: '', zuminovelChapterId: 'remote_1', zuminovelSyncStatus: 'synced' },
        { id: 'chap_2', title: 'C2', status: 'completed', createdAt: '', updatedAt: '', zuminovelChapterId: 'remote_2', zuminovelSyncStatus: 'synced' },
      ] as any,
    });

    const cleared = clearZuminovelStatusInProject(project, 'chap_1');

    expect(cleared.chapters[0].zuminovelChapterId).toBeUndefined();
    expect(cleared.chapters[0].zuminovelSyncStatus).toBe('never_published');
    // chap_2 (chương khác) không bị ảnh hưởng — chỉ đúng 1 chương được chỉ định mới bị xoá trạng thái.
    expect(cleared.chapters[1].zuminovelChapterId).toBe('remote_2');
    expect(cleared.chapters[1].zuminovelSyncStatus).toBe('synced');
  });
});
