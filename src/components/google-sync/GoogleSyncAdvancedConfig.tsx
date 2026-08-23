import React from 'react';
import {
  Key,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

export interface GoogleSyncAdvancedConfigProps {
  hasClientId: boolean;
  isCustomClientId: boolean;
  isCustomPickerKey: boolean;
  isCustomAppId?: boolean;
  showAdvanced: boolean;
  setShowAdvanced: React.Dispatch<React.SetStateAction<boolean>>;
  clientIdInput: string;
  setClientIdInput: (val: string) => void;
  pickerKeyInput: string;
  setPickerKeyInput: (val: string) => void;
  appIdInput?: string;
  setAppIdInput?: (val: string) => void;
  revealClientId: boolean;
  setRevealClientId: React.Dispatch<React.SetStateAction<boolean>>;
  revealPickerKey: boolean;
  setRevealPickerKey: React.Dispatch<React.SetStateAction<boolean>>;
  revealAppId?: boolean;
  setRevealAppId?: React.Dispatch<React.SetStateAction<boolean>>;
  onSaveClientId: () => void;
  onSavePickerKey: () => void;
  onSaveAppId?: () => void;
  onResetClientId: () => void;
  onResetPickerKey: () => void;
  onResetAppId?: () => void;
}

export function GoogleSyncAdvancedConfig({
  hasClientId,
  isCustomClientId,
  isCustomPickerKey,
  isCustomAppId,
  showAdvanced,
  setShowAdvanced,
  clientIdInput,
  setClientIdInput,
  pickerKeyInput,
  setPickerKeyInput,
  appIdInput = '',
  setAppIdInput,
  revealClientId,
  setRevealClientId,
  revealPickerKey,
  setRevealPickerKey,
  revealAppId = false,
  setRevealAppId,
  onSaveClientId,
  onSavePickerKey,
  onSaveAppId,
  onResetClientId,
  onResetPickerKey,
  onResetAppId,
}: GoogleSyncAdvancedConfigProps) {
  return (
    <div className="border border-parchment-2 rounded-[2px] p-3.5 bg-ink/5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key className="w-3.5 h-3.5 text-gold" />
          <span className="text-xs font-bold text-text-main">
            Cấu hình Google Cloud &amp; Drive
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasClientId ? (
            <Badge tone={isCustomClientId ? 'polish' : 'neutral'} className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-polish" />
              {isCustomClientId ? 'Tùy chỉnh riêng' : 'Đã cấu hình sẵn'}
            </Badge>
          ) : (
            <Badge tone="warning" className="flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-amber-400" />
              Chưa cấu hình
            </Badge>
          )}
          <button
            type="button"
            onClick={() => setShowAdvanced((prev) => !prev)}
            className="text-[11px] text-text-muted hover:text-text-main flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] hover:bg-parchment-2/50 transition-colors cursor-pointer"
            title={showAdvanced ? 'Thu gọn cài đặt nâng cao' : 'Mở rộng tùy chỉnh Client ID / API Key / App ID'}
          >
            <span>{showAdvanced ? 'Thu gọn' : 'Tùy chỉnh'}</span>
            {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Collapsible Advanced Credentials Drawer */}
      {showAdvanced && (
        <div className="pt-2 border-t border-parchment-2 space-y-3 animate-in fade-in duration-150">
          {/* Client ID field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="google-oauth-client-id" className="text-[11px] font-bold text-text-main flex items-center gap-1">
                <span>OAuth Client ID</span>
                {isCustomClientId && (
                  <span className="text-[9px] text-polish font-mono">(Tùy chỉnh)</span>
                )}
              </label>
              {isCustomClientId && (
                <button
                  type="button"
                  onClick={onResetClientId}
                  className="text-[10px] text-text-muted hover:text-polish flex items-center gap-0.5 transition-colors cursor-pointer"
                  title="Khôi phục về Client ID mặc định của ứng dụng"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Mặc định</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <div className="flex-1 flex items-center gap-1.5 border border-parchment-2 rounded-[2px] px-2.5 py-1.5 bg-ink">
                <input
                  id="google-oauth-client-id"
                  type={revealClientId ? 'text' : 'password'}
                  value={clientIdInput}
                  onChange={(e) => setClientIdInput(e.target.value)}
                  placeholder="Để trống để dùng Client ID mặc định của hệ thống..."
                  className="flex-1 text-xs bg-transparent outline-none text-text-main font-mono min-w-0 placeholder:text-text-muted"
                />
              </div>
              <button
                type="button"
                onClick={() => setRevealClientId((prev) => !prev)}
                className="text-text-muted hover:text-text-main p-1.5 rounded-[2px] hover:bg-parchment-2 transition-colors cursor-pointer shrink-0"
                title={revealClientId ? 'Ẩn' : 'Hiện'}
              >
                {revealClientId ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
              <Button variant="secondary" size="sm" onClick={onSaveClientId}>
                Lưu
              </Button>
            </div>
          </div>

          {/* Picker API Key field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="google-picker-api-key" className="text-[11px] font-bold text-text-main flex items-center gap-1">
                <span>Picker API Key</span>
                {isCustomPickerKey && (
                  <span className="text-[9px] text-polish font-mono">(Tùy chỉnh)</span>
                )}
              </label>
              {isCustomPickerKey && (
                <button
                  type="button"
                  onClick={onResetPickerKey}
                  className="text-[10px] text-text-muted hover:text-polish flex items-center gap-0.5 transition-colors cursor-pointer"
                  title="Khôi phục về Picker API Key mặc định của ứng dụng"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Mặc định</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <div className="flex-1 flex items-center gap-1.5 border border-parchment-2 rounded-[2px] px-2.5 py-1.5 bg-ink">
                <input
                  id="google-picker-api-key"
                  type={revealPickerKey ? 'text' : 'password'}
                  value={pickerKeyInput}
                  onChange={(e) => setPickerKeyInput(e.target.value)}
                  placeholder="Để trống để dùng Picker API Key mặc định của hệ thống..."
                  className="flex-1 text-xs bg-transparent outline-none text-text-main font-mono min-w-0 placeholder:text-text-muted"
                />
              </div>
              <button
                type="button"
                onClick={() => setRevealPickerKey((prev) => !prev)}
                className="text-text-muted hover:text-text-main p-1.5 rounded-[2px] hover:bg-parchment-2 transition-colors cursor-pointer shrink-0"
                title={revealPickerKey ? 'Ẩn' : 'Hiện'}
              >
                {revealPickerKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
              <Button variant="secondary" size="sm" onClick={onSavePickerKey}>
                Lưu
              </Button>
            </div>
          </div>

          {/* App ID (Project Number) field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="google-cloud-app-id" className="text-[11px] font-bold text-text-main flex items-center gap-1">
                <span>Google Cloud App ID (Project Number)</span>
                {isCustomAppId && (
                  <span className="text-[9px] text-polish font-mono">(Tùy chỉnh)</span>
                )}
              </label>
              {isCustomAppId && onResetAppId && (
                <button
                  type="button"
                  onClick={onResetAppId}
                  className="text-[10px] text-text-muted hover:text-polish flex items-center gap-0.5 transition-colors cursor-pointer"
                  title="Khôi phục về App ID mặc định của ứng dụng"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Mặc định</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <div className="flex-1 flex items-center gap-1.5 border border-parchment-2 rounded-[2px] px-2.5 py-1.5 bg-ink">
                <input
                  id="google-cloud-app-id"
                  type={revealAppId ? 'text' : 'password'}
                  value={appIdInput}
                  onChange={(e) => setAppIdInput?.(e.target.value)}
                  placeholder="Nhập Project Number (dạng số, ví dụ 123456789012)..."
                  className="flex-1 text-xs bg-transparent outline-none text-text-main font-mono min-w-0 placeholder:text-text-muted"
                />
              </div>
              {setRevealAppId && (
                <button
                  type="button"
                  onClick={() => setRevealAppId((prev) => !prev)}
                  className="text-text-muted hover:text-text-main p-1.5 rounded-[2px] hover:bg-parchment-2 transition-colors cursor-pointer shrink-0"
                  title={revealAppId ? 'Ẩn' : 'Hiện'}
                >
                  {revealAppId ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              )}
              {onSaveAppId && (
                <Button variant="secondary" size="sm" onClick={onSaveAppId}>
                  Lưu
                </Button>
              )}
            </div>
            <p className="text-[10px] text-text-muted">
              Project Number từ Google Cloud Console (IAM &amp; Admin → Settings → Project number), dùng để liên kết quyền truy cập tệp qua Google Picker.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

