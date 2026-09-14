/**
 * Bilingual Adaptive Splitter
 * Chia tách song ngữ đồng bộ ranh giới đoạn văn giữa văn bản nguồn (Trung) và văn bản thô (Việt)
 * Bảo đảm 1:1 ngữ cảnh cho từng TranslationChunk
 */

import { TranslationChunk } from './types';
import { estimateTokenCount } from '../../lib/text';

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
  sourceText: string,
  rawText: string,
  targetParts: number = 2
): TranslationChunk[] {
  const cleanSource = (sourceText || '').trim();
  const cleanRaw = (rawText || '').trim();

  if (!cleanSource || !cleanRaw || targetParts <= 1) {
    return [
      {
        chunkIndex: 0,
        totalChunks: 1,
        sourceText: cleanSource,
        rawText: cleanRaw,
        sourceParagraphRange: { start: 0, end: 1 },
        rawParagraphRange: { start: 0, end: 1 },
        estimatedTokens: estimateTokenCount(cleanSource),
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
        estimatedTokens: estimateTokenCount(cleanSource),
      },
    ];
  }

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
        estimatedTokens: estimateTokenCount(cleanSource),
      },
    ];
  }

  const chunks: TranslationChunk[] = [];
  for (let i = 0; i < parts; i++) {
    const srcStart = Math.round((i * sourceParas.length) / parts);
    const srcEnd = i === parts - 1 ? sourceParas.length : Math.round(((i + 1) * sourceParas.length) / parts);

    const rawStart = Math.round((i * rawParas.length) / parts);
    const rawEnd = i === parts - 1 ? rawParas.length : Math.round(((i + 1) * rawParas.length) / parts);

    const srcChunkText = sourceParas.slice(srcStart, srcEnd).join('\n\n').trim();
    const rawChunkText = rawParas.slice(rawStart, rawEnd).join('\n\n').trim();

    chunks.push({
      chunkIndex: i,
      totalChunks: parts,
      sourceText: srcChunkText,
      rawText: rawChunkText,
      sourceParagraphRange: { start: srcStart, end: srcEnd },
      rawParagraphRange: { start: rawStart, end: rawEnd },
      estimatedTokens: estimateTokenCount(srcChunkText),
    });
  }

  return chunks;
}
