import { describe, it, expect } from 'vitest';
import {
  sanitizePromptInput,
  countChineseCharacters,
  calculateChineseCharRatio,
  validateTranslationOutput,
  separateChapterTitleAndBody,
  ensureChapterTitlePreserved,
  estimateTokenCount,
  splitTextAdaptively,
  safeParseJson,
  getGenreStyleGuide,
} from '../text';
import {
  buildRawTranslationPayload,
  buildPolishTranslationPayload,
  buildQaCritiquePayload,
} from '../prompts';

describe('shared/text.ts utilities', () => {
  it('sanitizes zero-width and invisible prompt injection characters', () => {
    const dirty = 'Hello\u200BWorld\uFEFFTest\u200E';
    expect(sanitizePromptInput(dirty)).toBe('HelloWorldTest');
  });

  it('accurately counts Chinese characters and ratios', () => {
    const text = '这是测试 văn bản 123';
    expect(countChineseCharacters(text)).toBe(4);
    expect(calculateChineseCharRatio(text)).toBeGreaterThan(0.2);
  });

  it('validates translation output and throws on untranslated Chinese', () => {
    const rawChinese = '这是一个很长的测试文本，完全没有被翻译成越南语，内容全部都是中文句子，包含了大量的汉字。';
    expect(() => validateTranslationOutput(rawChinese, 20, 0.1)).toThrow(/UNTRANSLATED_CHINESE_LEFTOVER/);

    const translatedVietnamese = 'Đây là một đoạn văn bản tiếng Việt chuẩn mực đã được dịch thuật hoàn chỉnh.';
    expect(() => validateTranslationOutput(translatedVietnamese, 20, 0.1)).not.toThrow();
  });

  it('separates chapter title from body when stuck on same line', () => {
    const stuck = 'Chương 1: Khởi Đầu Mới. Mặt trời vừa mới ló dạng sau rặng núi.';
    const separated = separateChapterTitleAndBody(stuck);
    expect(separated).toContain('Chương 1: Khởi Đầu Mới');
    expect(separated).toContain('Mặt trời vừa mới ló dạng');
  });

  it('preserves chapter title between Phase 1 raw and Phase 2 polish', () => {
    const raw = 'Chương 10: Trận Chiến Cuối Cùng\n\nHắn giơ kiếm lên cao.';
    const polishedWithoutTitle = 'Hắn vung thanh kiếm sắc lẹm lên cao giữa bầu trời đêm.';
    const preserved = ensureChapterTitlePreserved(raw, polishedWithoutTitle);
    expect(preserved.startsWith('Chương 10: Trận Chiến Cuối Cùng')).toBe(true);
    expect(preserved).toContain('Hắn vung thanh kiếm');
  });

  it('estimates tokens accurately for Hanzi and Latin text', () => {
    const chineseText = '天地玄黄宇宙洪荒';
    const tokens = estimateTokenCount(chineseText);
    expect(tokens).toBeGreaterThan(8);
  });

  it('splits text adaptively without breaking paragraph blocks', () => {
    const p1 = 'Đoạn văn thứ nhất có nội dung tương đối dài để kiểm tra việc phân tách các đoạn văn bản trong hệ thống dịch thuật. Nội dung này cần đủ dài để vượt qua ngưỡng token tối thiểu của thuật toán phân đoạn thích ứng.';
    const p2 = 'Đoạn văn thứ hai tiếp tục bổ sung thông tin chi tiết về quá trình thử nghiệm đơn vị của module shared. Đoạn này cũng cần chứa đầy đủ các câu chữ tiếng Việt nhằm đảm bảo tổng số lượng token vượt mức 60 token.';
    const combined = `${p1}\n\n${p2}`;

    const chunks = splitTextAdaptively(combined, 2);
    expect(chunks.length).toBe(2);
    expect(chunks[0]).toBe(p1);
    expect(chunks[1]).toBe(p2);
  });

  it('safely parses JSON and handles markdown codeblocks', () => {
    const rawJson = '```json\n{"rawTranslation": "Bản dịch thử nghiệm", "discoveredEntities": []}\n```';
    const parsed = safeParseJson<{ rawTranslation: string }>(rawJson);
    expect(parsed).not.toBeNull();
    expect(parsed?.rawTranslation).toBe('Bản dịch thử nghiệm');
  });
});

describe('shared/prompts.ts generators', () => {
  it('builds raw translation payload with glossary substitution', () => {
    const { systemInstruction, prompt, schema } = buildRawTranslationPayload({
      text: '楚风看着眼前的山峰。',
      genre: 'Tiên Hiệp',
      tone: 'Trang nghiêm',
      glossary: [{ chinese: '楚风', vietnamese: 'Sở Phong', type: 'character' }],
    });

    expect(systemInstruction.toLowerCase()).toContain('dịch thô giai đoạn 1');
    expect(systemInstruction).toContain(getGenreStyleGuide('Tiên Hiệp'));
    expect(prompt).toContain('[Sở Phong]');
    expect(schema.required).toContain('rawTranslation');
    expect(schema.required).toContain('discoveredEntities');
  });

  it('builds polish translation payload with entity extraction toggle', () => {
    const { systemInstruction, prompt, schema } = buildPolishTranslationPayload({
      sourceText: '楚风看着眼前的山峰。',
      rawTranslation: 'Sở Phong nhìn ngọn núi trước mắt.',
      genre: 'Huyền Huyễn',
      tone: 'Hào hùng',
      isExtractionEnabled: true,
    });

    expect(systemInstruction).toContain('chuốt mịn văn phong (Translation Polishing Phase 2)');
    expect(prompt).toContain('BẢN DỊCH THÔ GIAI ĐOẠN 1');
    expect(schema.properties).toHaveProperty('polishedTranslation');
    expect(schema.properties).toHaveProperty('discoveredEntities');
  });

  it('builds QA critique payload accurately', () => {
    const { systemInstruction, prompt, schema } = buildQaCritiquePayload({
      sourceText: '原文',
      translatedText: 'Bản dịch',
    });

    expect(systemInstruction).toContain('chuyên gia kiểm định chất lượng (QA)');
    expect(prompt).toContain('--- VĂN BẢN TRUNG GỐC ---');
    expect(schema.properties).toHaveProperty('isValid');
    expect(schema.properties).toHaveProperty('issues');
  });
});
