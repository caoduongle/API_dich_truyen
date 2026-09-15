import { describe, it, expect } from 'vitest';
import { splitBilingualAdaptively, bilingualSplitter } from '../bilingualSplit';

describe('splitBilingualAdaptively', () => {
  it('splits with exact 1:1 paragraph parity when paragraph counts match', () => {
    const sourceParas = [
      '第一段：萧炎看着天上的云彩。',
      '第二段：药老的声音在心底响起。',
      '第三段：少年握紧了拳头。',
      '第四段：三年之约即将到来。',
    ];
    const rawParas = [
      'Đoạn 1: Tiêu Viêm nhìn mây trên trời.',
      'Đoạn 2: Tiếng Dược Lão vang lên trong đáy lòng.',
      'Đoạn 3: Thiếu niên nắm chặt nắm đấm.',
      'Đoạn 4: Ước hẹn ba năm sắp đến gần.',
    ];

    const sourceText = sourceParas.join('\n\n');
    const rawText = rawParas.join('\n\n');

    const chunks = splitBilingualAdaptively(sourceText, rawText, 2);

    expect(chunks).toHaveLength(2);

    // Chunk 0 covers paragraphs 0..2
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[0].totalChunks).toBe(2);
    expect(chunks[0].sourceParagraphRange).toEqual({ start: 0, end: 2 });
    expect(chunks[0].rawParagraphRange).toEqual({ start: 0, end: 2 });
    expect(chunks[0].sourceText).toBe(`${sourceParas[0]}\n\n${sourceParas[1]}`);
    expect(chunks[0].rawText).toBe(`${rawParas[0]}\n\n${rawParas[1]}`);

    // Chunk 1 covers paragraphs 2..4
    expect(chunks[1].chunkIndex).toBe(1);
    expect(chunks[1].sourceParagraphRange).toEqual({ start: 2, end: 4 });
    expect(chunks[1].rawParagraphRange).toEqual({ start: 2, end: 4 });
    expect(chunks[1].sourceText).toBe(`${sourceParas[2]}\n\n${sourceParas[3]}`);
    expect(chunks[1].rawText).toBe(`${rawParas[2]}\n\n${rawParas[3]}`);
  });

  it('maps paragraphs proportionally when counts do not match', () => {
    const sourceParas = ['Đoạn TQ 1', 'Đoạn TQ 2', 'Đoạn TQ 3', 'Đoạn TQ 4', 'Đoạn TQ 5', 'Đoạn TQ 6'];
    const rawParas = ['Đoạn VN 1', 'Đoạn VN 2', 'Đoạn VN 3', 'Đoạn VN 4'];

    const chunks = splitBilingualAdaptively(sourceParas.join('\n\n'), rawParas.join('\n\n'), 2);

    expect(chunks).toHaveLength(2);
    expect(chunks[0].sourceParagraphRange.end).toBe(3);
    expect(chunks[0].rawParagraphRange.end).toBe(2);
    expect(chunks[1].sourceParagraphRange.end).toBe(6);
    expect(chunks[1].rawParagraphRange.end).toBe(4);
  });

  it('returns single chunk for single-paragraph or short text', () => {
    const chunks = splitBilingualAdaptively('Một đoạn duy nhất.', 'One single paragraph.', 2);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].sourceText).toBe('Một đoạn duy nhất.');
    expect(chunks[0].rawText).toBe('One single paragraph.');
  });

  it('handles empty strings safely', () => {
    const chunks = splitBilingualAdaptively('', '', 2);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].sourceText).toBe('');
    expect(chunks[0].rawText).toBe('');
  });

  it('supports object options parameter signature matching positional signature', () => {
    const sourceText = '段落一\n\n段落二\n\n段落三\n\n段落四';
    const rawText = 'Đoạn 1\n\nĐoạn 2\n\nĐoạn 3\n\nĐoạn 4';

    const byPos = splitBilingualAdaptively(sourceText, rawText, 2);
    const byOptions = splitBilingualAdaptively({
      sourceText,
      rawText,
      targetParts: 2,
    });

    expect(byOptions).toEqual(byPos);
    expect(byOptions).toHaveLength(2);
    expect(byOptions[0].chunkIndex).toBe(0);
    expect(byOptions[1].chunkIndex).toBe(1);
  });

  it('safeguards against empty chunks when paragraph counts differ significantly (10 CN vs 4 VN)', () => {
    const sourceParas = Array.from({ length: 10 }, (_, i) => `中文段落 ${i + 1}`);
    const rawParas = Array.from({ length: 4 }, (_, i) => `Đoạn tiếng Việt ${i + 1}`);

    const chunks = splitBilingualAdaptively({
      sourceText: sourceParas.join('\n\n'),
      rawText: rawParas.join('\n\n'),
      targetParts: 6, // Requested 6 parts, but Vietnamese only has 4 paragraphs
    });

    // Should clamp to 4 parts maximum to avoid producing empty chunks
    expect(chunks.length).toBeLessThanOrEqual(4);
    expect(chunks.length).toBeGreaterThanOrEqual(2);

    for (const chunk of chunks) {
      expect(chunk.sourceText.trim().length).toBeGreaterThan(0);
      expect(chunk.rawText.trim().length).toBeGreaterThan(0);
      expect(chunk.sourceParagraphRange.end).toBeGreaterThan(chunk.sourceParagraphRange.start);
      expect(chunk.rawParagraphRange.end).toBeGreaterThan(chunk.rawParagraphRange.start);
    }
  });

  describe('maxTokensPerChunk runtime support (User Story 5)', () => {
    it('automatically increases chunk count to satisfy maxTokensPerChunk', () => {
      // 8 paragraphs of moderate size
      const sourceParas = Array.from(
        { length: 8 },
        (_, i) => `段落 ${i + 1}: 这是关于斗气大陆的一段非常详细的战斗描写，天地之间的能量在此刻剧烈震荡。`
      );
      const rawParas = Array.from(
        { length: 8 },
        (_, i) => `Đoạn ${i + 1}: Đây là một đoạn miêu tả chiến đấu vô cùng chi tiết về Đấu Khí đại lục, năng lượng giữa đất trời lúc này chấn động dữ dội.`
      );

      const sourceText = sourceParas.join('\n\n');
      const rawText = rawParas.join('\n\n');

      // Without maxTokensPerChunk, default targetParts is 2
      const defaultChunks = splitBilingualAdaptively({
        sourceText,
        rawText,
        targetParts: 2,
      });
      expect(defaultChunks).toHaveLength(2);

      // With maxTokensPerChunk set to a small limit (e.g. 50 tokens), targetParts should scale up
      const tokenLimitedChunks = splitBilingualAdaptively({
        sourceText,
        rawText,
        targetParts: 2,
        maxTokensPerChunk: 50,
      });

      // Target parts should increase beyond 2 to satisfy smaller token chunks
      expect(tokenLimitedChunks.length).toBeGreaterThan(2);
      expect(tokenLimitedChunks.length).toBeLessThanOrEqual(8);

      // Every chunk must contain intact paragraphs
      for (const chunk of tokenLimitedChunks) {
        expect(chunk.sourceText.length).toBeGreaterThan(0);
        expect(chunk.rawText.length).toBeGreaterThan(0);
      }
    });

    it('safeguards paragraph boundaries when maxTokensPerChunk is smaller than a single paragraph', () => {
      const longSourcePara = '这是一段极长的段落，包含大量的汉字描述，字符数非常多，即使设置极低的token限制也不能将它在段落中间截断。';
      const longRawPara = 'Đây là một đoạn văn cực kỳ dài chứa rất nhiều câu chữ mô tả, dù đặt giới hạn token cực thấp cũng không được cắt ngang giữa chừng.';

      const chunks = splitBilingualAdaptively({
        sourceText: `${longSourcePara}\n\n${longSourcePara}`,
        rawText: `${longRawPara}\n\n${longRawPara}`,
        maxTokensPerChunk: 5, // Ridiculously low token limit
      });

      // Exactly 2 paragraphs -> at most 2 chunks, never broken mid-paragraph
      expect(chunks).toHaveLength(2);
      expect(chunks[0].sourceText).toBe(longSourcePara);
      expect(chunks[1].sourceText).toBe(longSourcePara);
    });
  });

  describe('bilingualSplitter implementation and contract', () => {
    it('satisfies the IBilingualSplitter contract and exposes working split and concurrency methods', async () => {
      expect(typeof bilingualSplitter.splitBilingualAdaptively).toBe('function');
      expect(typeof bilingualSplitter.mapWithConcurrencyLimit).toBe('function');

      // Test splitBilingualAdaptively via instance
      const chunks = bilingualSplitter.splitBilingualAdaptively('段落1\n\n段落2', 'Đoạn 1\n\nĐoạn 2', 2);
      expect(chunks).toHaveLength(2);

      // Test mapWithConcurrencyLimit via instance
      const results = await bilingualSplitter.mapWithConcurrencyLimit([1, 2, 3], 2, async (item) => item * 10);
      expect(results).toEqual([10, 20, 30]);
    });
  });
});
