import React, { useState, useEffect } from 'react';
import {
  Cloud,
  CloudUpload,
  CloudDownload,
  RefreshCw,
  LogOut,
  LogIn,
  ShieldCheck,
  FolderOpen,
  Loader2,
} from 'lucide-react';
import { googleAuthService } from '../../services/googleAuthService';
import { googleDriveSyncService } from '../../services/googleDriveSyncService';
import { googlePickerService } from '../../services/googlePickerService';
import { GoogleAuthState } from '../../types/googleAuth';
import { SyncProgress } from '../../types/googleDriveSync';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useNotifications } from '../NotificationSystem';
import { GoogleSyncAdvancedConfig } from './GoogleSyncAdvancedConfig';

export interface GoogleSyncModalProps {
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
  const [appIdInput, setAppIdInput] = useState<string>(googlePickerService.getCustomAppId());
  const [showAdvanced, setShowAdvanced] = useState<boolean>(() => !googleAuthService.getClientId());
  const [revealClientId, setRevealClientId] = useState<boolean>(false);
  const [revealPickerKey, setRevealPickerKey] = useState<boolean>(false);
  const [revealAppId, setRevealAppId] = useState<boolean>(false);
  const [avatarError, setAvatarError] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isOpeningPicker, setIsOpeningPicker] = useState<boolean>(false);
  const { showToast } = useNotifications();

  useEffect(() => {
    const unsubscribe = googleAuthService.onAuthStateChanged((newState) => {
      setAuthState(newState);
      setAvatarError(false);
      setClientIdInput(googleAuthService.getCustomClientId());
    });
    return unsubscribe;
  }, []);

  const isCustomClientId = Boolean(
    typeof window !== 'undefined' && localStorage.getItem('ai_dich_truyen_google_client_id')
  );
  const isCustomPickerKey = Boolean(
    typeof window !== 'undefined' && localStorage.getItem('ai_dich_truyen_google_picker_key')
  );
  const isCustomAppId = Boolean(
    typeof window !== 'undefined' && localStorage.getItem('ai_dich_truyen_google_app_id')
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

  const handleSaveAppId = () => {
    googlePickerService.setAppId(appIdInput);
    showToast({ message: 'Đã lưu Google Cloud App ID!', type: 'success' });
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

  const handleResetAppId = () => {
    googlePickerService.setAppId('');
    setAppIdInput('');
    showToast({ message: 'Đã khôi phục Google Cloud App ID mặc định.', type: 'info' });
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
      await googlePickerService.openBundlePicker({
        accessToken: token,
        pickerApiKey: pickerKeyInput.trim() || googlePickerService.getPickerApiKey(),
        title: 'Chọn tệp gói dự án được chia sẻ (project_bundle.json)',
        onFileSelected: async (selectedFile) => {
          try {
            setIsSyncing(true);
            const imported = await googleDriveSyncService.importProjectFromBundle(
              token,
              selectedFile.id,
              setSyncProgress
            );
            showToast({
              message: `Đã mở và nạp dự án "${imported.title}" vào máy tính!`,
              type: 'success',
            });
            onDataChanged?.();
          } catch (importErr: any) {
            showToast({
              message: importErr.message || 'Không thể mở dự án từ tệp này.',
              type: 'error',
            });
          } finally {
            setIsSyncing(false);
            setIsOpeningPicker(false);
          }
        },
        onCancel: () => {
          setIsOpeningPicker(false);
        },
      });
    } catch (pickerErr: any) {
      setIsOpeningPicker(false);
      showToast({ message: pickerErr.message || 'Lỗi mở Google Picker.', type: 'error' });
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
      if (res.failedPullCount > 0) {
        showToast({
          message: `Đồng bộ hoàn tất! (Tải lên: ${res.uploadedCount}, Tải về: ${res.downloadedCount}) — có ${res.failedPullCount} mục chưa thể kéo về.`,
          type: 'warning',
        });
      } else {
        showToast({
          message: `Đồng bộ thành công! (Tải lên: ${res.uploadedCount}, Tải về: ${res.downloadedCount})`,
          type: 'success',
        });
      }
      onDataChanged?.();
    } else {
      showToast({ message: 'Đồng bộ dữ liệu gặp lỗi.', type: 'error' });
    }
  };


  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="lg"
      icon={<Cloud className="w-4 h-4 text-gold" />}
      title="Đồng Bộ & Cộng Tác Google Drive"
      description="100% Client-Side • Quyền drive.file tối thiểu • Chia sẻ theo từng truyện"
      closeOnBackdropClick={!isSyncing && !isOpeningPicker}
      closeOnEscape={!isSyncing && !isOpeningPicker}
      footer={
        <div className="flex items-center justify-between w-full text-[11px] text-text-muted">
          <span>AI Dịch Truyện Cloud Sync</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isSyncing || isOpeningPicker}
          >
            Đóng
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Privacy Note */}
        <div className="p-3 bg-parchment-2/60 border border-parchment-2 rounded-[2px] text-[11px] text-text-muted space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-text-main">
            <ShieldCheck className="w-3.5 h-3.5 text-polish" />
            Cam kết bảo mật &amp; quyền riêng tư:
          </div>
          <p>
            • Đăng nhập qua chuẩn <strong>Google Identity Services Popup</strong> trực tiếp từ trình duyệt đến Google. Không lưu token trên máy chủ.
          </p>
          <p>
            • Chỉ dùng quyền <code>drive.file</code> — ứng dụng chỉ đọc/sửa các thư mục do chính nó tạo ra hoặc do bạn chọn mở qua Google Picker.
          </p>
        </div>

        {/* Google Cloud Integration Configuration */}
        <GoogleSyncAdvancedConfig
          hasClientId={hasClientId}
          isCustomClientId={isCustomClientId}
          isCustomPickerKey={isCustomPickerKey}
          isCustomAppId={isCustomAppId}
          showAdvanced={showAdvanced}
          setShowAdvanced={setShowAdvanced}
          clientIdInput={clientIdInput}
          setClientIdInput={setClientIdInput}
          pickerKeyInput={pickerKeyInput}
          setPickerKeyInput={setPickerKeyInput}
          appIdInput={appIdInput}
          setAppIdInput={setAppIdInput}
          revealClientId={revealClientId}
          setRevealClientId={setRevealClientId}
          revealPickerKey={revealPickerKey}
          setRevealPickerKey={setRevealPickerKey}
          revealAppId={revealAppId}
          setRevealAppId={setRevealAppId}
          onSaveClientId={handleSaveClientId}
          onSavePickerKey={handleSavePickerKey}
          onSaveAppId={handleSaveAppId}
          onResetClientId={handleResetClientId}
          onResetPickerKey={handleResetPickerKey}
          onResetAppId={handleResetAppId}
        />


        {/* Auth State Card */}
        {authState.isAuthenticated && authState.user ? (
          <div className="border border-parchment-2 rounded-[2px] p-4 bg-ink/5 space-y-4">
            {/* User Profile Info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {authState.user.picture && !avatarError ? (
                  <img
                    src={authState.user.picture}
                    alt={authState.user.name || authState.user.email || 'Ảnh đại diện người dùng'}
                    width={40}
                    height={40}
                    loading="lazy"
                    decoding="async"
                    onError={() => setAvatarError(true)}
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
                  <a
                    href={`mailto:${authState.user.email}`}
                    className="text-[11px] text-text-muted hover:text-polish transition-colors block"
                    title="Gửi email"
                  >
                    {authState.user.email}
                  </a>
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
    </Modal>
  );
};
