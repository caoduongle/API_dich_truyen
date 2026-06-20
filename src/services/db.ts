import { StoryProject, Chapter, ChapterMetadata } from '../types';

const DB_NAME = 'ai-story-translator-db';
const DB_VERSION = 3;
const PROJECTS_STORE = 'projects';
const CHAPTERS_STORE = 'chapters';

let dbInstance: IDBDatabase | null = null;

export const initDB = (): Promise<IDBDatabase> => {
    if (dbInstance) return Promise.resolve(dbInstance);
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const db = request.result;
            dbInstance = db;
            db.onclose = () => {
                dbInstance = null;
            };
            db.onversionchange = () => {
                db.close();
                dbInstance = null;
            };
            resolve(db);
        };
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
                db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
            }
            let chaptersStore: IDBObjectStore;
            if (!db.objectStoreNames.contains(CHAPTERS_STORE)) {
                chaptersStore = db.createObjectStore(CHAPTERS_STORE, { keyPath: 'id' });
            } else {
                chaptersStore = request.transaction!.objectStore(CHAPTERS_STORE);
            }
            if (!chaptersStore.indexNames.contains('projectId')) {
                chaptersStore.createIndex('projectId', 'projectId', { unique: false });
            }
        };
    });
};

export const getProjectsFromDB = async (): Promise<StoryProject[]> => {
    try {
        const db = await initDB();
        const rawProjects = await new Promise<any[]>((resolve, reject) => {
            const transaction = db.transaction(PROJECTS_STORE, 'readonly');
            const store = transaction.objectStore(PROJECTS_STORE);
            const request = store.getAll();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result || []);
        });

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
                console.log(`Migrating project "${project.title}" chapters to separate store...`);
                
                const normalizedChaptersMeta: ChapterMetadata[] = [];
                const chaptersToSave: Chapter[] = [];
                for (const chap of project.chapters) {
                    if ('sourceText' in chap) {
                        chaptersToSave.push({
                            ...chap,
                            projectId: project.id
                        });
                        normalizedChaptersMeta.push({
                            id: chap.id,
                            title: chap.title,
                            status: chap.status || 'not_started',
                            createdAt: chap.createdAt,
                            updatedAt: chap.updatedAt
                        });
                    } else {
                        normalizedChaptersMeta.push(chap);
                    }
                }

                const migratedProject: StoryProject = {
                    ...project,
                    chapters: normalizedChaptersMeta
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
    } catch (err) {
        console.error('IndexedDB Get All Error:', err);
        return [];
    }
};

export const saveProjectToDB = async (project: StoryProject): Promise<void> => {
    try {
        const db = await initDB();

        // 1. Separate full chapters from project
        const chaptersToSave: Chapter[] = [];
        const normalizedChaptersMeta: ChapterMetadata[] = [];

        if (project.chapters && Array.isArray(project.chapters)) {
            for (const chap of project.chapters) {
                if ('sourceText' in chap) {
                    chaptersToSave.push({
                        ...(chap as Chapter),
                        projectId: project.id
                    });
                    normalizedChaptersMeta.push({
                        id: chap.id,
                        title: chap.title,
                        status: chap.status || 'not_started',
                        createdAt: chap.createdAt,
                        updatedAt: chap.updatedAt
                    });
                } else {
                    normalizedChaptersMeta.push(chap as ChapterMetadata);
                }
            }
        }

        // 2. Save everything in a single unified transaction
        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction([PROJECTS_STORE, CHAPTERS_STORE], 'readwrite');
            const projectsStore = transaction.objectStore(PROJECTS_STORE);
            const chaptersStore = transaction.objectStore(CHAPTERS_STORE);

            transaction.onerror = () => reject(transaction.error);
            transaction.oncomplete = () => resolve();

            for (const chap of chaptersToSave) {
                chaptersStore.put(chap);
            }

            const projectToSave = {
                ...project,
                chapters: normalizedChaptersMeta
            };
            projectsStore.put(projectToSave);
        });
    } catch (err) {
        console.error('IndexedDB Save Error:', err);
        throw err;
    }
};

export const deleteProjectFromDB = async (id: string): Promise<void> => {
    try {
        const db = await initDB();
        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction([PROJECTS_STORE, CHAPTERS_STORE], 'readwrite');
            const projectsStore = transaction.objectStore(PROJECTS_STORE);
            const chaptersStore = transaction.objectStore(CHAPTERS_STORE);

            transaction.onerror = () => reject(transaction.error);
            transaction.oncomplete = () => resolve();

            // 1. Delete the project record
            projectsStore.delete(id);

            // 2. Delete all chapters associated with this project
            if (chaptersStore.indexNames.contains('projectId')) {
                const index = chaptersStore.index('projectId');
                const cursorRequest = index.openKeyCursor(IDBKeyRange.only(id));
                cursorRequest.onerror = () => reject(cursorRequest.error);
                cursorRequest.onsuccess = (event) => {
                    const cursor = (event.target as IDBRequest<IDBCursor | null>).result;
                    if (cursor) {
                        chaptersStore.delete(cursor.primaryKey);
                        cursor.continue();
                    }
                };
            } else {
                // Fallback: cursor through whole store if index is not created
                const cursorRequest = chaptersStore.openCursor();
                cursorRequest.onerror = () => reject(cursorRequest.error);
                cursorRequest.onsuccess = (event) => {
                    const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
                    if (cursor) {
                        if (cursor.value.projectId === id) {
                            cursor.delete();
                        }
                        cursor.continue();
                    }
                };
            }
        });
    } catch (err) {
        console.error('IndexedDB Delete Error:', err);
        throw err;
    }
};

export const getChapterFromDB = async (id: string): Promise<Chapter | null> => {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(CHAPTERS_STORE, 'readonly');
            const store = transaction.objectStore(CHAPTERS_STORE);
            const request = store.get(id);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result || null);
        });
    } catch (err) {
        console.error('IndexedDB Get Chapter Error:', err);
        return null;
    }
};

export const saveChapterToDB = async (chapter: Chapter): Promise<void> => {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(CHAPTERS_STORE, 'readwrite');
            const store = transaction.objectStore(CHAPTERS_STORE);
            const request = store.put(chapter);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    } catch (err) {
        console.error('IndexedDB Save Chapter Error:', err);
        throw err;
    }
};

export const saveChaptersToDB = async (chapters: Chapter[]): Promise<void> => {
    try {
        const db = await initDB();
        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(CHAPTERS_STORE, 'readwrite');
            const store = transaction.objectStore(CHAPTERS_STORE);
            transaction.onerror = () => reject(transaction.error);
            transaction.oncomplete = () => resolve();
            for (const chap of chapters) {
                store.put(chap);
            }
        });
    } catch (err) {
        console.error('IndexedDB Save Chapters Error:', err);
        throw err;
    }
};

export const deleteChapterFromDB = async (id: string): Promise<void> => {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(CHAPTERS_STORE, 'readwrite');
            const store = transaction.objectStore(CHAPTERS_STORE);
            const request = store.delete(id);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    } catch (err) {
        console.error('IndexedDB Delete Chapter Error:', err);
        throw err;
    }
};

export const getChaptersByProjectFromDB = async (projectId: string): Promise<Chapter[]> => {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(CHAPTERS_STORE, 'readonly');
            const store = transaction.objectStore(CHAPTERS_STORE);
            if (!store.indexNames.contains('projectId')) {
                // Fallback: load all and filter in memory if index does not exist
                const request = store.getAll();
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    const all = request.result || [];
                    resolve(all.filter((c: any) => c.projectId === projectId));
                };
                return;
            }
            const index = store.index('projectId');
            const request = index.getAll(projectId);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result || []);
        });
    } catch (err) {
        console.error('IndexedDB Get Chapters By Project Error:', err);
        return [];
    }
};

export const deleteChaptersByProjectFromDB = async (projectId: string): Promise<void> => {
    try {
        const db = await initDB();
        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(CHAPTERS_STORE, 'readwrite');
            const store = transaction.objectStore(CHAPTERS_STORE);
            if (!store.indexNames.contains('projectId')) {
                resolve();
                return;
            }
            const index = store.index('projectId');
            const request = index.openKeyCursor(IDBKeyRange.only(projectId));
            request.onerror = () => reject(request.error);
            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursor | null>).result;
                if (cursor) {
                    store.delete(cursor.primaryKey);
                    cursor.continue();
                } else {
                    resolve();
                }
            };
        });
    } catch (err) {
        console.error('IndexedDB Delete Chapters By Project Error:', err);
        throw err;
    }
};
