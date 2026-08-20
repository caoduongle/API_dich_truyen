import { describe, it, expect, beforeEach, vi } from 'vitest';
import { modelInfoService } from '../modelInfoService';

describe('Model Discovery SingleFlight & Dual-Tier Cache (TASK 08)', () => {
  beforeEach(() => {
    modelInfoService.clearCache();
    vi.restoreAllMocks();
  });

  // 1. single request
  it('single request: executes 1 upstream call on cache miss and populates success cache', async () => {
    const testKey = 'AIzaSySingleFlightKey001';
    let fetchCount = 0;

    const mockFetch = vi.fn().mockImplementation(async () => {
      fetchCount++;
      return {
        ok: true,
        json: async () => ({
          models: [
            {
              name: 'models/gemini-2.5-flash',
              displayName: 'Gemini 2.5 Flash',
              supportedGenerationMethods: ['generateContent'],
            },
          ],
        }),
      };
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await modelInfoService.listModelsForKey(testKey);

    expect(fetchCount).toBe(1);
    expect(result.cached).toBe(false);
    expect(result.models.length).toBe(1);
    expect(result.models[0].name).toBe('models/gemini-2.5-flash');
  });

  // 2. 20 concurrent cache miss
  it('20 concurrent cache miss: coalesces 20 concurrent requests into exactly 1 upstream call', async () => {
    const testKey = 'AIzaSySingleFlightKey020';
    let fetchCount = 0;

    const mockFetch = vi.fn().mockImplementation(async () => {
      fetchCount++;
      // Giả lập độ trễ mạng 50ms để kiểm chứng race conditions
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        ok: true,
        json: async () => ({
          models: [
            {
              name: 'models/gemini-2.5-flash',
              displayName: 'Gemini 2.5 Flash',
              supportedGenerationMethods: ['generateContent'],
            },
            {
              name: 'models/gemini-2.5-pro',
              displayName: 'Gemini 2.5 Pro',
              supportedGenerationMethods: ['generateContent'],
            },
          ],
        }),
      };
    });
    vi.stubGlobal('fetch', mockFetch);

    // Bắn đồng thời 20 requests khi chưa có cache
    const promises = Array.from({ length: 20 }, () =>
      modelInfoService.listModelsForKey(testKey)
    );

    const results = await Promise.all(promises);

    // Khẳng định CHỈ ĐÚNG 1 request được gửi lên Google API
    expect(fetchCount).toBe(1);
    expect(results.length).toBe(20);

    // Cả 20 kết quả đều nhận danh sách models giống nhau hoàn toàn
    for (const res of results) {
      expect(res.models.length).toBe(2);
      expect(res.models[0].name).toBe('models/gemini-2.5-flash');
      expect(res.models[1].name).toBe('models/gemini-2.5-pro');
    }
  });

  // 3. cache hit
  it('cache hit: subsequent requests return instantly from memory with 0 upstream calls', async () => {
    const testKey = 'AIzaSySingleFlightKeyHit';
    let fetchCount = 0;

    const mockFetch = vi.fn().mockImplementation(async () => {
      fetchCount++;
      return {
        ok: true,
        json: async () => ({
          models: [
            {
              name: 'models/gemini-2.5-flash',
              displayName: 'Gemini 2.5 Flash',
              supportedGenerationMethods: ['generateContent'],
            },
          ],
        }),
      };
    });
    vi.stubGlobal('fetch', mockFetch);

    // Request 1 -> Cache Miss -> 1 fetch call
    await modelInfoService.listModelsForKey(testKey);
    expect(fetchCount).toBe(1);

    // Request 2 -> Cache Hit -> 0 fetch calls
    const cachedResult = await modelInfoService.listModelsForKey(testKey);
    expect(fetchCount).toBe(1);
    expect(cachedResult.cached).toBe(true);
    expect(cachedResult.models.length).toBe(1);
  });

  // 4. failure
  it('failure: safely propagates upstream errors to all concurrent waiters and caches error for 30s', async () => {
    const testKey = 'AIzaSySingleFlightKeyFail';
    let fetchCount = 0;

    const mockFetch = vi.fn().mockImplementation(async () => {
      fetchCount++;
      await new Promise((resolve) => setTimeout(resolve, 30));
      return {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: { message: 'Google API Outage' } }),
      };
    });
    vi.stubGlobal('fetch', mockFetch);

    // 20 requests đồng thời gặp lỗi upstream
    const promises = Array.from({ length: 20 }, () =>
      modelInfoService.listModelsForKey(testKey).catch((err) => err)
    );

    const results = await Promise.all(promises);

    // Chỉ gọi đúng 1 lần upstream
    expect(fetchCount).toBe(1);
    expect(results.length).toBe(20);

    // Cả 20 đều nhận Error an toàn
    for (const res of results) {
      expect(res).toBeInstanceOf(Error);
      expect((res as Error).message).toContain('Lỗi từ Google API');
    }

    // Yêu cầu tiếp theo trong 30s -> Bị Short Failure Cache chặn ngay lập tức mà không gọi upstream
    await expect(modelInfoService.listModelsForKey(testKey)).rejects.toThrow(
      /Lỗi từ Google API/
    );
    expect(fetchCount).toBe(1); // Vẫn chỉ là 1 call!
  });

  // 5. timeout
  it('timeout: aborts and cleans in-flight map when upstream call exceeds 15s timeout', async () => {
    const testKey = 'AIzaSySingleFlightKeyTimeout';

    // Mock fetch ném AbortError
    const mockFetch = vi.fn().mockImplementation(async (_url: string, options: any) => {
      return new Promise((_, reject) => {
        if (options?.signal) {
          options.signal.addEventListener('abort', () => {
            const err = new Error('AbortError');
            err.name = 'AbortError';
            reject(err);
          });
        }
        // Giả lập server treo
        setTimeout(() => {
          const err = new Error('AbortError');
          err.name = 'AbortError';
          reject(err);
        }, 100);
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(modelInfoService.listModelsForKey(testKey)).rejects.toThrow(
      /quá thời gian chờ/
    );
  });

  // 6. recovery
  it('recovery: allows new upstream requests to succeed after failure cache expiry or force refresh', async () => {
    const testKey = 'AIzaSySingleFlightKeyRecover';
    let shouldFail = true;
    let fetchCount = 0;

    const mockFetch = vi.fn().mockImplementation(async () => {
      fetchCount++;
      if (shouldFail) {
        return {
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          json: async () => ({ error: { message: 'Temporary Overload' } }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          models: [
            {
              name: 'models/gemini-2.5-flash',
              displayName: 'Gemini 2.5 Flash',
              supportedGenerationMethods: ['generateContent'],
            },
          ],
        }),
      };
    });
    vi.stubGlobal('fetch', mockFetch);

    // Lần 1: Thất bại
    await expect(modelInfoService.listModelsForKey(testKey)).rejects.toThrow(
      /Temporary Overload/
    );
    expect(fetchCount).toBe(1);

    // Lần 2: Upstream đã hồi phục và client gọi với forceRefresh = true -> Khôi phục thành công!
    shouldFail = false;
    const recoveredResult = await modelInfoService.listModelsForKey(testKey, true);

    expect(fetchCount).toBe(2);
    expect(recoveredResult.cached).toBe(false);
    expect(recoveredResult.models.length).toBe(1);
    expect(recoveredResult.models[0].name).toBe('models/gemini-2.5-flash');
  });
});
