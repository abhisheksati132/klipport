// Utility module for IndexedDB offline caching and history persistence
const DB_NAME = "KlipportOffline";
const DB_VERSION = 2;

let dbPromise = null;

export const getIndexedDB = () => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("offline_clips")) {
          db.createObjectStore("offline_clips", { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains("history_cache")) {
          db.createObjectStore("history_cache", { keyPath: "id" });
        }
      };

      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => {
        dbPromise = null;
        reject(e.target.error);
      };
    });
  }
  return dbPromise;
};

export const cacheHistoryClips = async (clips) => {
  try {
    const db = await getIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("history_cache", "readwrite");
      const store = transaction.objectStore("history_cache");
      store.clear();
      clips.forEach((clip) => store.put(clip));
      transaction.oncomplete = () => resolve();
      transaction.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error("IndexedDB cacheHistoryClips error:", err);
  }
};

export const getCachedHistoryClips = async () => {
  try {
    const db = await getIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("history_cache", "readonly");
      const store = transaction.objectStore("history_cache");
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error("IndexedDB getCachedHistoryClips error:", err);
    return [];
  }
};

export const saveOfflineClip = async (clip) => {
  const db = await getIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("offline_clips", "readwrite");
    const store = transaction.objectStore("offline_clips");
    const request = store.add(clip);
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
};

export const getOfflineClips = async () => {
  try {
    const db = await getIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("offline_clips", "readonly");
      const store = transaction.objectStore("offline_clips");
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error("IndexedDB getOfflineClips error:", err);
    return [];
  }
};

export const deleteOfflineClip = async (id) => {
  const db = await getIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("offline_clips", "readwrite");
    const store = transaction.objectStore("offline_clips");
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
};
