import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkIpRateLimit,
  incrementIpConnection,
  decrementIpConnection,
  formatRoomId,
  verifyCollaboratorAccess,
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
});
