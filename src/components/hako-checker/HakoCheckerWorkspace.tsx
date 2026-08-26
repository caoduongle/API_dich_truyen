/**
 * HakoCheckerWorkspace Component
 * Feature: 075-moderator-quality-checker
 *
 * Khu vực làm việc chính của Moderator để kiểm định chất lượng các chương truyện trong dự án.
 * Tích hợp toàn bộ luồng: Chọn dự án -> Chọn chương -> Rà soát Heuristic & AI -> Duyệt lỗi -> Xuất báo cáo.
 */

import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  ShieldCheck,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import {
  QualityIssue,
  HakoChapterFull,
  ProjectReviewChapter,
} from '../../types/hakoChecker';
import { useHakoReviewSession } from '../../hooks/useHakoReviewSession';
import { useProjectContext } from '../../context/ProjectContext';
import { getChapterFromDB } from '../../services/db';
import {
  runHeuristicQualityScan,
  runAiQualityScan,
} from '../../services/hakoQualityEngine';
import { HakoChapterSelector } from './HakoChapterSelector';
import { HakoIssueReviewPanel } from './HakoIssueReviewPanel';
import { HakoReportExportModal } from './HakoReportExportModal';
import { Button } from '../ui/Button';
import { ErrorBoundary } from '../ErrorBoundary';

export interface HakoCheckerWorkspaceProps {
  apiKeys: string[];
  selectedModel?: string;
}

export function HakoCheckerWorkspace({
  apiKeys,
  selectedModel,
}: HakoCheckerWorkspaceProps) {
  const { projects } = useProjectContext();
  const {
    session,
    isLoadingSession,
    isAnalyzing,
    analysisProgress,
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
  } = useHakoReviewSession();

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Safe selected chapters derivation with defensive filter
  const selectedChapters = useMemo(() => {
    if (!session?.chapters || !session?.selectedChapterIds) return [];
    const selectedSet = new Set(session.selectedChapterIds.map(String));
    return Object.values(session.chapters).filter(
      (c): c is ProjectReviewChapter => Boolean(c && selectedSet.has(String(c.chapterId)))
    );
  }, [session?.chapters, session?.selectedChapterIds]);

  // Safe total word count aggregation
  const _totalSelectedWords = useMemo(() => {
    return selectedChapters.reduce((sum, c) => sum + (c?.wordCount || 0), 0);
  }, [selectedChapters]);

  const handleSelectProject = useCallback(
    async (projectId: string) => {
      const proj = projects.find((p) => p.id === projectId);
      if (proj) {
        await selectProject(proj);
      }
    },
    [projects, selectProject]
  );

  /**
   * Kích hoạt quy trình phân tích chất lượng toàn diện (Heuristic + AI) với cơ chế nạp text Just-In-Time (JIT)
   */
  const handleStartAnalysis = useCallback(async () => {
    if (!session || !session.projectId || session.selectedChapterIds.length === 0) {
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    abortControllerRef.current = new AbortController();

    const selectedIds = (session.selectedChapterIds || []).map(String);
    const allDetectedIssues: QualityIssue[] = [];

    try {
      setAnalysisProgress({
        current: 0,
        total: selectedIds.length,
        message: `Đang nạp nội dung ${selectedIds.length} chương đã chọn từ cơ sở dữ liệu...`,
      });

      // BƯỚC 0: Nạp Just-In-Time (JIT) toàn bộ nội dung chỉ cho các chương đã chọn (tối đa 12 chương)
      const jitChapters: HakoChapterFull[] = await Promise.all(
        selectedIds.map(async (id) => {
          const meta = session.chapters[id] || (session.chapters as any)[Number(id)];
          const fullChap = await getChapterFromDB(id);
          const viContent = fullChap?.polishedTranslation || fullChap?.rawTranslation || '';
          const rawChinese = meta?.rawChineseContent ?? (fullChap?.sourceText || undefined);
          const words = viContent ? viContent.trim().split(/\s+/).filter(Boolean).length : (meta?.wordCount ?? 0);

          return {
            chapterId: id,
            title: meta?.title || fullChap?.title || 'Chương không tên',
            chapterNumber: meta?.chapterNumber ?? 1,
            translationType: fullChap?.polishedTranslation ? 'polished' : fullChap?.rawTranslation ? 'raw' : (meta?.translationType || 'none'),
            wordCount: words,
            status: 'analyzing' as const,
            vietnameseContent: viContent,
            rawChineseContent: rawChinese,
          };
        })
      );

      // BƯỚC 1: Chạy quét Heuristic tức thì cho các chương đã nạp
      for (let i = 0; i < jitChapters.length; i++) {
        const chData = jitChapters[i];

        if (chData && chData.vietnameseContent) {
          setAnalysisProgress({
            current: i + 1,
            total: jitChapters.length,
            message: `Đang quét quy tắc nhanh (Heuristic) chương ${i + 1}/${jitChapters.length}: "${chData.title}"...`,
          });

          const heuristicIssues = runHeuristicQualityScan({
            chapterId: chData.chapterId,
            title: chData.title,
            vietnameseContent: chData.vietnameseContent,
          });
          allDetectedIssues.push(...heuristicIssues);
        }
      }

      // BƯỚC 2: Chạy quét AI Semantic sâu qua Gemini API
      const validChaptersForAi = jitChapters
        .filter((ch) => ch && ch.vietnameseContent && ch.vietnameseContent.trim().length > 0)
        .map((ch) => ({
          chapterId: ch.chapterId,
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
          projectTitle: session.projectTitle,
          chapters: validChaptersForAi,
          onProgress: (curr, total, msg) => {
            setAnalysisProgress({ current: curr, total, message: msg });
          },
          signal: abortControllerRef.current.signal,
        });

        allDetectedIssues.push(...aiIssues);
      }

      // Cập nhật session và lưu vào IndexedDB (chỉ lưu metadata + issues)
      const updatedChaptersRecord = { ...session.chapters };
      jitChapters.forEach((ch) => {
        if (updatedChaptersRecord[ch.chapterId]) {
          updatedChaptersRecord[ch.chapterId] = {
            ...updatedChaptersRecord[ch.chapterId],
            status: 'done',
            wordCount: ch.wordCount,
          };
        }
      });

      await updateSessionChaptersAndIssues(updatedChaptersRecord, allDetectedIssues);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('[HakoCheckerWorkspace] Phân tích đã bị hủy bởi người dùng.');
      } else {
        console.error('[HakoCheckerWorkspace] Lỗi khi phân tích chất lượng:', err);
        setError({
          code: err.code || 'ANALYSIS_ERROR',
          message: err.message || 'Đã xảy ra lỗi trong quá trình phân tích chất lượng chương.',
        });
      }
    } finally {
      setIsAnalyzing(false);
      abortControllerRef.current = null;
    }
  }, [
    session,
    apiKeys,
    selectedModel,
    setIsAnalyzing,
    setError,
    setAnalysisProgress,
    updateSessionChaptersAndIssues,
  ]);

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

  const hasProjectSelected = !!session?.projectId;

  return (
    <ErrorBoundary fallbackTitle="Đã xảy ra lỗi tại phân vùng Kiểm Định Chất Lượng">
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
                  Kiểm Định Chất Lượng Bản Dịch
                  <span className="text-[9px] font-mono text-text-muted bg-parchment-2 px-1.5 py-0.5 rounded-[2px] border border-parchment-2">
                    Moderator Workspace
                  </span>
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Rà soát lỗi dịch thuật, xưng hô, tên riêng, sót raw và ngữ nghĩa trực tiếp từ các chương trong dự án
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {hasProjectSelected && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetCurrentSession}
                  disabled={isAnalyzing}
                  icon={<RotateCcw className="w-3.5 h-3.5" />}
                  className="text-xs text-text-muted hover:text-text-main"
                >
                  Đặt lại phiên
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Analysis Progress Banner */}
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

        {/* Chapter & Project Selector */}
        <HakoChapterSelector
          projects={projects}
          selectedProjectId={session?.projectId || null}
          onSelectProject={handleSelectProject}
          selectedChapterIds={session?.selectedChapterIds || []}
          chapters={session?.chapters || {}}
          onToggleChapter={toggleChapterSelection}
          onSelectRange={selectChapterRange}
          onClearSelection={clearChapterSelection}
          onUpdateRawText={updateChapterRawText}
          onStartAnalysis={handleStartAnalysis}
          isAnalyzing={isAnalyzing}
        />

        {/* Issue Review Panel (when issues exist or analysis completed) */}
        {hasProjectSelected && session.status === 'completed' && (
          <HakoIssueReviewPanel
            issues={session.issues}
            chapters={session.chapters}
            onDecisionChange={updateIssueDecision}
            onOpenExportModal={() => setIsExportModalOpen(true)}
            onReanalyze={handleStartAnalysis}
            isAnalyzing={isAnalyzing}
          />
        )}

        {/* Report Export Modal */}
        <HakoReportExportModal
          open={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          session={session}
        />
      </div>
    </ErrorBoundary>
  );
}

export default HakoCheckerWorkspace;
