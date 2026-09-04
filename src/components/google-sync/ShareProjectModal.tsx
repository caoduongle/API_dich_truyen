import React, { useState, useEffect, useCallback } from 'react';
import {
  Share2,
  UserPlus,
  Trash2,
  ShieldCheck,
  FolderLock,
  Mail,
  Loader2,
  Users,
  Layers,
} from 'lucide-react';
import { StoryProject } from '../../types';
import { CollaboratorPermission, SyncProgress } from '../../types/googleDriveSync';
import { googleAuthService } from '../../services/googleAuthService';
import { googleDriveSyncService } from '../../services/googleDriveSyncService';
import { googleDrivePermissionsService } from '../../services/googleDrivePermissionsService';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useNotifications } from '../NotificationSystem';
import { getProjectFromDB } from '../../services/db';

export type ShareStorageState = 'unshared' | 'granular' | 'bundle';

export function resolveShareStorageState(project: StoryProject | null): {
  state: ShareStorageState;
  targetResourceId: string | null;
  canManageCollaborators: boolean;
} {
  if (!project) {
    return { state: 'unshared', targetResourceId: null, canManageCollaborators: false };
  }
  if (project.driveStorageFormat === 'bundle' && !!project.driveFileId) {
    return { state: 'bundle', targetResourceId: project.driveFileId, canManageCollaborators: true };
  }
  if (project.driveStorageFormat === 'granular' && !!project.driveFolderId) {
    return { state: 'granular', targetResourceId: project.driveFolderId, canManageCollaborators: true };
  }
  return { state: 'unshared', targetResourceId: null, canManageCollaborators: false };
}

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
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [migrationProgress, setMigrationProgress] = useState<SyncProgress | null>(null);
  const [failedImgIds, setFailedImgIds] = useState<Set<string>>(new Set());

  const { showToast } = useNotifications();

  const { state: storageState, targetResourceId, canManageCollaborators } = resolveShareStorageState(project);
  const isGranular = storageState === 'granular';

  const loadCollaborators = useCallback(async () => {
    if (!targetResourceId) return;
    const token = googleAuthService.getValidAccessToken();
    if (!token) return;

    try {
      setIsLoadingList(true);
      const list = await googleDrivePermissionsService.listFolderCollaborators(
        token,
        targetResourceId
      );
      setCollaborators(list);
    } catch (err: any) {
      console.warn('Lỗi tải danh sách cộng tác viên:', err);
    } finally {
      setIsLoadingList(false);
    }
  }, [targetResourceId]);

  useEffect(() => {
    if (open && canManageCollaborators) {
      loadCollaborators();
    }
  }, [open, canManageCollaborators, loadCollaborators]);

  const handleMigrate = async () => {
    if (!project) return;
    const token = googleAuthService.getValidAccessToken();
    if (!token) {
      showToast({ message: 'Vui lòng đăng nhập Google trước khi chia sẻ dự án.', type: 'warning' });
      return;
    }

    try {
      setIsMigrating(true);
      const fileId = await googleDriveSyncService.migrateOwnerProjectToBundle(
        token,
        project.id,
        setMigrationProgress
      );
      const updated = await getProjectFromDB(project.id);
      if (updated) {
        onProjectUpdated?.(updated);
      }
      showToast({
        message: 'Đã đóng gói dự án dạng 1-file và sẵn sàng chia sẻ thành công!',
        type: 'success',
      });
      if (fileId) {
        loadCollaborators();
      }
    } catch (err: any) {
      showToast({ message: err.message || 'Lỗi chuyển đổi cấu trúc dự án.', type: 'error' });
    } finally {
      setIsMigrating(false);
    }
  };

  const handleUpgradeGranularToBundle = async () => {
    if (!project) return;
    const token = googleAuthService.getValidAccessToken();
    if (!token) {
      showToast({ message: 'Vui lòng đăng nhập Google trước khi nâng cấp dự án.', type: 'warning' });
      return;
    }

    if (
      !window.confirm(
        'Nâng cấp lên gói 1-file sẽ tạo file dữ liệu mới và chuyển dự án sang chuẩn đồng bộ tối ưu hơn. ' +
          'Các cộng tác viên cũ sẽ cần được cấp quyền lại trên file mới này và mở file mới qua Google Picker. ' +
          'Bạn có chắc chắn muốn nâng cấp ngay bây giờ?'
      )
    ) {
      return;
    }

    try {
      setIsMigrating(true);
      const fileId = await googleDriveSyncService.migrateOwnerProjectToBundle(
        token,
        project.id,
        setMigrationProgress
      );
      const updated = await getProjectFromDB(project.id);
      if (updated) {
        onProjectUpdated?.(updated);
      }
      showToast({
        message: 'Đã nâng cấp dự án lên gói 1-file thành công! Hãy chia sẻ lại với cộng tác viên.',
        type: 'success',
      });
      if (fileId) {
        loadCollaborators();
      }
    } catch (err: any) {
      showToast({ message: err.message || 'Lỗi nâng cấp dự án sang gói 1-file.', type: 'error' });
    } finally {
      setIsMigrating(false);
    }
  };

  const handleAddCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetResourceId) return;
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
        targetResourceId,
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
    if (!targetResourceId) return;
    const token = googleAuthService.getValidAccessToken();
    if (!token) return;

    if (!window.confirm(`Bạn có chắc chắn muốn thu hồi quyền của ${email || 'người dùng này'}?`)) {
      return;
    }

    try {
      setRevokingId(permissionId);
      await googleDrivePermissionsService.revokeFolderPermission(
        token,
        targetResourceId,
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
            • Dự án được lưu trữ thành 1 file dữ liệu duy nhất trong thư mục ứng dụng Google Drive (<code>AI_Dich_Truyen_Data</code>).
          </p>
          <p>
            • Người được mời chỉ được cấp quyền trên đúng file truyện này, hoàn toàn không xem được các dự án khác trong Drive của bạn.
          </p>
        </div>

        {/* Trạng thái 1: Chưa chuyển sang cấu trúc gói 1-file */}
        {!canManageCollaborators ? (
          <div className="p-5 border border-parchment-2 rounded-[2px] bg-ink/5 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-gold/15 flex items-center justify-center mx-auto border border-gold/30">
              <FolderLock className="w-6 h-6 text-gold" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-text-main">
                Chuẩn bị dự án để chia sẻ
              </h3>
              <p className="text-xs text-text-muted max-w-md mx-auto">
                Hệ thống sẽ đóng gói toàn bộ truyện thành một gói 1-file duy nhất trên Google Drive và lưu trữ an toàn. Người được mời sẽ có quyền truy cập trực tiếp để cùng dịch mà không lo phát sinh lỗi thiếu chương hay trùng file.
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
                {isMigrating ? 'Đang đóng gói dự án...' : 'Khởi tạo gói 1-file & Sẵn sàng chia sẻ'}
              </Button>
            </div>
          </div>
        ) : (
          /* Trạng thái 2 & 3: Đã là bundle hoặc granular, quản lý cộng tác viên */
          <div className="space-y-4">
            {/* Banner nâng cấp cho dự án Granular cũ */}
            {isGranular && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-[2px] text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                    Cấu trúc thư mục granular cũ (Spec 069)
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleUpgradeGranularToBundle}
                    disabled={isMigrating}
                    icon={isMigrating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
                  >
                    {isMigrating ? 'Đang nâng cấp...' : 'Nâng cấp lên gói 1-file'}
                  </Button>
                </div>
                <p className="text-text-muted text-[11px]">
                  Dự án này đang lưu ở dạng thư mục nhiều file. Bạn vẫn có thể quản lý cộng tác viên bên dưới, hoặc chủ động bấm nút nâng cấp sang gói 1-file để tối ưu tốc độ và độ ổn định khi đồng bộ.
                </p>
                {migrationProgress && isMigrating && (
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[11px] text-text-muted">
                      <span>{migrationProgress.message}</span>
                      <span>{migrationProgress.progressPercent}%</span>
                    </div>
                    <div className="w-full h-1 bg-ink/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gold transition-all duration-300"
                        style={{ width: `${migrationProgress.progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

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
                        {c.photoLink && !failedImgIds.has(c.permissionId) ? (
                          <img
                            src={c.photoLink}
                            alt={c.displayName || c.emailAddress || ''}
                            width={24}
                            height={24}
                            loading="lazy"
                            decoding="async"
                            onError={() => setFailedImgIds((prev) => new Set(prev).add(c.permissionId))}
                            className="w-6 h-6 rounded-full border border-parchment-2 object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center font-bold text-[10px] text-gold">
                            {(c.displayName || c.emailAddress || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-text-main leading-tight">
                            {c.displayName || (
                              c.emailAddress ? (
                                <a
                                  href={`mailto:${c.emailAddress}`}
                                  className="hover:text-polish transition-colors"
                                  title="Gửi email cho cộng tác viên"
                                >
                                  {c.emailAddress}
                                </a>
                              ) : 'Người dùng'
                            )}
                          </p>
                          {c.displayName && c.emailAddress && (
                            <a
                              href={`mailto:${c.emailAddress}`}
                              className="text-[10px] text-text-muted hover:text-polish transition-colors block"
                              title="Gửi email cho cộng tác viên"
                            >
                              {c.emailAddress}
                            </a>
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
