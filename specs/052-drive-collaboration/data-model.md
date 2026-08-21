# Data Model: Project Sharing & Drive Collaboration

**Feature Directory**: `specs/052-drive-collaboration`
**Date**: 2026-08-22

---

## 1. Entities & Relationships

```mermaid
classDiagram
    class StoryProject {
        +string id
        +string title
        +string author
        +string genre
        +string tone
        +string description
        +GlossaryItem[] glossary
        +PendingGlossaryItem[] pendingGlossary
        +ChapterMetadata[] chapters
        +string createdAt
        +string updatedAt
        +string driveFolderId
        +string driveStorageFormat
        +boolean isShared
        +boolean isOwner
        +CollaboratorPermission[] collaborators
    }

    class CollaboratorPermission {
        +string permissionId
        +string emailAddress
        +string displayName
        +string role
        +string photoLink
    }

    class ProjectManifest {
        +string projectId
        +string title
        +string updatedAt
        +ChapterManifestItem[] chapters
    }

    class ChapterManifestItem {
        +string id
        +string title
        +string updatedAt
        +number wordCount
        +string fileId
    }

    class ChapterConflictInfo {
        +string chapterId
        +string chapterTitle
        +string localUpdatedAt
        +string remoteUpdatedAt
        +Chapter localChapter
        +Chapter remoteChapter
    }

    StoryProject --> CollaboratorPermission
    ProjectManifest --> ChapterManifestItem
```

---

## 2. Extended TypeScript Types

### Extensions to `src/types.ts` & `src/types/googleDriveSync.ts`

```typescript
export interface CollaboratorPermission {
  permissionId: string;
  emailAddress: string;
  displayName?: string;
  role: 'writer' | 'reader' | 'owner';
  photoLink?: string;
}

export interface ChapterManifestItem {
  id: string;
  title: string;
  updatedAt: string;
  status: 'not_started' | 'in_progress' | 'completed';
  fileId?: string;
}

export interface SharedProjectManifest {
  version: string;
  projectId: string;
  title: string;
  updatedAt: string;
  chapters: ChapterManifestItem[];
}

export interface ChapterConflictInfo {
  chapterId: string;
  chapterTitle: string;
  localUpdatedAt: string;
  remoteUpdatedAt: string;
  localChapter: Chapter;
  remoteChapter: Chapter;
}
```
