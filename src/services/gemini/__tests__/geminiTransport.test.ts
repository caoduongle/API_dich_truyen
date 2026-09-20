import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeGeminiFetch, formatGeminiNetworkError } from '../geminiTransport';

describe('src/services/gemini/geminiTransport.ts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatGeminiNetworkError', () => {
    it('formats TypeError or Failed to fetch into user-friendly CSP / network error', () => {
      const typeError = new TypeError('Failed to fetch');
      const formatted = formatGeminiNetworkError(typeError);
      expect(formatted.message).toContain('Không thể kết nối đến Gemini API (Vui lòng kiểm tra kết nối mạng hoặc chính sách CSP).');
    });

    it('formats SecurityError into user-friendly CSP / network error', () => {
      const secError = new Error('SecurityError: blocked by Content Security Policy');
      const formatted = formatGeminiNetworkError(secError);
      expect(formatted.message).toContain('Không thể kết nối đến Gemini API (Vui lòng kiểm tra kết nối mạng hoặc chính sách CSP).');
    });

    it('preserves other standard errors', () => {
      const customError = new Error('Some internal processing error');
      const formatted = formatGeminiNetworkError(customError);
      expect(formatted.message).toBe('Some internal processing error');
    });
  });

  describe('executeGeminiFetch (T012 & T013)', () => {
    it('sends POST request with x-goog-api-key and stringified payload', async () => {
      const mockResponse = new Response(JSON.stringify({ candidates: [] }), { status: 200 });
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

      const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
      const apiKey = 'TEST_GEMINI_KEY';
      const payload = { contents: [{ parts: [{ text: 'Hello' }] }] };

      const res = await executeGeminiFetch(url, apiKey, payload);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe(url);
      expect(calledInit?.method).toBe('POST');
      expect((calledInit?.headers as Record<string, string>)['x-goog-api-key']).toBe(apiKey);
      expect((calledInit?.headers as Record<string, string>)['Content-Type']).toBe('application/json');
      expect(calledInit?.body).toBe(JSON.stringify(payload));
      expect(res).toBe(mockResponse);
    });

    it('aborts and throws TimeoutError when request exceeds timeoutMs ceiling', async () => {
      vi.useFakeTimers();

      // Mock fetch that hangs until aborted
      vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The user aborted a request.', 'AbortError'));
          });
        });
      });

      const fetchPromise = executeGeminiFetch(
        'https://example.com/api',
        'TEST_KEY',
        { test: 1 },
        undefined,
        5000 // 5 seconds timeout
      );

      // Advance clock past the 5s timeout
      vi.advanceTimersByTime(5001);

      await expect(fetchPromise).rejects.toThrow(/Yêu cầu tới Gemini API đã quá thời gian chờ \(5s\)/);
    });

    it('chains caller AbortSignal and aborts when caller cancels in-flight', async () => {
      const callerController = new AbortController();

      vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted by caller', 'AbortError'));
          });
        });
      });

      const fetchPromise = executeGeminiFetch(
        'https://example.com/api',
        'TEST_KEY',
        { test: 1 },
        callerController.signal
      );

      // Caller cancels while in-flight
      callerController.abort(new DOMException('User cancelled operation', 'AbortError'));

      await expect(fetchPromise).rejects.toThrow();
    });

    it('immediately aborts if caller signal was already aborted', async () => {
      const callerController = new AbortController();
      callerController.abort();

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
        if (init?.signal?.aborted) {
          return Promise.reject(new DOMException('Aborted immediately', 'AbortError'));
        }
        return Promise.resolve(new Response('{}'));
      });

      await expect(
        executeGeminiFetch('https://example.com', 'KEY', {}, callerController.signal)
      ).rejects.toThrow();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('cleans up timeout timer and abort listener upon successful response', async () => {
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
      const callerController = new AbortController();
      const removeListenerSpy = vi.spyOn(callerController.signal, 'removeEventListener');

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));

      await executeGeminiFetch('https://example.com', 'KEY', {}, callerController.signal, 10000);

      expect(clearTimeoutSpy).toHaveBeenCalled();
      expect(removeListenerSpy).toHaveBeenCalledWith('abort', expect.any(Function));
    });
  });
});
