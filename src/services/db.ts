import { StoryProject } from '../types';

const DB_NAME = 'ai-story-translator-db';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

export const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
};

export const getProjectsFromDB = async (): Promise<StoryProject[]> => {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result || []);
        });
    } catch (err) {
        console.error('IndexedDB Get All Error:', err);
        return [];
    }
};

export const saveProjectToDB = async (project: StoryProject): Promise<void> => {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(project);
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
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    } catch (err) {
        console.error('IndexedDB Delete Error:', err);
        throw err;
    }
};
