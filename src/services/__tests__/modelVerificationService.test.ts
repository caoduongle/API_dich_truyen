import { describe, it, expect } from 'vitest';
import { sha256Hex } from '../modelVerificationService';

describe('modelVerificationService (Zero Backend / Client-Direct)', () => {
  describe('sha256Hex', () => {
    it('should compute valid 64-char hex string SHA-256 hash', async () => {
      const hash = await sha256Hex('test-api-key');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});
