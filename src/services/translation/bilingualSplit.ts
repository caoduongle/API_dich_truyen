/**
 * Bilingual Adaptive Splitter
 * Chia tách song ngữ đồng bộ ranh giới đoạn văn giữa văn bản nguồn (Trung) và văn bản thô (Việt)
 * Bảo đảm 1:1 ngữ cảnh cho từng TranslationChunk
 */

import { TranslationChunk, BilingualSplitOptions } from './types';
import { estimateTokenCount } from '../../lib/text';

export type { BilingualSplitOptions };

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

  // If maxTokensPerChunk is set, compute targetParts to satisfy token limits
  const estSourceTokens = estimateTokenCount(cleanSource);
  if (maxTokensPerChunk && maxTokensPerChunk > 0 && estSourceTokens > maxTokensPerChunk) {
    targetParts = Math.max(targetParts, Math.ceil(estSourceTokens / maxTokensPerChunk));
  }

  if (!cleanSource || !cleanRaw || targetParts <= 1) {
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

  // Số lượng phần bị giới hạn bởi số đoạn văn khả dụng của cả hai bên để tránh khối rỗng
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
