import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GlossaryItem } from '../../../types';
import { stripDuplicatedContinuityOverlap } from '../../../lib/text';
import { buildRawTranslationPayload, buildPolishTranslationPayload } from '../../ai/prompts';
import {
  buildChapterContinuityContext,
  checkCharacterPronounConsistency,
} from '../translationValidation';

const callGeminiDirectMock = vi.fn();

vi.mock('../../directGeminiClient', () => ({
  callGeminiDirect: (...args: any[]) => callGeminiDirectMock(...args),
}));

import { translateRawDirect } from '../rawTranslation';
import { polishTranslationDirect } from '../polishTranslation';

const femaleCharGlossary: GlossaryItem = {
  id: 'g_char_female',
  chinese: '林雪',
  pinyin: 'lín xuě',
  vietnamese: 'Lâm Tuyết',
  type: 'character',
  note: '',
  origin: 'manual',
  createdAt: '2026-01-01T00:00:00Z',
  isPinned: true,
  characterProfile: {
    gender: 'female',
    defaultSelfPronoun: 'muội',
    defaultNarrativePronoun: 'nàng',
    relations: [
      {
        targetName: 'Lâm Uyển',
        selfPronoun: 'muội',
        targetPronoun: 'tỷ tỷ',
      },
    ],
  },
};

const maleCharGlossary: GlossaryItem = {
  id: 'g_char_male',
  chinese: '陈风',
  pinyin: 'chén fēng',
  vietnamese: 'Trần Phong',
  type: 'character',
  note: '',
  origin: 'manual',
  createdAt: '2026-01-01T00:00:00Z',
  characterProfile: {
    gender: 'male',
    defaultSelfPronoun: 'ta',
    defaultNarrativePronoun: 'hắn',
  },
};

describe('ContinuityContext, Overlap Stripping, and CharacterProfile', () => {
  beforeEach(() => {
    callGeminiDirectMock.mockReset();
  });

  describe('buildChapterContinuityContext & stripDuplicatedContinuityOverlap', () => {
    it('extracts tail paragraphs preferring polishedTranslation within char limits', () => {
      const ctx = buildChapterContinuityContext({
        sourceText: '第一段内容很短。\n\n第二段末尾出现转折。\n\n第三段林雪推开木门。',
        rawTranslation: 'Bản thô chương trước.',
        polishedTranslation: 'Đoạn một.\n\nĐoạn hai chuyển cảnh.\n\nLâm Tuyết nhẹ nhàng đẩy cánh cửa gỗ.',
      });

      expect(ctx).toBeDefined();
      expect(ctx?.sourceKind).toBe('previous-chapter');
      expect(ctx?.previousSourceTail).toContain('第二段末尾出现转折。');
      expect(ctx?.previousSourceTail).toContain('第三段林雪推开木门。');
      expect(ctx?.previousSourceTail).not.toContain('第一段内容很短。');
      expect(ctx?.previousTranslationTail).toContain('Đoạn hai chuyển cảnh.');
      expect(ctx?.previousTranslationTail).toContain('Lâm Tuyết nhẹ nhàng đẩy cánh cửa gỗ.');
    });

    it('returns undefined when previous chapter has no translation yet', () => {
      expect(buildChapterContinuityContext({ sourceText: '正文', rawTranslation: '' })).toBeUndefined();
      expect(buildChapterContinuityContext(null)).toBeUndefined();
    });

    it('strips accidentally duplicated continuity tail from start of translated output', () => {
      const tail = 'Lâm Tuyết bước ra ngoài sân, ánh trăng chiếu xuống nền đá.';
      const duplicatedOutput = `${tail}\n\nBất ngờ một tiếng kiếm rít vang lên từ phía đông.`;

      const cleaned = stripDuplicatedContinuityOverlap(duplicatedOutput, tail);
      expect(cleaned).toBe('Bất ngờ một tiếng kiếm rít vang lên từ phía đông.');
    });

    it('preserves translation when leading paragraph differs from continuity tail', () => {
      const tail = 'Lâm Tuyết khép cửa lại.';
      const normalOutput = 'Sáng hôm sau, tiếng chuông sớm đánh thức cả sơn trang.';

      expect(stripDuplicatedContinuityOverlap(normalOutput, tail)).toBe(normalOutput);
    });
  });

  describe('Prompt formatting with CharacterProfile & ContinuityContext', () => {
    it('formats CharacterProfile rules and injects ContinuityContext strictly BEFORE source delimiter in raw & polish prompts', () => {
      const continuity = {
        previousSourceTail: '夜色渐深。',
        previousTranslationTail: 'Màn đêm dần buông xuống tĩnh mịch.',
        sourceKind: 'previous-chapter' as const,
      };

      const rawPayload = buildRawTranslationPayload({
        text: '林雪走进院中。',
        genre: 'Tiên Hiệp',
        tone: 'Trang nghiêm cổ kính',
        glossary: [femaleCharGlossary],
        continuity,
      });

      expect(rawPayload.prompt).toContain('Giới tính: Nữ');
      expect(rawPayload.prompt).toContain('Tự xưng: "muội"');
      expect(rawPayload.prompt).toContain('Đại từ tự sự (ngôi thứ 3): "nàng"');
      expect(rawPayload.prompt).toContain('với Lâm Uyển (xưng "muội" - gọi "tỷ tỷ")');
      expect(rawPayload.prompt).toContain('Màn đêm dần buông xuống tĩnh mịch.');

      const continuityIdx = rawPayload.prompt.indexOf('NGỮ CẢNH');
      const sourceDelimiterIdx = rawPayload.prompt.indexOf('--- VĂN BẢN TIẾNG TRUNG GỐC ---');
      expect(continuityIdx).toBeGreaterThan(-1);
      expect(sourceDelimiterIdx).toBeGreaterThan(continuityIdx);

      const polishPayload = buildPolishTranslationPayload({
        sourceText: '林雪走进院中。',
        rawTranslation: 'Lâm Tuyết bước vào sân.',
        genre: 'Tiên Hiệp',
        tone: 'Trang nghiêm cổ kính',
        glossary: [femaleCharGlossary],
        continuity,
      });

      expect(polishPayload.prompt).toContain('Tự xưng: "muội"');
      expect(polishPayload.prompt).toContain('Đại từ tự sự (ngôi thứ 3): "nàng"');
      expect(polishPayload.prompt).toContain('với Lâm Uyển (xưng "muội" - gọi "tỷ tỷ")');
      expect(polishPayload.prompt).toContain('Màn đêm dần buông xuống tĩnh mịch.');

      const polishContinuityIdx = polishPayload.prompt.indexOf('NGỮ CẢNH');
      const polishSourceIdx = polishPayload.prompt.indexOf('[BẢN DỊCH THÔ GIAI ĐOẠN 1]');
      expect(polishContinuityIdx).toBeGreaterThan(-1);
      expect(polishSourceIdx).toBeGreaterThan(polishContinuityIdx);
    });
  });

  describe('Intra-chapter ContinuityContext propagation across split chunks', () => {
    it('propagates previous-chapter continuity to chunk 0 and previous-chunk tail to chunk 1 in rawTranslation', async () => {
      const longPara1 = '第一段：林雪握紧手中长剑，目光冷静地扫过四周荒凉的竹林。'.repeat(100);
      const longPara2 = '第二段：远处传来急促的脚步声，陈风的身影缓缓从迷雾中走出。'.repeat(100);
      const fullSource = `${longPara1}\n\n${longPara2}`;

      const promptsSeen: string[] = [];
      callGeminiDirectMock.mockImplementation(async (req: any) => {
        promptsSeen.push(req.prompt);
        const isSecond = req.prompt.includes('第二段：');
        return {
          text: JSON.stringify({
            rawTranslation: isSecond
              ? 'Màn đêm dần buông.\n\nTiếng bước chân dồn dập vang lên, bóng dáng Trần Phong bước ra từ sương mù.'
              : 'Lâm Tuyết nắm chặt trường kiếm, bình tĩnh quan sát rừng trúc hoang vắng.',
            discoveredEntities: [],
          }),
          successKeyIndex: 0,
        };
      });

      const result = await translateRawDirect({
        text: fullSource,
        genre: 'Tiên Hiệp',
        tone: 'Trang nghiêm cổ kính',
        glossary: [femaleCharGlossary, maleCharGlossary],
        apiKeys: ['AIzaDummyKey00000000000000000000000001'],
        model: 'gemini-2.5-flash',
        continuity: {
          previousTranslationTail: 'Chương trước khép lại trong tiếng gió lạnh.',
          sourceKind: 'previous-chapter',
        },
        concurrencyLimit: 2,
      });

      expect(callGeminiDirectMock).toHaveBeenCalledTimes(2);
      const chunk0Prompt = promptsSeen.find((p) => p.includes('第一段：')) || '';
      const chunk1Prompt = promptsSeen.find((p) => p.includes('第二段：')) || '';
      expect(chunk0Prompt).toContain('Chương trước khép lại trong tiếng gió lạnh.');
      expect(chunk1Prompt).toContain('竹林');
      expect(chunk1Prompt).toContain('Đoạn tiếng Trung liền trước');
      expect(result.rawTranslation).toContain('Trần Phong');
    });

    it('propagates previous chunk source & polished tail sequentially in polishTranslation and strips duplicated overlap', async () => {
      const srcPara1 = '第一段：林雪站在山崖边，寒风吹动她的衣袂。'.repeat(100);
      const srcPara2 = '第二段：剑光一闪，黑衣人倒退三步。'.repeat(100);
      const rawPart1a = 'Lâm Tuyết đứng bên vách núi, gió lạnh thổi bay vạt áo nàng.'.repeat(88);
      const rawPart1b = 'Nàng lặng lẽ đứng bên vách núi nghe tiếng gió gào thét.';
      const rawPara1 = `${rawPart1a}\n\n${rawPart1b}`;
      const rawPara2 = 'Ánh kiếm lóe lên, kẻ áo đen lùi lại ba bước.'.repeat(90);

      const promptsSeen: string[] = [];
      const duplicatedChunk0Tail = 'Lâm Tuyết đứng lặng bên vách núi nghe tiếng gió gào thét.';
      const polishedBody1a = 'Lâm Tuyết lặng lẽ đứng bên vách núi, gió lạnh thổi tung tà áo nàng. '.repeat(82);
      const polishedBody2 = 'Ánh kiếm chớp nhoáng lóe qua, hắc y nhân lảo đảo lùi lại ba bước. '.repeat(75);

      callGeminiDirectMock.mockImplementation(async (req: any) => {
        promptsSeen.push(req.prompt);
        const isSecond = req.prompt.includes('第二段：');
        return {
          text: JSON.stringify({
            polishedTranslation: isSecond
              ? `${duplicatedChunk0Tail}\n\n${polishedBody2}`
              : `${polishedBody1a}\n\n${duplicatedChunk0Tail}`,
            discoveredEntities: [],
          }),
          successKeyIndex: 0,
        };
      });

      const result = await polishTranslationDirect({
        sourceText: `${srcPara1}\n\n${srcPara2}`,
        rawTranslation: `${rawPara1}\n\n${rawPara2}`,
        genre: 'Tiên Hiệp',
        tone: 'Trang nghiêm cổ kính',
        glossary: [femaleCharGlossary],
        apiKeys: ['AIzaDummyKey00000000000000000000000001'],
        model: 'gemini-2.5-flash',
        continuity: {
          previousTranslationTail: 'Nàng rời khỏi đại điện từ lúc canh ba.',
          sourceKind: 'previous-chapter',
        },
      });

      expect(callGeminiDirectMock).toHaveBeenCalledTimes(2);
      expect(promptsSeen[0]).toContain('Nàng rời khỏi đại điện từ lúc canh ba.');
      expect(promptsSeen[1]).toContain(duplicatedChunk0Tail);
      expect(promptsSeen[1]).toContain('Bản dịch liền trước');
      // Duplicated continuity tail at start of chunk 1 should be stripped after merge
      const occurrences = result.polishedTranslation.split(duplicatedChunk0Tail).length - 1;
      expect(occurrences).toBe(1);
    });
  });

  describe('checkCharacterPronounConsistency', () => {
    it('flags narrative male pronoun mismatch on a single profiled female character', () => {
      const issues = checkCharacterPronounConsistency({
        sourceText: '林雪冷冷地看了一眼门外。',
        translatedText: 'Lâm Tuyết lạnh lùng nhìn ra ngoài cửa, hắn không nói một lời.',
        glossary: [femaleCharGlossary],
      });

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('pronoun');
      expect(issues[0].severity).toBe('critical');
      expect(issues[0].source).toBe('deterministic');
      expect(issues[0].paragraphIndex).toBe(0);
    });

    it('suppresses warning when opposite-gender characters appear in the same paragraph', () => {
      const issues = checkCharacterPronounConsistency({
        sourceText: '林雪看向陈风。',
        translatedText: 'Lâm Tuyết nhìn Trần Phong, hắn khẽ gật đầu.',
        glossary: [femaleCharGlossary, maleCharGlossary],
      });

      expect(issues).toHaveLength(0);
    });

    it('ignores pronouns spoken inside dialogue quotation marks', () => {
      const issues = checkCharacterPronounConsistency({
        sourceText: '林雪淡淡地说道：“他已经走了。”',
        translatedText: 'Lâm Tuyết nhàn nhạt nói: "Hắn đã đi rồi." Rồi nàng xoay người bước đi.',
        glossary: [femaleCharGlossary],
      });

      expect(issues).toHaveLength(0);
    });
  });
});
