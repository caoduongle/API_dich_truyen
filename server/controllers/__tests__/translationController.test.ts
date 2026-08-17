import { describe, it, expect, vi, beforeEach } from 'vitest';
import { translateRaw, polishTranslation, qaCritique } from '../translationController';
import * as geminiService from '../../services/geminiService';
import { translationChunkCache } from '../../utils/chunkCache';

vi.mock('../../services/geminiService', () => ({
  generateWithRotation: vi.fn(),
  sleep: vi.fn().mockResolvedValue(undefined),
  isOverloadError: vi.fn().mockReturnValue(false),
  isSafetyOrEmptyError: vi.fn(),
}));

describe('Translation Controller Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    translationChunkCache.clear();
  });

  describe('translateRaw', () => {
    it('returns 400 if text is missing or not a string', async () => {
      const req = { body: {} } as any;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;

      await translateRaw(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
    });

    it('translates single chunk directly with pre-substitution glossary', async () => {
      const mockGenerate = vi.mocked(geminiService.generateWithRotation);
      const mockSafety = vi.mocked(geminiService.isSafetyOrEmptyError);
      mockSafety.mockReturnValue(false);

      mockGenerate.mockResolvedValueOnce({
        text: JSON.stringify({
          rawTranslation: 'Tiêu Viêm đi vào phòng khách.',
          discoveredEntities: [{ chinese: '萧炎', vietnamese: 'Tiêu Viêm', type: 'Nhân vật' }],
        }),
        successKeyIndex: 1,
      });

      const req = {
        body: {
          text: '萧炎走进了客厅。',
          genre: 'Tiên Hiệp',
          tone: 'Trang trọng',
          glossary: [{ chinese: '萧炎', vietnamese: 'Tiêu Viêm', pinyin: 'Tieu Viem', type: 'Nhân vật', note: '' }],
          apiKeys: ['key-1', 'key-2'],
          model: 'gemini-2.5-flash',
        },
      } as any;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;

      await translateRaw(req, res);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          rawTranslation: 'Tiêu Viêm đi vào phòng khách.',
          successKeyIndex: 1,
        })
      );
    });

    it('triggers Divide & Conquer when encountering safety/empty error on full text', async () => {
      const mockGenerate = vi.mocked(geminiService.generateWithRotation);
      const mockSafety = vi.mocked(geminiService.isSafetyOrEmptyError);

      // Lần 1: Lỗi rỗng / vi phạm bộ lọc
      mockSafety.mockReturnValue(true);
      mockGenerate.mockRejectedValueOnce(new Error('FILTER_BLOCKED_EMPTY'));

      // Các lần chia sau: Thành công
      mockGenerate.mockResolvedValue({
        text: JSON.stringify({
          rawTranslation: 'Đoạn dịch đã chia nhỏ thành công.',
          discoveredEntities: [],
        }),
        successKeyIndex: 0,
      });

      // Đoạn văn dài đủ để vượt ngưỡng leaf token
      const longText = '第一章 陨落的天才。萧炎盘膝坐在石床上，闭目修炼。'.repeat(30);

      const req = {
        body: {
          text: longText,
          genre: 'Tiên Hiệp',
          tone: 'Trang trọng',
          glossary: [],
          apiKeys: ['test-key'],
          model: 'gemini-2.5-flash',
        },
      } as any;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;

      await translateRaw(req, res);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          rawTranslation: expect.any(String),
          successKeyIndex: expect.any(Number),
        })
      );
      expect(mockGenerate.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('polishTranslation', () => {
    it('returns 400 if rawTranslation is empty', async () => {
      const req = { body: { rawTranslation: '' } } as any;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;

      await polishTranslation(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('successfully polishes raw translation with style guide', async () => {
      const mockGenerate = vi.mocked(geminiService.generateWithRotation);
      mockGenerate.mockReset();
      const mockSafety = vi.mocked(geminiService.isSafetyOrEmptyError);
      mockSafety.mockReturnValue(false);

      mockGenerate.mockResolvedValueOnce({
        text: JSON.stringify({
          polishedTranslation: 'Chương 1: Phế sài trỗi dậy. Gió đêm vi vu thổi qua rèm cửa.',
        }),
        successKeyIndex: 0,
      });

      const req = {
        body: {
          rawTranslation: 'Chương 1: Phế sài quật khởi. Gió đêm thổi rèm cửa.',
          sourceText: '第一章 废柴崛起。夜风吹动窗帘。',
          genre: 'Huyền Huyễn',
          tone: 'Cổ phong, trau chuốt',
          apiKeys: ['test-key'],
          model: 'gemini-2.5-flash',
          isExtractionEnabled: false,
        },
      } as any;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;

      await polishTranslation(req, res);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          polishedTranslation: 'Chương 1: Phế sài trỗi dậy. Gió đêm vi vu thổi qua rèm cửa.',
        })
      );
    });
  });

  describe('qaCritique', () => {
    it('returns 400 when missing sourceText or translatedText', async () => {
      const req = { body: { sourceText: 'abc' } } as any;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;

      await qaCritique(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('detects translation QA critique issues', async () => {
      const mockGenerate = vi.mocked(geminiService.generateWithRotation);
      mockGenerate.mockResolvedValueOnce({
        text: JSON.stringify({
          issues: [
            {
              type: 'MISSING_CONTENT',
              severity: 'HIGH',
              description: 'Thiếu dịch đoạn văn cuối.',
              sourceSnippet: '萧炎站起身来。',
            },
          ],
          score: 85,
        }),
        successKeyIndex: 0,
      });

      const req = {
        body: {
          sourceText: '萧炎站起身来。',
          translatedText: 'Tiêu Viêm.',
          apiKeys: ['test-key'],
          model: 'gemini-2.5-flash',
        },
      } as any;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;

      await qaCritique(req, res);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          issues: expect.arrayContaining([
            expect.objectContaining({ type: 'MISSING_CONTENT' }),
          ]),
        })
      );
    });
  });
});
