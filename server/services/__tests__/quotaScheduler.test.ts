import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { quotaService } from '../quotaService';

describe('Single Scheduler Authority & Pacing Isolation (TASK 03)', () => {
  beforeEach(() => {
    quotaService.resetAll();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1. group pacing
  it('group pacing: paces sequential requests strictly according to group scheduling hint', () => {
    const key1 = 'AIzaSyGroupPacingKey1';
    const now = 1000000;

    quotaService.registerQuotaGroup({
      id: 'group_pacing_test',
      configuredRpm: 30, // interval = ceil(60000 / 27) = 2223ms
      keyIds: [key1],
    });

    // Request 1: Immediate execution
    const lease1 = quotaService.scheduleAttempt([key1], 'gemini-2.5-flash', 2000, now);
    expect(lease1.isEligible).toBe(true);
    expect(lease1.selectedGroupId).toBe('group_pacing_test');
    expect(lease1.selectedKey).toBe(key1);
    expect(lease1.delayMs).toBe(0);
    expect(lease1.effectiveIntervalMs).toBe(2223);

    // Request 2: Arrives at same time (now) -> Must be delayed by exactly 2223ms
    const lease2 = quotaService.scheduleAttempt([key1], 'gemini-2.5-flash', 2000, now);
    expect(lease2.isEligible).toBe(true);
    expect(lease2.delayMs).toBe(2223);

    // Request 3: Arrives 1000ms later (T + 1000) -> Must wait remaining (2223 * 2 - 1000) = 3446ms
    const lease3 = quotaService.scheduleAttempt([key1], 'gemini-2.5-flash', 2000, now + 1000);
    expect(lease3.isEligible).toBe(true);
    expect(lease3.delayMs).toBe(4446 - 1000); // 3446ms
  });

  // 2. multiple keys same group
  it('multiple keys same group: shares single group pacing clock across multiple keys', () => {
    const key1 = 'AIzaSyMultiKeyA';
    const key2 = 'AIzaSyMultiKeyB';
    const now = 1000000;

    // 2 keys belong to the same project / QuotaGroup
    const group = quotaService.registerQuotaGroup({
      id: 'group_shared_clock',
      configuredRpm: 15, // interval = ceil(60000 / 13.5) = 4445ms
      keyIds: [key1, key2],
    });

    // Request 1 uses key1
    const lease1 = quotaService.scheduleAttempt([key1, key2], 'gemini-2.5-flash', 2000, now);
    expect(lease1.isEligible).toBe(true);
    expect(lease1.delayMs).toBe(0);

    // Request 2 uses key2 in the same group at T+500ms
    // Since both keys share the same group clock, Request 2 CANNOT bypass the group interval!
    const lease2 = quotaService.scheduleAttempt([key1, key2], 'gemini-2.5-flash', 2000, now + 500);
    expect(lease2.isEligible).toBe(true);
    expect(lease2.delayMs).toBe(4445 - 500); // 3945ms
  });

  // 3. multiple groups
  it('multiple groups: executes independent groups concurrently with zero delay', () => {
    const keyA = 'AIzaSyProjectA_Key';
    const keyB = 'AIzaSyProjectB_Key';
    const now = 1000000;

    // Group A (Project 1)
    quotaService.registerQuotaGroup({
      id: 'group_project_a',
      projectId: 'proj-a',
      configuredRpm: 15,
      keyIds: [keyA],
    });

    // Group B (Project 2)
    quotaService.registerQuotaGroup({
      id: 'group_project_b',
      projectId: 'proj-b',
      configuredRpm: 15,
      keyIds: [keyB],
    });

    // Request to Group A: Takes slot at T -> nextAllowed = T + 4445
    const leaseA = quotaService.scheduleAttempt([keyA], 'gemini-2.5-flash', 2000, now);
    expect(leaseA.isEligible).toBe(true);
    expect(leaseA.selectedGroupId).toBe('group_project_a');
    expect(leaseA.delayMs).toBe(0);

    // Request to Group B at the same timestamp: Must NOT wait for Group A!
    const leaseB = quotaService.scheduleAttempt([keyB], 'gemini-2.5-flash', 2000, now);
    expect(leaseB.isEligible).toBe(true);
    expect(leaseB.selectedGroupId).toBe('group_project_b');
    expect(leaseB.delayMs).toBe(0);
  });

  // 4. parallel requests
  it('parallel requests: atomically schedules concurrent requests with incremental delays', () => {
    const key1 = 'AIzaSyParallelKey';
    const now = 1000000;

    quotaService.registerQuotaGroup({
      id: 'group_parallel_test',
      configuredRpm: 60, // interval = ceil(60000 / 54) = 1112ms
      keyIds: [key1],
    });

    // Simulate 5 simultaneous requests arriving at the exact same millisecond
    const lease1 = quotaService.scheduleAttempt([key1], 'gemini-2.5-flash', 2000, now);
    const lease2 = quotaService.scheduleAttempt([key1], 'gemini-2.5-flash', 2000, now);
    const lease3 = quotaService.scheduleAttempt([key1], 'gemini-2.5-flash', 2000, now);
    const lease4 = quotaService.scheduleAttempt([key1], 'gemini-2.5-flash', 2000, now);
    const lease5 = quotaService.scheduleAttempt([key1], 'gemini-2.5-flash', 2000, now);

    expect(lease1.delayMs).toBe(0);
    expect(lease2.delayMs).toBe(1112);
    expect(lease3.delayMs).toBe(2224);
    expect(lease4.delayMs).toBe(3336);
    expect(lease5.delayMs).toBe(4448);
  });

  // 5. no double sleep
  it('no double sleep: single authority decision provides authoritative delay without redundant clocks', () => {
    const key = 'AIzaSySingleAuthorityKey';
    const now = 1000000;

    quotaService.registerQuotaGroup({
      id: 'group_single_auth',
      configuredRpm: 15,
      keyIds: [key],
    });

    // Schedule attempt
    const lease = quotaService.scheduleAttempt([key], 'gemini-2.5-flash', 2000, now);
    expect(lease.isEligible).toBe(true);
    expect(lease.delayMs).toBe(0);

    // Subsequent request at T+1000
    const leaseNext = quotaService.scheduleAttempt([key], 'gemini-2.5-flash', 2000, now + 1000);
    expect(leaseNext.isEligible).toBe(true);
    expect(leaseNext.delayMs).toBe(3445);

    // Verify lease contract contains all necessary execution metadata so executor doesn't need its own clock
    expect(leaseNext.selectedGroupId).toBe('group_single_auth');
    expect(leaseNext.selectedKey).toBe(key);
    expect(leaseNext.effectiveIntervalMs).toBe(4445);
  });
});
