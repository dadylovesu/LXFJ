
const DB_NAME = 'OrangeStudioDB';
const STORE_NAME = 'Workflows';
const DB_VERSION = 1;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveToStorage = async (key: string, data: any) => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    // Check if data is valid
    if (!data || (Array.isArray(data) && data.length === 0)) {
        // We still save empty arrays to allow resetting, 
        // but we protect against undefined errors.
    }

    const request = store.put(data, key);
    
    return new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        console.debug(`[Persistence] Saved to IndexedDB: ${key}`);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to save to IndexedDB:", error);
  }
};

export const loadFromStorage = async <T>(key: string): Promise<T | null> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const result = request.result;
        console.debug(`[Persistence] Loaded from IndexedDB: ${key}`);
        resolve(result as T || null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to load from IndexedDB:", error);
    return null;
  }
};

export const clearStorage = async () => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    console.debug("[Persistence] IndexedDB cleared.");
  } catch (error) {
    console.error("Failed to clear IndexedDB:", error);
  }
};
