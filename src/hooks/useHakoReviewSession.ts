/**
 * React hook for managing Moderator Project Quality Checker session state
 * Feature: 075-moderator-quality-checker
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  QualityReviewSession,
  ProjectReviewChapter,
  QualityIssue,
  QualityIssueDecision,
} from '../types/hakoChecker';
import { StoryProject } from '../types';
import {
  saveSession,
  getLatestSession,
  deleteSession as deleteSessionFromDb,
} from '../services/hakoSessionStore';

export interface UseHakoReviewSessionReturn {
  session: QualityReviewSession | null;
  isLoadingSession: boolean;
  isAnalyzing: boolean;
  analysisProgress: { current: number; total: number; message: string };
  error: { code: string; message: string } | null;
  setError: (err: { code: string; message: string } | null) => void;
  setIsAnalyzing: (analyzing: boolean) => void;
  setAnalysisProgress: (progress: { current: number; total: number; message: string }) => void;
  selectProject: (project: StoryProject) => Promise<void>;
  toggleChapterSelection: (chapterId: string) => void;
  selectChapterRange: (chapterIds: string[]) => void;
  clearChapterSelection: () => void;
  updateChapterRawText: (chapterId: string, rawText: string) => void;
  updateSessionChaptersAndIssues: (
    chapters: Record<string, ProjectReviewChapter>,
    issues: QualityIssue[]
  ) => Promise<void>;
  updateIssueDecision: (
    issueId: string,
    decision: QualityIssueDecision,
    moderatorNote?: string
  ) => Promise<void>;
  resetCurrentSession: () => Promise<void>;
}

const MAX_CHAPTERS_LIMIT = 12;

function createEmptySession(id?: string): QualityReviewSession {
  return {
    id: id || `quality-session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    projectId: '',
    projectTitle: '',
    selectedChapterIds: [],
    chapters: {},
    issues: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'idle',
  };
}

export function useHakoReviewSession(): UseHakoReviewSessionReturn {
  const [session, setSession] = useState<QualityReviewSession | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0, message: '' });
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  const sessionRef = useRef<QualityReviewSession | null>(null);
  sessionRef.current = session;
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore latest session on mount
  useEffect(() => {
    let isMounted = true;

    getLatestSession()
      .then((savedSession) => {
        if (!isMounted) return;
        if (savedSession) {
          setSession(savedSession);
        } else {
          const empty = createEmptySession();
          setSession(empty);
        }
      })
      .catch((err) => {
        console.error('[useHakoReviewSession] Failed to load session from IndexedDB:', err);
        if (isMounted) {
          setSession(createEmptySession());
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingSession(false);
        }
      });

    return () => {
      isMounted = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  /**
   * Helper cập nhật state và persist vào IndexedDB (hỗ trợ debounce cho các thao tác tick nhanh)
   */
  const persistSession = useCallback(async (updated: QualityReviewSession, debounceMs = 0) => {
    setSession(updated);
    sessionRef.current = updated;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (debounceMs <= 0) {
      try {
        await saveSession(updated);
      } catch (err) {
        console.error('[useHakoReviewSession] Error persisting session:', err);
      }
    } else {
      debounceTimerRef.current = setTimeout(async () => {
        try {
          await saveSession(updated);
        } catch (err) {
          console.error('[useHakoReviewSession] Error persisting debounced session:', err);
        }
      }, debounceMs);
    }
  }, []);

  /**
   * Chọn dự án dịch từ ứng dụng và khởi tạo danh sách chương (nhanh 0ms, không đọc full text)
   */
  const selectProject = useCallback(
    async (project: StoryProject) => {
      if (!project || !project.id) return;

      const current = sessionRef.current || createEmptySession();

      // Khởi tạo metadata siêu nhẹ trực tiếp từ project.chapters
      const chaptersRecord: Record<string, ProjectReviewChapter> = {};
      (project.chapters || []).forEach((meta, index) => {
        const translationType: 'polished' | 'raw' | 'none' =
          meta.status === 'completed'
            ? 'polished'
            : meta.status === 'in_progress'
            ? 'raw'
            : 'none';
        const existingChapter = current.projectId === project.id ? current.chapters[meta.id] : null;

        chaptersRecord[meta.id] = {
          chapterId: meta.id,
          title: meta.title || `Chương ${index + 1}`,
          chapterNumber: index + 1,
          translationType,
          wordCount: 0,
          status: 'pending',
          rawChineseContent: existingChapter?.rawChineseContent,
        };
      });

      const isSameProject = current.projectId === project.id;
      const updated: QualityReviewSession = {
        ...current,
        projectId: project.id,
        projectTitle: project.title,
        selectedChapterIds: isSameProject ? current.selectedChapterIds : [],
        chapters: chaptersRecord,
        issues: isSameProject ? current.issues : [],
        status: isSameProject ? current.status : 'idle',
        error: undefined,
      };

      setError(null);
      await persistSession(updated, 0);
    },
    [persistSession]
  );

  /**
   * Bật/tắt chọn một chương (giới hạn 12 chương, phản hồi UI tức thì và debounce ghi DB 300ms)
   */
  const toggleChapterSelection = useCallback(
    (chapterId: string) => {
      const current = sessionRef.current;
      if (!current) return;

      const chapter = current.chapters[chapterId];
      if (chapter && chapter.translationType === 'none') {
        setError({
          code: 'CHAPTER_NOT_TRANSLATED',
          message: 'Chương này chưa có bản dịch (chưa dịch thô hoặc chưa biên tập), không thể chọn để kiểm định.',
        });
        return;
      }

      const isSelected = current.selectedChapterIds.includes(chapterId);
      let newSelectedIds: string[];

      if (isSelected) {
        newSelectedIds = current.selectedChapterIds.filter((id) => id !== chapterId);
      } else {
        if (current.selectedChapterIds.length >= MAX_CHAPTERS_LIMIT) {
          setError({
            code: 'CHAPTER_LIMIT_EXCEEDED',
            message: `Mỗi lượt rà soát chỉ được chọn tối đa ${MAX_CHAPTERS_LIMIT} chương để đảm bảo tốc độ và tránh quá tải.`,
          });
          return;
        }
        newSelectedIds = [...current.selectedChapterIds, chapterId];
      }

      setError(null);
      const updated: QualityReviewSession = {
        ...current,
        selectedChapterIds: newSelectedIds,
      };

      persistSession(updated, 300);
    },
    [persistSession]
  );

  /**
   * Chọn một danh sách chương (giới hạn 12)
   */
  const selectChapterRange = useCallback(
    (chapterIds: string[]) => {
      const current = sessionRef.current;
      if (!current) return;

      const translatableIds = chapterIds.filter((id) => {
        const ch = current.chapters[id];
        return ch && ch.translationType !== 'none';
      });

      const boundedIds = translatableIds.slice(0, MAX_CHAPTERS_LIMIT);
      if (translatableIds.length > MAX_CHAPTERS_LIMIT) {
        setError({
          code: 'CHAPTER_LIMIT_EXCEEDED',
          message: `Đã tự động giới hạn ${MAX_CHAPTERS_LIMIT} chương đầu tiên theo quy định tối đa mỗi lượt rà soát.`,
        });
      } else {
        setError(null);
      }

      const updated: QualityReviewSession = {
        ...current,
        selectedChapterIds: boundedIds,
      };

      persistSession(updated, 300);
    },
    [persistSession]
  );

  /**
   * Bỏ chọn toàn bộ chương
   */
  const clearChapterSelection = useCallback(() => {
    const current = sessionRef.current;
    if (!current) return;

    setError(null);
    const updated: QualityReviewSession = {
      ...current,
      selectedChapterIds: [],
    };

    persistSession(updated, 300);
  }, [persistSession]);

  /**
   * Cập nhật văn bản raw tiếng Trung cho một chương (không sửa sourceText gốc của project)
   */
  const updateChapterRawText = useCallback(
    (chapterId: string, rawText: string) => {
      const current = sessionRef.current;
      if (!current) return;

      const chapter = current.chapters[chapterId];
      if (!chapter) return;

      const updatedChapters = {
        ...current.chapters,
        [chapterId]: {
          ...chapter,
          rawChineseContent: rawText.trim() || undefined,
        },
      };

      const updated: QualityReviewSession = {
        ...current,
        chapters: updatedChapters,
      };

      persistSession(updated);
    },
    [persistSession]
  );

  /**
   * Cập nhật toàn bộ chapters và issues sau khi phân tích xong (lưu metadata & issues, loại bỏ full text)
   */
  const updateSessionChaptersAndIssues = useCallback(
    async (chapters: Record<string, ProjectReviewChapter>, issues: QualityIssue[]) => {
      const current = sessionRef.current;
      if (!current) return;

      const sanitizedChapters: Record<string, ProjectReviewChapter> = {};
      for (const [id, ch] of Object.entries(chapters)) {
        if (!ch) continue;
        const { vietnameseContent: _vi, ...meta } = ch;
        sanitizedChapters[id] = meta;
      }

      const updated: QualityReviewSession = {
        ...current,
        chapters: sanitizedChapters,
        issues,
        status: 'completed',
      };

      await persistSession(updated, 0);
    },
    [persistSession]
  );

  /**
   * Cập nhật quyết định của moderator cho một lỗi (xác nhận, xem lại, bác bỏ, ghi chú)
   */
  const updateIssueDecision = useCallback(
    async (issueId: string, decision: QualityIssueDecision, moderatorNote?: string) => {
      const current = sessionRef.current;
      if (!current) return;

      const updatedIssues = current.issues.map((issue) => {
        if (issue.id === issueId) {
          return {
            ...issue,
            decision,
            moderatorNote: moderatorNote !== undefined ? moderatorNote : issue.moderatorNote,
          };
        }
        return issue;
      });

      const updated: QualityReviewSession = {
        ...current,
        issues: updatedIssues,
      };

      await persistSession(updated);
    },
    [persistSession]
  );

  /**
   * Đặt lại phiên làm việc hiện tại
   */
  const resetCurrentSession = useCallback(async () => {
    const current = sessionRef.current;
    if (current && current.id) {
      await deleteSessionFromDb(current.id).catch(() => {});
    }
    const empty = createEmptySession();
    setError(null);
    await persistSession(empty);
  }, [persistSession]);

  return {
    session,
    isLoadingSession,
    isAnalyzing,
    analysisProgress,
    error,
    setError,
    setIsAnalyzing,
    setAnalysisProgress,
    selectProject,
    toggleChapterSelection,
    selectChapterRange,
    clearChapterSelection,
    updateChapterRawText,
    updateSessionChaptersAndIssues,
    updateIssueDecision,
    resetCurrentSession,
  };
}
