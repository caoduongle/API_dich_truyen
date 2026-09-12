/**
 * Contract: Export Files & Formatting
 * Feature: 112-simplify-txt-export
 */

export type ExportMode = 'web' | 'audio';

export interface ExportFileNameOptions {
  projectTitle: string;
  startIndex: number;
  endIndex: number;
  mode: ExportMode;
}

export interface ExportFilesHookReturn {
  isExportingTxt: boolean;
  handleExportTxt: () => Promise<void>;
}
