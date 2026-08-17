import { describe, it, expect, vi, beforeEach } from 'vitest';
import { alignChapter } from '../alignmentController';
import * as geminiService from '../../services/geminiService';

vi.mock('../../services/geminiService', () => ({
  generateWithRotation: vi.fn(),
}));

describe('Alignment Controller Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when sourceText or translatedText is missing', async () => {
    const res1 = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    await alignChapter({ body: { translatedText: 'bản dịch' } } as any, res1);
    expect(res1.status).toHaveBeenCalledWith(400);

    const res2 = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    await alignChapter({ body: { sourceText: 'nguyên tác' } } as any, res2);
    expect(res2.status).toHaveBeenCalledWith(400);
  });

  it('successfully aligns bilingual chapter data and returns jsonlLines', async () => {
    const mockGenerate = vi.mocked(geminiService.generateWithRotation);
    mockGenerate.mockResolvedValueOnce({
      text: JSON.stringify({
        alignments: [
          {
            chinese: '第一章 陨落的天才。',
            vietnamese: 'Chương 1: Thiên tài sa sút.',
          },
          {
            chinese: '斗之气，三段！',
            vietnamese: 'Đấu chi khí, tam đoạn!',
          },
        ],
      }),
      successKeyIndex: 0,
    });

    const req = {
      body: {
        sourceText: '第一章 陨落的天才。\n斗之气，三段！',
        translatedText: 'Chương 1: Thiên tài sa sút.\nĐấu chi khí, tam đoạn!',
        apiKeys: ['test-key'],
        model: 'gemini-2.5-flash',
      },
    } as any;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    await alignChapter(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        jsonlLines: expect.arrayContaining([
          expect.stringContaining('Chương 1: Thiên tài sa sút.'),
        ]),
        successKeyIndex: 0,
      })
    );
  });

  it('handles server rotation errors gracefully', async () => {
    const mockGenerate = vi.mocked(geminiService.generateWithRotation);
    mockGenerate.mockRejectedValueOnce(new Error('AI Quota Exceeded'));

    const req = {
      body: {
        sourceText: '原文',
        translatedText: 'Dịch',
      },
    } as any;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    await alignChapter(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('AI Quota Exceeded') }));
  });
});
