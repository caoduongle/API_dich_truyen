import React, { useState, useEffect, useCallback } from 'react';
import {
  Share2,
  UserPlus,
  Trash2,
  ShieldCheck,
  FolderLock,
  Mail,
  Loader2,
  CheckCircle2,
  Users,
  FolderSync,
  RefreshCw,
} from 'lucide-react';
import { StoryProject } from '../../types';
import { CollaboratorPermission, SyncProgress } from '../../types/googleDriveSync';
import { googleAuthService } from '../../services/googleAuthService';
import { googleDriveSyncService } from '../../services/googleDriveSyncService';
import { googleDrivePermissionsService } from '../../services/googleDrivePermissionsService';
import { googlePickerService } from '../../services/googlePickerService';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useNotifications } from '../NotificationSystem';
import { getProjectFromDB } from '../../services/db';

interface ShareProjectModalProps {
  open: boolean;
  onClose: () => void;
  project: StoryProject | null;
  onProjectUpdated?: (project: StoryProject) => void;
}

export const ShareProjectModal: React.FC<ShareProjectModalProps> = ({
  open,
  onClose,
  project,
  onProjectUpdated,
}) => {
  const [collaborators, setCollaborators] = useState<CollaboratorPermission[]>([]);
  const [emailInput, setEmailInput] = useState<string>('');
  const [roleInput, setRoleInput] = useState<'writer' | 'reader'>('writer');
  const [isLoadingList, setIsLoadingList] = useState<boolean>(false);
  const [isMigrating, setIsMigrating] = useState<boolean>(false);
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [isSyncingNewFiles, setIsSyncingNewFiles] = useState<boolean>(false);
  const [syncNewFilesProgress, setSyncNewFilesProgress] = useState<SyncProgress | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [migrationProgress, setMigrationProgress] = useState<SyncProgress | null>(null);

  const { showToast } = useNotifications();

  const isGranular = project?.driveStorageFormat === 'granular' && !!project?.driveFolderId;

  const loadCollaborators = useCallback(async () => {
    if (!project?.driveFolderId) return;
    const token = googleAuthService.getValidAccessToken();
    if (!token) return;

    try {
      setIsLoadingList(true);
      const list = await googleDrivePermissionsService.listFolderCollaborators(
        token,
        project.driveFolderId
      );
      setCollaborators(list);
    } catch (err: any) {
      console.warn('Lỗi tải danh sách cộng tác viên:', err);
    } finally {
      setIsLoadingList(false);
    }
  }, [project?.driveFolderId]);

  useEffect(() => {
    if (open && isGranular) {
      loadCollaborators();
    }
  }, [open, isGranular, loadCollaborators]);

  const handleMigrate = async () => {
    if (!project) return;
    const token = googleAuthService.getValidAccessToken();
    if (!token) {
      showToast({ message: 'Vui lòng đăng nhập Google trước khi chia sẻ dự án.', type: 'warning' });
      return;
    }

    try {
      setIsMigrating(true);
      const folderId = await googleDriveSyncService.migrateProjectToGranularSubfolder(
        token,
        project.id,
        setMigrationProgress
      );
      const updated = await getProjectFromDB(project.id);
      if (updated) {
        onProjectUpdated?.(updated);
      }
      showToast({
        message: 'Đã khởi tạo thư mục riêng và tách nhỏ từng chương thành công!',
        type: 'success',
      });
      loadCollaborators();
    } catch (err: any) {
      showToast({ message: err.message || 'Lỗi chuyển đổi cấu trúc dự án.', type: 'error' });
    } finally {
      setIsMigrating(false);
    }
  };

  const handleAddCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project?.driveFolderId) return;
    const token = googleAuthService.getValidAccessToken();
    if (!token) {
      showToast({ message: 'Phiên đăng nhập đã hết hạn.', type: 'error' });
      return;
    }

    const cleanEmail = emailInput.trim();
    if (!cleanEmail) {
      showToast({ message: 'Vui lòng nhập địa chỉ email Google.', type: 'warning' });
      return;
    }

    try {
      setIsSharing(true);
      const perm = await googleDrivePermissionsService.shareFolderWithUser(
        token,
        project.driveFolderId,
        cleanEmail,
        roleInput
      );
      showToast({
        message: `Đã cấp quyền ${roleInput === 'writer' ? 'chỉnh sửa' : 'xem'} cho ${cleanEmail}!`,
        type: 'success',
      });
      setEmailInput('');
      setCollaborators((prev) => [...prev, perm]);
    } catch (err: any) {
      showToast({ message: err.message || 'Không thể cấp quyền cho email này.', type: 'error' });
    } finally {
      setIsSharing(false);
    }
  };

  const handleRevoke = async (permissionId: string, email: string) => {
    if (!project?.driveFolderId) return;
    const token = googleAuthService.getValidAccessToken();
    if (!token) return;

    if (!window.confirm(`Bạn có chắc chắn muốn thu hồi quyền của ${email || 'người dùng này'}?`)) {
      return;
    }

    try {
      setRevokingId(permissionId);
      await googleDrivePermissionsService.revokeFolderPermission(
        token,
        project.driveFolderId,
        permissionId
      );
      showToast({ message: 'Đã thu hồi quyền thành công.', type: 'info' });
      setCollaborators((prev) => prev.filter((p) => p.permissionId !== permissionId));
    } catch (err: any) {
      showToast({ message: err.message || 'Lỗi thu hồi quyền.', type: 'error' });
    } finally {
      setRevokingId(null);
    }
  };

  const handleSyncNewFiles = async () => {
    if (!project?.driveFolderId) return;
    const token = googleAuthService.getValidAccessToken();
    if (!token) {
      showToast({ message: 'Vui lòng đăng nhập Google trước khi đồng bộ tệp.', type: 'warning' });
      return;
    }

    try {
      setIsSyncingNewFiles(true);
      await googlePickerService.openFilePicker({
        accessToken: token,
        folderId: project.driveFolderId,
        title: `Chọn các tệp để cấp quyền & tải về cho "${project.title}"`,
        onFilesSelected: async (selectedFiles) => {
          try {
            const res = await googleDriveSyncService.syncGranularProjectFiles(
              token,
              project.id,
              project.driveFolderId!,
              setSyncNewFilesProgress,
              selectedFiles
            );

            const updated = await getProjectFromDB(project.id);
            if (updated) {
              onProjectUpdated?.(updated);
            }

            if (res.success) {
              if (res.failedPullCount > 0) {
                showToast({
                  message: `Đã đồng bộ ${res.downloadedChapters + res.uploadedChapters} chương. Còn ${res.failedPullCount} chương chưa chọn đủ file.`,
                  type: 'warning',
                });
              } else {
                showToast({
                  message: `Đồng bộ file mới thành công! (Tải về: ${res.downloadedChapters}, Tải lên: ${res.uploadedChapters})`,
                  type: 'success',
                });
              }
            } else {
              showToast({ message: res.error || 'Lỗi đồng bộ tệp chương.', type: 'error' });
            }
          } catch (syncErr: any) {
            showToast({ message: syncErr.message || 'Lỗi đồng bộ tệp.', type: 'error' });
          } finally {
            setIsSyncingNewFiles(false);
          }
        },
        onCancel: () => {
          setIsSyncingNewFiles(false);
        },
      });
    } catch (pickerErr: any) {
      setIsSyncingNewFiles(false);
      showToast({ message: pickerErr.message || 'Lỗi mở Google Picker.', type: 'error' });
    }
  };

  if (!project) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <div className="flex items-center gap-2">
          <Share2 className="w-4 h-4 text-gold" />
          <span>Chia Sẻ Dự Án & Cộng Tác</span>
        </div>
      }
      description={`Dự án: "${project.title}"`}
      footer={
        <div className="flex items-center justify-between w-full text-xs text-text-muted">
          <span>Quyền Google Drive: <code>drive.file</code> tối thiểu</span>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Đóng
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Banner Bảo Mật */}
        <div className="p-3 bg-parchment-2/60 border border-parchment-2 rounded-[2px] text-xs text-text-muted space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-text-main">
            <ShieldCheck className="w-3.5 h-3.5 text-polish" />
            Cơ chế chia sẻ riêng biệt & an toàn:
          </div>
          <p>
            • Dự án được lưu trong một thư mục riêng <code>AI_Dich_Truyen_Data/{project.id}/</code>.
          </p>
          <p>
            • Người được mời chỉ có quyền truy cập đúng truyện này, không thấy các dự án khác trong Drive của bạn.
          </p>
        </div>

        {/* Trạng thái 1: Chưa chuyển sang cấu trúc thư mục riêng */}
        {!isGranular ? (
          <div className="p-5 border border-parchment-2 rounded-[2px] bg-ink/5 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-gold/15 flex items-center justify-center mx-auto border border-gold/30">
              <FolderLock className="w-6 h-6 text-gold" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-text-main">
                Chuẩn bị dự án để chia sẻ
              </h3>
              <p className="text-xs text-text-muted max-w-md mx-auto">
                Hệ thống sẽ tạo thư mục riêng cho truyện này trên Google Drive và chia nhỏ các chương thành từng file độc lập để nhiều người có thể dịch đồng thời mà không đè bản dịch của nhau.
              </p>
            </div>

            {migrationProgress && (
              <div className="space-y-1 max-w-sm mx-auto pt-2">
                <div className="flex justify-between text-[11px] text-text-muted">
                  <span>{migrationProgress.message}</span>
                  <span>{migrationProgress.progressPercent}%</span>
                </div>
                <div className="w-full h-1.5 bg-ink/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gold transition-all duration-300"
                    style={{ width: `${migrationProgress.progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            <div className="pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={handleMigrate}
                disabled={isMigrating}
                icon={isMigrating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                className="mx-auto"
              >
                {isMigrating ? 'Đang chuẩn bị thư mục...' : 'Khởi tạo thư mục & Sẵn sàng chia sẻ'}
              </Button>
            </div>
          </div>
        ) : (
          /* Trạng thái 2: Đã là thư mục riêng, quản lý cộng tác viên */
          <div className="space-y-4">
            {/* Card Đồng bộ file mới (Cấp quyền tăng dần) */}
            <div className="border border-parchment-2 rounded-[2px] p-3.5 bg-ink/5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text-main flex items-center gap-1.5">
                  <FolderSync className="w-3.5 h-3.5 text-gold" />
                  Đồng bộ file mới từ Google Drive
                </span>
                <Badge tone="neutral">drive.file</Badge>
              </div>
              <p className="text-[11px] text-text-muted leading-relaxed">
                Khi có chương mới được tải lên Google Drive, bấm nút dưới đây để cấp quyền và kéo các chương mới về máy tính.
              </p>

              {syncNewFilesProgress && (
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[10px] text-text-muted">
                    <span>{syncNewFilesProgress.message}</span>
                    <span>{syncNewFilesProgress.progressPercent}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-ink/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gold transition-all duration-300"
                      style={{ width: `${syncNewFilesProgress.progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="pt-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSyncNewFiles}
                  disabled={isSyncingNewFiles}
                  icon={isSyncingNewFiles ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderSync className="w-3.5 h-3.5 text-gold" />}
                  className="w-full justify-center"
                >
                  {isSyncingNewFiles ? 'Đang mở Google Picker / Đồng bộ...' : 'Đồng bộ file mới (Google Picker)'}
                </Button>
              </div>
            </div>

            {/* Form mời cộng tác viên */}
            <form onSubmit={handleAddCollaborator} className="border border-parchment-2 rounded-[2px] p-3.5 bg-ink/5 space-y-3">
              <label className="text-xs font-bold text-text-main flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5 text-gold" />
                Mời người dịch cùng (Email Google)
              </label>

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Mail className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    type="email"
                    required
                    placeholder="nguoidich@gmail.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-ink/10 border border-parchment-2 rounded-[2px] text-text-main placeholder:text-text-muted focus:outline-none focus:border-gold font-mono"
                  />
                </div>

                <select
                  value={roleInput}
                  onChange={(e) => setRoleInput(e.target.value as any)}
                  className="text-xs bg-ink/10 border border-parchment-2 rounded-[2px] px-2 py-1.5 text-text-main focus:outline-none focus:border-gold"
                >
                  <option value="writer">Quyền chỉnh sửa (Dịch)</option>
                  <option value="reader">Chỉ đọc (Xem)</option>
                </select>

                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSharing}
                  icon={isSharing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                >
                  Cấp quyền
                </Button>
              </div>
            </form>

            {/* Danh sách cộng tác viên */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text-main flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-gold" />
                  Danh sách cộng tác viên ({collaborators.length})
                </span>
                {isLoadingList && <Loader2 className="w-3.5 h-3.5 animate-spin text-text-muted" />}
              </div>

              {collaborators.length === 0 && !isLoadingList ? (
                <p className="text-xs text-text-muted py-3 text-center border border-parchment-2 rounded-[2px] bg-ink/5">
                  Chưa có cộng tác viên nào được mời. Nhập email ở trên để mời.
                </p>
              ) : (
                <div className="divide-y divide-parchment-2 border border-parchment-2 rounded-[2px] max-h-48 overflow-y-auto bg-ink/5">
                  {collaborators.map((c) => (
                    <div key={c.permissionId} className="flex items-center justify-between p-2.5 text-xs">
                      <div className="flex items-center gap-2.5">
                        {c.photoLink ? (
                          <img
                            src={c.photoLink}
                            alt=""
                            className="w-6 h-6 rounded-full border border-parchment-2"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center font-bold text-[10px] text-gold">
                            {(c.displayName || c.emailAddress || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-text-main leading-tight">
                            {c.displayName || c.emailAddress}
                          </p>
                          {c.displayName && (
                            <p className="text-[10px] text-text-muted">{c.emailAddress}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge tone={c.role === 'owner' ? 'solid' : 'polish'}>
                          {c.role === 'owner' ? 'Chủ sở hữu' : c.role === 'writer' ? 'Người dịch' : 'Người xem'}
                        </Badge>
                        {c.role !== 'owner' && (
                          <button
                            type="button"
                            onClick={() => handleRevoke(c.permissionId, c.emailAddress)}
                            disabled={revokingId === c.permissionId}
                            className="p-1 text-text-muted hover:text-crimson transition-colors"
                            title="Thu hồi quyền"
                          >
                            {revokingId === c.permissionId ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
