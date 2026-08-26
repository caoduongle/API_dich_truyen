/**
 * HakoCheckerWorkspace Component
 * Feature: 075-moderator-quality-checker
 *
 * Khu vực làm việc chính của Moderator để kiểm định chất lượng các chương truyện Hako.
 * Tích hợp toàn bộ luồng: Tìm nạp truyện -> Chọn chương -> Rà soát Heuristic & AI -> Duyệt lỗi -> Xuất báo cáo.
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  ShieldCheck,
  RefreshCw,
  Sparkles,
  BookOpen,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import {
  HakoReviewChapter,
  QualityIssue,
} from '../../types/hakoChecker';
import { useHakoReviewSession } from '../../hooks/useHakoReviewSession';
import { fetchHakoChapterContent, HakoApiError } from '../../services/hakoApiService';
import {
  runHeuristicQualityScan,
  runAiQualityScan,
} from '../../services/hakoQualityEngine';
import { HakoNovelImporter } from './HakoNovelImporter';
import { HakoChapterSelector } from './HakoChapterSelector';
import { HakoIssueReviewPanel } from './HakoIssueReviewPanel';
import { HakoReportExportModal } from './HakoReportExportModal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Seal } from '../ui/Seal';

export interface HakoCheckerWorkspaceProps {
  apiKeys: string[];
  selectedModel?: string;
}

export function HakoCheckerWorkspace({
  apiKeys,
  selectedModel,
}: HakoCheckerWorkspaceProps) {
  const {
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
  } = useHakoReviewSession();

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Kích hoạt quy trình phân tích chất lượng toàn diện (Heuristic + AI)
   */
  const handleStartAnalysis = useCallback(async () => {
    if (!session || !session.novelMeta || session.selectedChapterUrls.length === 0) {
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    abortControllerRef.current = new AbortController();

    const selectedUrls = session.selectedChapterUrls;
    const totalSelected = selectedUrls.length;
    const loadedChapters: Record<string, HakoReviewChapter> = { ...session.chapters };
    const allDetectedIssues: QualityIssue[] = [];

    try {
      // BƯỚC 1: Tải nội dung văn bản tiếng Việt của các chương đã chọn (nếu chưa tải)
      for (let i = 0; i < selectedUrls.length; i++) {
        const url = selectedUrls[i];
        let chData = loadedChapters[url];

        if (!chData || !chData.vietnameseContent) {
          setAnalysisProgress({
            current: i + 1,
            total: totalSelected,
            message: `Đang tải nội dung chương ${i + 1}/${totalSelected} từ Hako...`,
          });

          try {
            const fetched = await fetchHakoChapterContent(url);
            chData = {
              url,
              title: fetched.title || chData?.title || 'Chương truyện',
              volumeTitle: fetched.volumeTitle || chData?.volumeTitle || '',
              vietnameseContent: fetched.content,
              rawChineseContent: chData?.rawChineseContent,
              wordCount: fetched.wordCount,
              status: 'loaded',
            };
            loadedChapters[url] = chData;
          } catch (err: any) {
            console.error(`Failed to fetch content for chapter ${url}:`, err);
            chData = {
              url,
              title: chData?.title || 'Chương truyện',
              volumeTitle: chData?.volumeTitle || '',
              vietnameseContent: '',
              rawChineseContent: chData?.rawChineseContent,
              wordCount: 0,
              status: 'error',
              errorMessage: err.message || 'Lỗi khi tải nội dung chương',
            };
            loadedChapters[url] = chData;
          }
        }

        // BƯỚC 2: Chạy quét Heuristic tức thì cho chương này
        if (chData.vietnameseContent) {
          const heuristicIssues = runHeuristicQualityScan({
            url: chData.url,
            title: chData.title,
            vietnameseContent: chData.vietnameseContent,
          });
          allDetectedIssues.push(...heuristicIssues);
        }
      }

      // BƯỚC 3: Chạy quét AI Semantic sâu qua Gemini API
      const validChaptersForAi = selectedUrls
        .map((url) => loadedChapters[url])
        .filter((ch) => ch && ch.vietnameseContent && ch.vietnameseContent.trim().length > 0)
        .map((ch) => ({
          url: ch.url,
          title: ch.title,
          vietnameseContent: ch.vietnameseContent,
          rawChineseContent: ch.rawChineseContent,
        }));

      if (validChaptersForAi.length > 0) {
        setAnalysisProgress({
          current: 1,
          total: validChaptersForAi.length,
          message: 'Bắt đầu phân tích ngữ nghĩa và tính nhất quán qua mô hình AI...',
        });

        const aiIssues = await runAiQualityScan({
          apiKeys,
          model: selectedModel,
          novelTitle: session.novelMeta.title,
          chapters: validChaptersForAi,
          onProgress: (curr, total, msg) => {
            setAnalysisProgress({ current: curr, total, message: msg });
          },
          signal: abortControllerRef.current.signal,
        });

        allDetectedIssues.push(...aiIssues);
      }

      // Cập nhật session và lưu vào IndexedDB
      await updateSessionChaptersAndIssues(loadedChapters, allDetectedIssues);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('[HakoCheckerWorkspace] Phân tích đã bị hủy bởi người dùng.');
      } else {
        console.error('[HakoCheckerWorkspace] Lỗi khi phân tích chất lượng:', err);
        setError({
          code: err.code || 'ANALYSIS_ERROR',
          message: err.message || 'Đã xảy ra lỗi trong quá trình phân tích chất lượng chương.',
          retryAfterSeconds: err.retryAfterSeconds,
        });
      }
    } finally {
      setIsAnalyzing(false);
      abortControllerRef.current = null;
    }
  }, [session, apiKeys, selectedModel, setIsAnalyzing, setError, setAnalysisProgress, updateSessionChaptersAndIssues]);

  const handleCancelAnalysis = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsAnalyzing(false);
    }
  };

  if (isLoadingSession) {
    return (
      <div className="bg-parchment border border-parchment-2 rounded-md p-12 text-center shadow-xs">
        <RefreshCw className="w-8 h-8 text-polish animate-spin mx-auto mb-3" />
        <p className="text-xs text-text-muted font-bold tracking-wider uppercase">
          Đang khôi phục phiên làm việc kiểm định...
        </p>
      </div>
    );
  }

  const hasNovelMeta = !!session?.novelMeta;
  const hasIssues = !!(session?.issues && session.issues.length > 0);

  return (
    <div className="space-y-6">
      {/* Workspace Header Banner */}
      <div className="bg-parchment border border-parchment-2 rounded-md p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[3px] bg-ink border border-parchment-2 flex items-center justify-center text-polish shrink-0 shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-display font-bold text-text-main flex items-center gap-2">
                Kiểm Định Chất Lượng Bản Dịch Hako
                <span className="text-[9px] font-mono text-text-muted bg-parchment-2 px-1.5 py-0.5 rounded-[2px] border border-parchment-2">
                  Moderator Workspace
                </span>
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Rà soát lỗi dịch thuật, xưng hô, tên riêng và sót raw trên các chương đã đăng công khai trên Hako/Docln
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasNovelMeta && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetCurrentSession}
                disabled={isAnalyzing}
                icon={<RotateCcw className="w-3.5 h-3.5" />}
                className="text-xs text-text-muted hover:text-text-main"
              >
                Nhập truyện mới
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 1. Novel Importer */}
      <HakoNovelImporter
        novelUrl={session?.novelUrl || ''}
        novelMeta={session?.novelMeta || null}
        onFetchMeta={fetchNovel}
        isLoading={isFetchingMeta}
        error={error}
        onClearError={() => setError(null)}
      />

      {/* 2. Analysis Progress Banner */}
      {isAnalyzing && (
        <div className="bg-ink border-2 border-polish/60 rounded-md p-5 shadow-md animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <RefreshCw className="w-5 h-5 text-polish animate-spin" />
              <div>
                <h4 className="text-xs font-display font-bold text-text-main">
                  Đang thực hiện kiểm định chất lượng...
                </h4>
                <p className="text-[11px] text-polish font-medium mt-0.5">
                  {analysisProgress.message || 'Đang xử lý dữ liệu...'}
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleCancelAnalysis}
              className="text-xs"
            >
              Hủy phân tích
            </Button>
          </div>

          {/* Progress Bar */}
          {analysisProgress.total > 0 && (
            <div className="w-full bg-parchment-2/50 rounded-full h-2 overflow-hidden">
              <div
                className="bg-polish h-full transition-all duration-300 rounded-full"
                style={{
                  width: `${Math.round((analysisProgress.current / analysisProgress.total) * 100)}%`,
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* 3. Chapter Selector (when novel is loaded) */}
      {hasNovelMeta && (
        <HakoChapterSelector
          novelMeta={session.novelMeta!}
          selectedUrls={session.selectedChapterUrls}
          chapters={session.chapters}
          onToggleChapter={toggleChapterSelection}
          onSelectRange={selectChapterRange}
          onClearSelection={clearChapterSelection}
          onUpdateRawText={updateChapterRawText}
          onStartAnalysis={handleStartAnalysis}
          isAnalyzing={isAnalyzing}
        />
      )}

      {/* 4. Issue Review Panel (when issues exist or analysis completed) */}
      {hasNovelMeta && session.status === 'completed' && (
        <HakoIssueReviewPanel
          issues={session.issues}
          chapters={session.chapters}
          onDecisionChange={updateIssueDecision}
          onOpenExportModal={() => setIsExportModalOpen(true)}
          onReanalyze={handleStartAnalysis}
          isAnalyzing={isAnalyzing}
        />
      )}

      {/* 5. Report Export Modal */}
      <HakoReportExportModal
        open={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        session={session}
      />
    </div>
  );
}

export default HakoCheckerWorkspace;
