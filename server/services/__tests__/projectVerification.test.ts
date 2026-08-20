import { describe, it, expect, beforeEach } from 'vitest';
import { quotaService } from '../quotaService';

describe('Project ID Verification & Quota Bucket Semantics (TASK 11)', () => {
  const key1 = 'AIzaSyProjectKeyAlpha111';
  const key2 = 'AIzaSyProjectKeyBeta222';
  const key3 = 'AIzaSyProjectKeyGamma333';

  beforeEach(() => {
    quotaService.resetAll();
  });

  // 1. same declared project
  it('same declared project: records source=user, status=declared and isolates buckets unless explicit group', () => {
    // 2 keys đăng ký riêng lẻ với cùng một userDeclaredProject string
    const grp1 = quotaService.registerQuotaGroup({
      id: 'grp_user_1',
      projectId: 'my-declared-project',
      keyIds: [key1],
    });

    const grp2 = quotaService.registerQuotaGroup({
      id: 'grp_user_2',
      projectId: 'my-declared-project',
      keyIds: [key2],
    });

    expect(grp1.projectMetadata).toEqual({
      projectId: 'my-declared-project',
      source: 'user',
      status: 'declared',
    });

    expect(grp2.projectMetadata).toEqual({
      projectId: 'my-declared-project',
      source: 'user',
      status: 'declared',
    });

    // Scheduler Invariant: Vì chỉ là userDeclaredProject ở 2 groups riêng biệt,
    // hệ thống KHÔNG tự ý coi là Same Provider Quota Bucket
    const inSameBucket = quotaService.areKeysInSameVerifiedBucket(key1, key2);
    expect(inSameBucket).toBe(false);

    // Nếu user explicitly gom 2 keys vào cùng 1 group:
    const explicitGrp = quotaService.registerQuotaGroup({
      id: 'grp_explicit_shared',
      projectId: 'my-declared-project',
      keyIds: [key1, key2],
    });
    expect(quotaService.areKeysInSameVerifiedBucket(key1, key2)).toBe(true);
    expect(explicitGrp.keyIds).toContain(key1);
    expect(explicitGrp.keyIds).toContain(key2);
  });

  // 2. different declared project
  it('different declared project: assigns to distinct quota groups with respective metadata', () => {
    const grpA = quotaService.registerQuotaGroup({
      id: 'grp_prj_a',
      projectId: 'project-alpha',
      keyIds: [key1],
    });

    const grpB = quotaService.registerQuotaGroup({
      id: 'grp_prj_b',
      projectId: 'project-beta',
      keyIds: [key2],
    });

    expect(grpA.projectMetadata?.projectId).toBe('project-alpha');
    expect(grpA.projectMetadata?.source).toBe('user');
    expect(grpA.projectMetadata?.status).toBe('declared');

    expect(grpB.projectMetadata?.projectId).toBe('project-beta');
    expect(grpB.projectMetadata?.source).toBe('user');
    expect(grpB.projectMetadata?.status).toBe('declared');

    expect(quotaService.areKeysInSameVerifiedBucket(key1, key2)).toBe(false);
  });

  // 3. provider verified project
  it('provider verified project: records source=provider, status=verified and guarantees same quota bucket', () => {
    const grp1 = quotaService.registerQuotaGroup({
      id: 'grp_auto_1',
      keyIds: [key1],
    });

    const grp2 = quotaService.registerQuotaGroup({
      id: 'grp_auto_2',
      keyIds: [key2],
    });

    // Ban đầu chưa verify -> không cùng bucket
    expect(quotaService.areKeysInSameVerifiedBucket(key1, key2)).toBe(false);

    // Xác thực chính thức từ Google provider probe
    const verifiedPrjId = 'gcp-verified-prod-789';
    quotaService.verifyGroupProject(grp1.id, verifiedPrjId);
    quotaService.verifyGroupProject(grp2.id, verifiedPrjId);

    expect(grp1.projectMetadata).toEqual({
      projectId: verifiedPrjId,
      source: 'provider',
      status: 'verified',
      verifiedAtMs: expect.any(Number),
    });

    expect(grp2.projectMetadata).toEqual({
      projectId: verifiedPrjId,
      source: 'provider',
      status: 'verified',
      verifiedAtMs: expect.any(Number),
    });

    // Scheduler Invariant: Khi cả 2 đã được provider verified với cùng projectId,
    // hệ thống CHẮC CHẮN bảo đảm chia sẻ cùng Provider Quota Bucket
    expect(quotaService.areKeysInSameVerifiedBucket(key1, key2)).toBe(true);
  });

  // 4. unknown project
  it('unknown project: records source=inferred, status=unknown and isolates safely', () => {
    const grp = quotaService.ensureKeyGroup(key3);

    expect(grp.projectMetadata).toBeDefined();
    expect(grp.projectMetadata?.source).toBe('inferred');
    expect(grp.projectMetadata?.status).toBe('unknown');
    expect(grp.projectMetadata?.projectId).toBeUndefined();

    // Isolated from key1
    expect(quotaService.areKeysInSameVerifiedBucket(key3, key1)).toBe(false);
  });
});
