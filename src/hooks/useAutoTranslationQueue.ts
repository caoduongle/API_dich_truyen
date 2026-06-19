import { useState, useCallback, useRef } from 'react';
import { StoryProject, GlossaryItem } from '../types';
import { useTranslationProcess } from './useTranslationProcess';
import { useGlossaryScan } from './useGlossaryScan';
import { useGlossaryApply } from './useGlossaryApply';
import { useExportFiles } from './useExportFiles';

export interface UseAutoTranslationQueueProps {
  activeProject: StoryProject;
  onUpdateProject: (updated: StoryProject) => void;
  apiKeys: string[];
  selectedModel: string;
  polishCycles: number;
  autoTranslateMode: 'resume' | 'from_scratch';
  additionalInstructions: string;
  isExtractionDuringTranslationEnabled: boolean;
  
  // Scopes and ranges
  rangeEnabled: boolean;
  rangeStart: number;
  rangeEnd: number;

  applyGlossaryRangeEnabled: boolean;
  applyGlossaryRangeStart: number;
  applyGlossaryRangeEnd: number;

  scanRangeEnabled: boolean;
  scanRangeStart: number;
  scanRangeEnd: number;
  extractionLoops: number;

  // Export configs
  chaptersPerFile: number;
  exportScope: 'all' | 'translated';
  exportMode: 'web' | 'audio' | 'align_jsonl';
  
  // Retry options
  skipFailedChapters: boolean;
}

export interface LogEntry {
  timestamp: string;
  type: 'info' | 'warn' | 'success' | 'error' | 'gemini';
  message: string;
}

export function useAutoTranslationQueue(props: UseAutoTranslationQueueProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [autoDiscoveredBatch, setAutoDiscoveredBatch] = useState<GlossaryItem[]>([]);
  const currentApiKeyIndexRef = useRef<number>(0);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    const time = new Date().toLocaleTimeString('vi-VN');
    setLogs((prev) => [...prev, { timestamp: time, type, message }]);
  }, []);

  const translation = useTranslationProcess({
    ...props,
    currentApiKeyIndexRef,
    addLog,
    setAutoDiscoveredBatch,
    setLogs,
  });

  const glossaryScan = useGlossaryScan({
    ...props,
    currentApiKeyIndexRef,
    addLog,
    setAutoDiscoveredBatch,
  });

  const glossaryApply = useGlossaryApply({
    ...props,
    addLog,
  });

  const exportFiles = useExportFiles({
    ...props,
    addLog,
  });

  return {
    ...translation,
    ...glossaryScan,
    ...glossaryApply,
    ...exportFiles,
    logs,
    setLogs,
    autoDiscoveredBatch,
  };
}
