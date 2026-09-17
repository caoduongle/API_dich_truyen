/**
 * Bilingual Adaptive Splitter
 * Chia tách song ngữ đồng bộ ranh giới đoạn văn giữa văn bản nguồn (Trung) và văn bản thô (Việt)
 * Bảo đảm 1:1 ngữ cảnh cho từng TranslationChunk.
 *
 * Cơ chế đóng gói (Greedy Accumulative Packing Heuristic):
 * `maxTokensPerChunk` đóng vai trò là một heuristic đóng gói lũy kế (soft target packing budget)
 * nhằm giữ kích cỡ các chunk ở quy mô hợp lý trong khi bảo toàn tuyệt đối ranh giới đoạn văn (paragraph integrity).
 * Thay vì cắt vụn văn bản giữa chừng câu hoặc đoạn văn, thuật toán gom lũy kế từng đoạn hoàn chỉnh
 * cho đến khi vượt ngưỡng `maxTokensPerChunk`. Nếu gặp một đoạn văn đơn lẻ dài hơn ngưỡng, đoạn văn đó
 * vẫn được giữ nguyên vẹn trong một chunk riêng để đảm bảo chất lượng ngữ nghĩa bản dịch.
 */

import { TranslationChunk, BilingualSplitOptions, IBilingualSplitter } from './types';
import { estimateTokenCount } from '../../lib/text';
import { mapWithConcurrencyLimit } from '../../lib/concurrency';

export type { BilingualSplitOptions, IBilingualSplitter };
export { mapWithConcurrencyLimit };

function extractParagraphs(text: string): string[] {
  if (!text) return [];
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Thử ngắt theo 2 dấu xuống dòng (\n\n)
  const doubleNewline = trimmed.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (doubleNewline.length > 1) {
    return doubleNewline;
  }

  // Fallback sang từng dòng đơn (\n)
  const singleNewline = trimmed.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (singleNewline.length > 1) {
    return singleNewline;
  }

  return [trimmed];
}

export function splitBilingualAdaptively(
  options: BilingualSplitOptions
): TranslationChunk[];
export function splitBilingualAdaptively(
  sourceText: string,
  rawText: string,
  targetParts?: number
): TranslationChunk[];
export function splitBilingualAdaptively(
  sourceOrOptions: string | BilingualSplitOptions,
  rawTextArg?: string,
  targetPartsArg: number = 2
): TranslationChunk[] {
  let sourceText = '';
  let rawText = '';
  let targetParts = 2;
  let maxTokensPerChunk: number | undefined;

  if (typeof sourceOrOptions === 'object' && sourceOrOptions !== null) {
    sourceText = sourceOrOptions.sourceText || '';
    rawText = sourceOrOptions.rawText || '';
    targetParts = typeof sourceOrOptions.targetParts === 'number' ? sourceOrOptions.targetParts : 2;
    maxTokensPerChunk = sourceOrOptions.maxTokensPerChunk;
  } else {
    sourceText = sourceOrOptions || '';
    rawText = rawTextArg || '';
    targetParts = typeof targetPartsArg === 'number' ? targetPartsArg : 2;
  }

  const cleanSource = (sourceText || '').trim();
  const cleanRaw = (rawText || '').trim();

  const estSourceTokens = estimateTokenCount(cleanSource);
  const estRawTokens = estimateTokenCount(cleanRaw);
  const maxTokens = Math.max(estSourceTokens, estRawTokens);

  if (!cleanSource || !cleanRaw) {
    return [
      {
        chunkIndex: 0,
        totalChunks: 1,
        sourceText: cleanSource,
        rawText: cleanRaw,
        sourceParagraphRange: { start: 0, end: 1 },
        rawParagraphRange: { start: 0, end: 1 },
        estimatedTokens: estSourceTokens,
      },
    ];
  }

  const sourceParas = extractParagraphs(cleanSource);
  const rawParas = extractParagraphs(cleanRaw);

  if (sourceParas.length <= 1 || rawParas.length <= 1) {
    return [
      {
        chunkIndex: 0,
        totalChunks: 1,
        sourceText: cleanSource,
        rawText: cleanRaw,
        sourceParagraphRange: { start: 0, end: sourceParas.length },
        rawParagraphRange: { start: 0, end: rawParas.length },
        estimatedTokens: estSourceTokens,
      },
    ];
  }

  // T017 & T018: Greedy Accumulative Packing theo trọng số token lũy kế
  if (maxTokensPerChunk && maxTokensPerChunk > 0 && maxTokens > maxTokensPerChunk) {
    const chunks: TranslationChunk[] = [];
    let currentSrcStart = 0;
    let currentRawStart = 0;
    let currentTokens = 0;

    for (let i = 0; i < sourceParas.length; i++) {
      const srcSlice = sourceParas[i];
      const nextRawEnd = (i === sourceParas.length - 1) 
        ? rawParas.length 
        : Math.round(((i + 1) * rawParas.length) / sourceParas.length);
      
      const rawSliceEnd = Math.max(currentRawStart, Math.min(nextRawEnd, rawParas.length));
      const rawSlice = rawParas.slice(currentRawStart, rawSliceEnd).join('\n\n');
      
      const estSrc = estimateTokenCount(srcSlice);
      const estRaw = estimateTokenCount(rawSlice);
      const paraTokens = Math.max(estSrc, estRaw);

      if (currentTokens + paraTokens > maxTokensPerChunk && currentSrcStart < i) {
        // Cắt chunk trước đoạn văn `i`
        const chunkSrcEnd = i;
        const chunkRawEnd = currentRawStart;

        const chunkSrcText = sourceParas.slice(currentSrcStart, chunkSrcEnd).join('\n\n');
        const lastRawEnd = chunks.length === 0 ? 0 : chunks[chunks.length - 1].rawParagraphRange.end;
        const chunkRawText = rawParas.slice(lastRawEnd, chunkRawEnd).join('\n\n');

        chunks.push({
          chunkIndex: chunks.length,
          totalChunks: 0,
          sourceText: chunkSrcText,
          rawText: chunkRawText,
          sourceParagraphRange: { start: currentSrcStart, end: chunkSrcEnd },
          rawParagraphRange: { start: lastRawEnd, end: chunkRawEnd },
          estimatedTokens: currentTokens,
        });

        currentSrcStart = i;
        currentTokens = paraTokens;
      } else {
        currentTokens += paraTokens;
      }
      currentRawStart = rawSliceEnd;
    }

    // Đẩy chunk cuối cùng còn lại
    if (currentSrcStart < sourceParas.length) {
      const chunkSrcText = sourceParas.slice(currentSrcStart, sourceParas.length).join('\n\n');
      const lastRawEnd = chunks.length === 0 ? 0 : chunks[chunks.length - 1].rawParagraphRange.end;
      const chunkRawText = rawParas.slice(lastRawEnd, rawParas.length).join('\n\n');
      
      chunks.push({
        chunkIndex: chunks.length,
        totalChunks: 0,
        sourceText: chunkSrcText,
        rawText: chunkRawText,
        sourceParagraphRange: { start: currentSrcStart, end: sourceParas.length },
        rawParagraphRange: { start: lastRawEnd, end: rawParas.length },
        estimatedTokens: currentTokens,
      });
    }

    chunks.forEach(c => c.totalChunks = chunks.length);
    return chunks;
  }

  // Fallback: Chia đều theo số phần cố định
  const parts = Math.max(1, Math.min(targetParts, sourceParas.length, rawParas.length));
  if (parts <= 1) {
    return [
      {
        chunkIndex: 0,
        totalChunks: 1,
        sourceText: cleanSource,
        rawText: cleanRaw,
        sourceParagraphRange: { start: 0, end: sourceParas.length },
        rawParagraphRange: { start: 0, end: rawParas.length },
        estimatedTokens: estSourceTokens,
      },
    ];
  }

  const chunks: TranslationChunk[] = [];
  for (let i = 0; i < parts; i++) {
    const srcStart = Math.round((i * sourceParas.length) / parts);
    const srcEnd = i === parts - 1 ? sourceParas.length : Math.round(((i + 1) * sourceParas.length) / parts);

    const rawStart = Math.round((i * rawParas.length) / parts);
    const rawEnd = i === parts - 1 ? rawParas.length : Math.round(((i + 1) * rawParas.length) / parts);

    // Safeguard đảm bảo mỗi khối có ít nhất 1 đoạn văn khi có thể
    const actualSrcEnd = Math.max(srcStart + 1, srcEnd);
    const actualRawEnd = Math.max(rawStart + 1, rawEnd);

    const srcChunkText = sourceParas.slice(srcStart, Math.min(sourceParas.length, actualSrcEnd)).join('\n\n').trim();
    const rawChunkText = rawParas.slice(rawStart, Math.min(rawParas.length, actualRawEnd)).join('\n\n').trim();

    chunks.push({
      chunkIndex: i,
      totalChunks: parts,
      sourceText: srcChunkText,
      rawText: rawChunkText,
      sourceParagraphRange: { start: srcStart, end: Math.min(sourceParas.length, actualSrcEnd) },
      rawParagraphRange: { start: rawStart, end: Math.min(rawParas.length, actualRawEnd) },
      estimatedTokens: estimateTokenCount(srcChunkText),
    });
  }

  return chunks;
}

/**
 * Implementation mẫu tuân thủ hợp đồng IBilingualSplitter
 */
export const bilingualSplitter: IBilingualSplitter = {
  splitBilingualAdaptively,
  mapWithConcurrencyLimit,
};
