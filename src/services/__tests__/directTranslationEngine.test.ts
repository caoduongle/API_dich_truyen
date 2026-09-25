import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as directGeminiClient from '../directGeminiClient';
import {
  translateRawDirect,
  polishTranslationDirect,
  qaCritiqueDirect,
  rewriteSentenceDirect,
  fallbackSinoVietnameseLine,
} from '../directTranslationEngine';

describe('src/services/directTranslationEngine.ts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('executes translateRawDirect and returns structured translation and discovered entities', async () => {
    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockResolvedValue({
      text: JSON.stringify({
        rawTranslation: 'Chương 1: Khởi Đầu\n\nSở Phong nhìn bầu trời.',
        discoveredEntities: [
          {
            chinese: '楚风',
            pinyin: 'Sở Phong',
            vietnamese: 'Sở Phong',
            type: 'character',
            note: 'Nhân vật chính',
          },
        ],
      }),
      successKeyIndex: 0,
    });

    const res = await translateRawDirect({
      text: '第一章 初始\n\n楚风看着天空。',
      genre: 'Tiên Hiệp',
      tone: 'Trang nghiêm',
      glossary: [],
      apiKeys: ['AQ_TEST_KEY'],
      model: 'gemini-2.5-flash',
      startKeyIndex: 0,
    });

    expect(res.rawTranslation).toContain('Chương 1: Khởi Đầu');
    expect(res.rawTranslation).toContain('Sở Phong nhìn bầu trời');
    expect(res.discoveredEntities).toHaveLength(1);
    expect(res.discoveredEntities[0].chinese).toBe('楚风');
    expect(res.successKeyIndex).toBe(0);
  });

  it('executes polishTranslationDirect and preserves chapter title', async () => {
    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockResolvedValue({
      text: JSON.stringify({
        polishedTranslation: 'Sở Phong ngước mắt nhìn lên vòm trời bao la.',
      }),
      successKeyIndex: 0,
    });

    const res = await polishTranslationDirect({
      sourceText: '第一章 初始\n\n楚风看着天空。',
      rawTranslation: 'Chương 1: Khởi Đầu\n\nSở Phong nhìn bầu trời.',
      genre: 'Tiên Hiệp',
      tone: 'Trang nghiêm',
      glossary: [],
      apiKeys: ['AQ_TEST_KEY'],
      model: 'gemini-2.5-flash',
      startKeyIndex: 0,
    });

    expect(res.polishedTranslation.startsWith('Chương 1: Khởi Đầu')).toBe(true);
    expect(res.polishedTranslation).toContain('Sở Phong ngước mắt');
  });

  it('executes polishTranslationDirect with roundIndex = 2 and uses dynamic temperature and round 2 prompt', async () => {
    let capturedArgs: any = null;
    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockImplementation(async (args) => {
      capturedArgs = args;
      return {
        text: JSON.stringify({
          polishedTranslation: 'Sở Phong nhìn lên bầu trời bao la vô tận.',
        }),
        successKeyIndex: 0,
      };
    });

    const res = await polishTranslationDirect({
      sourceText: '第一章 初始\n\n楚风看着天空。',
      rawTranslation: 'Chương 1: Khởi Đầu\n\nSở Phong ngước mắt nhìn lên vòm trời bao la.',
      genre: 'Tiên Hiệp',
      tone: 'Trang nghiêm',
      glossary: [],
      apiKeys: ['AQ_TEST_KEY'],
      model: 'gemini-2.5-flash',
      startKeyIndex: 0,
      roundIndex: 2,
      totalRounds: 3,
    });

    expect(res.polishedTranslation).toContain('Sở Phong nhìn lên bầu trời');
    expect(capturedArgs).not.toBeNull();
    // Round 2 uses temperature 0.50
    expect(capturedArgs.temperature).toBe(0.5);
    // Prompt contains round 1 translation label
    expect(capturedArgs.prompt).toContain('[BẢN DỊCH ĐÃ BIÊN TẬP LƯỢT 1]');
    // System instruction contains round 2 directive
    expect(capturedArgs.systemInstruction).toContain('ĐÂY LÀ LƯỢT CHUỐT VĂN THỨ 2/3');
  });

  it('executes qaCritiqueDirect and returns validation report', async () => {
    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockResolvedValue({
      text: JSON.stringify({
        isValid: false,
        issues: [
          {
            type: 'omission',
            severity: 'critical',
            targetText: '',
            description: 'Thiếu đoạn văn kết chương',
          },
        ],
      }),
      successKeyIndex: 0,
    });

    const res = await qaCritiqueDirect({
      sourceText: '原文',
      translatedText: 'Bản dịch',
      apiKeys: ['AQ_TEST_KEY'],
      model: 'gemini-2.5-flash',
      startKeyIndex: 0,
    });

    expect(res.isValid).toBe(false);
    expect(res.issues).toHaveLength(1);
    expect(res.issues[0].type).toBe('omission');
    expect(res.issues[0].targetText).toBe('');
  });

  it('executes rewriteSentenceDirect and sends targeted prompt with only targetText and context', async () => {
    let capturedCallArgs: any = null;
    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockImplementation(async (args) => {
      capturedCallArgs = args;
      return {
        text: JSON.stringify({
          rewrittenSentence: 'Hắn cất bước đi về phía trước một cách thong thả.',
        }),
        successKeyIndex: 1,
      };
    });

    const target = 'Hắn đi về phía trước.';
    const context = 'Mặt trời lặn sau rặng núi.';
    const issueMessage = 'Câu văn hơi cứng, cần mềm mại hơn.';

    const res = await rewriteSentenceDirect({
      targetText: target,
      context,
      issueMessage,
      apiKeys: ['KEY_1', 'KEY_2'],
      model: 'gemini-2.5-flash',
      startKeyIndex: 1,
    });

    expect(res.rewrittenSentence).toBe('Hắn cất bước đi về phía trước một cách thong thả.');
    expect(res.successKeyIndex).toBe(1);

    // Verify targeted prompt payload: contains targetText, context, issueMessage
    expect(capturedCallArgs).not.toBeNull();
    expect(capturedCallArgs.prompt).toContain(target);
    expect(capturedCallArgs.prompt).toContain(context);
    expect(capturedCallArgs.prompt).toContain(issueMessage);
    // Does NOT contain whole chapter content or unrelated prompt builders
    expect(capturedCallArgs.prompt).not.toContain('Chương 1');
    expect(capturedCallArgs.prompt).not.toContain('Bản dịch thô');
    expect(capturedCallArgs.temperature).toBe(0.4);
    expect(capturedCallArgs.startKeyIndex).toBe(1);
  });

  it('throws an error when rewriteSentenceDirect receives an empty response', async () => {
    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockResolvedValue({
      text: JSON.stringify({ rewrittenSentence: '   ' }),
      successKeyIndex: 0,
    });

    await expect(
      rewriteSentenceDirect({
        targetText: 'Một câu ngắn.',
        apiKeys: ['KEY_1'],
      })
    ).rejects.toThrow('AI không trả về câu viết lại hợp lệ.');
  });

  it('recursively splits text and polishes when full text throws empty or safety response', async () => {
    let callCount = 0;
    const p1 = 'Sở Phong đứng trên đỉnh núi cao lộng gió nhìn về phương xa, tâm trạng vô cùng trầm mặc trước phong cảnh tráng lệ của đất trời bao la vô tận nơi đây.';
    const p2 = 'Bên dưới chân núi, sóng biển cuồn cuộn vỗ bờ như sấm rền vang vọng khắp không gian, khiến cho lòng người không khỏi dâng lên cảm giác cô liêu.';
    const p3 = 'Hắn hít sâu một hơi linh khí thanh thuần, ánh mắt dần trở nên kiên định, bắt đầu vận chuyển huyền công trong cơ thể theo lộ tuyến đã định sẵn.';
    const p4 = 'Từng đạo linh lưu ấm áp lưu chuyển qua các kinh mạch, xua tan đi sự mệt mỏi sau chuỗi ngày dài bôn ba nơi hoang dã hiểm trở.';
    const source = `第一章 初始\n\n${p1}\n\n${p2}\n\n${p3}\n\n${p4}`;
    const raw = `Chương 1: Khởi Đầu\n\n${p1}\n\n${p2}\n\n${p3}\n\n${p4}`;

    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockImplementation(async (args) => {
      callCount++;
      if (callCount === 1) {
        // First call on full chapter text throws empty response
        throw new Error('AI trả về phản hồi rỗng.');
      }
      // Subsequent split calls succeed
      return {
        text: JSON.stringify({
          polishedTranslation: `Đoạn đã chuốt mịn thành công phần ${callCount}: ` + args.prompt.substring(0, 30),
        }),
        successKeyIndex: 0,
      };
    });

    const res = await polishTranslationDirect({
      sourceText: source,
      rawTranslation: raw,
      genre: 'Tiên Hiệp',
      tone: 'Trang nghiêm',
      glossary: [],
      apiKeys: ['KEY_1'],
      model: 'gemini-2.5-flash',
    });

    expect(callCount).toBeGreaterThan(1);
    expect(res.polishedTranslation).toContain('Chương 1: Khởi Đầu');
    expect(res.polishedTranslation).toContain('Đoạn đã chuốt mịn thành công');
  });

  it('falls back to raw text with isPartial flag when recursive child reaches leaf level and still throws empty response', async () => {
    // Generate text with enough tokens to allow split
    const longText = Array(15).fill('Sở Phong ngắm nhìn trời cao bao la vô tận. Cảnh vật nơi đây thật huyền bí và kỳ ảo.').join('\n\n');
    const source = `第一章\n\n${longText}`;
    const raw = `Chương 1: Tiêu Đề\n\n${longText}`;

    // All calls throw empty response
    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockRejectedValue(
      new Error('AI trả về phản hồi rỗng.')
    );

    const res = await polishTranslationDirect({
      sourceText: source,
      rawTranslation: raw,
      genre: 'Tiên Hiệp',
      tone: 'Trang nghiêm',
      glossary: [],
      apiKeys: ['KEY_1'],
      model: 'gemini-2.5-flash',
    });

    expect(res.isPartial).toBe(true);
    expect(res.polishedTranslation).toContain('Chương 1: Tiêu Đề');
  });

  it('recursively splits text and translates when translateRawDirect encounters UNTRANSLATED_CHINESE_LEFTOVER', async () => {
    let callCount = 0;
    const retryEvents: any[] = [];
    const p1 = '楚风站在高山之巅远眺四方，天地广阔无边，令人心旷神怡。';
    const p2 = '山脚下海浪滔滔，拍打着礁石发出如雷轰鸣，震撼人心。';
    const p3 = '他深深吸了一口清纯的灵气，眼神逐渐变得坚定起来。';
    const p4 = '温热的灵流在经脉中流淌，驱散了多日以来的疲惫。';
    const source = `第一章 初始\n\n${p1}\n\n${p2}\n\n${p3}\n\n${p4}`;

    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        // First call returns untranslated Chinese text (> 10% Chinese characters), which triggers UNTRANSLATED_CHINESE_LEFTOVER
        return {
          text: JSON.stringify({
            rawTranslation: `Chương 1: Khởi Đầu\n\n${p1}\n\n${p2}\n\n${p3}\n\n${p4}`,
          }),
          successKeyIndex: 0,
        };
      }
      if (callCount === 2) {
        return {
          text: JSON.stringify({
            rawTranslation: `Chương 1: Khởi Đầu\n\nĐoạn dịch thô tiếng Việt sạch chữ Hán phần 1.`,
          }),
          successKeyIndex: 0,
        };
      }
      // Subsequent split calls succeed with pure Vietnamese translation
      return {
        text: JSON.stringify({
          rawTranslation: `Đoạn dịch thô tiếng Việt sạch chữ Hán phần ${callCount}.`,
        }),
        successKeyIndex: 0,
      };
    });

    const res = await translateRawDirect({
      text: source,
      genre: 'Tiên Hiệp',
      tone: 'Trang nghiêm',
      glossary: [],
      apiKeys: ['KEY_1', 'KEY_2'],
      onSplitRetry: (info) => {
        retryEvents.push(info);
      },
    });

    expect(callCount).toBeGreaterThan(1);
    expect(retryEvents.length).toBeGreaterThan(0);
    expect(retryEvents[0].stage).toBe('raw');
    expect(retryEvents[0].reason).toContain('UNTRANSLATED_CHINESE_LEFTOVER');
    expect(res.rawTranslation).toContain('Chương 1: Khởi Đầu');
    expect(res.rawTranslation).toContain('Đoạn dịch thô tiếng Việt sạch chữ Hán');
  });

  it('recursively splits text and polishes when polishTranslationDirect encounters UNTRANSLATED_CHINESE_LEFTOVER', async () => {
    let callCount = 0;
    const retryEvents: any[] = [];
    const p1 = 'Sở Phong đứng trên đỉnh núi cao lộng gió nhìn về phương xa, tâm trạng vô cùng trầm mặc trước phong cảnh tráng lệ của đất trời bao la vô tận nơi đây.';
    const p2 = 'Bên dưới chân núi, sóng biển cuồn cuộn vỗ bờ như sấm rền vang vọng khắp không gian, khiến cho lòng người không khỏi dâng lên cảm giác cô liêu.';
    const p3 = 'Hắn hít sâu một hơi linh khí thanh thuần, ánh mắt dần trở nên kiên định, bắt đầu vận chuyển huyền công trong cơ thể theo lộ tuyến đã định sẵn.';
    const p4 = 'Từng đạo linh lưu ấm áp lưu chuyển qua các kinh mạch, xua tan đi sự mệt mỏi sau chuỗi ngày dài bôn ba nơi hoang dã hiểm trở.';
    const source = `第一章 初始\n\n楚风站在高山之巅远眺四方，天地广阔无边，令人心旷神怡。\n\n山脚下海浪滔滔，拍打着礁石发出如雷轰鸣，震撼人心。\n\n他深深吸了一口清纯的灵气，眼神逐渐变得坚定起来。\n\n温热的灵流在经脉中流淌，驱散了多日以来的疲惫。`;
    const raw = `Chương 1: Khởi Đầu\n\n${p1}\n\n${p2}\n\n${p3}\n\n${p4}`;

    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        // First call returns untranslated Chinese text (> 10% Chinese characters), which triggers UNTRANSLATED_CHINESE_LEFTOVER
        return {
          text: JSON.stringify({
            polishedTranslation: `Chương 1: Khởi Đầu\n\n楚风站在高山之巅远眺四方，天地广阔无边，令人心旷神怡。山脚下海浪滔滔，拍打着礁石发出如雷轰鸣，震撼人心。`,
          }),
          successKeyIndex: 0,
        };
      }
      // Subsequent split calls succeed with pure Vietnamese polished text
      return {
        text: JSON.stringify({
          polishedTranslation: `Đoạn văn đã chuốt mịn màng thuần Việt không còn chữ Hán phần ${callCount}.`,
        }),
        successKeyIndex: 0,
      };
    });

    const res = await polishTranslationDirect({
      sourceText: source,
      rawTranslation: raw,
      genre: 'Tiên Hiệp',
      tone: 'Trang nghiêm',
      glossary: [],
      apiKeys: ['KEY_1', 'KEY_2'],
      model: 'gemini-2.5-flash',
      onSplitRetry: (info) => {
        retryEvents.push(info);
      },
    });

    expect(callCount).toBeGreaterThan(1);
    expect(retryEvents.length).toBeGreaterThan(0);
    expect(retryEvents[0].stage).toBe('polish');
    expect(retryEvents[0].reason).toContain('UNTRANSLATED_CHINESE_LEFTOVER');
    expect(res.polishedTranslation).toContain('Chương 1: Khởi Đầu');
    expect(res.polishedTranslation).toContain('Đoạn văn đã chuốt mịn màng thuần Việt');
  });

  it('US1: long-text pre-split (>2000 tokens) decouples retryDepth so sub-chunks get full 2-level retry budget', async () => {
    let callCount = 0;
    const retryEvents: any[] = [];
    const paragraph = '楚风站在荒凉的大地上，注视着远方升起的奇异烟雾，心中充满了对未知世界的疑惑与警惕。'.repeat(3);
    const longSource = `第一章 恐怖广播\n\n` + Array.from({ length: 25 }, (_, i) => `${paragraph} Đoạn ${i + 1}`).join('\n\n');

    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockImplementation(async () => {
      callCount++;
      // Call 1 (first sub-chunk): returns Chinese untranslated error
      if (callCount === 1) {
        return {
          text: JSON.stringify({
            rawTranslation: `Chương 1: Khởi Đầu\n\n${longSource.slice(0, 500)}`,
          }),
          successKeyIndex: 0,
        };
      }
      // Call 2 (sub-chunk split retry level 0): fails again to trigger level 1 retry
      if (callCount === 2) {
        return {
          text: JSON.stringify({
            rawTranslation: `Chương 1: Khởi Đầu\n\n${longSource.slice(0, 300)}`,
          }),
          successKeyIndex: 0,
        };
      }
      if (callCount === 3) {
        return {
          text: JSON.stringify({
            rawTranslation: `Chương 1: Khởi Đầu\n\nBản dịch thô tiếng Việt sạch chữ Hán cho phần 3.`,
          }),
          successKeyIndex: 0,
        };
      }
      // Subsequent calls succeed with clean Vietnamese
      return {
        text: JSON.stringify({
          rawTranslation: `Bản dịch thô tiếng Việt sạch chữ Hán cho phần ${callCount}.`,
        }),
        successKeyIndex: 0,
      };
    });

    const res = await translateRawDirect({
      text: longSource,
      genre: 'Kinh Dị',
      tone: 'U ám ly kỳ',
      glossary: [],
      apiKeys: ['KEY_1', 'KEY_2'],
      concurrencyLimit: 1,
      onSplitRetry: (info) => {
        retryEvents.push(info);
      },
    });

    expect(callCount).toBeGreaterThan(2);
    expect(retryEvents.length).toBeGreaterThanOrEqual(2);
    expect(retryEvents.some(e => e.depth === 0)).toBe(true);
    expect(retryEvents.some(e => e.depth === 1)).toBe(true);
    expect(res.rawTranslation).toContain('Chương 1: Khởi Đầu');
    expect(res.rawTranslation).toContain('Bản dịch thô tiếng Việt sạch chữ Hán');
  });

  it('US2: fallbackSinoVietnameseLine replaces glossary terms, variants and strips brackets', () => {
    const glossary: any[] = [
      { id: '1', chinese: '楚风', vietnamese: 'Sở Phong', pinyin: 'Sở Phong', type: 'character', note: 'Nhân vật' },
      { id: '2', chinese: '九重雷刀', variants: ['九重刀'], vietnamese: 'Cửu Trọng Lôi Đao', pinyin: 'Cửu Trọng Lôi Đao', type: 'term', note: 'Chiêu thức' },
    ];
    const input = '楚风施展[九重刀]，破空斩下。';
    const output = fallbackSinoVietnameseLine(input, glossary);
    expect(output).toBe('Sở Phong施展Cửu Trọng Lôi Đao，破空斩下。');
  });

  it('US2: triggers Tier 3 Sino-Vietnamese rescue directly when retryDepth reaches 4 without line-by-line fallback', async () => {
    let callCount = 0;
    const retryEvents: any[] = [];
    const p1 = '楚风运转九重雷刀，狂暴的雷霆刀芒划破长空，带着毁天灭地的气势破空斩下。';
    const p2 = '大地剧烈震颤，四周尘土飞扬，地面被撕裂开一道深不见底的巨大沟壑。';
    const p3 = '神秘符文闪耀着奇异的光芒。';
    const source = `第一章 绝境\n\n${p1}\n\n${p2}\n\n${p3}`;

    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockImplementation(async (args) => {
      callCount++;
      const prompt = args.prompt || '';
      const textBlock = prompt.split('--- VĂN BẢN TIẾNG TRUNG GỐC ---')[1] || prompt;
      // Chunks containing '神秘符文': always return untranslated Chinese to reach depth 4
      if (textBlock.includes('神秘符文')) {
        return {
          text: JSON.stringify({
            rawTranslation: textBlock, // untranslated Chinese
          }),
          successKeyIndex: 0,
        };
      }
      // Other chunks succeed
      if (textBlock.includes('第一章 绝境') && textBlock.includes('楚风运转')) {
        return {
          text: JSON.stringify({
            rawTranslation: 'Chương 1: Tuyệt Cảnh\n\nSở Phong vận chuyển Cửu Trọng Lôi Đao, chém thẳng xuống hư không.\n\nMặt đất chấn động dữ dội, bụi bay mù mịt khắp bốn phía.',
          }),
          successKeyIndex: 0,
        };
      }
      if (textBlock.includes('第一章 绝境')) {
        return {
          text: JSON.stringify({
            rawTranslation: 'Chương 1: Tuyệt Cảnh',
          }),
          successKeyIndex: 0,
        };
      }
      if (textBlock.includes('楚风运转')) {
        return {
          text: JSON.stringify({
            rawTranslation: 'Sở Phong vận chuyển Cửu Trọng Lôi Đao, chém thẳng xuống hư không.',
          }),
          successKeyIndex: 0,
        };
      }
      if (textBlock.includes('大地剧烈')) {
        return {
          text: JSON.stringify({
            rawTranslation: 'Mặt đất chấn động dữ dội, bụi bay mù mịt khắp bốn phía.',
          }),
          successKeyIndex: 0,
        };
      }
      return {
        text: JSON.stringify({
          rawTranslation: 'Bản dịch thành công',
        }),
        successKeyIndex: 0,
      };
    });

    const res = await translateRawDirect({
      text: source,
      genre: 'Tiên Hiệp',
      tone: 'Trang nghiêm',
      glossary: [
        { id: '1', chinese: '神秘符文', vietnamese: 'Phù văn bí ẩn', pinyin: 'Thần Bí Phù Văn', type: 'term', note: 'Phù văn' },
      ],
      apiKeys: ['KEY_1'],
      onSplitRetry: (info) => {
        retryEvents.push(info);
      },
    });

    expect(retryEvents.some(e => e.tier === 'split')).toBe(true);
    // Line-by-line fallback is completely removed
    expect(retryEvents.some(e => e.tier === 'line-by-line')).toBe(false);
    // Sino-fallback rescue is triggered directly for the stubborn chunk
    expect(retryEvents.some(e => e.tier === 'sino-fallback')).toBe(true);
    expect(res.rawTranslation).toContain('Chương 1: Tuyệt Cảnh');
    expect(res.rawTranslation).toContain('Sở Phong vận chuyển Cửu Trọng Lôi Đao');
    expect(res.rawTranslation).toContain('Phù văn bí ẩn');
  });

  it('Feature 132 US1: isolates sub-branch recursion so successful chunks are not re-translated and in-order assembly is preserved', async () => {
    const p1 = '第一段：天地玄黄，宇宙洪荒。';
    const p2 = '第二段：日月盈昃，辰宿列张。';
    const p3 = '第三段：寒来暑往，秋收冬藏。';
    const p4 = '第四段：闰余成岁，律吕调阳。';
    const source = `${p1}\n\n${p2}\n\n${p3}\n\n${p4}`;

    const apiCalls: string[] = [];
    const retryEvents: any[] = [];

    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockImplementation(async (args) => {
      const prompt = args.prompt || '';
      const textBlock = (prompt.split('--- VĂN BẢN TIẾNG TRUNG GỐC ---')[1] || prompt).trim();
      apiCalls.push(textBlock);

      // Whole text (depth 0): fail with untranslated Chinese error
      if (textBlock.includes('第一段') && textBlock.includes('第四段')) {
        return {
          text: JSON.stringify({ rawTranslation: source }), // untranslated
          successKeyIndex: 0,
        };
      }

      // Left branch (p1 + p2): succeeds immediately!
      if (textBlock.includes('第一段') && textBlock.includes('第二段') && !textBlock.includes('第三段')) {
        return {
          text: JSON.stringify({
            rawTranslation: 'Đoạn 1: Trời đất huyền hoàng, vũ trụ hồng hoang.\n\nĐoạn 2: Nhật nguyệt đầy vơi, sao giăng chòm sáng.',
          }),
          successKeyIndex: 0,
        };
      }

      // Right branch (p3 + p4): fails on first try
      if (textBlock.includes('第三段') && textBlock.includes('第四段') && !textBlock.includes('第一段')) {
        return {
          text: JSON.stringify({ rawTranslation: `${p3}\n\n${p4}` }), // untranslated
          successKeyIndex: 0,
        };
      }

      // Sub-branch Right 1 (p3 only): succeeds
      if (textBlock.includes('第三段') && !textBlock.includes('第四段')) {
        return {
          text: JSON.stringify({
            rawTranslation: 'Đoạn 3: Lạnh đến hè qua, thu thu đông tàng.',
          }),
          successKeyIndex: 0,
        };
      }

      // Sub-branch Right 2 (p4 only): succeeds
      if (textBlock.includes('第四段') && !textBlock.includes('第三段')) {
        return {
          text: JSON.stringify({
            rawTranslation: 'Đoạn 4: Nhuận sinh thêm năm, luật lữ điều dương.',
          }),
          successKeyIndex: 0,
        };
      }

      return {
        text: JSON.stringify({ rawTranslation: textBlock }),
        successKeyIndex: 0,
      };
    });

    const res = await translateRawDirect({
      text: source,
      genre: 'Cổ đại',
      tone: 'Hùng tráng',
      glossary: [],
      apiKeys: ['KEY_1'],
      onSplitRetry: (info) => {
        retryEvents.push(info);
      },
    });

    // Verify retryEvents: partsCount is always 2 for split
    expect(retryEvents.length).toBeGreaterThan(0);
    expect(retryEvents.every(e => e.tier !== 'line-by-line')).toBe(true);
    const splitEvents = retryEvents.filter(e => e.tier === 'split');
    expect(splitEvents.every(e => e.partsCount === 2)).toBe(true);

    // Verify left branch (p1 + p2) was only called ONCE and not re-executed when right branch retried
    const leftBranchCalls = apiCalls.filter(c => c.includes('第一段') && c.includes('第二段') && !c.includes('第三段'));
    expect(leftBranchCalls).toHaveLength(1);

    // Verify in-order assembly
    expect(res.rawTranslation).toContain('Đoạn 1: Trời đất huyền hoàng');
    expect(res.rawTranslation).toContain('Đoạn 2: Nhật nguyệt đầy vơi');
    expect(res.rawTranslation).toContain('Đoạn 3: Lạnh đến hè qua');
    expect(res.rawTranslation).toContain('Đoạn 4: Nhuận sinh thêm năm');

    const idx1 = res.rawTranslation.indexOf('Đoạn 1');
    const idx2 = res.rawTranslation.indexOf('Đoạn 2');
    const idx3 = res.rawTranslation.indexOf('Đoạn 3');
    const idx4 = res.rawTranslation.indexOf('Đoạn 4');
    expect(idx1).toBeLessThan(idx2);
    expect(idx2).toBeLessThan(idx3);
    expect(idx3).toBeLessThan(idx4);
  });

  it('Feature 132 US1 & US3: splits up to depth 4 with binary division (partsCount = 2) and records telemetry', async () => {
    const text = '第一句。第二句。第三句。第四句。第五句。第六句。第七句。第八句。第九句。第十句。';
    const retryEvents: any[] = [];

    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockImplementation(async () => {
      // Always fail with untranslated Chinese to trigger splits up to depth 4
      return {
        text: JSON.stringify({ rawTranslation: text }),
        successKeyIndex: 0,
      };
    });

    const res = await translateRawDirect({
      text,
      genre: 'Tiên Hiệp',
      tone: 'Trang nghiêm',
      glossary: [{ id: '1', chinese: '第一句', vietnamese: 'Câu thứ nhất', pinyin: '', type: 'term', note: '' }],
      apiKeys: ['KEY_1'],
      onSplitRetry: (info) => {
        retryEvents.push(info);
      },
    });

    // Check split events
    const splitEvents = retryEvents.filter(e => e.tier === 'split');
    expect(splitEvents.length).toBeGreaterThan(0);
    // Every split event must have partsCount === 2
    expect(splitEvents.every(e => e.partsCount === 2)).toBe(true);
    // Depths observed should include 0
    const depths = splitEvents.map(e => e.depth);
    expect(depths).toContain(0);
    // No line-by-line events
    expect(retryEvents.some(e => e.tier === 'line-by-line')).toBe(false);
    // Final rescue was sino-fallback
    expect(retryEvents.some(e => e.tier === 'sino-fallback')).toBe(true);
    // Glossary applied in rescue
    expect(res.rawTranslation).toContain('Câu thứ nhất');
  });

  describe('Feature 125: Polish Truncation Prevention and Paragraph Parity Integration', () => {
    it('detects truncation when LLM returns only partial chapter and recovers via Divide & Conquer', async () => {
      const p1 = 'Tô Bạch đang mặc quần áo bỗng khựng lại, đoạn cười cười cũng không để tâm lắm. Hòa thượng và Gia Thố chỉ liếc nhìn rồi không nói gì thêm.';
      const p2 = 'Ở trong Thế giới câu chuyện, sơ sẩy ngộ sát một người vốn chẳng phải chuyện to tát gì, điều duy nhất đáng tiếc là thiếu đi một kẻ có thể dùng để hỏi chuyện.';
      const p3 = 'Cả Gia Thố lẫn Hòa thượng đều không phải là kẻ cổ hủ giả nhân giả nghĩa, chẳng có tâm trạng nhàn rỗi đâu mà đi thương thiên bi người.';
      const p4 = 'Đúng lúc cả ba người đã mặc xong quần áo chuẩn bị lên kế hoạch hành động tiếp theo, đầu thôn bỗng truyền tới tiếng người lao xao náo loạn.';
      const p5 = 'Tô Bạch đứng dựa lưng vào tường, Hòa thượng quỳ một gối xuống đất quan sát tình hình bên ngoài qua khe cửa hẹp.';

      const source = `Chương 92: Cởi sạch\n\n${p1}\n\n${p2}\n\n${p3}\n\n${p4}\n\n${p5}`;
      const raw = `Chương 92: Cởi sạch\n\n${p1}\n\n${p2}\n\n${p3}\n\n${p4}\n\n${p5}`;

      let callCount = 0;
      const retryEvents: any[] = [];

      vi.spyOn(directGeminiClient, 'callGeminiDirect').mockImplementation(async (args) => {
        callCount++;
        if (callCount === 1) {
          // Lượt 1: AI trả về bản chuốt văn bị cắt cụt đuôi (chỉ có 2 đoạn đầu tiên, ngắn hơn 50% bản thô)
          return {
            text: JSON.stringify({
              polishedTranslation: `Chương 92: Cởi sạch\n\n${p1} Biên tập mượt mà.\n\n${p2} Biên tập mượt mà.`,
            }),
            successKeyIndex: 0,
          };
        }
        // Các lượt chia nhỏ sau đó: trả về từng phần đầy đủ
        return {
          text: JSON.stringify({
            polishedTranslation: args.prompt.includes(p1) || args.prompt.includes(p2)
              ? `Chương 92: Cởi sạch\n\n${p1} Chuốt mịn.\n\n${p2} Chuốt mịn.\n\n${p3} Chuốt mịn.`
              : `${p4} Chuốt mịn.\n\n${p5} Chuốt mịn.`,
          }),
          successKeyIndex: 0,
        };
      });

      const res = await polishTranslationDirect({
        sourceText: source,
        rawTranslation: raw,
        genre: 'Đô Thị',
        tone: 'Hồi hộp',
        glossary: [],
        apiKeys: ['KEY_1'],
        onSplitRetry: (info) => {
          retryEvents.push(info);
        },
      });

      expect(callCount).toBeGreaterThan(1);
      expect(retryEvents.some(e => e.stage === 'polish')).toBe(true);
      expect(res.polishedTranslation).toContain('Chương 92: Cởi sạch');
      expect(res.polishedTranslation).toContain(p1);
      expect(res.polishedTranslation).toContain(p5);
    });

    it('pre-splits long chapters before calling polish API when token count exceeds 1800', async () => {
      // Create a long text with > 1800 estimated tokens
      const longParagraph = 'Đây là một đoạn văn bản tương đối dài nhằm kiểm tra thuật toán tiền phân đoạn trong quá trình chuốt văn phong của hệ thống dịch thuật AI trực tiếp.';
      const longSource = Array(35).fill(longParagraph).join('\n\n');
      const longRaw = Array(35).fill(longParagraph).join('\n\n');

      let callCount = 0;
      vi.spyOn(directGeminiClient, 'callGeminiDirect').mockImplementation(async (_args) => {
        callCount++;
        return {
          text: JSON.stringify({
            polishedTranslation: 'Đoạn văn đã được chuốt mịn mượt mà thành công.',
          }),
          successKeyIndex: 0,
        };
      });

      const res = await polishTranslationDirect({
        sourceText: `Chương 1: Mở Đầu\n\n${longSource}`,
        rawTranslation: `Chương 1: Mở Đầu\n\n${longRaw}`,
        genre: 'Tiên Hiệp',
        tone: 'Trang nghiêm',
        glossary: [],
        apiKeys: ['KEY_1'],
      });

      // Since the text is > 1800 tokens, it should have pre-split into at least 2 chunks
      expect(callCount).toBeGreaterThanOrEqual(2);
      expect(res.polishedTranslation).toContain('Chương 1: Mở Đầu');
    });
  });

  describe('quickTranslateTermDirect (US5)', () => {
    it('parses valid structured quick term response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      chinese: '张三',
                      vietnamese: 'Trương Tam',
                      pinyin: 'Zhāng Sān',
                      type: 'character',
                      note: 'Nhân vật phụ',
                    }),
                  },
                ],
              },
            },
          ],
        }),
      });

      const res = await directGeminiClient.quickTranslateTermDirect({
        term: '张三',
        apiKeys: ['KEY_1'],
      });

      expect(res).toEqual({
        chinese: '张三',
        vietnamese: 'Trương Tam',
        pinyin: 'Zhāng Sān',
        type: 'character',
        note: 'Nhân vật phụ',
      });
    });

    it('falls back safely to default term structure when AI returns invalid schema', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      chinese: '',
                      invalidField: 123,
                    }),
                  },
                ],
              },
            },
          ],
        }),
      });

      const res = await directGeminiClient.quickTranslateTermDirect({
        term: '李四',
        apiKeys: ['KEY_1'],
      });

      expect(res.chinese).toBe('李四');
      expect(res.vietnamese).toBe('');
      expect(res.type).toBe('character');
    });

    it('sanitizes options.genre against prompt injection and hidden control characters', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      chinese: '张三',
                      vietnamese: 'Trương Tam',
                      pinyin: 'Zhāng Sān',
                      type: 'character',
                      note: 'Nhân vật',
                    }),
                  },
                ],
              },
            },
          ],
        }),
      });

      await directGeminiClient.quickTranslateTermDirect({
        term: '张三',
        genre: 'Tiên\u200B Hiệp\uFEFF',
        apiKeys: ['KEY_1'],
      });

      expect(global.fetch).toHaveBeenCalled();
      const callArgs = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      const systemInstruction = requestBody.systemInstruction.parts[0].text;
      expect(systemInstruction).toContain('Tiên Hiệp');
      expect(systemInstruction).not.toContain('\u200B');
      expect(systemInstruction).not.toContain('\uFEFF');
    });
  });

  describe('Spec 162 User Story 1: Translation Resilience & Lossless Recovery', () => {
    it('handles CONTENT_BLOCKED without rotating keys and rescues failed branch with isPartial=true', async () => {
      const source = '第一章 激战\n\n楚风挥剑斩杀强敌，鲜血染红了大地。\n\n战斗结束后，他静静地坐在石阶上疗伤。';
      let callCount = 0;
      const keyIndicesUsed: number[] = [];

      vi.spyOn(directGeminiClient, 'callGeminiDirect').mockImplementation(async (options) => {
        callCount++;
        keyIndicesUsed.push(options.startKeyIndex ?? 0);

        // First call with whole text fails with CONTENT_BLOCKED
        if (callCount === 1) {
          throw new directGeminiClient.GeminiRequestError('Safety filter blocked content', {
            code: 'CONTENT_BLOCKED',
            category: 'CONTENT_BLOCKED',
            isRetryable: false,
          });
        }

        // Branch 1 (violent fight scene) fails again with CONTENT_BLOCKED
        if (options.prompt.includes('斩杀强敌')) {
          throw new directGeminiClient.GeminiRequestError('Safety filter blocked branch', {
            code: 'CONTENT_BLOCKED',
            category: 'CONTENT_BLOCKED',
            isRetryable: false,
          });
        }

        // Branch 2 (healing on stone steps) succeeds
        return {
          text: JSON.stringify({
            rawTranslation: 'Chiến đấu kết thúc, hắn lẳng lặng ngồi trên bậc đá chữa thương.',
            discoveredEntities: [],
          }),
          successKeyIndex: options.startKeyIndex ?? 0,
        };
      });

      const res = await translateRawDirect({
        text: source,
        genre: 'Tiên Hiệp',
        tone: 'Trang nghiêm',
        glossary: [
          {
            id: '1',
            chinese: '第一章',
            vietnamese: 'Chương 1',
            pinyin: 'Đệ nhất chương',
            type: 'term' as any,
            note: '',
          },
          {
            id: '2',
            chinese: '楚风',
            vietnamese: 'Sở Phong',
            pinyin: 'Sở Phong',
            type: 'character' as any,
            note: '',
          },
        ],
        apiKeys: ['KEY_1', 'KEY_2', 'KEY_3'],
        maxDepth: 1, // Terminal after 1 split
      });

      expect(callCount).toBeGreaterThan(1);
      // For CONTENT_BLOCKED, keys must not be rotated (should stick to startKeyIndex 0)
      expect(keyIndicesUsed.every((k) => k === 0)).toBe(true);
      // Sibling that succeeded via AI is present
      expect(res.rawTranslation).toContain('bậc đá chữa thương');
      // Failed branch is rescued via Sino-Vietnamese fallback
      expect(res.rawTranslation).toContain('Chương 1');
      // Overall result is marked isPartial
      expect(res.isPartial).toBe(true);
    });

    it('polishTranslationDirect preserves raw translation when terminal depth is reached with isPartial=true', async () => {
      const source = '第一章 初始\n\n楚风看着天空。';
      const raw = 'Chương 1: Khởi Đầu\n\nSở Phong nhìn bầu trời.';

      vi.spyOn(directGeminiClient, 'callGeminiDirect').mockRejectedValue(
        new directGeminiClient.GeminiRequestError('Safety blocked', {
          code: 'CONTENT_BLOCKED',
          category: 'CONTENT_BLOCKED',
          isRetryable: false,
        })
      );

      const res = await polishTranslationDirect({
        sourceText: source,
        rawTranslation: raw,
        genre: 'Tiên Hiệp',
        tone: 'Trang nghiêm',
        glossary: [],
        apiKeys: ['KEY_1'],
        maxDepth: 1,
      });

      expect(res.polishedTranslation).toBe(raw);
      expect(res.isPartial).toBe(true);
    });
  });
});
