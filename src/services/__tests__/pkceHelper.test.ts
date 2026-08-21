import { describe, it, expect } from 'vitest';
import { generateCodeVerifier, generateCodeChallenge, generateRandomState, generatePKCEChallenge } from '../pkceHelper';

describe('pkceHelper Web Crypto PKCE generator', () => {
  it('generates a high-entropy code_verifier between 43 and 128 chars', () => {
    const verifier = generateCodeVerifier();
    expect(typeof verifier).toBe('string');
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
    // Verifier must only contain unreserved URL characters [A-Za-z0-9-._~]
    expect(/^[A-Za-z0-9\-._~]+$/.test(verifier)).toBe(true);
  });

  it('generates a valid SHA-256 base64url code_challenge from a verifier', async () => {
    const verifier = 'test_code_verifier_1234567890_abcdefghij_klmnopqrstuvwxyz';
    const challenge = await generateCodeChallenge(verifier);
    expect(typeof challenge).toBe('string');
    expect(challenge.length).toBeGreaterThan(20);
    // Base64URL cannot contain '+', '/', or '='
    expect(challenge).not.toContain('+');
    expect(challenge).not.toContain('/');
    expect(challenge).not.toContain('=');
  });

  it('generates deterministic challenge for the same verifier', async () => {
    const verifier = 'fixed_verifier_sample_1234567890_unreserved';
    const c1 = await generateCodeChallenge(verifier);
    const c2 = await generateCodeChallenge(verifier);
    expect(c1).toBe(c2);
  });

  it('generates a full PKCE Challenge object with state', async () => {
    const pkce = await generatePKCEChallenge();
    expect(pkce.codeVerifier).toBeDefined();
    expect(pkce.codeChallenge).toBeDefined();
    expect(pkce.state).toBeDefined();
    expect(pkce.state.length).toBeGreaterThanOrEqual(16);
  });
});
