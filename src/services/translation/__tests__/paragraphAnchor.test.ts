import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  encodeAnchoredParagraphs,
  parseAnchoredParagraphs,
  stripParagraphAnchors,
} from '../paragraphAnchor';
import * as directGeminiClient from '../../directGeminiClient';
import { translateRawDirect } from '../rawTranslation';
import { polishTranslationDirect } from '../polishTranslation';

describe('paragraphAnchor (Feature 171 - US1)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('encodes multi-paragraph text with sequential <<P1>>..<<PN>> markers and parses internal newlines cleanly', () => {
    const source = 'Chương 68: Thế giới suy tàn\n\nĐoạn một.\n\n"Ai đó?" Hắn hỏi.';
    const encoded = encodeAnchoredParagraphs(source);

    expect(encoded.expectedCount).toBe(3);
    expect(encoded.encodedText).toBe(
      '<<P1>> Chương 68: Thế giới suy tàn\n\n<<P2>> Đoạn một.\n\n<<P3>> "Ai đó?" Hắn hỏi.'
    );

    const modelOutput =
      '<<P1>> Chương 68: Thế giới suy tàn\n\n<<P2>> Đoạn một\nbị xuống dòng phụ.\n\n<<P3>> "Ai đó?" Hắn hỏi.';
    const parsed = parseAnchoredParagraphs(modelOutput, 3);

    expect(parsed.usedAnchors).toBe(true);
    expect(parsed.missingIndices).toEqual([]);
    expect(parsed.paragraphs).toEqual([
      'Chương 68: Thế giới suy tàn',
      'Đoạn một bị xuống dòng phụ.',
      '"Ai đó?" Hắn hỏi.',
    ]);
    expect(stripParagraphAnchors(parsed.paragraphs.join('\n\n'))).not.toContain('<<P');
  });

  it('ignores mid-sentence <<P9>> game/system tokens and detects genuinely missing anchor indices', () => {
    const modelOutput =
      '<<P1>> Chương 1: Hệ thống\n\n<<P3>> Anh ta nhập mã <<P2>> vào bảng điều khiển <<P99>>.';
    const parsed = parseAnchoredParagraphs(modelOutput, 3);

    expect(parsed.usedAnchors).toBe(true);
    expect(parsed.missingIndices).toEqual([1]); // missing 0-based index 1 (<<P2>>)
    expect(parsed.paragraphs[1]).toContain('Anh ta nhập mã <<P2>> vào bảng điều khiển <<P99>>.');
  });

  it('falls back gracefully when legacy mocks omit anchor markers', () => {
    const parsed = parseAnchoredParagraphs('Đoạn 1 bình thường.\n\nĐoạn 2 bình thường.', 2);
    expect(parsed.usedAnchors).toBe(false);
    expect(parsed.missingIndices).toEqual([]);
    expect(parsed.paragraphs).toEqual(['Đoạn 1 bình thường.', 'Đoạn 2 bình thường.']);
  });

  it('performs bounded 1-pass surgical recovery for 1 isolated leftover Han paragraph without full split', async () => {
    const paras = [
      '第一章 世界',
      '第二段正常翻译。',
      '第三段出现大片未翻译的中文内容导致整体比例超标并且必须单独手术修复这唯一的一段长文以确保通过校验。',
      '第四段结束。',
      '第五段补充。',
      '第六段收尾。',
    ];
    let calls = 0;

    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockImplementation(async (args) => {
      calls++;
      if (calls === 1) {
        return {
          text: JSON.stringify({
            rawTranslation: [
              '<<P1>> Chương 1: Thế Giới',
              '<<P2>> Đoạn hai dịch bình thường.',
              `<<P3>> ${paras[2]}`,
              '<<P4>> Đoạn bốn kết thúc.',
              '<<P5>> Đoạn năm bổ sung.',
              '<<P6>> Đoạn sáu khép lại.',
            ].join('\n\n'),
            discoveredEntities: [],
          }),
          successKeyIndex: 0,
        };
      }
      // Surgical single-paragraph call only receives paragraph 3 without anchor tags
      expect(args.prompt).toContain(paras[2]);
      expect(args.prompt).not.toContain('第六段收尾。');
      return {
        text: JSON.stringify({
          rawTranslation: 'Đoạn ba đã được dịch lại hoàn chỉnh sạch sẽ không còn chữ Hán.',
          discoveredEntities: [],
        }),
        successKeyIndex: 0,
      };
    });

    const result = await translateRawDirect({
      text: paras.join('\n\n'),
      genre: 'Tiên Hiệp',
      tone: 'Trang nghiêm',
      glossary: [],
      apiKeys: ['KEY_1'],
    });

    expect(calls).toBe(2);
    expect(result.isPartial).toBe(false);
    expect(result.rawTranslation).toContain('Đoạn ba đã được dịch lại hoàn chỉnh sạch sẽ không còn chữ Hán.');
    expect(result.rawTranslation.split('\n\n')).toHaveLength(6);
    expect(result.rawTranslation).not.toContain('<<P');
  });

  it('deterministically backfills 1 omitted anchored paragraph during polish without triggering split retries', async () => {
    const srcParas = [
      '第一章 深夜',
      '千江月走进大厅。',
      '钱仓一站在窗边。',
      '众人保持沉默。',
      '灯光微微闪烁。',
    ];
    const rawParas = [
      'Chương 1: Đêm Khuya',
      'Thiên Giang Nguyệt bước vào đại sảnh.',
      'Tiền Thương Nhất đứng bên cửa sổ.',
      'Mọi người giữ im lặng.',
      'Ánh đèn khẽ chập chờn.',
    ];

    let polishCalls = 0;
    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockImplementation(async () => {
      polishCalls++;
      return {
        text: JSON.stringify({
          polishedTranslation: [
            '<<P1>> Chương 1: Đêm Khuya',
            '<<P2>> Thiên Giang Nguyệt nhẹ bước vào đại sảnh.',
            // Cố tình thiếu <<P3>>
            '<<P4>> Mọi người vẫn lặng thinh không nói.',
            '<<P5>> Ánh đèn trên trần khẽ lay động.',
          ].join('\n\n'),
        }),
        successKeyIndex: 0,
      };
    });

    const res = await polishTranslationDirect({
      sourceText: srcParas.join('\n\n'),
      rawTranslation: rawParas.join('\n\n'),
      genre: 'Kinh Dị',
      tone: 'U ám',
      glossary: [],
      apiKeys: ['KEY_1'],
      roundIndex: 1,
      totalRounds: 2,
    });

    expect(polishCalls).toBe(1);
    expect(res.isPartial).toBe(false);
    expect(res.polishedTranslation.split('\n\n')).toEqual([
      'Chương 1: Đêm Khuya',
      'Thiên Giang Nguyệt nhẹ bước vào đại sảnh.',
      'Tiền Thương Nhất đứng bên cửa sổ.',
      'Mọi người vẫn lặng thinh không nói.',
      'Ánh đèn trên trần khẽ lay động.',
    ]);
  });
});
