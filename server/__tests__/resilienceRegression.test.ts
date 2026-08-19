import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { redactApiKey } from '../utils/text';
import { quotaService } from '../services/quotaService';
import { PACING_SAFETY_FLOOR_SERVER_MS, PACING_SAFETY_FLOOR_CLIENT_MS } from '@shared/models';
import { getDynamicPacingInterval } from '../../src/utils/modelRegistry';

describe('Architecture & Resilience Regression Suite', () => {
  beforeEach(() => {
    quotaService.resetAll();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Invariant 1: Secret Redaction in Logs & Error Messages', () => {
    it('redacts plaintext API keys from raw exception traces', () => {
      const secretKey = 'AIzaSySecretKey9876543210';
      const rawError = `Failed to generate content: https://generativelanguage.googleapis.com/v1beta/models?key=${secretKey} returned 400`;

      const sanitized = redactApiKey(rawError, [secretKey]);
      expect(sanitized).not.toContain(secretKey);
      expect(sanitized).toContain('***REDACTED***');
    });
  });


  describe('Invariant 2: Dynamic Pacing Floors (No Hardcoded 4500ms, Clamped Floor)', () => {
    it('enforces safety floors correctly on server and client', () => {
      expect(PACING_SAFETY_FLOOR_SERVER_MS).toBe(400);
      expect(PACING_SAFETY_FLOOR_CLIENT_MS).toBe(500);

      // Client pacing for high RPM (e.g. 500 RPM) should not go below 500ms
      const highRpmInterval = getDynamicPacingInterval(500);
      expect(highRpmInterval).toBe(500);

      // Free tier RPM (15 RPM) produces ~4546ms
      const freeTierInterval = getDynamicPacingInterval(15);
      expect(freeTierInterval).toBe(4546);
    });
  });

  describe('Invariant 3: Independent Rate Limit Layers', () => {
    it('tracks per-key Gemini token consumption independently of HTTP IP rate limiter', () => {
      const key1 = 'AIzaSyKeyIndependent1';
      const key2 = 'AIzaSyKeyIndependent2';

      quotaService.recordUsage(key1, 'gemini-2.5-flash', 'success', Date.now(), {
        promptTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      });

      const snapshots = quotaService.getQuotaSnapshot([key1, key2]);
      expect(snapshots[0].tokensTotal).toBe(1500);
      expect(snapshots[1].tokensTotal).toBe(0);
    });
  });
});
