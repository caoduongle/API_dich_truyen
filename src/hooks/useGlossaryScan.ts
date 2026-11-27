import React, { useState, useRef, useEffect, useCallback } from 'react';
import { StoryProject, GlossaryItem, PendingGlossaryItem, ChapterMetadata } from '../types';
import { getChaptersByProjectFromDB } from '../services/db';
import { LogEntry } from './useAutoTranslationQueue';
import { useNotifications } from '../context/NotificationContext';
import { isHanEquivalent } from '../lib/sinoNormalize';
import {
  inferCharacterGenderFromContext,
  isNoisyGlossaryTerm,
  prioritizeKnownTermsForChapter,
} from '../lib/glossaryMatch';
import { analyzeGlossaryDirect } from '../services/directGlossaryEngine';
import { inspectKeyPoolCooldown } from '../services/gemini/geminiKeyScheduler';
import { RATE_LIMIT_RECOVERY_CONFIG } from '../config/constants';
import { getDynamicPacingInterval } from '../utils/modelRegistry';
import { getStoredCustomLimits } from '../utils/customLimitsStorage';

function createAbortError(message = 'Người dùng đã dừng tiến trình quét thuật ngữ.'): Error {
  const err = new Error(message);
  err.name = 'AbortError';
  return err;
}

export function waitForCooldownWithAbort(waitMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(createAbortError());
  }
  if (waitMs <= 0) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(createAbortError());
    };

    const timer = setTimeout(() => {
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
      resolve();
    }, waitMs);

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

function isAllKeysExhaustedError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const errObj = err as { code?: unknown; message?: unknown };
  const msg = typeof errObj.message === 'string' ? errObj.message : '';
  return (
    errObj.code === 'ALL_KEYS_EXHAUSTED' ||
    msg.includes('ALL_KEYS_EXHAUSTED') ||
    msg.includes('Toàn bộ API Key đã hết hạn mức') ||
    msg.includes('Toàn bộ API Key đang tạm nghỉ')
  );
}

function resolveRecoverableRetryAfterMs(err: unknown, apiKeys: string[]): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const errObj = err as {
    code?: unknown;
    category?: unknown;
    isRetryable?: unknown;
    retryAfterMs?: unknown;
  };

  if (
    typeof errObj.retryAfterMs === 'number' &&
    errObj.retryAfterMs > 0 &&
    errObj.retryAfterMs <= RATE_LIMIT_RECOVERY_CONFIG.MAX_AUTO_WAIT_COOLDOWN_MS
  ) {
    return errObj.retryAfterMs;
  }

  if (errObj.category === 'RATE_LIMIT_RPM' || errObj.code === 'ALL_KEYS_EXHAUSTED') {
    const pool = inspectKeyPoolCooldown(apiKeys, getStoredCustomLimits(apiKeys));
    if (
      pool.availableKeyIndex === -1 &&
      pool.hasRecoverableCooldown &&
      pool.minCooldownRemainingMs > 0 &&
      pool.minCooldownRemainingMs <= RATE_LIMIT_RECOVERY_CONFIG.MAX_AUTO_WAIT_COOLDOWN_MS
    ) {
      return pool.minCooldownRemainingMs;
    }
  }

  return undefined;
}

export interface UseGlossaryScanProps {
  activeProject: StoryProject;
  onUpdateProject: (updated: StoryProject) => void;
  apiKeys: string[];
  selectedModel: string;
  extractionLoops: number;
  scanRangeEnabled: boolean;
  scanRangeStart: number;
  scanRangeEnd: number;

  // Shared ref and state updaters
  currentApiKeyIndexRef: React.MutableRefObject<number>;
  addLog: (message: string, type?: LogEntry['type']) => void;
  setAutoDiscoveredBatch: React.Dispatch<React.SetStateAction<GlossaryItem[]>>;
}

export function useGlossaryScan({
  activeProject,
  onUpdateProject,
  apiKeys,
  selectedModel,
  extractionLoops,
  scanRangeEnabled,
  scanRangeStart,
  scanRangeEnd,
  currentApiKeyIndexRef,
  addLog,
  setAutoDiscoveredBatch,
}: UseGlossaryScanProps) {
  const { showToast } = useNotifications();
  const [isScanningGlossary, setIsScanningGlossary] = useState<boolean>(false);
  const [scanningProgress, setScanningProgress] = useState<number>(0);
  const [currentExtractionLoop, setCurrentExtractionLoop] = useState<number>(1);
  const [currentScanningChapterTitle, setCurrentScanningChapterTitle] = useState<string>('');
  const [currentScanningChapterIndex, setCurrentScanningChapterIndex] = useState<number>(0);
  const [totalScanChapters, setTotalScanChapters] = useState<number>(0);
  const [scanFoundCount, setScanFoundCount] = useState<number>(0);

  const projectRef = useRef<StoryProject>(activeProject);
  const isStopScanRequestedRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      isStopScanRequestedRef.current = true;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    projectRef.current = activeProject;
  }, [activeProject]);

  const handleAutoExtractGlossary = useCallback(async (overrideChapters?: ChapterMetadata[]) => {
    if (isScanningGlossary) {
      isStopScanRequestedRef.current = true;
      addLog("ĐANG YÊU CẦU DỪNG QUÉT... Đang hủy tác vụ hiện tại và lưu tiến độ.", "warn");
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      return;
    }

    const hasValidKeys = Array.isArray(apiKeys) && apiKeys.some((k) => typeof k === 'string' && k.trim().length > 0);
    if (!hasValidKeys) {
      showToast({ message: "Vui lòng thêm ít nhất một Gemini API Key cá nhân trong Cấu hình AI để quét từ điển!", type: 'error' });
      addLog("LỖI: Chưa cấu hình API Key cá nhân. Bắt buộc cần có key để thực hiện quét từ điển.", "error");
      return;
    }

    const chaps = projectRef.current.chapters || [];
    if (chaps.length === 0) {
      showToast({ message: "Bộ truyện không có chương nào để lọc!", type: 'warning' });
      return;
    }

    let scopedChaps = overrideChapters ?? chaps;
    if (!overrideChapters && scanRangeEnabled) {
      const startIdx = Math.max(0, scanRangeStart - 1);
      const endIdx = Math.min(chaps.length, scanRangeEnd);
      scopedChaps = chaps.slice(startIdx, endIdx);
    }

    setIsScanningGlossary(true);
    isStopScanRequestedRef.current = false;
    abortControllerRef.current = new AbortController();
    setScanningProgress(0);
    setScanFoundCount(0);
    setCurrentScanningChapterIndex(0);
    setTotalScanChapters(scopedChaps.length);
    setCurrentScanningChapterTitle('');
    addLog(`=== KHỞI CHẠY QUÉT LỌC THUẬT NGỮ SỈ${!overrideChapters && scanRangeEnabled ? ` (Chương ${scanRangeStart}→${scanRangeEnd})` : ' TOÀN BỘ TRUYỆN'} ===`, 'success');

    try {
      const dbChapters = await getChaptersByProjectFromDB(projectRef.current.id);
      const chaptersMap = new Map(dbChapters.map(c => [c.id, c]));

      let updatedGlossary = [...projectRef.current.glossary];
      let chaptersProcessedSinceLastUpdate = 0;

      const newlyFailedIds: string[] = [];
      let activeFailedIds = overrideChapters
        ? [...(projectRef.current.glossaryScanQueueState?.failedIds || [])]
        : [];
      const cleanKeys = (apiKeys || []).map((k) => (typeof k === 'string' ? k.trim() : '')).filter(Boolean);
      let stoppedDueToQuota = false;
      let hasDispatchedChapterCall = false;

      for (let loop = 1; loop <= extractionLoops; loop++) {
        if (isStopScanRequestedRef.current || stoppedDueToQuota || !isMountedRef.current) break;
        setCurrentExtractionLoop(loop);

        for (let i = 0; i < scopedChaps.length; i++) {
          if (isStopScanRequestedRef.current || stoppedDueToQuota || !isMountedRef.current) break;
          const chapMeta = scopedChaps[i];
          const chap = chaptersMap.get(chapMeta.id);
          if (!chap) continue;

          // Giãn nhịp chủ động giữa các chương để hạn chế chạm trần 15 RPM của gói miễn phí
          if (hasDispatchedChapterCall) {
            const customLimits = getStoredCustomLimits(cleanKeys);
            const firstCustomRpm = Object.values(customLimits).find(
              (lim) => typeof lim?.maxRpm === 'number' && lim.maxRpm > 0
            )?.maxRpm;
            const baseInterval = getDynamicPacingInterval(firstCustomRpm, selectedModel);
            const effectiveBaseInterval =
              baseInterval > 0 && cleanKeys.length === 1 && !firstCustomRpm
                ? Math.max(baseInterval, 4200)
                : baseInterval;
            const pacingMs =
              effectiveBaseInterval > 0
                ? Math.max(300, Math.ceil(effectiveBaseInterval / Math.max(1, cleanKeys.length)))
                : 0;
            if (pacingMs > 0) {
              try {
                await waitForCooldownWithAbort(pacingMs, abortControllerRef.current?.signal);
              } catch {
                isStopScanRequestedRef.current = true;
                break;
              }
            }
          }

          // Kiểm tra trạng thái pool key trước khi gọi: nếu toàn bộ key đang tạm nghỉ RPM thì chờ phục hồi tại chỗ
          const preCheckPool = inspectKeyPoolCooldown(cleanKeys, getStoredCustomLimits(cleanKeys));
          if (preCheckPool.availableKeyIndex === -1) {
            if (preCheckPool.hasRecoverableCooldown && preCheckPool.minCooldownRemainingMs > 0) {
              const waitMs = preCheckPool.minCooldownRemainingMs + 50;
              addLog(
                `[Chờ RPM] Toàn bộ khóa đang tạm nghỉ RPM — Tạm chờ hồi phục (~${Math.ceil(waitMs / 1000)}s) trước khi quét chương [${chap.title}]...`,
                'warn'
              );
              try {
                await waitForCooldownWithAbort(waitMs, abortControllerRef.current?.signal);
              } catch {
                isStopScanRequestedRef.current = true;
                break;
              }
            } else if (preCheckPool.allPermanentlyExhausted) {
              stoppedDueToQuota = true;
              for (const rem of scopedChaps.slice(i)) {
                if (!newlyFailedIds.includes(rem.id)) newlyFailedIds.push(rem.id);
              }
              addLog(
                `Dừng quét thuật ngữ tại chương [${chap.title}] (${i + 1}/${scopedChaps.length}) do toàn bộ API Key đã hết hạn mức quota.`,
                'error'
              );
              break;
            }
          }

          setCurrentScanningChapterIndex(i + 1);
          setCurrentScanningChapterTitle(chap.title);
          setScanningProgress(Math.round(((i + 1) / scopedChaps.length) * 100));
          const loopNote = loop > 1 ? ` (Rà soát sâu lượt ${loop}/${extractionLoops} - Bỏ qua ${updatedGlossary.length} từ đã biết)` : '';
          addLog(`[Vòng ${loop}] Quét lọc Chương ${i + 1}/${scopedChaps.length}: ${chap.title}${loopNote}`, 'gemini');

          let chapterCooldownWaits = 0;
          let chapterAttemptDone = false;

          while (!chapterAttemptDone && !isStopScanRequestedRef.current && !stoppedDueToQuota && isMountedRef.current) {
            try {
              hasDispatchedChapterCall = true;
              const chapterInputText = `${chap.title}\n\n${chap.sourceText}`;
              const knownChineseTerms =
                loop > 1 ? prioritizeKnownTermsForChapter(chapterInputText, updatedGlossary, 150) : [];
              const data = await analyzeGlossaryDirect({
                text: chapterInputText,
                apiKeys,
                model: selectedModel,
                startKeyIndex: currentApiKeyIndexRef.current,
                sourceChapterId: chap.id,
                signal: abortControllerRef.current?.signal,
                knownChineseTerms,
                loopIndex: loop,
                totalLoops: extractionLoops,
              });

              if (data.truncated && isMountedRef.current) {
                showToast({
                  message: `Lưu ý: Chỉ ${data.analyzedLength!.toLocaleString()} / ${data.originalLength!.toLocaleString()} ký tự đầu tiên của Chương ${i + 1} được phân tích để tối ưu hiệu suất.`,
                  type: 'warning'
                });
              }
              if (typeof data.successKeyIndex === 'number') {
                currentApiKeyIndexRef.current =
                  cleanKeys.length > 1 ? (data.successKeyIndex + 1) % cleanKeys.length : data.successKeyIndex;
              }

              const suggestions = data.suggestions || [];
              if (suggestions.length > 0) {
                const newlyDiscovered: GlossaryItem[] = [];
                const pendingDiscovered: PendingGlossaryItem[] = [];

                suggestions.forEach((ent: any) => {
                  const chineseTrimmed = ent.chinese?.trim() || "";
                  if (!chineseTrimmed) return;
                  if (isNoisyGlossaryTerm(chineseTrimmed, ent.type)) return;

                  const exists = updatedGlossary.some((gItem) => isHanEquivalent(gItem.chinese, chineseTrimmed));
                  const originParagraph = chap.sourceText.split('\n').find(p =>
                      p.includes(chineseTrimmed) || p.replace(/\s+/g, '').includes(chineseTrimmed.replace(/\s+/g, ''))
                  )?.trim() || "";
                  if (!exists) {
                    const entryType = ent.type || "other";
                    const trimmedNote = (ent.note || "").trim();
                    const inferredGender =
                      entryType === 'character'
                        ? inferCharacterGenderFromContext({
                            chinese: chineseTrimmed,
                            note: trimmedNote,
                            sourceParagraph: originParagraph,
                          })
                        : undefined;
                    const itemPayload: GlossaryItem = {
                      id: 'glo_auto_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                      chinese: chineseTrimmed,
                      pinyin: (ent.pinyin || "").trim(),
                      vietnamese: (ent.vietnamese || "").trim(),
                      type: entryType,
                      note: trimmedNote,
                      ...(inferredGender ? { characterProfile: { gender: inferredGender } } : {}),
                      sourceChapter: chap.title,
                      sourceParagraph: originParagraph,
                      sourceChapterId: chap.id,
                      origin: 'scanned',
                      createdAt: new Date().toISOString(),
                      needsReview: ent.needsReview
                    };

                    if (ent.needsReview) {
                      const pendingPayload: PendingGlossaryItem = {
                        id: 'pend_auto_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                        chinese: chineseTrimmed,
                        pinyin: (ent.pinyin || "").trim(),
                        vietnamese: (ent.vietnamese || "").trim(),
                        type: ent.type || "other",
                        note: (ent.note || "").trim(),
                        reason: 'AI trích xuất nghi ngờ hallucinate',
                        originalValue: 'Không tìm thấy cụm từ này trong văn bản gốc của chương.',
                        importedAt: new Date().toISOString(),
                        needsReview: true,
                        sourceChapterId: chap.id
                      };
                      pendingDiscovered.push(pendingPayload);
                      addLog(`[Hallucinate] Phát hiện từ nghi ngờ AI nhận diện sai "${chineseTrimmed}" - Đã chuyển vào hàng chờ kiểm duyệt.`, 'warn');
                    } else {
                      newlyDiscovered.push(itemPayload);
                      updatedGlossary.push(itemPayload);
                    }
                  }
                });

                if (newlyDiscovered.length > 0 || pendingDiscovered.length > 0) {
                  if (newlyDiscovered.length > 0) {
                    addLog(`Phát hiện ${newlyDiscovered.length} thuật ngữ mới tại chương "${chap.title}"`, 'success');
                    setAutoDiscoveredBatch((prev) => [...prev, ...newlyDiscovered]);
                    if (isMountedRef.current) {
                      setScanFoundCount((prev) => prev + newlyDiscovered.length);
                    }
                  }
                  if (pendingDiscovered.length > 0) {
                    projectRef.current.pendingGlossary = [...(projectRef.current.pendingGlossary || []), ...pendingDiscovered];
                  }
                }
              }

              activeFailedIds = activeFailedIds.filter(id => id !== chap.id);
              const existingNewFailIdx = newlyFailedIds.indexOf(chap.id);
              if (existingNewFailIdx !== -1) {
                newlyFailedIds.splice(existingNewFailIdx, 1);
              }
              chapterAttemptDone = true;
            } catch (chapErr: any) {
              if (chapErr?.name === 'AbortError' || (chapErr instanceof DOMException && chapErr.name === 'AbortError')) {
                isStopScanRequestedRef.current = true;
                break;
              }

              const retryAfterMs = resolveRecoverableRetryAfterMs(chapErr, cleanKeys);
              if (
                retryAfterMs !== undefined &&
                retryAfterMs <= RATE_LIMIT_RECOVERY_CONFIG.MAX_AUTO_WAIT_COOLDOWN_MS &&
                chapterCooldownWaits < RATE_LIMIT_RECOVERY_CONFIG.MAX_COOLDOWN_WAITS_PER_CHAPTER
              ) {
                chapterCooldownWaits++;
                const waitMs = retryAfterMs + 50;
                addLog(
                  `[Chờ RPM] Tạm chờ hồi phục hạn mức RPM (~${Math.ceil(waitMs / 1000)}s, lần ${chapterCooldownWaits}/${RATE_LIMIT_RECOVERY_CONFIG.MAX_COOLDOWN_WAITS_PER_CHAPTER}) trước khi tiếp tục quét chương [${chap.title}]...`,
                  'warn'
                );
                try {
                  await waitForCooldownWithAbort(waitMs, abortControllerRef.current?.signal);
                  continue;
                } catch (waitErr: any) {
                  if (waitErr?.name === 'AbortError') {
                    isStopScanRequestedRef.current = true;
                    break;
                  }
                }
              }

              if (isAllKeysExhaustedError(chapErr)) {
                stoppedDueToQuota = true;
                for (const rem of scopedChaps.slice(i)) {
                  if (!newlyFailedIds.includes(rem.id)) newlyFailedIds.push(rem.id);
                }
                addLog(
                  `Dừng quét thuật ngữ tại chương [${chap.title}] (${i + 1}/${scopedChaps.length}) do toàn bộ API Key đã hết hạn mức quota.`,
                  'error'
                );
                break;
              }

              if (!newlyFailedIds.includes(chap.id)) {
                newlyFailedIds.push(chap.id);
              }
              addLog(`Bỏ qua lỗi tại chương [${chap.title}]: ${chapErr.message}`, 'error');
              chapterAttemptDone = true;
            }
          }

          if (isStopScanRequestedRef.current || stoppedDueToQuota) {
            break;
          }

          chaptersProcessedSinceLastUpdate++;
          if (chaptersProcessedSinceLastUpdate >= 10) {
            const mergedFailed = Array.from(new Set([...activeFailedIds, ...newlyFailedIds]));
            onUpdateProject({
              ...projectRef.current,
              glossary: updatedGlossary,
              glossaryScanQueueState: { failedIds: mergedFailed }
            });
            chaptersProcessedSinceLastUpdate = 0;
          }
        }
      }

      const mergedFailed = Array.from(new Set([...activeFailedIds, ...newlyFailedIds]));
      onUpdateProject({
        ...projectRef.current,
        glossary: updatedGlossary,
        glossaryScanQueueState: { failedIds: mergedFailed }
      });

      if (stoppedDueToQuota) {
        addLog(`=== TIẾN TRÌNH QUÉT LỌC TẠM DỪNG DO HẾT HẠN MỨC QUOTA (ĐÃ LƯU ${mergedFailed.length} CHƯƠNG CHƯA QUÉT ĐỂ QUÉT BÙ) ===`, 'error');
      } else if (isStopScanRequestedRef.current) {
        addLog("=== TIẾN TRÌNH QUÉT LỌC TỰ ĐỘNG ĐÃ DỪNG THEO YÊU CẦU ===", 'warn');
      } else {
        addLog("=== ĐÃ HOÀN TẤT TOÀN BỘ QUY TRÌNH QUÉT LỌC TỰ ĐỘNG THÀNH CÔNG ===", 'success');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError' && !(err instanceof DOMException && err.name === 'AbortError')) {
        addLog(`Lỗi hệ thống rà soát từ vựng sỉ: ${err.message}`, 'error');
      }
    } finally {
      if (isMountedRef.current) {
        setIsScanningGlossary(false);
        isStopScanRequestedRef.current = false;
      }
      abortControllerRef.current = null;
    }
  }, [isScanningGlossary, scanRangeEnabled, scanRangeStart, scanRangeEnd, extractionLoops, apiKeys, selectedModel, currentApiKeyIndexRef, onUpdateProject, addLog, setAutoDiscoveredBatch]);

  const handleRetryFailedGlossaryChapters = useCallback(() => {
    const failedIds = projectRef.current.glossaryScanQueueState?.failedIds || [];
    if (failedIds.length === 0) return;
    const chaps = projectRef.current.chapters || [];
    const failedChaps = chaps.filter(c => failedIds.includes(c.id));
    if (failedChaps.length === 0) {
      addLog("Không tìm thấy chương lỗi nào trong dự án.", "warn");
      return;
    }
    addLog(`Chuẩn bị quét lại ${failedChaps.length} chương lỗi...`, 'info');
    handleAutoExtractGlossary(failedChaps);
  }, [addLog, handleAutoExtractGlossary]);

  return {
    isScanningGlossary,
    scanningProgress,
    currentExtractionLoop,
    currentScanningChapterTitle,
    currentScanningChapterIndex,
    totalScanChapters,
    scanFoundCount,
    handleAutoExtractGlossary,
    handleRetryFailedGlossaryChapters,
  };
}
