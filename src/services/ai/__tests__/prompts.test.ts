import { describe, it, expect } from 'vitest';
import {
  buildRawTranslationPayload,
  buildPolishTranslationPayload,
  buildQaCritiquePayload,
  buildAnalyzeGuidelinesPayload,
  buildAnalyzeGlossaryPayload,
} from '../prompts';
import { getGenreStyleGuide, getToneStyleGuide } from '../../../config/translationStyles';

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

      expect(payload.prompt).toContain('Hãy trau chuốt câu chữ tự nhiên, thuần Việt nhưng vẫn trung thành nguyên tác và giữ nguyên tuyệt đối cấu trúc 1-1');
      expect(payload.prompt).toContain('[BẢN ĐỒ CẤU TRÚC ĐOẠN BẮT BUỘC: Xuất đúng 1 đoạn văn/dòng');
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

  describe('Prompt Structure Clarity, Single Source Emission & Priority Hierarchy (US5 / FR-019)', () => {
    it('keeps each numbered rule cleanly separated on its own line in buildRawTranslationPayload', () => {
      const payload = buildRawTranslationPayload({
        text: '罗峰拔出影刃。',
        genre: 'Tiên Hiệp',
        tone: 'Hào hùng',
        description: 'Giữ đúng tên gọi.',
        glossary: sampleGlossary,
      });

      const ruleNumbers = payload.systemInstruction
        .split('\n')
        .map((line) => line.match(/^(\d+)\.\s/)?.[1])
        .filter((n): n is string => Boolean(n));

      expect(ruleNumbers).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
      expect(payload.systemInstruction).not.toContain('6. Phong cách phù hợp thể loại:.*Trích xuất');
    });

    it('emits source text block only once (no duplicate raw/marked blocks) in buildRawTranslationPayload', () => {
      const uniqueSnippet = '星辰大海之间矗立着古老神殿。';
      const plainPayload = buildRawTranslationPayload({
        text: uniqueSnippet,
        genre: 'Khoa Huyễn',
        tone: 'Hùng vĩ',
      });

      expect(plainPayload.prompt.split(uniqueSnippet).length - 1).toBe(1);
      expect(plainPayload.prompt.match(/--- VĂN BẢN TIẾNG TRUNG/g)).toHaveLength(1);

      const bracketPayload = buildRawTranslationPayload({
        text: `[Thánh Điện] ${uniqueSnippet}`,
        genre: 'Khoa Huyễn',
        tone: 'Hùng vĩ',
      });

      expect(bracketPayload.prompt.split(uniqueSnippet).length - 1).toBe(1);
      expect(bracketPayload.prompt.match(/--- VĂN BẢN TIẾNG TRUNG/g)).toHaveLength(1);
    });

    it('declares consistent explicit priority hierarchy (#1 Fidelity -> #2 Pronouns -> #3 Style) across Phases 1, 2, and 3', () => {
      const rawPayload = buildRawTranslationPayload({
        text: '罗峰点头。',
        genre: 'Tiên Hiệp',
        tone: 'Trang nghiêm',
      });
      const polishPayload = buildPolishTranslationPayload({
        sourceText: '罗峰点头。',
        rawTranslation: 'La Phong gật đầu.',
        genre: 'Tiên Hiệp',
        tone: 'Trang nghiêm',
      });
      const qaPayload = buildQaCritiquePayload({
        sourceText: '罗峰点头。',
        translatedText: 'La Phong gật đầu.',
        genre: 'Tiên Hiệp',
        tone: 'Trang nghiêm',
      });

      for (const payload of [rawPayload, polishPayload, qaPayload]) {
        expect(payload.systemInstruction).toContain('[THỨ TỰ ƯU TIÊN TUYỆT ĐỐI');
        expect(payload.systemInstruction).toContain('- ƯU TIÊN #1 (BẤT KHẢ XÂM PHẠM):');
        expect(payload.systemInstruction).toContain('Cẩm nang & quy tắc xưng hô của truyện > Hồ sơ nhân vật');
        expect(payload.systemInstruction).toContain('> Yêu cầu biên tập bổ sung');
        expect(payload.systemInstruction).toContain('- ƯU TIÊN #3');

        const pos1 = payload.systemInstruction.indexOf('ƯU TIÊN #1');
        const pos2 = payload.systemInstruction.indexOf('ƯU TIÊN #2');
        const pos3 = payload.systemInstruction.indexOf('ƯU TIÊN #3');
        expect(pos1).toBeLessThan(pos2);
        expect(pos2).toBeLessThan(pos3);
      }
    });

    it('injects both getGenreStyleGuide and getToneStyleGuide across Phases 1-3 and sanitizes guideline analysis prompt', () => {
      const genre = 'Cung Đấu / Gia Đấu';
      const tone = 'Sắc sảo cung đấu';

      const rawPayload = buildRawTranslationPayload({
        text: '皇后微微一笑。',
        genre,
        tone,
      });
      const polishPayload = buildPolishTranslationPayload({
        sourceText: '皇后微微一笑。',
        rawTranslation: 'Hoàng hậu khẽ mỉm cười.',
        genre,
        tone,
      });
      const qaPayload = buildQaCritiquePayload({
        sourceText: '皇后微微一笑。',
        translatedText: 'Hoàng hậu khẽ mỉm cười.',
        genre,
        tone,
        description: 'Giữ nguyên xưng hô bổn cung - thần thiếp.',
      });

      for (const payload of [rawPayload, polishPayload, qaPayload]) {
        expect(payload.systemInstruction).toContain(getGenreStyleGuide(genre));
        expect(payload.systemInstruction).toContain(getToneStyleGuide(tone));
        expect(payload.systemInstruction).toContain('Quy chuẩn Tông giọng biên tập > Chỉ dẫn Thể loại chính');
      }

      const guidelinePayload = buildAnalyzeGuidelinesPayload({
        guidelinesSection: `Quy\u200B tắc${'\uFEFF'} tùy chỉnh\u{E0001}`,
      });
      expect(guidelinePayload.prompt).not.toContain('\u200B');
      expect(guidelinePayload.prompt).not.toContain('\uFEFF');
      expect(guidelinePayload.prompt).not.toContain('\u{E0001}');
      expect('enum' in guidelinePayload.schema.properties.genre).toBe(false);
      expect('enum' in guidelinePayload.schema.properties.tone).toBe(false);
    });
  });

  describe('Feature 169: 3-Phase Glossary Context Parity, Role Grouping & Chapter Exclusions', () => {
    it('passes full note, type, variants and role headings consistently across Raw, Polish and QA', () => {
      const richGlossary = [
        {
          chinese: '青云宗',
          vietnamese: 'Thanh Vân Tông',
          pinyin: 'Thanh Vân Tông',
          type: 'location',
          note: 'Tông môn chính đạo nổi tiếng bậc nhất',
        },
        {
          chinese: '苏晴',
          vietnamese: 'Tô Tình',
          pinyin: 'Tô Tình',
          type: 'character',
          variants: ['晴儿'],
          note: 'Nữ sư tỷ tính cách lạnh lùng nhưng trọng tình',
          characterProfile: { gender: 'female' as const, defaultNarrativePronoun: 'nàng' },
        },
        {
          chinese: '紫阳剑诀',
          vietnamese: 'Tử Dương Kiếm Quyết',
          pinyin: 'Tử Dương Kiếm Quyết',
          type: 'term',
          note: 'Kiếm quyết hỏa hệ',
          isPinned: true,
        },
      ];

      const source = '晴儿站在青云宗山门前。';
      const raw = buildRawTranslationPayload({ text: source, genre: 'Tiên Hiệp', tone: 'Hào sảng', glossary: richGlossary });
      const polish = buildPolishTranslationPayload({
        sourceText: source,
        rawTranslation: 'Tô Tình đứng trước sơn môn Thanh Vân Tông.',
        genre: 'Tiên Hiệp',
        tone: 'Hào sảng',
        glossary: richGlossary,
      });
      const qa = buildQaCritiquePayload({
        sourceText: source,
        translatedText: 'Tô Tình đứng trước sơn môn Thanh Vân Tông.',
        glossary: richGlossary,
      });

      for (const payload of [raw, polish, qa]) {
        expect(payload.prompt).toContain('Nữ sư tỷ tính cách lạnh lùng nhưng trọng tình');
        expect(payload.prompt).toContain('Tông môn chính đạo nổi tiếng bậc nhất');
        expect(payload.prompt).toContain('Kiếm quyết hỏa hệ');
        expect(payload.prompt).toContain('晴儿');
        expect(payload.prompt).toContain('### Nhân vật & Hồ sơ xưng hô');
        expect(payload.prompt).toContain('### Địa danh');
        // Nhân vật có hồ sơ phải đứng trước Địa danh
        expect(payload.prompt.indexOf('### Nhân vật & Hồ sơ xưng hô')).toBeLessThan(
          payload.prompt.indexOf('### Địa danh')
        );
      }
      expect(polish.prompt).toContain('[TỪ ĐIỂN GHIM BẮT BUỘC (1 thuật ngữ)]');
    });

    it('prioritizes chapter-present exclusions when knownChineseTerms exceeds 150 entries', () => {
      const filler = Array.from({ length: 180 }, (_, idx) => `无关术语${idx}`);
      const payload = buildAnalyzeGlossaryPayload({
        text: '玄天剑尊踏入太虚古境。',
        knownChineseTerms: [...filler, '玄天剑尊', '太虚古境'],
        loopIndex: 2,
        totalLoops: 2,
      });

      expect(payload.prompt).toContain('玄天剑尊');
      expect(payload.prompt).toContain('太虚古境');
    });
  });

  describe('Feature 170: Loop-1 Anchor Context & Hardened Anti-Pinyin Scan Prompts', () => {
    it('injects project genre/tone/description and knownGlossaryEntries on Loop 1 alongside anti-Pinyin rules', () => {
      const payload = buildAnalyzeGlossaryPayload({
        text: '钱仓一走进电影院。',
        genre: 'Kinh Dị / Linh Dị',
        tone: 'U ám hồi hộp',
        description: 'Tên người thuần Trung giữ Hán-Việt chuẩn.',
        knownGlossaryEntries: [{ chinese: '钱仓一', vietnamese: 'Tiền Thương Nhất', isPinned: true }],
        loopIndex: 1,
        totalLoops: 1,
      });

      expect(payload.prompt).toContain('--- BỐI CẢNH DỰ ÁN (NEO PHONG CÁCH ĐẶT TÊN) ---');
      expect(payload.prompt).toContain('Thể loại: Kinh Dị / Linh Dị');
      expect(payload.prompt).toContain('- [钱仓一] => [Tiền Thương Nhất]');
      expect(payload.systemInstruction).toContain("TUYỆT ĐỐI CẤM điền Bính âm");
      expect(payload.systemInstruction).toContain("giữ nguyên '萬劍歸宗'");
    });
  });

  describe('Feature 171: Explicit Anchors, rawSourceText Glossary Lookup & Stage Compliance Handoff', () => {
    it('supports opt-in <<Pk>> anchoring without breaking unanchored default calls', () => {
      const anchored = buildRawTranslationPayload({
        text: '第一章 启程\n\n钱仓一推开大门。',
        genre: 'Kinh Dị',
        tone: 'U ám',
        useParagraphAnchors: true,
      });

      expect(anchored.prompt).toContain('<<P1>> 第一章 启程');
      expect(anchored.prompt).toContain('<<P2>> 钱仓一推开大门。');
      expect(anchored.systemInstruction).toContain('NEO ĐOẠN TƯỜNG MINH 1-1');

      const unanchored = buildRawTranslationPayload({
        text: '第一章 启程\n\n钱仓一推开大门。',
        genre: 'Kinh Dị',
        tone: 'U ám',
      });
      expect(unanchored.prompt).not.toContain('<<P1>>');
    });

    it('matches glossary & characterProfile via rawSourceText on pre-processed chapters without double annotation', () => {
      const payload = buildRawTranslationPayload({
        text: '第一段 [Thiên Giang Nguyệt] mỉm cười nhìn [Tiền Thương Nhất].',
        rawSourceText: '第一段 千江月 mỉm cười nhìn 钱仓一。',
        genre: 'Kinh Dị',
        tone: 'U ám',
        glossary: [
          {
            id: 'g_girl',
            chinese: '千江月',
            pinyin: 'Thiên Giang Nguyệt',
            vietnamese: 'Thiên Giang Nguyệt',
            type: 'character',
            note: 'Nữ chính',
            characterProfile: { gender: 'female', defaultNarrativePronoun: 'cô' },
          },
        ],
      });

      expect(payload.prompt).toContain('千江月');
      expect(payload.prompt).toContain('Giới tính: Nữ');
      expect(payload.prompt).not.toContain('千江月[Thiên Giang Nguyệt]');
    });

    it('injects sanitized complianceIssuesToFix into Polish Round 1 prompt', () => {
      const payload = buildPolishTranslationPayload({
        sourceText: '千江月看着天马。',
        rawTranslation: 'Thiên Giang nhìn thấy Ngựa Trời.',
        genre: 'Kinh Dị',
        tone: 'U ám',
        roundIndex: 1,
        totalRounds: 3,
        complianceIssuesToFix: [
          {
            type: 'terminology',
            severity: 'critical',
            targetText: 'Thiên Giang nhìn thấy Ngựa Trời.',
            description: 'Đoạn 1 thiếu tên "Thiên Mã".',
            expectedTerm: { chinese: '天马', vietnamese: 'Thiên Mã' },
          },
        ],
      });

      expect(payload.prompt).toContain('[DANH SÁCH LỖI CẦN SỬA NGAY TỪ DỊCH THÔ (1 mục)]');
      expect(payload.prompt).toContain('Bắt buộc dùng [天马] = "Thiên Mã"');
    });
  });
});
