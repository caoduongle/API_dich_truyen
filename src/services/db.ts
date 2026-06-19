import { StoryProject, Chapter, ChapterMetadata } from '../types';

const DB_NAME = 'ai-story-translator-db';
const DB_VERSION = 2;
const PROJECTS_STORE = 'projects';
const CHAPTERS_STORE = 'chapters';

let dbInstance: IDBDatabase | null = null;

export const initDB = (): Promise<IDBDatabase> => {
    if (dbInstance) return Promise.resolve(dbInstance);
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            dbInstance = request.result;
            resolve(dbInstance);
        };
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
                db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(CHAPTERS_STORE)) {
                db.createObjectStore(CHAPTERS_STORE, { keyPath: 'id' });
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
                await saveProjectToDB(project);
                
                const dbProject = await new Promise<any>((resolve, reject) => {
                    const transaction = db.transaction(PROJECTS_STORE, 'readonly');
                    const store = transaction.objectStore(PROJECTS_STORE);
                    const request = store.get(project.id);
                    request.onerror = () => reject(request.error);
                    request.onsuccess = () => resolve(request.result);
                });
                migratedProjects.push(dbProject);
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
                    chaptersToSave.push(chap as Chapter);
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

        // 2. Save full chapters to CHAPTERS_STORE if any
        if (chaptersToSave.length > 0) {
            const transaction = db.transaction(CHAPTERS_STORE, 'readwrite');
            const store = transaction.objectStore(CHAPTERS_STORE);
            for (const chap of chaptersToSave) {
                await new Promise<void>((resolve, reject) => {
                    const req = store.put(chap);
                    req.onsuccess = () => resolve();
                    req.onerror = () => reject(req.error);
                });
            }
        }

        // 3. Save project with metadata chapters only to PROJECTS_STORE
        const projectToSave = {
            ...project,
            chapters: normalizedChaptersMeta
        };

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(PROJECTS_STORE, 'readwrite');
            const store = transaction.objectStore(PROJECTS_STORE);
            const request = store.put(projectToSave);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    } catch (err) {
        console.error('IndexedDB Save Error:', err);
        throw err;
    }
};

export const deleteProjectFromDB = async (id: string): Promise<void> => {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(PROJECTS_STORE, 'readwrite');
            const store = transaction.objectStore(PROJECTS_STORE);
            const request = store.delete(id);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
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
