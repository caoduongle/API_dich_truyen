import { Request, Response } from 'express';
import { quotaService, getDayInLosAngeles } from '../services/quotaService';
import { getKeyRuntimeStatus } from '../services/geminiService';
import { modelInfoService } from '../services/modelInfoService';

/**
 * Lấy snapshot trạng thái Quota & Mức sử dụng thời gian thực
 * Endpoint: POST /api/quota-status
 */
export async function getQuotaStatusHandler(req: Request, res: Response): Promise<void> {
  try {
    const apiKeys: string[] = Array.isArray(req.body?.apiKeys) ? req.body.apiKeys : [];

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

    res.json({
      timestamp: new Date().toISOString(),
      timezone: 'America/Los_Angeles',
      currentDayPST: getDayInLosAngeles(),
      keys: keysWithRuntime,
    });
  } catch (err: any) {
    console.error('[quotaController] Lỗi khi lấy trạng thái quota:', err);
    res.status(500).json({
      error: 'Không thể lấy thông tin trạng thái hạn ngạch lúc này.',
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
    const { keyIndex } = req.body || {};

    if (typeof keyIndex !== 'number' || keyIndex < 0 || keyIndex >= apiKeys.length) {
      res.status(400).json({
        error: `Chỉ mục khóa không hợp lệ (keyIndex: ${keyIndex}). Danh sách có ${apiKeys.length} khóa.`,
      });
      return;
    }

    const targetKey = apiKeys[keyIndex];
    const result = await modelInfoService.listModelsForKey(targetKey);

    res.json(result);
  } catch (err: any) {
    console.error('[quotaController] Lỗi khi tra cứu model cho khóa:', err.message || err);
    res.status(500).json({
      error: err.message || 'Lỗi khi tra cứu danh sách mô hình từ nhà cung cấp.',
    });
  }
}
