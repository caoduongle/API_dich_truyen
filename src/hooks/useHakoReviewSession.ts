/**
 * React hook for managing Moderator Hako Quality Checker session state
 * Feature: 075-moderator-quality-checker
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  QualityReviewSession,
  HakoNovelMeta,
  HakoReviewChapter,
  QualityIssue,
  QualityIssueDecision,
} from '../types/hakoChecker';
import {
  saveSession,
  getLatestSession,
  deleteSession as deleteSessionFromDb,
} from '../services/hakoSessionStore';
import { fetchHakoNovelMeta, HakoApiError } from '../services/hakoApiService';

export interface UseHakoReviewSessionReturn {
  session: QualityReviewSession | null;
  isLoadingSession: boolean;
  isFetchingMeta: boolean;
  isAnalyzing: boolean;
  analysisProgress: { current: number; total: number; message: string };
  error: { code: string; message: string; retryAfterSeconds?: number } | null;
  setError: (err: { code: string; message: string; retryAfterSeconds?: number } | null) => void;
  setIsAnalyzing: (analyzing: boolean) => void;
  setAnalysisProgress: (progress: { current: number; total: number; message: string }) => void;
  fetchNovel: (url: string) => Promise<void>;
  toggleChapterSelection: (url: string, chapterTitle?: string, volumeTitle?: string) => void;
  selectChapterRange: (urls: string[]) => void;
  clearChapterSelection: () => void;
  updateChapterRawText: (url: string, rawText: string) => void;
  updateSessionChaptersAndIssues: (
    chapters: Record<string, HakoReviewChapter>,
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
    id: id || `hako-session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    novelUrl: '',
    novelMeta: null,
    selectedChapterUrls: [],
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
  const [isFetchingMeta, setIsFetchingMeta] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0, message: '' });
  const [error, setError] = useState<{ code: string; message: string; retryAfterSeconds?: number } | null>(null);

  const sessionRef = useRef<QualityReviewSession | null>(null);
  sessionRef.current = session;

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
    };
  }, []);

  /**
   * Helper cập nhật state và persist vào IndexedDB
   */
  const persistSession = useCallback(async (updated: QualityReviewSession) => {
    setSession(updated);
    try {
      await saveSession(updated);
    } catch (err) {
      console.error('[useHakoReviewSession] Error persisting session:', err);
    }
  }, []);

  /**
   * Tìm nạp thông tin bộ truyện từ Hako URL
   */
  const fetchNovel = useCallback(
    async (url: string) => {
      const cleanUrl = url?.trim();
      if (!cleanUrl) {
        setError({
          code: 'INVALID_HAKO_URL',
          message: 'Vui lòng nhập đường dẫn truyện Hako/Docln hợp lệ.',
        });
        return;
      }

      setIsFetchingMeta(true);
      setError(null);

      try {
        const meta: HakoNovelMeta = await fetchHakoNovelMeta(cleanUrl);
        const current = sessionRef.current || createEmptySession();

        const updated: QualityReviewSession = {
          ...current,
          novelUrl: cleanUrl,
          novelMeta: meta,
          selectedChapterUrls: [], // Reset selection khi nạp truyện mới
          chapters: {},
          issues: [],
          status: 'idle',
          error: undefined,
        };

        await persistSession(updated);
      } catch (err: any) {
        const code = err.code || 'HAKO_FETCH_ERROR';
        const message = err.message || 'Không thể tìm nạp thông tin truyện từ Hako.';
        const retryAfterSeconds = err.retryAfterSeconds;
        setError({ code, message, retryAfterSeconds });
      } finally {
        setIsFetchingMeta(false);
      }
    },
    [persistSession]
  );

  /**
   * Bật/tắt chọn một chương (giới hạn 12 chương)
   */
  const toggleChapterSelection = useCallback(
    (url: string, chapterTitle?: string, volumeTitle?: string) => {
      const current = sessionRef.current;
      if (!current) return;

      const isSelected = current.selectedChapterUrls.includes(url);
      let newSelectedUrls: string[];

      if (isSelected) {
        newSelectedUrls = current.selectedChapterUrls.filter((u) => u !== url);
      } else {
        if (current.selectedChapterUrls.length >= MAX_CHAPTERS_LIMIT) {
          setError({
            code: 'CHAPTER_LIMIT_EXCEEDED',
            message: `Mỗi lượt rà soát chỉ được chọn tối đa ${MAX_CHAPTERS_LIMIT} chương để đảm bảo tốc độ và tránh quá tải.`,
          });
          return;
        }
        newSelectedUrls = [...current.selectedChapterUrls, url];
      }

      // Khởi tạo hoặc giữ chapter entry
      const newChapters = { ...current.chapters };
      if (!isSelected && !newChapters[url]) {
        newChapters[url] = {
          url,
          title: chapterTitle || 'Chương truyện',
          volumeTitle: volumeTitle || '',
          vietnameseContent: '',
          wordCount: 0,
          status: 'pending',
        };
      }

      setError(null);
      const updated: QualityReviewSession = {
        ...current,
        selectedChapterUrls: newSelectedUrls,
        chapters: newChapters,
      };

      persistSession(updated);
    },
    [persistSession]
  );

  /**
   * Chọn một danh sách chương (giới hạn 12)
   */
  const selectChapterRange = useCallback(
    (urls: string[]) => {
      const current = sessionRef.current;
      if (!current) return;

      const boundedUrls = urls.slice(0, MAX_CHAPTERS_LIMIT);
      if (urls.length > MAX_CHAPTERS_LIMIT) {
        setError({
          code: 'CHAPTER_LIMIT_EXCEEDED',
          message: `Đã tự động giới hạn ${MAX_CHAPTERS_LIMIT} chương đầu tiên theo quy định tối đa mỗi lượt rà soát.`,
        });
      } else {
        setError(null);
      }

      const updated: QualityReviewSession = {
        ...current,
        selectedChapterUrls: boundedUrls,
      };

      persistSession(updated);
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
      selectedChapterUrls: [],
    };

    persistSession(updated);
  }, [persistSession]);

  /**
   * Cập nhật văn bản raw tiếng Trung cho một chương
   */
  const updateChapterRawText = useCallback(
    (url: string, rawText: string) => {
      const current = sessionRef.current;
      if (!current) return;

      const chapter = current.chapters[url] || {
        url,
        title: 'Chương truyện',
        volumeTitle: '',
        vietnameseContent: '',
        wordCount: 0,
        status: 'pending',
      };

      const updatedChapters = {
        ...current.chapters,
        [url]: {
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
   * Cập nhật toàn bộ chapters và issues sau khi phân tích xong
   */
  const updateSessionChaptersAndIssues = useCallback(
    async (chapters: Record<string, HakoReviewChapter>, issues: QualityIssue[]) => {
      const current = sessionRef.current;
      if (!current) return;

      const updated: QualityReviewSession = {
        ...current,
        chapters,
        issues,
        status: 'completed',
      };

      await persistSession(updated);
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
    isFetchingMeta,
    isAnalyzing,
    analysisProgress,
    error,
    setError,
    setIsAnalyzing,
    setAnalysisProgress,
    fetchNovel,
    toggleChapterSelection,
    selectChapterRange,
    clearChapterSelection,
    updateChapterRawText,
    updateSessionChaptersAndIssues,
    updateIssueDecision,
    resetCurrentSession,
  };
}
