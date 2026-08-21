import { CollaboratorPermission } from '../types/googleDriveSync';

const DRIVE_FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files';

class GoogleDrivePermissionsService {
  /**
   * Cấp quyền truy cập (writer / reader) trên một thư mục Google Drive cho email người dùng
   */
  public async shareFolderWithUser(
    accessToken: string,
    folderId: string,
    emailAddress: string,
    role: 'writer' | 'reader' = 'writer'
  ): Promise<CollaboratorPermission> {
    const cleanEmail = emailAddress.trim();
    if (!cleanEmail) {
      throw new Error('Vui lòng nhập địa chỉ email Google hợp lệ.');
    }

    const url = `${DRIVE_FILES_ENDPOINT}/${folderId}/permissions?fields=id,role,type,emailAddress,displayName,photoLink&sendNotificationEmail=false`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role,
        type: 'user',
        emailAddress: cleanEmail,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errorMsg =
        errData.error?.message || `Không thể cấp quyền cho email ${cleanEmail} (HTTP ${res.status})`;
      throw new Error(errorMsg);
    }

    const data = await res.json();
    return {
      permissionId: data.id,
      emailAddress: data.emailAddress || cleanEmail,
      displayName: data.displayName,
      role: data.role || role,
      photoLink: data.photoLink,
    };
  }

  /**
   * Lấy danh sách cộng tác viên có quyền truy cập trên thư mục
   */
  public async listFolderCollaborators(
    accessToken: string,
    folderId: string
  ): Promise<CollaboratorPermission[]> {
    const url = `${DRIVE_FILES_ENDPOINT}/${folderId}/permissions?fields=permissions(id,role,type,emailAddress,displayName,photoLink)`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(
        errData.error?.message || `Không thể lấy danh sách quyền thư mục (HTTP ${res.status})`
      );
    }

    const data = await res.json();
    if (!data.permissions || !Array.isArray(data.permissions)) {
      return [];
    }

    return data.permissions.map((p: any) => ({
      permissionId: p.id,
      emailAddress: p.emailAddress || '',
      displayName: p.displayName,
      role: p.role || 'writer',
      photoLink: p.photoLink,
    }));
  }

  /**
   * Thu hồi quyền truy cập của cộng tác viên khỏi thư mục
   */
  public async revokeFolderPermission(
    accessToken: string,
    folderId: string,
    permissionId: string
  ): Promise<boolean> {
    const url = `${DRIVE_FILES_ENDPOINT}/${folderId}/permissions/${permissionId}`;

    const res = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok && res.status !== 204) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(
        errData.error?.message || `Không thể thu hồi quyền (HTTP ${res.status})`
      );
    }

    return true;
  }
}

export const googleDrivePermissionsService = new GoogleDrivePermissionsService();
