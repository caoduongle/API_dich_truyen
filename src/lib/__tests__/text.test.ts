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
  parseGeminiStructuredResponse,
  getGenreStyleGuide,
  getPolishStrategyForRound,
  calculateTextSimilarity,
  isTextConverged,
  countParagraphs,
  validatePolishIntegrity,
  validateParagraphParity,
  escapeHtml,
  isRawTranslationResponse,
  isPolishTranslationResponse,
  isQaCritiqueResponse,
  isSentenceRewriteResponse,
} from '../text';
import {
  buildRawTranslationPayload,
  buildPolishTranslationPayload,
  buildQaCritiquePayload,
} from '../../services/ai/prompts';

describe('shared/text.ts utilities', () => {
  it('sanitizes zero-width and invisible prompt injection characters', () => {
    const dirty = 'Hello\u200BWorld\uFEFFTest\u200E';
    expect(sanitizePromptInput(dirty)).toBe('HelloWorldTest');
  });

  it('escapes 5 special HTML/XML characters in deterministic order (&, <, >, ", \')', () => {
    expect(escapeHtml('Tom & Jerry <cartoon> "funny" \'quote\'')).toBe(
      'Tom &amp; Jerry &lt;cartoon&gt; &quot;funny&quot; &#39;quote&#39;'
    );
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
    expect(escapeHtml('')).toBe('');
    expect(escapeHtml(null as any)).toBe('');
    expect(escapeHtml(undefined as any)).toBe('');
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
    expect(systemInstruction).toContain('targetText');
    expect(systemInstruction).toContain('NGUYÊN VĂN');
    expect(prompt).toContain('--- VĂN BẢN TRUNG GỐC ---');
    expect(schema.properties).toHaveProperty('isValid');
    expect(schema.properties).toHaveProperty('issues');
    expect(schema.properties.issues.items.properties).toHaveProperty('targetText');
    expect(schema.properties.issues.items.properties.targetText.type).toBe('STRING');
    expect(schema.properties.issues.items.required).toContain('targetText');
  });
});

describe('Tiered Polish Strategy & Convergence Detection (Feature 111)', () => {
  it('returns distinct strategies and progressive temperatures for rounds 1 through 5', () => {
    const s1 = getPolishStrategyForRound(1, 3);
    const s2 = getPolishStrategyForRound(2, 3);
    const s3 = getPolishStrategyForRound(3, 3);
    const s4 = getPolishStrategyForRound(4, 5);
    const s5 = getPolishStrategyForRound(5, 5);

    expect(s1.round).toBe(1);
    expect(s1.inputLabel).toBe('[BẢN DỊCH THÔ GIAI ĐOẠN 1]');
    expect(s1.temperature).toBe(0.4);
    expect(s1.directive).toContain('LƯỢT 1/3');

    expect(s2.round).toBe(2);
    expect(s2.inputLabel).toBe('[BẢN DỊCH ĐÃ BIÊN TẬP LƯỢT 1]');
    expect(s2.temperature).toBe(0.5);
    expect(s2.directive).toContain('LƯỢT 2/3');

    expect(s3.round).toBe(3);
    expect(s3.inputLabel).toBe('[BẢN DỊCH ĐÃ BIÊN TẬP LƯỢT 2]');
    expect(s3.temperature).toBe(0.55);

    expect(s4.temperature).toBe(0.6);
    expect(s5.temperature).toBe(0.65);
    expect(s5.inputLabel).toBe('[BẢN DỊCH ĐÃ BIÊN TẬP LƯỢT 4]');
  });

  it('handles out-of-bounds round indices gracefully', () => {
    const s0 = getPolishStrategyForRound(0, 1);
    expect(s0.round).toBe(1);

    const s9 = getPolishStrategyForRound(9, 9);
    expect(s9.round).toBe(9);
    expect(s9.temperature).toBe(0.65);
    expect(s9.inputLabel).toBe('[BẢN DỊCH ĐÃ BIÊN TẬP LƯỢT 8]');
  });

  describe('calculateTextSimilarity & isTextConverged', () => {
    it('returns 1.0 similarity for identical texts', () => {
      const text = 'Sở Phong nhìn ngọn núi trước mắt, lòng đầy cảm xúc.';
      const res = calculateTextSimilarity(text, text);
      expect(res.similarity).toBe(1.0);
      expect(res.diffPercentage).toBe(0);
      expect(res.changedWordsCount).toBe(0);
      expect(res.isConverged).toBe(true);
      expect(isTextConverged(text, text)).toBe(true);
    });

    it('returns 1.0 for both empty texts', () => {
      const res = calculateTextSimilarity('', '   ');
      expect(res.similarity).toBe(1.0);
      expect(res.isConverged).toBe(true);
    });

    it('returns 0.0 when one text is empty', () => {
      const res = calculateTextSimilarity('Văn bản có nội dung', '');
      expect(res.similarity).toBe(0.0);
      expect(res.isConverged).toBe(false);
    });

    it('accurately detects convergence when similarity exceeds 0.96 threshold', () => {
      // 1 từ thay đổi trên câu dài
      const prev = 'Trời thu xanh ngắt mấy tầng cao, cần trúc lơ phơ gió hắt hiu, sóng biếc theo làn hơi gợn tí, lá vàng trước gió sẽ đưa vèo.';
      const next = 'Trời thu xanh ngắt mấy tầng cao, cần trúc lơ phơ gió hắt hiu, sóng biếc theo làn hơi gợn nhẹ, lá vàng trước gió sẽ đưa vèo.';
      const res = calculateTextSimilarity(prev, next, 0.90);
      expect(res.similarity).toBeGreaterThanOrEqual(0.90);
      expect(res.isConverged).toBe(true);
      expect(res.diffPercentage).toBeLessThan(10);
    });

    it('returns isConverged = false when text has significant changes', () => {
      const prev = 'Hắn bước vào sơn động tối tăm, cẩn thận từng bước một.';
      const next = 'Nàng nhẹ nhàng bay qua rặng liễu, tà áo trắng phất phơ trong gió sớm mai.';
      const res = calculateTextSimilarity(prev, next, 0.96);
      expect(res.similarity).toBeLessThan(0.3);
      expect(res.isConverged).toBe(false);
      expect(res.diffPercentage).toBeGreaterThan(70);
    });
  });
});

describe('Feature 125: Polish Truncation Prevention & Paragraph Parity', () => {
  describe('countParagraphs', () => {
    it('returns 0 for empty or whitespace text', () => {
      expect(countParagraphs('')).toBe(0);
      expect(countParagraphs('   \n\n  \t  ')).toBe(0);
    });

    it('accurately counts paragraphs separated by single or multiple newlines', () => {
      const text = 'Đoạn 1.\n\nĐoạn 2.\nĐoạn 3.\n\n\nĐoạn 4.';
      expect(countParagraphs(text)).toBe(4);
    });

    it('ignores leading and trailing blank lines', () => {
      const text = '\n\n\nĐoạn 1.\n\nĐoạn 2.\n\n\n';
      expect(countParagraphs(text)).toBe(2);
    });
  });

  describe('validatePolishIntegrity', () => {
    it('throws error when polished translation is empty', () => {
      expect(() => validatePolishIntegrity('Đoạn văn thô hợp lệ.', '')).toThrow(/kết quả trả về trống/);
      expect(() => validatePolishIntegrity('Đoạn văn thô hợp lệ.', '   ')).toThrow(/kết quả trả về trống/);
    });

    it('bypasses ratio checks on short raw texts (< 300 characters)', () => {
      const shortRaw = 'Chương 1: Tiêu Đề\n\nThông báo ngắn của tác giả về lịch ra chương mới.';
      const shortPolished = 'Chương 1: Tiêu Đề\n\nThông báo.';
      expect(() => validatePolishIntegrity(shortRaw, shortPolished, 300, 0.80)).not.toThrow();
    });

    it('throws POLISH_TRUNCATION_DETECTED when polished text length drops below 80% of raw length', () => {
      const p1 = 'Sở Phong đứng trên đỉnh núi cao lộng gió nhìn về phương xa, tâm trạng vô cùng trầm mặc trước phong cảnh tráng lệ của đất trời bao la vô tận nơi đây.';
      const p2 = 'Bên dưới chân núi, sóng biển cuồn cuộn vỗ bờ như sấm rền vang vọng khắp không gian, khiến cho lòng người không khỏi dâng lên cảm giác cô liêu.';
      const p3 = 'Hắn hít sâu một hơi linh khí thanh thuần, ánh mắt dần trở nên kiên định, bắt đầu vận chuyển huyền công trong cơ thể theo lộ tuyến đã định sẵn.';
      const rawText = `${p1}\n\n${p2}\n\n${p3}`;
      // Truncated polish: only keeps first paragraph (~33% length)
      const truncatedPolished = p1;

      expect(() => validatePolishIntegrity(rawText, truncatedPolished, 200, 0.80)).toThrow(/POLISH_TRUNCATION_DETECTED/);
    });

    it('throws POLISH_TRUNCATION_DETECTED when polished text drops below 75% of raw paragraphs', () => {
      const p = 'Đây là một đoạn văn bản tiếng Việt mẫu với độ dài tương đối để kiểm tra số lượng đoạn văn bản.';
      const rawText = Array(10).fill(p).join('\n\n'); // 10 paragraphs
      // Polished has normal length but AI collapsed 10 paragraphs into 4 paragraphs
      const collapsedPolished = Array(4).fill(p + ' ' + p + ' ' + p).join('\n\n');

      expect(() => validatePolishIntegrity(rawText, collapsedPolished, 200, 0.80)).toThrow(/POLISH_TRUNCATION_DETECTED/);
    });

    it('passes when polished text maintains healthy length and paragraph count', () => {
      const p = 'Sở Phong đứng trên đỉnh núi cao lộng gió nhìn về phương xa, tâm trạng vô cùng trầm mặc trước phong cảnh tráng lệ.';
      const rawText = Array(6).fill(p).join('\n\n');
      const polishedText = Array(6).fill(p + ' Rất mượt mà và bay bổng.').join('\n\n');

      expect(() => validatePolishIntegrity(rawText, polishedText, 200, 0.80)).not.toThrow();
    });
  });

  describe('validateParagraphParity', () => {
    it('does not throw when reference text has fewer than minParagraphs (e.g. < 5)', () => {
      const ref = 'Đoạn 1.\n\nĐoạn 2.\n\nĐoạn 3.';
      const target = 'Đoạn 1.\n\nĐoạn 2 gộp Đoạn 3.';
      expect(() => validateParagraphParity(ref, target, 0.20, 5)).not.toThrow();
    });

    it('throws PARAGRAPH_STRUCTURE_DIVERGENCE when paragraph divergence exceeds 20%', () => {
      const p = 'Đoạn văn tiêu chuẩn để đo lường cấu trúc phân đoạn.';
      const ref = Array(10).fill(p).join('\n\n'); // 10 paragraphs
      const target = Array(7).fill(p).join('\n\n'); // 7 paragraphs: 3/10 = 30% divergence > 20%

      expect(() => validateParagraphParity(ref, target, 0.20, 5)).toThrow(/PARAGRAPH_STRUCTURE_DIVERGENCE/);
    });

    it('passes when paragraph count is within 20% tolerance', () => {
      const p = 'Đoạn văn tiêu chuẩn để đo lường cấu trúc phân đoạn.';
      const ref = Array(10).fill(p).join('\n\n'); // 10 paragraphs
      const target = Array(9).fill(p).join('\n\n'); // 9 paragraphs: 1/10 = 10% <= 20%

      expect(() => validateParagraphParity(ref, target, 0.20, 5)).not.toThrow();
    });
  });

  describe('parseGeminiStructuredResponse', () => {
    it('parses valid JSON response directly', () => {
      const input = '{"chinese": "仙", "vietnamese": "Tiên"}';
      const result = parseGeminiStructuredResponse<{ chinese: string; vietnamese: string }>(input);
      expect(result).toEqual({ chinese: '仙', vietnamese: 'Tiên' });
    });

    it('parses markdown-fenced JSON response cleanly', () => {
      const input = '```json\n{"status": "ok", "items": [1, 2, 3]}\n```';
      const result = parseGeminiStructuredResponse<{ status: string; items: number[] }>(input);
      expect(result.status).toBe('ok');
      expect(result.items).toHaveLength(3);
    });

    it('returns fallback on malformed JSON when fallback is provided', () => {
      const malformed = 'Not valid JSON at all';
      const fallback = { status: 'fallback', items: [] };
      const result = parseGeminiStructuredResponse(malformed, { fallback });
      expect(result).toEqual(fallback);
    });

    it('throws descriptive error on malformed JSON when fallback is omitted', () => {
      const malformed = 'This is corrupted data {';
      expect(() =>
        parseGeminiStructuredResponse(malformed, { contextName: 'UnitTesting' })
      ).toThrow(/trong ngữ cảnh \[UnitTesting\]/);
    });

    it('validates schema using validator predicate and triggers fallback on failure', () => {
      const input = '{"age": "twenty"}';
      interface Person { age: number }
      const isPerson = (data: any): data is Person => typeof data?.age === 'number';

      const fallback: Person = { age: 0 };
      const result = parseGeminiStructuredResponse<Person>(input, {
        validator: isPerson,
        fallback,
      });
      expect(result).toEqual(fallback);
    });

    it('throws error when validator fails and no fallback is provided', () => {
      const input = '{"role": "guest"}';
      const isAdmin = (data: any): data is { role: 'admin' } => data?.role === 'admin';

      expect(() =>
        parseGeminiStructuredResponse(input, {
          validator: isAdmin,
          contextName: 'AdminCheck',
        })
      ).toThrow(/Dữ liệu JSON từ AI trong ngữ cảnh \[AdminCheck\] không thỏa mãn cấu trúc yêu cầu/);
    });
  });

  describe('translation structured response validators (T002 & T010)', () => {
    describe('isRawTranslationResponse', () => {
      it('validates compliant raw translation payloads', () => {
        expect(isRawTranslationResponse({ rawTranslation: 'Dịch', discoveredEntities: [] })).toBe(true);
        expect(isRawTranslationResponse({ translation: 'Dịch', vietnamese: 'Dịch' })).toBe(true);
        expect(isRawTranslationResponse({})).toBe(true);
      });

      it('rejects non-objects or null', () => {
        expect(isRawTranslationResponse(null)).toBe(false);
        expect(isRawTranslationResponse(undefined)).toBe(false);
        expect(isRawTranslationResponse('string')).toBe(false);
        expect(isRawTranslationResponse(123)).toBe(false);
      });

      it('rejects invalid field types for raw translation', () => {
        expect(isRawTranslationResponse({ rawTranslation: 12345 })).toBe(false);
        expect(isRawTranslationResponse({ translation: true })).toBe(false);
        expect(isRawTranslationResponse({ discoveredEntities: 'not-an-array' })).toBe(false);
      });
    });

    describe('isPolishTranslationResponse', () => {
      it('validates compliant polish translation payloads', () => {
        expect(isPolishTranslationResponse({ polishedTranslation: 'Chuốt', discoveredEntities: [] })).toBe(true);
        expect(isPolishTranslationResponse({ translation: 'Chuốt' })).toBe(true);
        expect(isPolishTranslationResponse({})).toBe(true);
      });

      it('rejects non-objects or invalid field types for polish translation', () => {
        expect(isPolishTranslationResponse(null)).toBe(false);
        expect(isPolishTranslationResponse({ polishedTranslation: false })).toBe(false);
        expect(isPolishTranslationResponse({ discoveredEntities: 42 })).toBe(false);
      });
    });

    describe('isQaCritiqueResponse', () => {
      it('validates compliant qa critique payloads', () => {
        expect(isQaCritiqueResponse({ isValid: true, issues: [] })).toBe(true);
        expect(isQaCritiqueResponse({ isValid: false, issues: [{ message: 'issue' }] })).toBe(true);
        expect(isQaCritiqueResponse({})).toBe(true);
      });

      it('rejects non-boolean isValid or non-array issues', () => {
        expect(isQaCritiqueResponse(null)).toBe(false);
        expect(isQaCritiqueResponse({ isValid: 'yes' })).toBe(false);
        expect(isQaCritiqueResponse({ issues: 'none' })).toBe(false);
      });
    });

    describe('isSentenceRewriteResponse', () => {
      it('validates compliant sentence rewrite payloads', () => {
        expect(isSentenceRewriteResponse({ rewrittenSentence: 'Câu chuốt mượt' })).toBe(true);
        expect(isSentenceRewriteResponse({ rewrittenSentence: 'Câu chuốt', extra: 123 })).toBe(true);
      });

      it('rejects missing or non-string rewrittenSentence', () => {
        expect(isSentenceRewriteResponse(null)).toBe(false);
        expect(isSentenceRewriteResponse({})).toBe(false);
        expect(isSentenceRewriteResponse({ rewrittenSentence: 123 })).toBe(false);
        expect(isSentenceRewriteResponse({ rewrittenSentence: null })).toBe(false);
      });
    });
  });
});

