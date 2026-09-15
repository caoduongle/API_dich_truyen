/**
 * Contract: Unified Bilingual Splitter
 * Giao diện chuẩn hóa cho bộ phân đoạn song ngữ hỗ trợ cả dạng tham số vị trí và đối tượng cấu hình
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

export interface IBilingualSplitter {
  splitBilingualAdaptively(options: BilingualSplitOptions): TranslationChunk[];
  splitBilingualAdaptively(sourceText: string, rawText: string, targetParts?: number): TranslationChunk[];
}
