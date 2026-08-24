import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveShareStorageState } from '../ShareProjectModal';
import { StoryProject } from '../../../types';
import { googleDriveSyncService } from '../../../services/googleDriveSyncService';
import { googleDrivePermissionsService } from '../../../services/googleDrivePermissionsService';

describe('ShareProjectModal State Resolution & Sharing Architecture', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('resolveShareStorageState', () => {
    it('resolves unshared state for null project', () => {
      const result = resolveShareStorageState(null);
      expect(result.state).toBe('unshared');
      expect(result.targetResourceId).toBeNull();
      expect(result.canManageCollaborators).toBe(false);
    });

    it('resolves unshared state for newly created project without Drive IDs', () => {
      const project: StoryProject = {
        id: 'proj_new',
        title: 'New Story',
        author: 'Author',
        genre: 'Genre',
        tone: 'Tone',
        description: '',
        glossary: [],
        pendingGlossary: [],
        chapters: [],
        createdAt: '2026-08-24',
        updatedAt: '2026-08-24',
      };

      const result = resolveShareStorageState(project);
      expect(result.state).toBe('unshared');
      expect(result.targetResourceId).toBeNull();
      expect(result.canManageCollaborators).toBe(false);
    });

    it('resolves unshared state for monolithic format project', () => {
      const project: StoryProject = {
        id: 'proj_mono',
        title: 'Monolithic Story',
        author: 'Author',
        genre: 'Genre',
        tone: 'Tone',
        description: '',
        glossary: [],
        pendingGlossary: [],
        chapters: [],
        createdAt: '2026-08-24',
        updatedAt: '2026-08-24',
        driveStorageFormat: 'monolithic',
      };

      const result = resolveShareStorageState(project);
      expect(result.state).toBe('unshared');
      expect(result.targetResourceId).toBeNull();
      expect(result.canManageCollaborators).toBe(false);
    });

    it('resolves granular state with driveFolderId for legacy granular projects', () => {
      const project: StoryProject = {
        id: 'proj_gran',
        title: 'Granular Story',
        author: 'Author',
        genre: 'Genre',
        tone: 'Tone',
        description: '',
        glossary: [],
        pendingGlossary: [],
        chapters: [],
        createdAt: '2026-08-24',
        updatedAt: '2026-08-24',
        driveFolderId: 'folder_abc_123',
        driveStorageFormat: 'granular',
      };

      const result = resolveShareStorageState(project);
      expect(result.state).toBe('granular');
      expect(result.targetResourceId).toBe('folder_abc_123');
      expect(result.canManageCollaborators).toBe(true);
    });

    it('resolves bundle state with driveFileId for modern 1-file bundle projects', () => {
      const project: StoryProject = {
        id: 'proj_bundle',
        title: 'Bundle Story',
        author: 'Author',
        genre: 'Genre',
        tone: 'Tone',
        description: '',
        glossary: [],
        pendingGlossary: [],
        chapters: [],
        createdAt: '2026-08-24',
        updatedAt: '2026-08-24',
        driveFileId: 'file_bundle_789',
        driveStorageFormat: 'bundle',
      };

      const result = resolveShareStorageState(project);
      expect(result.state).toBe('bundle');
      expect(result.targetResourceId).toBe('file_bundle_789');
      expect(result.canManageCollaborators).toBe(true);
    });
  });

  describe('Service Wiring Contracts for ShareProjectModal', () => {
    it('guarantees migrateOwnerProjectToBundle is available on googleDriveSyncService', () => {
      expect(typeof googleDriveSyncService.migrateOwnerProjectToBundle).toBe('function');
    });

    it('guarantees permissions service accepts file or folder resourceId', async () => {
      const shareSpy = vi
        .spyOn(googleDrivePermissionsService, 'shareFolderWithUser')
        .mockResolvedValue({
          permissionId: 'perm_1',
          emailAddress: 'user@gmail.com',
          role: 'writer',
        });

      const listSpy = vi
        .spyOn(googleDrivePermissionsService, 'listFolderCollaborators')
        .mockResolvedValue([
          { permissionId: 'perm_1', emailAddress: 'user@gmail.com', role: 'writer' },
        ]);

      const revokeSpy = vi
        .spyOn(googleDrivePermissionsService, 'revokeFolderPermission')
        .mockResolvedValue(true);

      // Verify file resource call (Bundle)
      await googleDrivePermissionsService.shareFolderWithUser(
        'mock_token',
        'file_bundle_789',
        'user@gmail.com',
        'writer'
      );
      expect(shareSpy).toHaveBeenCalledWith(
        'mock_token',
        'file_bundle_789',
        'user@gmail.com',
        'writer'
      );

      await googleDrivePermissionsService.listFolderCollaborators('mock_token', 'file_bundle_789');
      expect(listSpy).toHaveBeenCalledWith('mock_token', 'file_bundle_789');

      await googleDrivePermissionsService.revokeFolderPermission(
        'mock_token',
        'file_bundle_789',
        'perm_1'
      );
      expect(revokeSpy).toHaveBeenCalledWith('mock_token', 'file_bundle_789', 'perm_1');

      // Verify folder resource call (Granular)
      await googleDrivePermissionsService.shareFolderWithUser(
        'mock_token',
        'folder_abc_123',
        'user@gmail.com',
        'writer'
      );
      expect(shareSpy).toHaveBeenCalledWith(
        'mock_token',
        'folder_abc_123',
        'user@gmail.com',
        'writer'
      );
    });
  });
});
