import { describe, it, expect } from 'vitest';
import {
  buildRawTranslationPayload,
  buildPolishTranslationPayload,
  buildQaCritiquePayload,
} from '../prompts';

describe('AI Prompts Construction Pipeline', () => {
  const sampleGlossary = [
    {
      chinese: '罗峰',
      vietnamese: 'La Phong',
      pinyin: 'La Phong',
      type: 'character',
      note: 'Nhân vật chính, thiếu niên kiên nghị',
    },
    {
      chinese: '九重雷刀',
      vietnamese: 'Cửu Trọng Lôi Đao',
      pinyin: 'Cửu Trọng Lôi Đao',
      type: 'term',
      note: 'Tuyệt kỹ đao pháp',
    },
  ];

  describe('buildRawTranslationPayload (Phase 1)', () => {
    it('integrates genre style guide, tone, and description into systemInstruction and prompt', () => {
      const payload = buildRawTranslationPayload({
        text: '罗峰拔出影刃，施展九重雷刀。',
        genre: 'Tiên Hiệp',
        tone: 'Hào hùng kỳ ảo',
        description: 'Nhân vật xưng hô huynh - đệ, xưng ta - ngươi trong chiến đấu.',
        glossary: sampleGlossary,
      });

      expect(payload.systemInstruction).toContain('Tiên Hiệp');
      expect(payload.systemInstruction).toContain('Nhân vật xưng hô huynh - đệ');
      expect(payload.prompt).toContain('Hào hùng kỳ ảo');
      expect(payload.prompt).toContain('Nguyên tắc dịch thuật & Quy tắc xưng hô từ cẩm nang:');
      expect(payload.prompt).toContain('Nhân vật xưng hô huynh - đệ');
      expect(payload.prompt).toContain('La Phong');
      expect(payload.prompt).toContain('Cửu Trọng Lôi Đao');
    });

    it('handles empty glossary and missing description gracefully', () => {
      const payload = buildRawTranslationPayload({
        text: '清晨的微风吹过湖面。',
        genre: 'Đô Thị',
        tone: 'Bình dị đời thường',
      });

      expect(payload.prompt).toContain('(Không có từ điển tùy chọn');
      expect(payload.prompt).not.toContain('Nguyên tắc dịch thuật & Quy tắc xưng hô từ cẩm nang:');
    });

    it('injects prompt reinforcement directive when isRetry is true', () => {
      const payload = buildRawTranslationPayload({
        text: '罗峰拔出影刃。',
        genre: 'Tiên Hiệp',
        tone: 'Hào hùng',
        isRetry: true,
      });

      expect(payload.systemInstruction).toContain('⚠️ CẢNH BÁO QUAN TRỌNG: Lượt dịch trước bị lỗi do để sót chữ Hán chưa dịch');
      expect(payload.systemInstruction).toContain('TUYỆT ĐỐI KHÔNG COPY NGUYÊN VĂN BẤT KỲ CÂU TỪ CHỮ HÁN NÀO');
    });

    it('deduplicates text section when text already has glossary brackets', () => {
      const payload = buildRawTranslationPayload({
        text: '[La Phong] 拔出影刃。',
        genre: 'Tiên Hiệp',
        tone: 'Hào hùng',
      });

      expect(payload.prompt).toContain('--- VĂN BẢN TIẾNG TRUNG (ĐÃ ĐÁNH DẤU TỪ ĐIỂN) ---');
      expect(payload.prompt).not.toContain('--- VĂN BẢN TIẾNG TRUNG GỐC ---');
    });
  });

  describe('buildPolishTranslationPayload (Phase 2)', () => {
    it('enforces Rule 8 (description compliance) and Rule 7 (genre style guide) in systemInstruction', () => {
      const payload = buildPolishTranslationPayload({
        sourceText: '罗峰看着浩瀚星空。',
        rawTranslation: 'La Phong nhìn bầu trời sao bao la.',
        genre: 'Khoa Huyễn',
        tone: 'Hùng vĩ lạnh lùng',
        description: 'Quy tắc xưng hô: Ta - Ngươi giữa các chiến binh vũ trụ.',
        additionalInstructions: 'Tập trung miêu tả sự cô tịch của vũ trụ.',
      });

      expect(payload.systemInstruction).toContain('8. BẮT BUỘC TUÂN THỦ NGUYÊN TẮC DỊCH THUẬT & QUY TẮC XƯNG HÔ ĐẶC THÙ CỦA TRUYỆN');
      expect(payload.systemInstruction).toContain('Ta - Ngươi giữa các chiến binh vũ trụ');
      expect(payload.systemInstruction).toContain('Khoa Huyễn');
      expect(payload.prompt).toContain('[NGUYÊN TẮC DỊCH THUẬT & QUY TẮC XƯNG HÔ ĐẶC THÙ TỪ CẨM NANG]');
      expect(payload.prompt).toContain('Tập trung miêu tả sự cô tịch của vũ trụ.');
    });

    it('applies fallback additionalInstructions when parameter is empty or whitespace', () => {
      const payload = buildPolishTranslationPayload({
        sourceText: '罗峰深吸一口气。',
        rawTranslation: 'La Phong hít sâu một hơi.',
        genre: 'Tiên Hiệp',
        tone: 'Trang nghiêm',
        additionalInstructions: '   ',
      });

      expect(payload.prompt).toContain('Hãy tối ưu ngữ điệu mượt mà, bay bổng nhất có thể, giữ trọn vẹn văn phong tiểu thuyết.');
    });

    it('injects matched glossary items into [TỪ ĐIỂN RIÊNG ĐÃ XUẤT HIỆN TRONG ĐOẠN NÀY]', () => {
      const payload = buildPolishTranslationPayload({
        sourceText: '罗峰施展九重雷刀。',
        rawTranslation: 'La Phong thi triển Cửu Trọng Lôi Đao.',
        genre: 'Tiên Hiệp',
        tone: 'Kịch tính',
        glossary: sampleGlossary,
      });

      expect(payload.prompt).toContain('[TỪ ĐIỂN RIÊNG ĐÃ XUẤT HIỆN TRONG ĐOẠN NÀY');
      expect(payload.prompt).toContain('罗峰');
      expect(payload.prompt).toContain('La Phong');
      expect(payload.prompt).toContain('九重雷刀');
      expect(payload.prompt).toContain('Cửu Trọng Lôi Đao');
    });

    it('retains Western names and Chinese characters per Rule 9 instruction', () => {
      const payload = buildPolishTranslationPayload({
        sourceText: '罗峰遇到罗伯特。',
        rawTranslation: 'La Phong gặp Robert.',
        genre: 'Đô Thị',
        tone: 'Hiện đại',
        isExtractionEnabled: true,
      });

      expect(payload.systemInstruction).toContain('Khôi phục tên gốc tiếng Anh');
      expect(payload.systemInstruction).toContain('giữ nguyên dạng chữ Hán phồn/giản thể như trong bản gốc');
    });
  });

  describe('buildQaCritiquePayload (Phase 3)', () => {
    it('enriches QA critique prompt and system instruction with genre, tone, description, and glossary', () => {
      const payload = buildQaCritiquePayload({
        sourceText: '罗峰施展九重雷刀，劈向巨兽。',
        translatedText: 'La Phong thi triển Cửu Trọng Lôi Đao, chém về phía cự thú.',
        genre: 'Tiên Hiệp',
        tone: 'Hào hùng kỳ ảo',
        description: 'Quy tắc dịch: Giữ nguyên tên chiêu thức Hán Việt.',
        glossary: sampleGlossary,
      });

      expect(payload.systemInstruction).toContain('Tiên Hiệp');
      expect(payload.systemInstruction).toContain('Hào hùng kỳ ảo');
      expect(payload.systemInstruction).toContain('Giữ nguyên tên chiêu thức Hán Việt');
      expect(payload.prompt).toContain('--- BẢNG TỪ ĐIỂN QUY ƯỚC CỦA DỰ ÁN ---');
      expect(payload.prompt).toContain('罗峰');
      expect(payload.prompt).toContain('La Phong');
      expect(payload.prompt).toContain('九重雷刀');
      expect(payload.prompt).toContain('Cửu Trọng Lôi Đao');
    });

    it('includes terminology validation in critique schema and system instructions', () => {
      const payload = buildQaCritiquePayload({
        sourceText: '短句。',
        translatedText: 'Câu ngắn.',
      });

      expect(payload.systemInstruction).toContain('Terminology');
      expect(payload.systemInstruction).toContain('Omissions');
      expect(payload.systemInstruction).toContain('Additions');
      expect(payload.systemInstruction).toContain('Repetitions');
      expect(payload.schema.properties.issues.items.properties.type.enum).toContain('terminology');
    });
  });

  describe('Universal Prompt Sanitization (US3)', () => {
    const dirtyChars = '\u200B\uFEFF\u{E0001}\u202A\u202C';

    it('sanitizes genre, tone, description, text, and glossary in buildRawTranslationPayload', () => {
      const payload = buildRawTranslationPayload({
        text: `第一章${dirtyChars} 萧炎`,
        genre: `Tiên\u200B Hiệp\uFEFF`,
        tone: `Hào\u{E0001} hùng`,
        description: `Quy\u202A tắc cẩm\u202C nang`,
        glossary: [
          {
            chinese: `萧\u200B炎`,
            vietnamese: `Tiêu\uFEFF Viêm`,
            pinyin: `Tiêu\u{E0001} Viêm`,
            type: 'character',
            note: `Ghi\u202A chú\u202C`,
          },
        ],
      });

      expect(payload.systemInstruction).not.toContain('\u200B');
      expect(payload.systemInstruction).not.toContain('\uFEFF');
      expect(payload.systemInstruction).not.toContain('\u{E0001}');
      expect(payload.systemInstruction).not.toContain('\u202A');
      expect(payload.systemInstruction).not.toContain('\u202C');

      expect(payload.prompt).not.toContain('\u200B');
      expect(payload.prompt).not.toContain('\uFEFF');
      expect(payload.prompt).not.toContain('\u{E0001}');
      expect(payload.prompt).not.toContain('\u202A');
      expect(payload.prompt).not.toContain('\u202C');

      expect(payload.prompt).toContain('Tiên Hiệp');
      expect(payload.prompt).toContain('Hào hùng');
      expect(payload.prompt).toContain('Quy tắc cẩm nang');
      expect(payload.prompt).toContain('Tiêu Viêm');
    });

    it('sanitizes genre, tone, description, additionalInstructions, and glossary in buildPolishTranslationPayload', () => {
      const payload = buildPolishTranslationPayload({
        sourceText: `第一章${dirtyChars} 萧炎`,
        rawTranslation: `Chương 1${dirtyChars} Tiêu Viêm`,
        genre: `Đô\u200B Thị`,
        tone: `Hiện\uFEFF đại`,
        description: `Cẩm\u{E0001} nang xưng hô`,
        additionalInstructions: `Chỉ\u202A đạo thêm\u202C`,
        glossary: [
          {
            chinese: `萧\u200B炎`,
            vietnamese: `Tiêu\uFEFF Viêm`,
          },
        ],
      });

      expect(payload.systemInstruction).not.toContain('\u200B');
      expect(payload.systemInstruction).not.toContain('\uFEFF');
      expect(payload.systemInstruction).not.toContain('\u{E0001}');
      expect(payload.systemInstruction).not.toContain('\u202A');
      expect(payload.systemInstruction).not.toContain('\u202C');

      expect(payload.prompt).not.toContain('\u200B');
      expect(payload.prompt).not.toContain('\uFEFF');
      expect(payload.prompt).not.toContain('\u{E0001}');
      expect(payload.prompt).not.toContain('\u202A');
      expect(payload.prompt).not.toContain('\u202C');

      expect(payload.prompt).toContain('Đô Thị');
      expect(payload.prompt).toContain('Hiện đại');
      expect(payload.prompt).toContain('Cẩm nang xưng hô');
      expect(payload.prompt).toContain('Chỉ đạo thêm');
    });

    it('sanitizes genre, tone, description, and glossary in buildQaCritiquePayload', () => {
      const payload = buildQaCritiquePayload({
        sourceText: `第一章${dirtyChars}`,
        translatedText: `Chương 1${dirtyChars}`,
        genre: `Huyền\u200B Huyễn`,
        tone: `Kỳ\uFEFF ảo`,
        description: `Quy\u{E0001} tắc QA`,
        glossary: [
          {
            chinese: `词\u202A汇`,
            vietnamese: `Từ\u202C vựng`,
          },
        ],
      });

      expect(payload.systemInstruction).not.toContain('\u200B');
      expect(payload.systemInstruction).not.toContain('\uFEFF');
      expect(payload.systemInstruction).not.toContain('\u{E0001}');
      expect(payload.systemInstruction).not.toContain('\u202A');
      expect(payload.systemInstruction).not.toContain('\u202C');

      expect(payload.prompt).not.toContain('\u200B');
      expect(payload.prompt).not.toContain('\uFEFF');
      expect(payload.prompt).not.toContain('\u{E0001}');
      expect(payload.prompt).not.toContain('\u202A');
      expect(payload.prompt).not.toContain('\u202C');

      expect(payload.systemInstruction).toContain('Huyền Huyễn');
      expect(payload.systemInstruction).toContain('Kỳ ảo');
      expect(payload.systemInstruction).toContain('Quy tắc QA');
    });
  });
});
