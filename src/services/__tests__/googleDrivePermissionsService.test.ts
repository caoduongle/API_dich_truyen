import { describe, it, expect, vi, beforeEach } from 'vitest';
import { googleDrivePermissionsService } from '../googleDrivePermissionsService';

describe('googleDrivePermissionsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shares a folder or file with a user via POST /files/{resourceId}/permissions', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'perm_123',
        role: 'writer',
        type: 'user',
        emailAddress: 'collab@gmail.com',
        displayName: 'Collaborator Name',
      }),
    } as any);

    const result = await googleDrivePermissionsService.shareFolderWithUser(
      'mock_access_token',
      'bundle_file_456',
      'collab@gmail.com',
      'writer'
    );

    expect(result.permissionId).toBe('perm_123');
    expect(result.emailAddress).toBe('collab@gmail.com');
    expect(result.role).toBe('writer');

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/files/bundle_file_456/permissions'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer mock_access_token',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          role: 'writer',
          type: 'user',
          emailAddress: 'collab@gmail.com',
        }),
      })
    );
  });

  it('lists active collaborators for a file or folder resource via GET /files/{resourceId}/permissions', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        permissions: [
          {
            id: 'perm_1',
            role: 'owner',
            type: 'user',
            emailAddress: 'owner@gmail.com',
            displayName: 'Owner',
          },
          {
            id: 'perm_2',
            role: 'writer',
            type: 'user',
            emailAddress: 'collab@gmail.com',
            displayName: 'Collaborator',
          },
        ],
      }),
    } as any);

    const list = await googleDrivePermissionsService.listFolderCollaborators(
      'mock_token',
      'bundle_file_456'
    );

    expect(list.length).toBe(2);
    expect(list[1].emailAddress).toBe('collab@gmail.com');
    expect(list[1].role).toBe('writer');
  });

  it('revokes a permission via DELETE /files/{resourceId}/permissions/{permissionId}', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 204,
    } as any);

    const success = await googleDrivePermissionsService.revokeFolderPermission(
      'mock_token',
      'bundle_file_456',
      'perm_2'
    );

    expect(success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/files/bundle_file_456/permissions/perm_2'),
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({
          Authorization: 'Bearer mock_token',
        }),
      })
    );
  });
});
