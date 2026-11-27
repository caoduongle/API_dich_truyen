import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GlossaryItem } from '../../../types';
import {
  evaluateAndMergePolishRound,
  evaluatePolishRoundFidelity,
  detectUngroundedProperNouns,
} from '../translationValidation';

const callGeminiDirectMock = vi.fn();

vi.mock('../../directGeminiClient', () => ({
  callGeminiDirect: (...args: any[]) => callGeminiDirectMock(...args),
}));

import { polishTranslationDirect } from '../polishTranslation';

const sampleGlossary: GlossaryItem[] = [
  {
    id: 'g1',
    chinese: '楚风',
    pinyin: 'Sở Phong',
    vietnamese: 'Sở Phong',
    type: 'character',
    note: 'Nam chính',
    origin: 'manual',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'g2',
    chinese: '青云宗',
    pinyin: 'Thanh Vân Tông',
    vietnamese: 'Thanh Vân Tông',
    type: 'location',
    note: '',
    origin: 'manual',
    createdAt: '2026-01-01T00:00:00Z',
  },
];

describe('Polish Fidelity Gate & Round Temperature Strategy (US3)', () => {
  beforeEach(() => {
    callGeminiDirectMock.mockReset();
  });

  describe('evaluatePolishRoundFidelity & detectUngroundedProperNouns', () => {
    it('rejects candidate that introduces a new glossary violation compared to previous draft', () => {
      const report = evaluatePolishRoundFidelity({
        sourceText: '楚风离开青云宗。',
        previousDraft: 'Sở Phong rời khỏi Thanh Vân Tông.',
        candidatePolished: 'Sở Phong rời khỏi tông môn mây xanh.',
        glossary: sampleGlossary,
        roundIndex: 2,
      });

      expect(report.isAcceptable).toBe(false);
      expect(report.previousGlossaryViolations).toBe(0);
      expect(report.candidateGlossaryViolations).toBeGreaterThan(0);
      expect(report.rejectionReason).toContain('GLOSSARY_REGRESSION');
    });

    it('rejects ungrounded invented multi-word proper nouns on round >= 2', () => {
      const report = evaluatePolishRoundFidelity({
        sourceText: '楚风看着远处山峰。',
        previousDraft: 'Sở Phong ngước mắt nhìn dãy núi phía xa.',
        candidatePolished: 'Sở Phong nhìn dãy núi phía xa thuộc về Huyết Sát Thần Điện và Lý Vô Song.',
        glossary: sampleGlossary,
        roundIndex: 2,
      });

      expect(report.isAcceptable).toBe(false);
      expect(report.ungroundedProperNouns).toContain('Huyết Sát Thần Điện');
      expect(report.ungroundedProperNouns).toContain('Lý Vô Song');
      expect(report.rejectionReason).toContain('UNGROUNDED_PROPER_NOUN');
    });

    it('allows legitimate case-insensitive capitalization adjustments from previous draft and glossary', () => {
      const report = evaluatePolishRoundFidelity({
        sourceText: '楚风走进玄天宫。',
        previousDraft: 'Sở Phong bước vào huyền thiên cung. Trời tối dần. Nhưng trong đại điện vẫn sáng đèn.',
        candidatePolished:
          'Chương 1: Khởi Đầu\n\nSở Phong bước vào Huyền Thiên Cung. Màn đêm buông xuống. Tuy nhiên đại điện vẫn rực sáng ánh đèn.',
        glossary: sampleGlossary,
        roundIndex: 2,
      });

      expect(report.ungroundedProperNouns).toEqual([]);
      expect(report.isAcceptable).toBe(true);
    });

    it('ignores chapter titles, ALL CAPS headers, and single sentence-start words when scanning proper nouns', () => {
      const ungrounded = detectUngroundedProperNouns({
        sourceText: '天黑了。',
        previousDraft: 'Mặt trời lặn xuống.',
        candidatePolished:
          'Chương 12: Đêm Đông Lạnh Giá\n\nQUYỂN THỨ NHẤT\n\nHoàng hôn buông xuống. Không gian chìm vào tĩnh mịch.',
        glossary: [],
      });

      expect(ungrounded).toEqual([]);
    });

    it('rejects candidate when multi-paragraph chapter structure collapses beyond tolerance', () => {
      const prev = ['Đoạn 1: A.', 'Đoạn 2: B.', 'Đoạn 3: C.', 'Đoạn 4: D.', 'Đoạn 5: E.'].join('\n\n');
      const collapsed = 'Đoạn 1 gộp toàn bộ nội dung năm đoạn thành một đoạn duy nhất.';

      const report = evaluatePolishRoundFidelity({
        sourceText: '1\n\n2\n\n3\n\n4\n\n5',
        previousDraft: prev,
        candidatePolished: collapsed,
        glossary: [],
        roundIndex: 2,
      });

      expect(report.isAcceptable).toBe(false);
      expect(report.paragraphCountDelta).toBe(4);
      expect(report.rejectionReason).toContain('PARAGRAPH_STRUCTURE_DIVERGENCE');
    });
  });

  describe('Round temperature mapping in polishTranslationDirect', () => {
    it.each([
      [1, 0.4],
      [2, 0.5],
      [3, 0.55],
      [4, 0.6],
      [5, 0.65],
    ])('uses strategy temperature %s -> %s when roundIndex is provided', async (roundIndex, expectedTemp) => {
      let capturedTemp: number | undefined;
      callGeminiDirectMock.mockImplementation(async (args: any) => {
        capturedTemp = args.temperature;
        return {
          text: JSON.stringify({
            polishedTranslation: 'Sở Phong bước qua cổng đá lớn dẫn vào Thanh Vân Tông cổ kính.',
            discoveredEntities: [],
          }),
          successKeyIndex: 0,
        };
      });

      await polishTranslationDirect({
        sourceText: '楚风走入青云宗石门。',
        rawTranslation: 'Sở Phong đi qua cổng đá vào Thanh Vân Tông.',
        genre: 'Tiên Hiệp',
        tone: 'Trang nghiêm',
        glossary: sampleGlossary,
        apiKeys: ['AIzaDummyKey00000000000000000000000001'],
        model: 'gemini-2.5-flash',
        roundIndex,
        totalRounds: 5,
      });

      expect(capturedTemp).toBe(expectedTemp);
    });

    it('preserves default 0.3 fallback temperature when roundIndex is omitted', async () => {
      let capturedTemp: number | undefined;
      callGeminiDirectMock.mockImplementation(async (args: any) => {
        capturedTemp = args.temperature;
        return {
          text: JSON.stringify({
            polishedTranslation: 'Sở Phong bước vào Thanh Vân Tông.',
          }),
          successKeyIndex: 0,
        };
      });

      await polishTranslationDirect({
        sourceText: '楚风进入青云宗。',
        rawTranslation: 'Sở Phong tiến vào Thanh Vân Tông.',
        genre: 'Tiên Hiệp',
        tone: 'Trang nghiêm',
        glossary: sampleGlossary,
        apiKeys: ['AIzaDummyKey00000000000000000000000001'],
        model: 'gemini-2.5-flash',
      });

      expect(capturedTemp).toBe(0.3);
    });
  });

  describe('evaluateAndMergePolishRound (Feature 171 - US2)', () => {
    it('accepts improved paragraphs and selectively reverts only regressed paragraphs on multi-paragraph chapters', () => {
      const srcList = [
        '“你怎么在这里？”楚风问道。',
        '第二段风景描写。',
        '楚风离开青云宗。',
        ...Array.from({ length: 7 }, (_, i) => `第${i + 4}段普通叙述。`),
      ];
      const prevList = [
        '"Sao ngươi lại ở đây?" Sở Phong hỏi.',
        'Cảnh sắc đoạn hai còn hơi thô.',
        'Sở Phong rời khỏi Thanh Vân Tông.',
        ...Array.from({ length: 7 }, (_, i) => `Đoạn kể chuyện bình thường thứ ${i + 4}.`),
      ];
      const candList = [
        'Sao ngươi lại ở đây? Sở Phong hỏi.', // Mất ngoặc thoại -> hoàn tác đoạn 1
        'Cảnh sắc đoạn hai hiện lên sống động và khoáng đạt hơn hẳn.', // Cải thiện tốt
        'Sở Phong rời khỏi tông môn mây xanh.', // Mất từ điển Thanh Vân Tông -> hoàn tác đoạn 3
        ...Array.from({ length: 7 }, (_, i) => `Đoạn tự sự thứ ${i + 4} đã được trau chuốt mượt mà.`), // 7 đoạn cải thiện tốt
      ];

      const merged = evaluateAndMergePolishRound({
        sourceText: srcList.join('\n\n'),
        previousDraft: prevList.join('\n\n'),
        candidatePolished: candList.join('\n\n'),
        glossary: sampleGlossary,
        roundIndex: 2,
      });

      expect(merged.isAcceptable).toBe(true);
      expect(merged.isCatastrophicRollback).toBe(false);
      expect(merged.acceptedParagraphCount).toBe(8);
      expect(merged.revertedParagraphs.map((r) => r.paragraphIndex)).toEqual([0, 2]);
      expect(merged.mergedPolishedText).toContain('"Sao ngươi lại ở đây?" Sở Phong hỏi.');
      expect(merged.mergedPolishedText).toContain('Sở Phong rời khỏi Thanh Vân Tông.');
      expect(merged.mergedPolishedText).toContain('sống động và khoáng đạt hơn hẳn');
    });

    it('triggers catastrophic rollback when > 40% of paragraphs regress or 0 improvements survive on small drafts', () => {
      const res = evaluateAndMergePolishRound({
        sourceText: '楚风离开青云宗。',
        previousDraft: 'Sở Phong rời khỏi Thanh Vân Tông.',
        candidatePolished: 'Sở Phong rời khỏi tông môn mây xanh.',
        glossary: sampleGlossary,
        roundIndex: 2,
      });

      expect(res.isAcceptable).toBe(false);
      expect(res.isCatastrophicRollback).toBe(true);
      expect(res.mergedPolishedText).toBe('Sở Phong rời khỏi Thanh Vân Tông.');
    });
  });
});
