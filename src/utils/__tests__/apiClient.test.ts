import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  apiFetch,
  sha256Hex,
  setGlobalCustomRpm,
  getGlobalCustomRpm,
} from '../apiClient';

describe('apiClient (Zero Backend / Client-Direct)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('sha256Hex', () => {
    it('should compute valid 64-char hex string SHA-256 hash', async () => {
      const hash = await sha256Hex('test-api-key');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('Global Custom RPM', () => {
    it('should store and retrieve custom RPM', () => {
      setGlobalCustomRpm(30);
      expect(getGlobalCustomRpm()).toBe(30);

      setGlobalCustomRpm(null);
      expect(getGlobalCustomRpm()).toBeNull();
    });
  });

  describe('apiFetch', () => {
    it('should strip raw apiKeys from JSON body by default', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });
      global.fetch = fetchMock;

      await apiFetch('/api/test', {
        method: 'POST',
        body: JSON.stringify({
          text: '你好世界',
          genre: 'Tiên Hiệp',
          apiKeys: ['AIzaSySecret1', 'AIzaSySecret2'],
        }),
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const callArgs = fetchMock.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      // Verify apiKeys is completely omitted from body payload
      expect(body.apiKeys).toBeUndefined();
      expect(body.text).toBe('你好世界');
      expect(body.genre).toBe('Tiên Hiệp');
    });

    it('should attach X-Custom-Rpm header when provided', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });
      global.fetch = fetchMock;

      await apiFetch('/api/test', {
        method: 'POST',
        body: JSON.stringify({
          text: 'Hello',
          customRpm: 15,
        }),
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const callArgs = fetchMock.mock.calls[0];
      const headers = callArgs[1].headers;
      expect(headers.get('X-Custom-Rpm')).toBe('15');
    });
  });
});

