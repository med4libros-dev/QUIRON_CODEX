/**
 * Envoltorio mínimo de IndexedDB.
 *  - kv:   estado serializado de los stores grandes (biblioteca, notas)
 *  - pdfs: archivos PDF como Blob (pueden pesar cientos de MB)
 *  - ink:  trazos del lienzo por nota (se cargan solo al abrir la nota)
 */
type StoreName = 'kv' | 'pdfs' | 'ink';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('alquimia', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of ['kv', 'pdfs', 'ink'] as const) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(req.result as T);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

/** Contador de escrituras: el respaldo automático se salta si nada cambió desde el último. */
let changes = 0;
export const changeCount = () => changes;
export const bumpChanges = () => {
  changes++;
};

export const idb = {
  get: <T>(store: StoreName, key: string) => run<T | undefined>(store, 'readonly', (s) => s.get(key)),
  set: (store: StoreName, key: string, value: unknown) => (changes++, run<void>(store, 'readwrite', (s) => s.put(value, key))),
  del: (store: StoreName, key: string) => run<void>(store, 'readwrite', (s) => s.delete(key)),
  keys: (store: StoreName) => run<IDBValidKey[]>(store, 'readonly', (s) => s.getAllKeys()).then((k) => k.map(String)),
};
