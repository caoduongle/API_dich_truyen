import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  apiFetch,
  getSessionToken,
  setSessionToken,
  registerSessionSyncCallback,
  syncSessionKeysToServer,
} from '../apiClient';

describe('apiClient', () => {
  const originalFetch = global.fetch;
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    const storageMock = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, value: string) => { mockStorage[key] = value; },
      removeItem: (key: string) => { delete mockStorage[key]; },
      clear: () => { mockStorage = {}; },
    };
    (global as any).localStorage = storageMock;
    setSessionToken(null);
    registerSessionSyncCallback(() => Promise.resolve(null));
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should store and retrieve session token from localStorage', () => {
    expect(getSessionToken()).toBeNull();
    setSessionToken('test-token-123');
    expect(getSessionToken()).toBe('test-token-123');
    expect(localStorage.getItem('gemini_session_token')).toBe('test-token-123');

    setSessionToken(null);
    expect(getSessionToken()).toBeNull();
    expect(localStorage.getItem('gemini_session_token')).toBeNull();
  });

  it('should sync keys to server via POST /api/session-keys and save token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ sessionToken: 'mock-uuid-456', keyCount: 2 }),
    });
    global.fetch = fetchMock;

    const token = await syncSessionKeysToServer(['AIzaSyKey1', 'AIzaSyKey2']);
    expect(token).toBe('mock-uuid-456');
    expect(getSessionToken()).toBe('mock-uuid-456');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/session-keys',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ apiKeys: ['AIzaSyKey1', 'AIzaSyKey2'] }),
      })
    );
  });

  it('should remove session on server when empty keys provided', async () => {
    setSessionToken('active-token-789');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });
    global.fetch = fetchMock;

    const token = await syncSessionKeysToServer([]);
    expect(token).toBeNull();
    expect(getSessionToken()).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/session-keys',
      expect.objectContaining({
        method: 'DELETE',
        headers: { 'X-Session-Token': 'active-token-789' },
      })
    );
  });

  describe('apiFetch', () => {
    it('should attach X-Session-Token header and remove raw apiKeys from JSON body', async () => {
      setSessionToken('token-abc');

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });
      global.fetch = fetchMock;

      await apiFetch('/api/translate-raw', {
        method: 'POST',
        body: JSON.stringify({
          text: '你好世界',
          genre: 'Tiên Hiệp',
          apiKeys: ['AIzaSySecret1', 'AIzaSySecret2'],
        }),
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const callArgs = fetchMock.mock.calls[0];
      const headers = callArgs[1].headers;
      const body = JSON.parse(callArgs[1].body);

      // Verify token is in header
      expect(headers.get('X-Session-Token')).toBe('token-abc');

      // Verify apiKeys is completely omitted from body payload
      expect(body.apiKeys).toBeUndefined();
      expect(body.text).toBe('你好世界');
      expect(body.genre).toBe('Tiên Hiệp');
    });

    it('should automatically re-sync session and retry on 401 sessionExpired', async () => {
      setSessionToken('expired-token');

      const syncCallback = vi.fn().mockResolvedValue('new-fresh-token');
      registerSessionSyncCallback(syncCallback);

      // First call returns 401 with sessionExpired, second call returns 200
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          clone: () => ({
            json: () => Promise.resolve({ error: 'Session expired', sessionExpired: true }),
          }),
          json: () => Promise.resolve({ error: 'Session expired', sessionExpired: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ result: 'translated text' }),
        });

      global.fetch = fetchMock;

      const res = await apiFetch('/api/translate-raw', {
        method: 'POST',
        body: JSON.stringify({ text: '测试' }),
      });

      expect(syncCallback).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);

      // Second request should use the new token
      const secondCallHeaders = fetchMock.mock.calls[1][1].headers;
      expect(secondCallHeaders.get('X-Session-Token')).toBe('new-fresh-token');
      expect(res.status).toBe(200);
    });
  });
});
