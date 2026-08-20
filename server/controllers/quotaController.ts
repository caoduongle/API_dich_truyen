import { Request, Response } from 'express';
import { quotaService, getDayInLosAngeles, hashApiKey, maskApiKey } from '../services/quotaService';
import { getKeyRuntimeStatus } from '../services/geminiService';
import { modelInfoService } from '../services/modelInfoService';
import { Logger } from '../utils/logger';

const logger = new Logger('QuotaController');

/**
 * Lấy snapshot trạng thái Quota & Mức sử dụng thời gian thực
 * Endpoint: POST /api/quota-status
 */
export async function getQuotaStatusHandler(req: Request, res: Response): Promise<void> {
  try {
    const apiKeys: string[] = Array.isArray(req.body?.apiKeys) ? req.body.apiKeys : [];

    // Ensure groups exist for keys
    for (const key of apiKeys) {
      if (typeof key === 'string' && key.trim()) {
        quotaService.ensureKeyGroup(key);
      }
    }

    const snapshots = quotaService.getQuotaSnapshot(apiKeys);
    const keysWithRuntime = snapshots.map((snapshot, index) => {
      const key = apiKeys[index] || '';
      const runtime = getKeyRuntimeStatus(key);
      return {
        ...snapshot,
        index,
        runtime,
      };
    });

    const activeGroups = quotaService.getAllQuotaGroups();
    const groupsResponse = activeGroups.map(group => {
      const groupKeys = group.keyIds.map((keyId: string) => {
        const matchingSnapshot = keysWithRuntime.find((k: any) => k.keyHash === hashApiKey(keyId) || k.keyHash === keyId);
        if (matchingSnapshot) return matchingSnapshot;
        const health = quotaService.getKeyHealth(keyId);
        return {
          keyHash: hashApiKey(keyId),
          maskedKey: maskApiKey(keyId),
          healthState: health.state,
          transitionReason: health.transitionReason,
          circuitBreakerState: health.circuitBreaker,
          cooldownRemainingMs: health.cooldownRemainingMs,
          providerAttemptsTotal: 0,
          providerAttemptsToday: 0,
          providerAttemptsThisMinute: 0,
          requestsTotal: 0,
          requestsToday: 0,
          requestsThisMinute: 0,
          errorsTotal: 0,
          consecutiveErrors: 0,
          quotaEventsTotal: 0,
          cooldownEventsTotal: 0,
          tokensTotal: 0,
          tokensToday: 0,
          tokensThisMinute: 0,
          byModel: {},
        };
      });

      return {
        id: group.id,
        projectId: group.projectId,
        name: group.name,
        healthState: group.healthState,
        configuredLimits: group.configuredLimits,
        providerQuota: group.providerQuota,
        observedUsage: group.observedUsage,
        schedulingHint: group.schedulingHint,
        cooldownRemainingMs: Math.max(0, group.cooldownUntilMs - Date.now()),
        keys: groupKeys,
      };
    });

    const summary = quotaService.getLogicalSummary();
    const scheduler = quotaService.getSchedulerTelemetry();
    const byModel = quotaService.getAggregatedModelStats();
    const recentAttempts = quotaService.getRecentAttempts(20);

    res.json({
      timestamp: new Date().toISOString(),
      timezone: 'America/Los_Angeles',
      currentDayPST: getDayInLosAngeles(),
      summary,
      scheduler,
      byModel,
      recentAttempts,
      groups: groupsResponse,
      keys: keysWithRuntime,
    });
  } catch (err: any) {
    logger.error('[quotaController] Lỗi khi lấy trạng thái quota:', err);
    res.status(500).json({
      error: 'Không thể lấy thông tin trạng thái hạn ngạch lúc này.',
    });
  }
}

/**
 * Cấu hình / cập nhật các Quota Group
 * Endpoint: POST /api/quota-groups/configure
 */
export async function configureQuotaGroupsHandler(req: Request, res: Response): Promise<void> {
  try {
    const groups = Array.isArray(req.body?.groups) ? req.body.groups : [];
    const updatedGroups = [];

    for (const grpInput of groups) {
      if (grpInput && typeof grpInput === 'object') {
        const updated = quotaService.registerQuotaGroup(grpInput);
        updatedGroups.push(updated);
      }
    }

    res.json({
      status: 'success',
      updatedGroupsCount: updatedGroups.length,
      groups: updatedGroups.map(g => ({
        id: g.id,
        configuredLimits: g.configuredLimits,
        schedulingHint: g.schedulingHint,
      })),
    });
  } catch (err: any) {
    logger.error('[quotaController] Lỗi khi cấu hình quota group:', err);
    res.status(500).json({
      error: 'Không thể cập nhật cấu hình quota group.',
    });
  }
}

/**
 * Tra cứu danh sách model hỗ trợ thực tế cho 1 API key theo index
 * Endpoint: POST /api/models-for-key
 */
export async function getModelsForKeyHandler(req: Request, res: Response): Promise<void> {
  try {
    const apiKeys: string[] = Array.isArray(req.body?.apiKeys) ? req.body.apiKeys : [];
    const { keyIndex, forceRefresh } = req.body || {};

    if (typeof keyIndex !== 'number' || keyIndex < 0 || keyIndex >= apiKeys.length) {
      res.status(400).json({
        error: `Chỉ mục khóa không hợp lệ (keyIndex: ${keyIndex}). Danh sách có ${apiKeys.length} khóa.`,
      });
      return;
    }

    const targetKey = apiKeys[keyIndex];

    const result = await modelInfoService.listModelsForKey(targetKey, Boolean(forceRefresh));

    res.json(result);

  } catch (err: any) {
    logger.error('[quotaController] Lỗi khi tra cứu model cho khóa:', err.message || err);
    res.status(500).json({
      error: err.message || 'Lỗi khi tra cứu danh sách mô hình từ nhà cung cấp.',
    });
  }
}

/**
 * Xác minh 1 model ID cụ thể có tồn tại và hỗ trợ dịch thuật
 * Endpoint: POST /api/verify-model
 */
export async function verifyModelHandler(req: Request, res: Response): Promise<void> {
  try {
    const { modelId, label } = req.body || {};
    const apiKeys: string[] = Array.isArray(req.body?.apiKeys) ? req.body.apiKeys : [];

    if (!modelId || typeof modelId !== 'string' || !modelId.trim()) {
      res.status(400).json({
        success: false,
        verified: false,
        error: 'Vui lòng cung cấp mã định danh mô hình (modelId).',
        errorCode: 'INVALID_FORMAT',
        checkedAt: new Date().toISOString(),
      });
      return;
    }

    const primaryKey = apiKeys.find((k: string) => typeof k === 'string' && k.trim().length > 0);

    const verifiedModel = await modelInfoService.verifySingleModel(modelId, primaryKey, label);

    res.json({
      success: true,
      verified: true,
      model: verifiedModel,
      checkedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.warn('[quotaController] Xác minh mô hình thất bại:', err.message || err);
    res.status(400).json({
      success: false,
      verified: false,
      error: err.message || 'Không thể xác minh mô hình từ nhà cung cấp.',
      errorCode: err.message?.includes('generateContent') ? 'UNSUPPORTED_METHODS' : 'MODEL_NOT_FOUND',
      checkedAt: new Date().toISOString(),
    });
  }
}
