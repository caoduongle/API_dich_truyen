import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { quotaService } from '../quotaService';
import { getQuotaStatusHandler, configureQuotaGroupsHandler } from '../../controllers/quotaController';

describe('Quota Group Telemetry & Classification API Contract (TASK 01 / US4)', () => {
  beforeEach(() => {
    quotaService.resetAll();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('verifies /api/quota-status returns structured Quota Group hierarchy and 4-tier data classification', async () => {
    const key1 = 'AIzaSyProject1_KeyA';
    const key2 = 'AIzaSyProject1_KeyB';

    // Register a Quota Group with configured limits
    quotaService.registerQuotaGroup({
      id: 'group_test_telemetry',
      projectId: 'gemini-prod-project',
      name: 'Production Project',
      configuredRpm: 30,
      configuredTpm: 2000000,
      configuredRpd: 5000,
      keyIds: [key1, key2],
    });

    // Record some usage
    quotaService.recordGroupUsage('group_test_telemetry', key1, 'gemini-2.5-flash', 'success', Date.now(), {
      promptTokens: 1500,
      outputTokens: 500,
      totalTokens: 2000,
    });

    let jsonResponse: any = null;
    const req = {
      body: { apiKeys: [key1, key2] },
    } as any;
    const res = {
      json: (data: any) => {
        jsonResponse = data;
      },
      status: vi.fn().mockReturnThis(),
    } as any;

    await getQuotaStatusHandler(req, res);

    expect(jsonResponse).not.toBeNull();
    expect(Array.isArray(jsonResponse.groups)).toBe(true);
    expect(jsonResponse.groups.length).toBeGreaterThanOrEqual(1);

    const group = jsonResponse.groups.find((g: any) => g.id === 'group_test_telemetry');
    expect(group).toBeDefined();

    // 1. providerQuota: isVerified is false by default
    expect(group.providerQuota).toBeDefined();
    expect(group.providerQuota.isVerified).toBe(false);
    expect(group.providerQuota.rpm).toBe(15);

    // 2. configuredLimits: user entered values
    expect(group.configuredLimits).toBeDefined();
    expect(group.configuredLimits.configuredRpm).toBe(30);
    expect(group.configuredLimits.configuredTpm).toBe(2000000);
    expect(group.configuredLimits.configuredRpd).toBe(5000);

    // 3. observedUsage: empirical runtime counts
    expect(group.observedUsage).toBeDefined();
    expect(group.observedUsage.requestsTotal).toBe(1);
    expect(group.observedUsage.tokensTotal).toBe(2000);

    // 4. schedulingHint: derived intervals
    expect(group.schedulingHint).toBeDefined();
    expect(group.schedulingHint.isCustom).toBe(true);
    expect(group.schedulingHint.effectiveIntervalMs).toBe(2223);

    // 5. Nested keys
    expect(Array.isArray(group.keys)).toBe(true);
    expect(group.keys.length).toBe(2);
    expect(group.keys[0].healthState).toBe('Healthy');
  });

  it('configures Quota Groups dynamically via configureQuotaGroupsHandler', async () => {
    let jsonResponse: any = null;
    const req = {
      body: {
        groups: [
          {
            id: 'group_dynamic_1',
            projectId: 'dynamic-proj-1',
            name: 'Dynamic Project 1',
            configuredRpm: 60,
            keyIds: ['AIzaSyDynamicKey1'],
          },
        ],
      },
    } as any;
    const res = {
      json: (data: any) => {
        jsonResponse = data;
      },
      status: vi.fn().mockReturnThis(),
    } as any;

    await configureQuotaGroupsHandler(req, res);

    expect(jsonResponse).not.toBeNull();
    expect(jsonResponse.status).toBe('success');
    expect(jsonResponse.updatedGroupsCount).toBe(1);
    expect(jsonResponse.groups[0].configuredLimits.configuredRpm).toBe(60);
    expect(jsonResponse.groups[0].schedulingHint.effectiveIntervalMs).toBe(1112);
  });
});
