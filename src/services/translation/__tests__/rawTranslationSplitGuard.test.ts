import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as directGeminiClient from '../../directGeminiClient';
import { translateRawDirect } from '../rawTranslation';

describe('Feature 173 US4 (FR-010): GĐ1 Minor Paragraph Variance Split Guard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const buildChineseChapter = (bodyParagraphCount: number): string => {
    const paras = ['第一章 先驱者的荣耀'];
    for (let i = 1; i <= bodyParagraphCount; i++) {
      paras.push(`第${i}段测试文本内容：聊天室中的匿名者正在等待系统开启下一轮逃生片场。`);
    }
    return paras.join('\n\n');
  };

  it('tolerates delta <= 2 on clean >= 12 paragraph draft when title preserved & 0 leftover Han (saves RPD split calls)', async () => {
    const srcText = buildChineseChapter(13); // total 14 paragraphs
    const splitRetrySpy = vi.fn();

    // Draft has 12 paragraphs (delta = 2): clean Vietnamese, title preserved, ample length >= 80%
    const translatedParas = ['Chương 1: Vinh quang của người tiên phong'];
    for (let i = 1; i <= 11; i++) {
      translatedParas.push(
        `Đoạn văn dịch tiếng Việt thứ ${i}: Những kẻ ẩn danh trong phòng chat đang lặng lẽ chờ hệ thống mở ra trường quay sinh tồn tiếp theo để tìm đường sống.`
      );
    }

    const callSpy = vi.spyOn(directGeminiClient, 'callGeminiDirect').mockResolvedValueOnce({
      text: JSON.stringify({
        rawTranslation: translatedParas.join('\n\n'),
        discoveredEntities: [],
      }),
      successKeyIndex: 0,
    });

    const result = await translateRawDirect({
      text: srcText,
      genre: 'Vô hạn lưu',
      tone: 'U ám',
      glossary: [],
      apiKeys: ['KEY_GD1_1'],
      model: 'gemini-3.5-flash-lite',
      useParagraphAnchors: false,
      onSplitRetry: splitRetrySpy,
    });

    expect(callSpy).toHaveBeenCalledTimes(1);
    expect(splitRetrySpy).not.toHaveBeenCalled();
    expect(result.isPartial).toBe(false);
    expect(result.rawTranslation).toContain('Chương 1: Vinh quang của người tiên phong');
  });

  it('still rejects minor variance and falls back to split when chapter title is missing on target draft', async () => {
    const srcText = buildChineseChapter(13); // starts with 第一章 title
    const splitRetrySpy = vi.fn();

    // 12 paragraphs (delta = 2), clean Vietnamese & sufficient length, EXCEPT missing chapter title line at index 0
    const noTitleParas: string[] = [];
    for (let i = 1; i <= 12; i++) {
      noTitleParas.push(
        `Nội dung đoạn thứ ${i}: Những người chơi ẩn danh trong phòng chat đang theo dõi bảng đếm ngược trường quay sinh tồn vô cùng căng thẳng.`
      );
    }

    const callSpy = vi
      .spyOn(directGeminiClient, 'callGeminiDirect')
      .mockResolvedValueOnce({
        text: JSON.stringify({
          rawTranslation: noTitleParas.join('\n\n'),
          discoveredEntities: [],
        }),
        successKeyIndex: 0,
      })
      .mockResolvedValue({
        text: JSON.stringify({
          rawTranslation: 'Chương 1: Vinh quang\n\nĐoạn dịch chuẩn.\n\nĐoạn dịch hai.\n\nĐoạn dịch ba.\n\nĐoạn dịch bốn.\n\nĐoạn dịch năm.\n\nĐoạn dịch sáu.',
          discoveredEntities: [],
        }),
        successKeyIndex: 0,
      });

    await translateRawDirect({
      text: srcText,
      genre: 'Vô hạn lưu',
      tone: 'U ám',
      glossary: [],
      apiKeys: ['KEY_GD1_2'],
      model: 'gemini-3.5-flash-lite',
      useParagraphAnchors: false,
      maxDepth: 1,
      onSplitRetry: splitRetrySpy,
    });

    expect(splitRetrySpy).toHaveBeenCalledTimes(1);
    expect(callSpy.mock.calls.length).toBeGreaterThan(1);
  });
});
