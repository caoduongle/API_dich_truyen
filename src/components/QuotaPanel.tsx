import React, { useState, useEffect, useCallback } from 'react';
import { 
  RotateCw, 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  Cpu, 
  Settings2,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { 
  fetchQuotaStatus, 
  fetchModelsForKey, 
  KeyQuotaFullSnapshot, 
  ModelInfoItem 
} from '../utils/apiClient';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Seal } from './ui/Seal';
import { EmptyState } from './ui/EmptyState';

const CUSTOM_LIMITS_STORAGE_KEY = 'gemini_quota_custom_limits';

interface CustomLimit {
  maxRpm: number;
  maxRpd: number;
}

interface QuotaPanelProps {
  apiKeys: string[];
  selectedModel: string;
  onSwitchToConfigTab?: () => void;
}

export function QuotaPanel({ apiKeys, selectedModel, onSwitchToConfigTab }: QuotaPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshotKeys, setSnapshotKeys] = useState<KeyQuotaFullSnapshot[]>([]);
  const [timezone, setTimezone] = useState<string>('America/Los_Angeles');
  const [currentDayPST, setCurrentDayPST] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Accordion state
  const [expandedModels, setExpandedModels] = useState<Set<number>>(new Set());
  const [modelInspectLoading, setModelInspectLoading] = useState<number | null>(null);
  const [inspectResults, setInspectResults] = useState<Record<number, ModelInfoItem[]>>({});
  const [inspectErrors, setInspectErrors] = useState<Record<number, string>>({});

  // Custom User Limits
  const [customLimits, setCustomLimits] = useState<Record<string, CustomLimit>>(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_LIMITS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [showLimitSettings, setShowLimitSettings] = useState(false);

  const cleanKeys = apiKeys.filter(k => typeof k === 'string' && k.trim().length > 0);

  const loadQuotaStatus = useCallback(async () => {
    if (cleanKeys.length === 0) {
      setSnapshotKeys([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchQuotaStatus(cleanKeys);
      setSnapshotKeys(data.keys || []);
      setTimezone(data.timezone || 'America/Los_Angeles');
      setCurrentDayPST(data.currentDayPST || '');
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('[QuotaPanel] Error loading quota status:', err);
      setError(err.message || 'Không thể tải thông tin hạn ngạch.');
    } finally {
      setLoading(false);
    }
  }, [cleanKeys.join(',')]);

  useEffect(() => {
    loadQuotaStatus();
  }, [loadQuotaStatus]);

  // Đồng hồ đếm ngược nội bộ (giảm runtime.blacklistRemainingMs mỗi giây)
  useEffect(() => {
    const timer = setInterval(() => {
      setSnapshotKeys(prev => {
        let changed = false;
        const next = prev.map(item => {
          let blacklistMs = item.runtime.blacklistRemainingMs;
          let rateLimitMs = item.runtime.nextAllowedRemainingMs;

          if (blacklistMs > 0 || rateLimitMs > 0) {
            changed = true;
            blacklistMs = Math.max(0, blacklistMs - 1000);
            rateLimitMs = Math.max(0, rateLimitMs - 1000);
            return {
              ...item,
              runtime: {
                ...item.runtime,
                isBlacklisted: blacklistMs > 0,
                blacklistRemainingMs: blacklistMs,
                isRateLimited: rateLimitMs > 0,
                nextAllowedRemainingMs: rateLimitMs,
              },
            };
          }
          return item;
        });
        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const toggleModelExpand = (index: number) => {
    setExpandedModels(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleInspectModels = async (keyIndex: number) => {
    setModelInspectLoading(keyIndex);
    setInspectErrors(prev => ({ ...prev, [keyIndex]: '' }));
    try {
      const res = await fetchModelsForKey(keyIndex, cleanKeys);
      setInspectResults(prev => ({ ...prev, [keyIndex]: res.models || [] }));
    } catch (err: any) {
      setInspectErrors(prev => ({ ...prev, [keyIndex]: err.message || 'Lỗi kiểm tra model' }));
    } finally {
      setModelInspectLoading(null);
    }
  };

  const handleUpdateLimit = (keyHash: string, field: 'maxRpm' | 'maxRpd', value: number) => {
    setCustomLimits(prev => {
      const current = prev[keyHash] || { maxRpm: 15, maxRpd: 1500 };
      const next = {
        ...prev,
        [keyHash]: {
          ...current,
          [field]: Math.max(1, value || 1),
        },
      };
      try {
        localStorage.setItem(CUSTOM_LIMITS_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const formatRemainingTime = (ms: number) => {
    if (ms <= 0) return '0s';
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes > 0) {
      return `${minutes}p ${seconds}s`;
    }
    return `${seconds}s`;
  };

  if (cleanKeys.length === 0) {
    return (
      <EmptyState
        icon={<Seal character="限" tone="polish" size="md" />}
        title="Chưa có API key nào"
        description="Hãy thêm ít nhất một Gemini API Key trong tab Cấu hình để xem báo cáo hạn mức và thống kê số lượng request."
        action={
          onSwitchToConfigTab ? (
            <Button variant="primary" size="sm" onClick={onSwitchToConfigTab}>
              Đến tab Cấu hình
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header controls & summary */}
      <div className="flex items-center justify-between bg-ink/60 border border-parchment-2 rounded-[2px] p-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Seal character="限" tone="polish" size="sm" />
            <h3 className="text-xs font-bold text-text-main uppercase tracking-wider">
              Theo dõi Hạn mức API &amp; Quota
            </h3>
          </div>
          <p className="text-[11px] text-text-muted flex items-center gap-2">
            <span>Múi giờ chuẩn: <span className="font-mono text-text-main">{timezone}</span> (Ngày: <span className="font-mono text-text-main">{currentDayPST || 'Hôm nay'}</span>)</span>
            {lastUpdated && (
              <span>• Cập nhật: {lastUpdated.toLocaleTimeString()}</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowLimitSettings(!showLimitSettings)}
            icon={<Settings2 className="w-3.5 h-3.5" />}
          >
            {showLimitSettings ? 'Đóng cấu hình' : 'Ngưỡng cá nhân'}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={loadQuotaStatus}
            disabled={loading}
            icon={<RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-polish' : ''}`} />}
          >
            Làm mới
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-amber-950/30 border border-amber-800/60 rounded-[2px] p-3 text-xs text-amber-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Global Limit Settings Panel */}
      {showLimitSettings && (
        <div className="bg-parchment-2/20 border border-parchment-2 rounded-[2px] p-3.5 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-text-main">
            <Settings2 className="w-3.5 h-3.5 text-polish" />
            Cấu hình Ngưỡng Hạn ngạch Người dùng Tự đặt
          </div>
          <p className="text-[11px] text-text-muted leading-relaxed">
            Thiết lập ngưỡng RPM (Request / Phút) và RPD (Request / Ngày) để hiển thị thanh tiến độ phần trăm trực quan trên từng key.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {snapshotKeys.map((item, idx) => {
              const limit = customLimits[item.keyHash] || { maxRpm: 15, maxRpd: 1500 };
              return (
                <div key={item.keyHash || idx} className="bg-ink border border-parchment-2 rounded-[2px] p-2.5 space-y-2">
                  <div className="text-[11px] font-bold text-text-main flex items-center justify-between">
                    <span>Khóa #{idx + 1}</span>
                    <span className="font-mono text-text-muted text-[10px]">{item.maskedKey}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] text-text-muted block mb-0.5">Giới hạn RPM:</label>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={limit.maxRpm}
                        onChange={e => handleUpdateLimit(item.keyHash, 'maxRpm', parseInt(e.target.value, 10))}
                        className="w-full bg-parchment-2/40 border border-parchment-2 rounded-[2px] px-2 py-1 text-text-main text-xs font-mono outline-none focus:border-polish"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-text-muted block mb-0.5">Giới hạn RPD:</label>
                      <input
                        type="number"
                        min="1"
                        max="50000"
                        value={limit.maxRpd}
                        onChange={e => handleUpdateLimit(item.keyHash, 'maxRpd', parseInt(e.target.value, 10))}
                        className="w-full bg-parchment-2/40 border border-parchment-2 rounded-[2px] px-2 py-1 text-text-main text-xs font-mono outline-none focus:border-polish"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List of Keys Quota Cards */}
      <div className="space-y-3">
        {snapshotKeys.map((item, idx) => {
          const limit = customLimits[item.keyHash] || { maxRpm: 15, maxRpd: 1500 };
          const rpmPercent = Math.min(100, Math.round((item.requestsThisMinute / limit.maxRpm) * 100));
          const rpdPercent = Math.min(100, Math.round((item.requestsToday / limit.maxRpd) * 100));
          const isExpanded = expandedModels.has(idx);
          const isInspecting = modelInspectLoading === idx;
          const inspectData = inspectResults[idx];
          const inspectErr = inspectErrors[idx];

          const isBlacklisted = item.runtime?.isBlacklisted;
          const isRateLimited = item.runtime?.isRateLimited;

          return (
            <div 
              key={item.keyHash || idx}
              className="border border-parchment-2 bg-ink rounded-[2px] p-3.5 space-y-3 transition-colors hover:border-parchment-2/80"
            >
              {/* Top row: Key title, masked key & Status badge */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-text-main">
                    Khóa #{idx + 1}
                  </span>
                  <span className="font-mono text-xs text-text-muted bg-parchment-2/30 px-2 py-0.5 rounded-[2px] border border-parchment-2">
                    {item.maskedKey}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {isBlacklisted ? (
                    <Badge tone="warning" className="animate-pulse">
                      <AlertTriangle className="w-3 h-3 text-amber-400" />
                      Ngắt mạch ({formatRemainingTime(item.runtime.blacklistRemainingMs)})
                    </Badge>
                  ) : isRateLimited ? (
                    <Badge tone="neutral">
                      <Clock className="w-3 h-3 text-text-muted" />
                      Đang hoãn ({formatRemainingTime(item.runtime.nextAllowedRemainingMs)})
                    </Badge>
                  ) : (
                    <Badge tone="polish">
                      <CheckCircle2 className="w-3 h-3 text-polish" />
                      Hoạt động
                    </Badge>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleInspectModels(idx)}
                    disabled={isInspecting}
                    className="py-0.5 text-[11px] h-6"
                    icon={<Sparkles className="w-3 h-3 text-polish" />}
                  >
                    {isInspecting ? 'Đang kiểm tra...' : 'Kiểm tra Model'}
                  </Button>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="bg-parchment-2/20 border border-parchment-2 rounded-[2px] p-2">
                  <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider">RPM (Phút)</div>
                  <div className="text-sm font-mono font-bold text-text-main mt-0.5">
                    {item.requestsThisMinute} <span className="text-[10px] text-text-muted font-normal">/ {limit.maxRpm}</span>
                  </div>
                  {/* RPM Progress bar */}
                  <div className="w-full bg-parchment-2 h-1 rounded-full mt-1.5 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${rpmPercent >= 90 ? 'bg-polish' : rpmPercent >= 70 ? 'bg-amber-400' : 'bg-text-muted'}`}
                      style={{ width: `${rpmPercent}%` }}
                    />
                  </div>
                </div>

                <div className="bg-parchment-2/20 border border-parchment-2 rounded-[2px] p-2">
                  <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider">RPD (Hôm nay PST)</div>
                  <div className="text-sm font-mono font-bold text-text-main mt-0.5">
                    {item.requestsToday} <span className="text-[10px] text-text-muted font-normal">/ {limit.maxRpd}</span>
                  </div>
                  {/* RPD Progress bar */}
                  <div className="w-full bg-parchment-2 h-1 rounded-full mt-1.5 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${rpdPercent >= 90 ? 'bg-polish' : rpdPercent >= 70 ? 'bg-amber-400' : 'bg-text-muted'}`}
                      style={{ width: `${rpdPercent}%` }}
                    />
                  </div>
                </div>

                <div className="bg-parchment-2/20 border border-parchment-2 rounded-[2px] p-2">
                  <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Tổng Request</div>
                  <div className="text-sm font-mono font-bold text-text-main mt-0.5">
                    {item.requestsTotal}
                  </div>
                  <div className="text-[9px] text-text-muted mt-1">Lũy kế phiên</div>
                </div>

                <div className="bg-parchment-2/20 border border-parchment-2 rounded-[2px] p-2">
                  <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Lỗi phát sinh</div>
                  <div className={`text-sm font-mono font-bold mt-0.5 ${item.errorsTotal > 0 ? 'text-polish' : 'text-text-main'}`}>
                    {item.errorsTotal}
                  </div>
                  <div className="text-[9px] text-text-muted mt-1">429 / 503 / Safety</div>
                </div>
              </div>

              {/* Inspect Models Result if triggered */}
              {inspectErr && (
                <div className="bg-amber-950/20 border border-amber-800/40 rounded-[2px] p-2 text-xs text-amber-300">
                  {inspectErr}
                </div>
              )}

              {inspectData && inspectData.length > 0 && (
                <div className="bg-ink/90 border border-parchment-2 rounded-[2px] p-2.5 space-y-1.5 text-xs">
                  <div className="font-bold text-text-main flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1">
                      <Cpu className="w-3 h-3 text-polish" />
                      Google Model List khả dụng ({inspectData.length} models):
                    </span>
                    <button 
                      onClick={() => setInspectResults(prev => ({ ...prev, [idx]: [] }))}
                      className="text-[10px] text-text-muted hover:text-text-main underline cursor-pointer"
                    >
                      Ẩn
                    </button>
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                    {inspectData.map(m => (
                      <div key={m.name} className="flex items-center justify-between bg-parchment-2/20 px-2 py-1 rounded-[2px]">
                        <span className="font-mono text-[11px] text-text-main">{m.name.replace('models/', '')}</span>
                        <span className="text-[10px] text-text-muted truncate max-w-[180px]">{m.displayName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* By Model Breakdown Accordion */}
              {Object.keys(item.byModel || {}).length > 0 && (
                <div className="border-t border-parchment-2 pt-2">
                  <button
                    type="button"
                    onClick={() => toggleModelExpand(idx)}
                    className="flex items-center justify-between w-full text-left text-[11px] font-semibold text-text-muted hover:text-text-main cursor-pointer"
                  >
                    <span className="flex items-center gap-1">
                      <Layers className="w-3 h-3 text-polish" />
                      Chi tiết sử dụng theo từng Model ({Object.keys(item.byModel).length})
                    </span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {isExpanded && (
                    <div className="mt-2 space-y-1.5">
                      {Object.entries(item.byModel).map(([modelId, mStats]) => (
                        <div 
                          key={modelId}
                          className="flex items-center justify-between bg-parchment-2/15 border border-parchment-2/60 rounded-[2px] px-2.5 py-1.5 text-xs font-mono"
                        >
                          <span className="text-text-main text-[11px] font-semibold">
                            {modelId.replace('models/', '')}
                          </span>
                          <div className="flex items-center gap-3 text-[10px] text-text-muted">
                            <span>RPM: <strong className="text-text-main">{mStats.requestsThisMinute}</strong></span>
                            <span>RPD: <strong className="text-text-main">{mStats.requestsToday}</strong></span>
                            <span>Tổng: <strong className="text-text-main">{mStats.requestsTotal}</strong></span>
                            {mStats.errorsTotal > 0 && (
                              <span className="text-polish font-bold">Lỗi: {mStats.errorsTotal}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default QuotaPanel;
