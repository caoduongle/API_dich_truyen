/**
 * EPUB Export Contract
 * Defines structure and expectations for EPUB package generation and batch chapter loading.
 */

import type { StoryProject, Chapter } from '../../../src/types';

export interface EpubPackageManifestEntry {
  id: string;
  href: string;
  mediaType: string;
}

export interface ParsedEpubPackage {
  mimetype: string;
  containerXml: string;
  contentOpf: string;
  navXhtml: string;
  tocNcx: string;
  styleCss: string;
  chapters: Map<string, string>;
}

export interface EpubExportService {
  /**
   * Generates and triggers download of an EPUB 3 document from a project and its chapters.
   */
  handleExportEpub(project: StoryProject): Promise<void>;

  /**
   * Fetches full chapter entities from database using bounded concurrency.
   * Concurrency is constrained (e.g. 5-10) to prevent IndexedDB connection exhaustion.
   */
  loadChaptersBatch(chapterIds: string[], concurrencyLimit?: number): Promise<Chapter[]>;
}
