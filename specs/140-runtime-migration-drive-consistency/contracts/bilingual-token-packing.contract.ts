/**
 * Contract: Token-Budget Aware Bilingual Splitter Interface
 * Feature: 140-runtime-migration-drive-consistency
 */

import { TranslationChunk, BilingualSplitOptions } from '../../../src/services/translation/types';

export interface IBilingualTokenPackingSplitter {
  /**
   * Phân đoạn thích ứng dựa trên đối tượng tùy chọn (hỗ trợ maxTokensPerChunk và greedy accumulative packing)
   */
  splitBilingualAdaptively(options: BilingualSplitOptions): TranslationChunk[];

  /**
   * Phân đoạn thích ứng tương thích ngược theo tham số vị trí
   */
  splitBilingualAdaptively(sourceText: string, rawText: string, targetParts?: number): TranslationChunk[];

  /**
   * Giới hạn mức xử lý đồng thời cho tác vụ bất đồng bộ
   */
  mapWithConcurrencyLimit<T, R>(
    items: T[],
    limit: number,
    worker: (item: T, index: number) => Promise<R>
  ): Promise<R[]>;
}
