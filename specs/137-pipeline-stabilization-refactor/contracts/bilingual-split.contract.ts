/**
 * Contract: Bilingual Split & Concurrency Control
 * Định nghĩa giao diện chia tách song ngữ đồng bộ ranh giới đoạn văn và điều phối lưu lượng
 */

export interface TranslationChunk {
  chunkIndex: number;
  totalChunks: number;
  sourceText: string;
  rawText: string;
  sourceParagraphRange: {
    start: number;
    end: number;
  };
  rawParagraphRange: {
    start: number;
    end: number;
  };
  estimatedTokens: number;
}

export interface BilingualSplitOptions {
  sourceText: string;
  rawText: string;
  targetParts?: number;
  maxTokensPerChunk?: number;
}

export interface ConcurrencyLimiterOptions {
  maxConcurrency: number;
}

export interface IBilingualSplitter {
  splitBilingualAdaptively(options: BilingualSplitOptions): TranslationChunk[];
  mapWithConcurrencyLimit<T, R>(
    items: T[],
    limit: number,
    worker: (item: T, index: number) => Promise<R>
  ): Promise<R[]>;
}
