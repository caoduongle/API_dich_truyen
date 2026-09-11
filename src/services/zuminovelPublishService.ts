/**
 * Orchestration cho tính năng "Đăng lên ZumiNovel": map Chapter nội bộ -> payload
 * ZumiNovel, quyết định tạo mới hay cập nhật, và ghi lại trạng thái đồng bộ.
 * Tầng REST thuần nằm ở services/zuminovel/zuminovelRestClient.ts.
 */
import { Chapter, ChapterMetadata, StoryProject, ZuminovelSyncStatus } from '../types';
import { saveChapterToDB } from './db';
import { formatChapterForWeb } from '../utils/exportFormatter';
import { zuminovelRestClient } from './zuminovel/zuminovelRestClient';
import { ZuminovelCreateChapterPayload, ZuminovelUpdateChapterPayload } from '../types/zuminovel';

export interface ZuminovelPublishOverrides {
  isVIP?: boolean;
  price?: number;
  isAdult?: boolean;
  volume?: string;
  volumeOrder?: number;
}

// ZumiNovel yêu cầu content là HTML bọc thẻ <p> — escape 5 ký tự đặc biệt HTML
// chuẩn trước khi bọc, tránh nội dung dịch chứa dấu < > & làm hỏng cấu trúc HTML.
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Tái dùng formatChapterForWeb (đã dùng cho export .txt) để loại tiêu đề lặp lại
 * và dòng phân cách rác khỏi bản dịch, rồi bọc từng đoạn còn lại trong thẻ <p>
 * theo đúng field "content" mà ZumiNovel yêu cầu.
 */
export function buildChapterHtmlContent(chapter: Chapter, chapterIndex: number): { title: string; html: string } {
  const { formattedTitle, cleanBody } = formatChapterForWeb({
    index: chapterIndex,
    chapterTitle: chapter.title,
    translatedText: chapter.polishedTranslation || chapter.rawTranslation || '',
  });

  const html = cleanBody
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('');

  return { title: formattedTitle, html };
}

export function buildCreatePayload(
  project: StoryProject,
  chapter: Chapter,
  chapterIndex: number,
  overrides: ZuminovelPublishOverrides = {}
): ZuminovelCreateChapterPayload {
  const { title, html } = buildChapterHtmlContent(chapter, chapterIndex);
  const novelRef = project.zuminovelNovelSlug
    ? { novelSlug: project.zuminovelNovelSlug }
    : project.zuminovelNovelId
    ? { novelId: project.zuminovelNovelId }
    : {};

  return {
    ...novelRef,
    title,
    content: html,
    ...overrides,
  };
}

export function buildUpdatePayload(
  chapter: Chapter,
  chapterIndex: number,
  overrides: ZuminovelPublishOverrides = {}
): ZuminovelUpdateChapterPayload {
  const { title, html } = buildChapterHtmlContent(chapter, chapterIndex);
  return { title, content: html, ...overrides };
}

export type ZuminovelPublishAction = 'created' | 'updated';

export interface ZuminovelPublishResult {
  chapter: Chapter;
  action: ZuminovelPublishAction;
}

/**
 * Đăng chương mới (nếu Chapter chưa có zuminovelChapterId) hoặc cập nhật chương
 * đã đăng (nếu đã có). Luôn ghi lại trạng thái đồng bộ vào IndexedDB — kể cả khi
 * thất bại (đánh dấu 'error') — để người dùng biết chính xác chương nào cần đăng lại
 * mà không phải đoán hoặc soát lại toàn bộ.
 */
export async function publishChapterToZuminovel(
  apiKey: string,
  project: StoryProject,
  chapter: Chapter,
  chapterIndex: number,
  overrides: ZuminovelPublishOverrides = {}
): Promise<ZuminovelPublishResult> {
  if (!project.zuminovelNovelSlug && !project.zuminovelNovelId) {
    throw new Error('Dự án chưa được liên kết với truyện nào trên ZumiNovel.');
  }

  try {
    let action: ZuminovelPublishAction;
    let remoteChapterId = chapter.zuminovelChapterId;

    if (remoteChapterId) {
      await zuminovelRestClient.updateChapter(
        apiKey,
        remoteChapterId,
        buildUpdatePayload(chapter, chapterIndex, overrides)
      );
      action = 'updated';
    } else {
      const created = await zuminovelRestClient.createChapter(
        apiKey,
        buildCreatePayload(project, chapter, chapterIndex, overrides)
      );
      remoteChapterId = created.id;
      action = 'created';
    }

    const updatedChapter: Chapter = {
      ...chapter,
      zuminovelChapterId: remoteChapterId,
      zuminovelSyncStatus: 'synced',
      zuminovelPublishedAt: new Date().toISOString(),
    };
    await saveChapterToDB(updatedChapter);
    return { chapter: updatedChapter, action };
  } catch (err) {
    const erroredChapter: Chapter = { ...chapter, zuminovelSyncStatus: 'error' };
    await saveChapterToDB(erroredChapter).catch(() => {
      /* không để lỗi ghi DB che mất lỗi publish gốc */
    });
    throw err;
  }
}

export interface ZuminovelBulkPublishProgress {
  index: number;
  total: number;
  chapter: Chapter;
}

export interface ZuminovelBulkPublishOutcome {
  succeeded: ZuminovelPublishResult[];
  failed: Array<{ chapter: Chapter; error: Error }>;
}

/**
 * Đăng/cập nhật tuần tự nhiều chương. Một chương lỗi KHÔNG làm dừng cả lô —
 * tiếp tục các chương còn lại rồi trả về danh sách thành công/thất bại riêng
 * để UI hiển thị, giống tinh thần "skipFailedChapters" đã có ở hàng đợi dịch.
 */
export async function publishChaptersToZuminovel(
  apiKey: string,
  project: StoryProject,
  chapters: Chapter[],
  options: {
    overrides?: ZuminovelPublishOverrides;
    startIndex?: number;
    onProgress?: (progress: ZuminovelBulkPublishProgress) => void;
  } = {}
): Promise<ZuminovelBulkPublishOutcome> {
  const { overrides, startIndex = 1, onProgress } = options;
  const succeeded: ZuminovelPublishResult[] = [];
  const failed: Array<{ chapter: Chapter; error: Error }> = [];

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    onProgress?.({ index: i + 1, total: chapters.length, chapter });
    try {
      const result = await publishChapterToZuminovel(apiKey, project, chapter, startIndex + i, overrides);
      succeeded.push(result);
    } catch (err: any) {
      failed.push({ chapter, error: err instanceof Error ? err : new Error(String(err)) });
    }
  }

  return { succeeded, failed };
}

/**
 * DELETE /external/chapters/{chapter_id} — xoá vĩnh viễn khỏi ZumiNovel.
 * CẢNH BÁO (nguyên văn tài liệu): xoá vĩnh viễn dữ liệu khỏi hệ thống, chương đã
 * mua bởi độc giả sẽ không còn khả dụng. Hàm này KHÔNG tự hỏi xác nhận — nơi gọi
 * (UI) chịu trách nhiệm xác nhận với người dùng trước khi gọi tới đây.
 * Chỉ xoá trên ZumiNovel — bản dịch local trong app không bị ảnh hưởng, chỉ có
 * zuminovelChapterId/zuminovelSyncStatus được đưa về trạng thái "chưa đăng".
 */
export async function deleteChapterFromZuminovel(
  apiKey: string,
  chapter: Chapter
): Promise<Chapter> {
  if (!chapter.zuminovelChapterId) {
    throw new Error('Chương này chưa được đăng lên ZumiNovel nên không có gì để xoá.');
  }
  await zuminovelRestClient.deleteChapter(apiKey, chapter.zuminovelChapterId);

  const clearedChapter: Chapter = {
    ...chapter,
    zuminovelChapterId: undefined,
    zuminovelSyncStatus: 'never_published',
    zuminovelPublishedAt: undefined,
  };
  await saveChapterToDB(clearedChapter);
  return clearedChapter;
}

/**
 * Đưa đúng 1 chương trong ChapterMetadata về trạng thái "chưa đăng" sau khi xoá.
 * Tách riêng khỏi mergeZuminovelStatusIntoProject() vì hàm đó dùng `??` để giữ
 * giá trị cũ khi field không được truyền — dùng nhầm cho ca "cần xoá về undefined"
 * sẽ không xoá được gì (undefined ?? giá_trị_cũ === giá_trị_cũ).
 */
export function clearZuminovelStatusInProject(project: StoryProject, chapterId: string): StoryProject {
  const newChapters: ChapterMetadata[] = project.chapters.map((meta) =>
    meta.id === chapterId
      ? { ...meta, zuminovelChapterId: undefined, zuminovelSyncStatus: 'never_published' as const }
      : meta
  );
  return { ...project, chapters: newChapters, updatedAt: new Date().toISOString() };
}

/**
 * Gộp trạng thái đồng bộ (đã lưu đầy đủ vào CHAPTERS_STORE) trở lại mảng
 * ChapterMetadata nhẹ trong StoryProject, để danh sách chương hiển thị đúng
 * trạng thái mà không cần load lại toàn bộ Chapter. Trả về StoryProject mới
 * (immutable) — nơi gọi (hook) chịu trách nhiệm persist qua onUpdateProject,
 * đúng như cách project-level state đã được cập nhật ở các tính năng khác.
 * LƯU Ý: chỉ dùng để SET giá trị mới (luôn có id/status thật từ 1 lần publish
 * thành công) — không dùng để xoá về undefined, vì `??` sẽ giữ giá trị cũ thay
 * vì xoá. Ca xoá dùng clearZuminovelStatusInProject() ở trên.
 */
export function mergeZuminovelStatusIntoProject(
  project: StoryProject,
  updatedChapters: Array<{ id: string; zuminovelChapterId?: string; zuminovelSyncStatus?: ZuminovelSyncStatus }>
): StoryProject {
  const statusById = new Map(updatedChapters.map((c) => [c.id, c]));
  const newChapters: ChapterMetadata[] = project.chapters.map((meta) => {
    const update = statusById.get(meta.id);
    if (!update) return meta;
    return {
      ...meta,
      zuminovelChapterId: update.zuminovelChapterId ?? meta.zuminovelChapterId,
      zuminovelSyncStatus: update.zuminovelSyncStatus ?? meta.zuminovelSyncStatus,
    };
  });
  return { ...project, chapters: newChapters, updatedAt: new Date().toISOString() };
}
