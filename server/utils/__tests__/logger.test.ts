import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, sanitizeSecretString, sanitizeValue } from '../logger';

describe('Logger secret redaction', () => {
  describe('sanitizeSecretString', () => {
    it('should redact Google AIza API keys in free-form text', () => {
      const text = 'Failed to call upstream with key AIzaSyD12345678901234567890123456789012 in request';
      const clean = sanitizeSecretString(text);
      expect(clean).not.toContain('AIzaSyD12345678901234567890123456789012');
      expect(clean).toContain('AIza***[REDACTED]');
    });

    it('should redact query parameters in URLs (token, key, apikey, password, access_token)', () => {
      const url1 = '/api/session-keys/status?token=secretSessionToken12345&mode=fast';
      expect(sanitizeSecretString(url1)).toBe('/api/session-keys/status?token=[REDACTED]&mode=fast');

      const url2 = '/api/auth/login?password=mySuperSecretPassword!&user=admin';
      expect(sanitizeSecretString(url2)).toBe('/api/auth/login?password=[REDACTED]&user=admin');

      const url3 = '/api/translate?apiKey=AIzaSyD12345678901234567890123456789012&model=gemini-2.5';
      expect(sanitizeSecretString(url3)).toContain('apiKey=[REDACTED]');
    });

    it('should redact Bearer authorization tokens', () => {
      const text = 'Incoming header Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
      const clean = sanitizeSecretString(text);
      expect(clean).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(clean).toContain('Bearer [REDACTED]');
    });

    it('should leave normal non-secret strings intact', () => {
      const text = 'GET /api/health 200 - 15ms';
      expect(sanitizeSecretString(text)).toBe(text);
    });
  });

  describe('sanitizeValue with objects and arrays', () => {
    it('should sanitize nested objects with secret keys', () => {
      const meta = {
        url: '/api/session-keys?token=secret123',
        auth: {
          token: 'verySecretTokenValue',
          apiKey: 'AIzaSyD12345678901234567890123456789012',
          nonSensitive: 'hello'
        }
      };
      const clean = sanitizeValue(meta);
      expect(clean.url).toBe('/api/session-keys?token=[REDACTED]');
      expect(clean.auth.token).toContain('[REDACTED]');
      expect(clean.auth.apiKey).toContain('[REDACTED]');
      expect(clean.auth.nonSensitive).toBe('hello');
    });

    it('should sanitize arrays of strings', () => {
      const arr = [
        'normal string',
        'token=superSecret123',
        'key=AIzaSyD12345678901234567890123456789012'
      ];
      const clean = sanitizeValue(arr);
      expect(clean[0]).toBe('normal string');
      expect(clean[1]).toBe('token=[REDACTED]');
      expect(clean[2]).toContain('[REDACTED]');
    });
  });

  describe('Logger instance output', () => {
    let consoleLogSpy: any;

    beforeEach(() => {
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
    });

    it('should never emit unredacted secrets in message or meta', () => {
      const logger = new Logger('Test');
      logger.info('User accessed /api/session?token=mySensitiveToken999', {
        apiKey: 'AIzaSyD12345678901234567890123456789012',
        url: '/api/test?secret=topSecret'
      });

      expect(consoleLogSpy).toHaveBeenCalled();
      const loggedStr = consoleLogSpy.mock.calls[0][0];
      expect(loggedStr).not.toContain('mySensitiveToken999');
      expect(loggedStr).not.toContain('AIzaSyD12345678901234567890123456789012');
      expect(loggedStr).not.toContain('topSecret');
      expect(loggedStr).toContain('[REDACTED]');
    });
  });
});
