import { StoryProject, Chapter, ChapterMetadata } from '../types';

export const PROJECTS_STORE = 'projects';
export const CHAPTERS_STORE = 'chapters';
export const CRDT_STATES_STORE = 'crdt_states';

/**
 * Xử lý nâng cấp schema IndexedDB qua các phiên bản (onupgradeneeded)
 */
export function handleDBUpgrade(
  db: IDBDatabase,
  oldVersion: number,
  newVersion: number | null,
  transaction: IDBTransaction | null
): void {
  // Schema v1 -> v2: Khởi tạo store projects
  if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
    db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
  }

  // Schema v2 -> v3: Khởi tạo store chapters riêng biệt & index projectId
  let chaptersStore: IDBObjectStore | null = null;
  if (!db.objectStoreNames.contains(CHAPTERS_STORE)) {
    chaptersStore = db.createObjectStore(CHAPTERS_STORE, { keyPath: 'id' });
  } else if (transaction) {
    chaptersStore = transaction.objectStore(CHAPTERS_STORE);
  }

  if (chaptersStore) {
    const hasIndex = chaptersStore.indexNames && typeof chaptersStore.indexNames.contains === 'function'
      ? chaptersStore.indexNames.contains('projectId')
      : false;
    if (!hasIndex && typeof chaptersStore.createIndex === 'function') {
      chaptersStore.createIndex('projectId', 'projectId', { unique: false });
    }
  }

  // Schema v3 -> v4: Khởi tạo store crdt_states riêng biệt & index projectId
  let crdtStore: IDBObjectStore | null = null;
  if (!db.objectStoreNames.contains(CRDT_STATES_STORE)) {
    crdtStore = db.createObjectStore(CRDT_STATES_STORE, { keyPath: 'chapterId' });
  } else if (transaction) {
    crdtStore = transaction.objectStore(CRDT_STATES_STORE);
  }

  if (crdtStore) {
    const hasIndex = crdtStore.indexNames && typeof crdtStore.indexNames.contains === 'function'
      ? crdtStore.indexNames.contains('projectId')
      : false;
    if (!hasIndex && typeof crdtStore.createIndex === 'function') {
      crdtStore.createIndex('projectId', 'projectId', { unique: false });
    }
  }
}

/**
 * Migration dữ liệu từ v2 (chapters lưu gộp trong project record) sang v3 (tách chapters sang store riêng)
 */
export async function migrateLegacyProjects(
  rawProjects: any[],
  db: IDBDatabase
): Promise<StoryProject[]> {
  const migratedProjects: StoryProject[] = [];

  for (const project of rawProjects) {
    let needsMigration = false;
    if (project.chapters && Array.isArray(project.chapters)) {
      for (const chap of project.chapters) {
        if ('sourceText' in chap) {
          needsMigration = true;
          break;
        }
      }
    }

    if (needsMigration) {
      console.log(`[IndexedDB Migration] Chuyển đổi dữ liệu chương của dự án "${project.title}" sang store riêng...`);

      const normalizedChaptersMeta: ChapterMetadata[] = [];
      const chaptersToSave: Chapter[] = [];

      for (const chap of project.chapters) {
        if ('sourceText' in chap) {
          chaptersToSave.push({
            ...chap,
            projectId: project.id,
          });
          normalizedChaptersMeta.push({
            id: chap.id,
            title: chap.title,
            status: chap.status || 'not_started',
            createdAt: chap.createdAt,
            updatedAt: chap.updatedAt,
          });
        } else {
          normalizedChaptersMeta.push(chap);
        }
      }

      const migratedProject: StoryProject = {
        ...project,
        chapters: normalizedChaptersMeta,
      };

      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([PROJECTS_STORE, CHAPTERS_STORE], 'readwrite');
        const projectsStore = transaction.objectStore(PROJECTS_STORE);
        const chaptersStore = transaction.objectStore(CHAPTERS_STORE);

        transaction.onerror = () => reject(transaction.error);
        transaction.oncomplete = () => resolve();

        for (const chap of chaptersToSave) {
          chaptersStore.put(chap);
        }
        projectsStore.put(migratedProject);
      });

      migratedProjects.push(migratedProject);
    } else {
      migratedProjects.push(project);
    }
  }

  return migratedProjects;
}
