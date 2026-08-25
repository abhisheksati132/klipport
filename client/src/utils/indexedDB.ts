// Utility module for IndexedDB offline caching and history persistence
import type { ClipboardItem, OfflineClip } from "../types";

const DB_NAME = "KlipportOffline";
const DB_VERSION = 2;

let dbPromise: Promise<IDBDatabase> | null = null;

export const getIndexedDB = (): Promise<IDBDatabase> => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db: IDBDatabase = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains("offline_clips")) {
          db.createObjectStore("offline_clips", { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains("history_cache")) {
          db.createObjectStore("history_cache", { keyPath: "id" });
        }
      };

      request.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
      request.onerror = (e) => {
        dbPromise = null;
        reject((e.target as IDBOpenDBRequest).error);
      };
    });
  }
  return dbPromise;
};

export const cacheHistoryClips = async (clips: ClipboardItem[]): Promise<void | undefined> => {
  try {
    const db = await getIndexedDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("history_cache", "readwrite");
      const store = transaction.objectStore("history_cache");
      store.clear();
      clips.forEach((clip) => store.put(clip));
      transaction.oncomplete = () => resolve();
      transaction.onerror = (e) => reject((e.target as IDBTransaction).error);
    });
  } catch (err) {
    console.error("IndexedDB cacheHistoryClips error:", err);
  }
};

export const getCachedHistoryClips = async (): Promise<ClipboardItem[]> => {
  try {
    const db = await getIndexedDB();
    return new Promise<ClipboardItem[]>((resolve, reject) => {
      const transaction = db.transaction("history_cache", "readonly");
      const store = transaction.objectStore("history_cache");
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (e) => reject((e.target as IDBRequest).error);
    });
  } catch (err) {
    console.error("IndexedDB getCachedHistoryClips error:", err);
    return [];
  }
};

export const saveOfflineClip = async (clip: ClipboardItem): Promise<void> => {
  const db = await getIndexedDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("offline_clips", "readwrite");
    const store = transaction.objectStore("offline_clips");
    const request = store.add(clip);
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject((e.target as IDBRequest).error);
  });
};

export const getOfflineClips = async (): Promise<OfflineClip[]> => {
  try {
    const db = await getIndexedDB();
    return new Promise<OfflineClip[]>((resolve, reject) => {
      const transaction = db.transaction("offline_clips", "readonly");
      const store = transaction.objectStore("offline_clips");
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (e) => reject((e.target as IDBRequest).error);
    });
  } catch (err) {
    console.error("IndexedDB getOfflineClips error:", err);
    return [];
  }
};

export const deleteOfflineClip = async (id: number): Promise<void> => {
  const db = await getIndexedDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("offline_clips", "readwrite");
    const store = transaction.objectStore("offline_clips");
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject((e.target as IDBRequest).error);
  });
};
