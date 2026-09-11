import { useState, useCallback, useRef, useEffect } from 'react';
import { StoryProject, Chapter } from '../types';
import { getChaptersByProjectFromDB, getChapterFromDB } from '../services/db';
import { useNotifications } from '../components/NotificationSystem';
import { LogEntry } from './useAutoTranslationQueue';
import { zuminovelRestClient, ZuminovelApiError, ZuminovelNetworkError } from '../services/zuminovel/zuminovelRestClient';
import { getStoredZuminovelApiKey, setStoredZuminovelApiKey } from '../services/zuminovel/zuminovelCredentials';
import {
  publishChaptersToZuminovel,
  mergeZuminovelStatusIntoProject,
  deleteChapterFromZuminovel,
  clearZuminovelStatusInProject,
  ZuminovelPublishOverrides,
} from '../services/zuminovelPublishService';
import { ZuminovelNovel, ZuminovelUploadResult, ZUMINOVEL_UPLOAD_MAX_BYTES } from '../types/zuminovel';

export function describeZuminovelError(err: unknown): string {
  if (err instanceof ZuminovelNetworkError) return err.message;
  if (err instanceof ZuminovelApiError) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}

export interface UseZuminovelPublishProps {
  activeProject: StoryProject;
  onUpdateProject: (updated: StoryProject) => void;
  addLog: (message: string, type?: LogEntry['type']) => void;
}

export function useZuminovelPublish({ activeProject, onUpdateProject, addLog }: UseZuminovelPublishProps) {
  const { showToast, showConfirm } = useNotifications();
  const [apiKey, setApiKeyState] = useState<string>(() => getStoredZuminovelApiKey());
  const [isVerifying, setIsVerifying] = useState(false);
  const [isKeyValid, setIsKeyValid] = useState<boolean | null>(null);
  const [novels, setNovels] = useState<ZuminovelNovel[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState<{ index: number; total: number } | null>(null);
  const [deletingChapterId, setDeletingChapterId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<ZuminovelUploadResult | null>(null);

  const projectRef = useRef<StoryProject>(activeProject);
  useEffect(() => {
    projectRef.current = activeProject;
  }, [activeProject]);

  const setApiKey = useCallback((key: string) => {
    setApiKeyState(key);
    setStoredZuminovelApiKey(key);
    setIsKeyValid(null);
  }, []);

  /** Gọi GET /external/novels như một phép thử kết nối: vừa xác thực key, vừa lấy luôn danh sách truyện để liên kết. */
  const handleVerifyKey = useCallback(async () => {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      showToast({ message: 'Vui lòng nhập API Key ZumiNovel trước.', type: 'warning' });
      return;
    }
    setIsVerifying(true);
    try {
      const list = await zuminovelRestClient.listNovels(trimmedKey);
      setNovels(list);
      setIsKeyValid(true);
      showToast({ message: `Key hợp lệ — tìm thấy ${list.length} truyện sở hữu.`, type: 'success' });
    } catch (err) {
      setIsKeyValid(false);
      setNovels([]);
      showToast({ message: describeZuminovelError(err), type: 'error' });
    } finally {
      setIsVerifying(false);
    }
  }, [apiKey, showToast]);

  const handleLinkNovel = useCallback(
    (novel: ZuminovelNovel) => {
      onUpdateProject({
        ...projectRef.current,
        zuminovelNovelId: novel.id,
        zuminovelNovelSlug: novel.slug,
        zuminovelNovelTitle: novel.title,
      });
      showToast({ message: `Đã liên kết dự án với "${novel.title}" trên ZumiNovel.`, type: 'success' });
    },
    [onUpdateProject, showToast]
  );

  const handleUnlinkNovel = useCallback(() => {
    onUpdateProject({
      ...projectRef.current,
      zuminovelNovelId: undefined,
      zuminovelNovelSlug: undefined,
      zuminovelNovelTitle: undefined,
    });
  }, [onUpdateProject]);

  /** Đăng/cập nhật hàng loạt chương theo danh sách id đã chọn. */
  const handlePublishChapters = useCallback(
    async (chapterIds: string[], overrides?: ZuminovelPublishOverrides) => {
      const proj = projectRef.current;
      const trimmedKey = apiKey.trim();

      if (!proj.zuminovelNovelId && !proj.zuminovelNovelSlug) {
        showToast({ message: 'Hãy liên kết dự án với 1 truyện trên ZumiNovel trước khi đăng.', type: 'warning' });
        return;
      }
      if (!trimmedKey) {
        showToast({ message: 'Vui lòng nhập API Key ZumiNovel trước.', type: 'warning' });
        return;
      }
      if (chapterIds.length === 0) return;

      setIsPublishing(true);
      addLog(`BẮT ĐẦU ĐĂNG ${chapterIds.length} CHƯƠNG LÊN ZUMINOVEL...`, 'info');
      try {
        const dbChapters = await getChaptersByProjectFromDB(proj.id);
        const chaptersMap = new Map(dbChapters.map((c) => [c.id, c]));
        const chaptersToPublish = chapterIds.map((id) => chaptersMap.get(id)).filter((c): c is Chapter => !!c);

        if (chaptersToPublish.length === 0) {
          showToast({ message: 'Không tìm thấy nội dung chương đã chọn trong cơ sở dữ liệu.', type: 'warning' });
          return;
        }

        const outcome = await publishChaptersToZuminovel(trimmedKey, proj, chaptersToPublish, {
          overrides,
          onProgress: ({ index, total, chapter }) => {
            setPublishProgress({ index, total });
            addLog(`[${index}/${total}] Đang đăng: ${chapter.title}...`, 'info');
          },
        });

        if (outcome.succeeded.length > 0) {
          const merged = mergeZuminovelStatusIntoProject(
            proj,
            outcome.succeeded.map((r) => ({
              id: r.chapter.id,
              zuminovelChapterId: r.chapter.zuminovelChapterId,
              zuminovelSyncStatus: r.chapter.zuminovelSyncStatus,
            }))
          );
          onUpdateProject(merged);
        }

        outcome.succeeded.forEach((r) => {
          addLog(`${r.action === 'created' ? 'Đã đăng mới' : 'Đã cập nhật'}: ${r.chapter.title}`, 'success');
        });
        outcome.failed.forEach(({ chapter, error }) => {
          addLog(`Thất bại "${chapter.title}": ${describeZuminovelError(error)}`, 'error');
        });

        if (outcome.failed.length === 0) {
          addLog(`HOÀN TẤT — ĐÃ ĐĂNG THÀNH CÔNG TOÀN BỘ ${outcome.succeeded.length} CHƯƠNG LÊN ZUMINOVEL!`, 'success');
          showToast({ message: `Đã đăng ${outcome.succeeded.length} chương lên ZumiNovel.`, type: 'success' });
        } else {
          addLog(`HOÀN TẤT — ${outcome.succeeded.length} thành công, ${outcome.failed.length} thất bại.`, 'warn');
          showToast({
            message: `${outcome.succeeded.length} chương thành công, ${outcome.failed.length} thất bại.`,
            type: 'warning',
          });
        }
      } catch (err) {
        addLog(`Lỗi hệ thống khi đăng lên ZumiNovel: ${describeZuminovelError(err)}`, 'error');
      } finally {
        setIsPublishing(false);
        setPublishProgress(null);
      }
    },
    [apiKey, addLog, onUpdateProject, showToast]
  );

  /**
   * Xoá 1 chương khỏi ZumiNovel. Luôn hỏi xác nhận trước — đúng cảnh báo
   * "HÀNH ĐỘNG NGUY HIỂM" trong tài liệu (xoá vĩnh viễn, ảnh hưởng độc giả đã mua).
   */
  const handleDeleteChapter = useCallback(
    async (chapterId: string) => {
      const trimmedKey = apiKey.trim();
      if (!trimmedKey) {
        showToast({ message: 'Vui lòng nhập API Key ZumiNovel trước.', type: 'warning' });
        return;
      }

      const chapter = await getChapterFromDB(chapterId);
      if (!chapter) {
        showToast({ message: 'Không tìm thấy chương này trong cơ sở dữ liệu.', type: 'warning' });
        return;
      }
      if (!chapter.zuminovelChapterId) {
        showToast({ message: 'Chương này chưa được đăng lên ZumiNovel.', type: 'warning' });
        return;
      }

      const confirmed = await showConfirm({
        title: 'Xoá chương khỏi ZumiNovel?',
        message: `"${chapter.title}" sẽ bị gỡ bỏ vĩnh viễn khỏi ZumiNovel. Nếu độc giả đã mua chương này, họ sẽ không còn đọc được nữa. Bản dịch trong app KHÔNG bị xoá — chỉ bản đã đăng trên ZumiNovel. Hành động này không thể hoàn tác.`,
        confirmText: 'Xoá vĩnh viễn',
        cancelText: 'Huỷ',
        type: 'danger',
      });
      if (!confirmed) return;

      setDeletingChapterId(chapterId);
      try {
        await deleteChapterFromZuminovel(trimmedKey, chapter);
        onUpdateProject(clearZuminovelStatusInProject(projectRef.current, chapterId));
        addLog(`Đã xoá "${chapter.title}" khỏi ZumiNovel.`, 'warn');
        showToast({ message: 'Đã xoá chương khỏi ZumiNovel.', type: 'success' });
      } catch (err) {
        addLog(`Lỗi khi xoá "${chapter.title}": ${describeZuminovelError(err)}`, 'error');
        showToast({ message: describeZuminovelError(err), type: 'error' });
      } finally {
        setDeletingChapterId(null);
      }
    },
    [apiKey, addLog, onUpdateProject, showToast, showConfirm]
  );

  /** POST /external/upload — tiện ích tải ảnh lên CDN của ZumiNovel, trả về URL để dùng trong nội dung chương. */
  const handleUploadImage = useCallback(
    async (file: File, folder?: string) => {
      const trimmedKey = apiKey.trim();
      if (!trimmedKey) {
        showToast({ message: 'Vui lòng nhập API Key ZumiNovel trước.', type: 'warning' });
        return;
      }
      if (file.size > ZUMINOVEL_UPLOAD_MAX_BYTES) {
        showToast({ message: 'Ảnh vượt quá giới hạn 5MB của ZumiNovel.', type: 'error' });
        return;
      }

      setIsUploading(true);
      setUploadResult(null);
      try {
        const result = await zuminovelRestClient.uploadImage(trimmedKey, file, folder);
        setUploadResult(result);
        addLog(`Đã tải ảnh lên ZumiNovel CDN: ${result.url}`, 'success');
        showToast({ message: 'Tải ảnh lên ZumiNovel thành công.', type: 'success' });
      } catch (err) {
        addLog(`Lỗi tải ảnh lên ZumiNovel: ${describeZuminovelError(err)}`, 'error');
        showToast({ message: describeZuminovelError(err), type: 'error' });
      } finally {
        setIsUploading(false);
      }
    },
    [apiKey, addLog, showToast]
  );

  return {
    apiKey,
    setApiKey,
    isVerifying,
    isKeyValid,
    novels,
    handleVerifyKey,
    handleLinkNovel,
    handleUnlinkNovel,
    isPublishing,
    publishProgress,
    handlePublishChapters,
    deletingChapterId,
    handleDeleteChapter,
    isUploading,
    uploadResult,
    handleUploadImage,
  };
}
