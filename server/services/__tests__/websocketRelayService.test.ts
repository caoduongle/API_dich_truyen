import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkIpRateLimit,
  incrementIpConnection,
  decrementIpConnection,
  formatRoomId,
  verifyCollaboratorAccess,
  verifyGoogleAccessToken,
} from '../websocketRelayService';

describe('websocketRelayService (Handshake & Room Management)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('formats roomId consistently with project and chapter identifiers', () => {
    const roomId = formatRoomId('project_abc', 'chapter_123');
    expect(roomId).toBe('project_project_abc_chapter_chapter_123');
  });

  it('enforces per-IP connection limits correctly', () => {
    const testIp = '192.168.1.100';

    // Verify initial allowance
    expect(checkIpRateLimit(testIp, 20)).toBe(true);

    // Simulate opening 20 connections
    for (let i = 0; i < 20; i++) {
      incrementIpConnection(testIp);
    }

    // 21st connection must be rejected
    expect(checkIpRateLimit(testIp, 20)).toBe(false);

    // After closing 1 connection, next connection is allowed
    decrementIpConnection(testIp);
    expect(checkIpRateLimit(testIp, 20)).toBe(true);
  });

  it('verifies collaborator access against project owner and collaborator list', () => {
    const collaborators = [
      { email: 'trans1@gmail.com', role: 'writer' },
      { email: 'editor@gmail.com', role: 'writer' },
    ];

    expect(verifyCollaboratorAccess('trans1@gmail.com', collaborators)).toBe(true);
    expect(verifyCollaboratorAccess('TRANS1@GMAIL.COM', collaborators)).toBe(true);
    expect(verifyCollaboratorAccess('stranger@gmail.com', collaborators)).toBe(false);
    expect(verifyCollaboratorAccess('', collaborators)).toBe(false);
  });

  it('validates Google OAuth token and caches result', async () => {
    const mockUser = { email: 'translator@gmail.com', name: 'Translator User', picture: 'https://example.com/pic.jpg' };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockUser,
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await verifyGoogleAccessToken('valid_token_123');
    expect(result).toEqual({ email: 'translator@gmail.com', name: 'Translator User', picture: 'https://example.com/pic.jpg' });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Second call hits cache
    const cachedResult = await verifyGoogleAccessToken('valid_token_123');
    expect(cachedResult).toEqual({ email: 'translator@gmail.com', name: 'Translator User', picture: 'https://example.com/pic.jpg' });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid or expired Google OAuth tokens', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await verifyGoogleAccessToken('invalid_token_xyz');
    expect(result).toBeNull();
  });

  it('returns null immediately when token is empty', async () => {
    const result = await verifyGoogleAccessToken('');
    expect(result).toBeNull();
  });
});
