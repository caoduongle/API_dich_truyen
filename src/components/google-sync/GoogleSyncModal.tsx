import React, { useState, useEffect } from 'react';
import {
  Cloud,
  CloudUpload,
  CloudDownload,
  RefreshCw,
  LogOut,
  LogIn,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  FolderOpen,
  Settings,
  Loader2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';
import { googleAuthService } from '../../services/googleAuthService';
import { googleDriveSyncService } from '../../services/googleDriveSyncService';
import { googlePickerService } from '../../services/googlePickerService';
import { GoogleAuthState } from '../../types/googleAuth';
import { SyncProgress } from '../../types/googleDriveSync';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useNotifications } from '../NotificationSystem';

interface GoogleSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged?: () => void;
}

export const GoogleSyncModal: React.FC<GoogleSyncModalProps> = ({
  isOpen,
  onClose,
  onDataChanged,
}) => {
  const [authState, setAuthState] = useState<GoogleAuthState>(googleAuthService.getAuthState());
  const [clientIdInput, setClientIdInput] = useState<string>(googleAuthService.getCustomClientId());
  const [pickerKeyInput, setPickerKeyInput] = useState<string>(googlePickerService.getCustomPickerApiKey());
  const [showAdvanced, setShowAdvanced] = useState<boolean>(() => !googleAuthService.getClientId());
  const [revealClientId, setRevealClientId] = useState<boolean>(false);
  const [revealPickerKey, setRevealPickerKey] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isOpeningPicker, setIsOpeningPicker] = useState<boolean>(false);
  const { showToast } = useNotifications();

  useEffect(() => {
    const unsubscribe = googleAuthService.onAuthStateChanged((newState) => {
      setAuthState(newState);
      setClientIdInput(googleAuthService.getCustomClientId());
    });
    return unsubscribe;
  }, []);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSyncing && !isOpeningPicker) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSyncing, isOpeningPicker, onClose]);

  if (!isOpen) return null;

  const isCustomClientId = Boolean(
    typeof window !== 'undefined' && localStorage.getItem('ai_dich_truyen_google_client_id')
  );
  const isCustomPickerKey = Boolean(
    typeof window !== 'undefined' && localStorage.getItem('ai_dich_truyen_google_picker_key')
  );
  const hasClientId = Boolean(clientIdInput.trim() || googleAuthService.getClientId());

  const handleSaveClientId = () => {
    googleAuthService.setClientId(clientIdInput);
    showToast({ message: 'Đã lưu Google Client ID!', type: 'success' });
  };

  const handleSavePickerKey = () => {
    googlePickerService.setPickerApiKey(pickerKeyInput);
    showToast({ message: 'Đã lưu Google Picker API Key!', type: 'success' });
  };

  const handleResetClientId = () => {
    googleAuthService.setClientId('');
    setClientIdInput('');
    showToast({ message: 'Đã khôi phục Google Client ID mặc định.', type: 'info' });
  };

  const handleResetPickerKey = () => {
    googlePickerService.setPickerApiKey('');
    setPickerKeyInput('');
    showToast({ message: 'Đã khôi phục Google Picker Key mặc định.', type: 'info' });
  };

  const handleLogin = async () => {
    try {
      if (!clientIdInput.trim() && !googleAuthService.getClientId()) {
        showToast({
          message: 'Vui lòng nhập Google Client ID trước khi đăng nhập.',
          type: 'warning',
        });
        setShowAdvanced(true);
        return;
      }
      if (clientIdInput.trim() && clientIdInput !== googleAuthService.getCustomClientId()) {
        googleAuthService.setClientId(clientIdInput);
      }
      await googleAuthService.initiateLogin();
    } catch (err: any) {
      showToast({ message: err.message || 'Lỗi khởi tạo đăng nhập Google.', type: 'error' });
    }
  };

  const handleLogout = () => {
    googleAuthService.logout();
    setSyncProgress(null);
    showToast({ message: 'Đã đăng xuất tài khoản Google.', type: 'info' });
  };

  const handleOpenSharedProjectPicker = async () => {
    const token = googleAuthService.getValidAccessToken();
    if (!token) {
      showToast({ message: 'Vui lòng đăng nhập Google trước khi mở dự án.', type: 'warning' });
      return;
    }

    try {
      setIsOpeningPicker(true);
      await googlePickerService.openFolderPicker({
        accessToken: token,
        pickerApiKey: pickerKeyInput.trim() || googlePickerService.getPickerApiKey(),
        onFolderSelected: async (folderId, folderName) => {
          try {
            setIsSyncing(true);
            const imported = await googleDriveSyncService.importProjectFromSharedFolder(
              token,
              folderId,
              setSyncProgress
            );
            showToast({
              message: `Đã mở và nạp dự án "${imported.title}" vào máy tính!`,
              type: 'success',
            });
            onDataChanged?.();
          } catch (importErr: any) {
            showToast({
              message: importErr.message || 'Không thể mở dự án từ thư mục này.',
              type: 'error',
            });
          } finally {
            setIsSyncing(false);
          }
        },
        onCancel: () => {
          setIsOpeningPicker(false);
        },
      });
    } catch (pickerErr: any) {
      showToast({ message: pickerErr.message || 'Lỗi mở Google Picker.', type: 'error' });
    } finally {
      setIsOpeningPicker(false);
    }
  };

  const handlePush = async () => {
    const token = googleAuthService.getValidAccessToken();
    if (!token) {
      showToast({ message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', type: 'error' });
      return;
    }
    setIsSyncing(true);
    const res = await googleDriveSyncService.pushAllToDrive(token, setSyncProgress);
    setIsSyncing(false);
    if (res.success) {
      showToast({
        message: `Đã sao lưu ${res.syncedProjects} dự án lên Google Drive thành công!`,
        type: 'success',
      });
    } else {
      showToast({ message: `Sao lưu thất bại: ${res.error}`, type: 'error' });
    }
  };

  const handlePull = async () => {
    const token = googleAuthService.getValidAccessToken();
    if (!token) {
      showToast({ message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', type: 'error' });
      return;
    }
    setIsSyncing(true);
    const res = await googleDriveSyncService.pullAllFromDrive(token, setSyncProgress);
    setIsSyncing(false);
    if (res.success) {
      showToast({
        message: `Đã khôi phục ${res.restoredProjects} dự án từ Google Drive!`,
        type: 'success',
      });
      onDataChanged?.();
    } else {
      showToast({ message: `Khôi phục thất bại: ${res.error}`, type: 'error' });
    }
  };

  const handleBiDirectionalSync = async () => {
    const token = googleAuthService.getValidAccessToken();
    if (!token) {
      showToast({ message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', type: 'error' });
      return;
    }
    setIsSyncing(true);
    const res = await googleDriveSyncService.syncBiDirectional(token, setSyncProgress);
    setIsSyncing(false);
    if (res.success) {
      showToast({
        message: `Đồng bộ thành công! (Tải lên: ${res.uploadedCount}, Tải về: ${res.downloadedCount})`,
        type: 'success',
      });
      onDataChanged?.();
    } else {
      showToast({ message: 'Đồng bộ dữ liệu gặp lỗi.', type: 'error' });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="google-sync-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/75 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={() => !isSyncing && !isOpeningPicker && onClose()}
    >
      <div
        className="bg-parchment border border-parchment-2 rounded-[2px] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-parchment-2 bg-ink/5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gold/15 flex items-center justify-center border border-gold/30">
              <Cloud className="w-4 h-4 text-gold" />
            </div>
            <div>
              <h2 id="google-sync-modal-title" className="text-sm font-bold font-serif text-text-main">
                Đồng Bộ & Cộng Tác Google Drive
              </h2>
              <p className="text-[11px] text-text-muted">
                100% Client-Side • Quyền drive.file tối thiểu • Chia sẻ theo từng truyện
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSyncing || isOpeningPicker}
            className="p-1 text-text-muted hover:text-text-main rounded hover:bg-parchment-2 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Privacy Note */}
          <div className="p-3 bg-parchment-2/60 border border-parchment-2 rounded-[2px] text-[11px] text-text-muted space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-text-main">
              <ShieldCheck className="w-3.5 h-3.5 text-polish" />
              Cam kết bảo mật & quyền riêng tư:
            </div>
            <p>
              • Đăng nhập qua chuẩn <strong>OAuth 2.0 PKCE</strong> trực tiếp từ trình duyệt đến Google. Không lưu token trên máy chủ.
            </p>
            <p>
              • Chỉ dùng quyền <code>drive.file</code> — ứng dụng chỉ đọc/sửa các thư mục do chính nó tạo ra hoặc do bạn chọn mở qua Google Picker.
            </p>
          </div>

          {/* Google Cloud Integration Configuration */}
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
                  title={showAdvanced ? 'Thu gọn cài đặt nâng cao' : 'Mở rộng tùy chỉnh Client ID / API Key'}
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
                        onClick={handleResetClientId}
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
                    <Button variant="secondary" size="sm" onClick={handleSaveClientId}>
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
                        onClick={handleResetPickerKey}
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
                    <Button variant="secondary" size="sm" onClick={handleSavePickerKey}>
                      Lưu
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Auth State Card */}
          {authState.isAuthenticated && authState.user ? (
            <div className="border border-parchment-2 rounded-[2px] p-4 bg-ink/5 space-y-4">
              {/* User Profile Info */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {authState.user.picture ? (
                    <img
                      src={authState.user.picture}
                      alt={authState.user.name}
                      className="w-10 h-10 rounded-full border border-parchment-2 object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center font-bold text-gold">
                      {authState.user.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-text-main">{authState.user.name}</span>
                      <Badge tone="polish">Đã kết nối</Badge>
                    </div>
                    <span className="text-[11px] text-text-muted">{authState.user.email}</span>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleLogout}
                  icon={<LogOut className="w-3.5 h-3.5" />}
                  title="Đăng xuất khỏi Google"
                >
                  Đăng xuất
                </Button>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-parchment-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleBiDirectionalSync}
                  disabled={isSyncing}
                  icon={<RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />}
                  className="w-full justify-center"
                >
                  Đồng bộ 2 chiều
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handlePush}
                  disabled={isSyncing}
                  icon={<CloudUpload className="w-3.5 h-3.5 text-gold" />}
                  className="w-full justify-center"
                >
                  Sao lưu (Push)
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handlePull}
                  disabled={isSyncing}
                  icon={<CloudDownload className="w-3.5 h-3.5 text-polish" />}
                  className="w-full justify-center"
                >
                  Khôi phục (Pull)
                </Button>
              </div>

              {/* Collaboration: Open Shared Project via Google Picker */}
              <div className="pt-2 border-t border-parchment-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleOpenSharedProjectPicker}
                  disabled={isSyncing || isOpeningPicker}
                  icon={isOpeningPicker ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5 text-gold" />}
                  className="w-full justify-center"
                >
                  {isOpeningPicker ? 'Đang mở Google Picker...' : 'Mở dự án được chia sẻ (Google Picker)'}
                </Button>
              </div>

              {/* Sync Progress Indicator */}
              {syncProgress && (
                <div className="space-y-1.5 pt-2 border-t border-parchment-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-text-main">{syncProgress.message}</span>
                    <span className="text-text-muted">{syncProgress.progressPercent}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-ink/20 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        syncProgress.status === 'error'
                          ? 'bg-crimson'
                          : syncProgress.status === 'success'
                          ? 'bg-polish'
                          : 'bg-gold'
                      }`}
                      style={{ width: `${syncProgress.progressPercent}%` }}
                    />
                  </div>
                  {syncProgress.lastSyncedAt && (
                    <p className="text-[10px] text-text-muted text-right">
                      Đồng bộ gần nhất lúc: {syncProgress.lastSyncedAt}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="border border-parchment-2 rounded-[2px] p-5 text-center space-y-3 bg-ink/5">
              <div className="w-12 h-12 rounded-full bg-gold/15 flex items-center justify-center mx-auto border border-gold/30">
                <Cloud className="w-6 h-6 text-gold" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-text-main">
                  Chưa đăng nhập Google
                </p>
                <p className="text-[11px] text-text-muted max-w-sm mx-auto">
                  Đăng nhập để đồng bộ toàn bộ sách, chương dịch và từ điển sang Google Drive cá nhân hoặc mở các dự án dịch được chia sẻ từ bạn bè.
                </p>
              </div>

              <div className="pt-2">
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleLogin}
                  icon={<LogIn className="w-4 h-4" />}
                  className="mx-auto"
                >
                  Đăng nhập với Google
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-parchment-2 bg-ink/5 flex items-center justify-between text-[11px] text-text-muted">
          <span>AI Dịch Truyện Cloud Sync</span>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isSyncing || isOpeningPicker}>
            Đóng
          </Button>
        </div>
      </div>
    </div>
  );
};
