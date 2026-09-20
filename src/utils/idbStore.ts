/**
 * Tiny promise-based key-value wrapper over IndexedDB (one object store per database). Used for
 * data too big for localStorage: spilled undo states and saved project versions. Every call
 * fails soft — if IndexedDB is unavailable the callers keep working in memory / report an error.
 */
export class IdbStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor(private dbName: string, private storeName = 'kv') {}

  private open(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(this.dbName, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(this.storeName);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return this.dbPromise;
  }

  private async run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(this.storeName, mode);
      const req = fn(tx.objectStore(this.storeName));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  get<T>(key: string): Promise<T | undefined> {
    return this.run('readonly', (s) => s.get(key));
  }
  set(key: string, value: unknown): Promise<IDBValidKey> {
    return this.run('readwrite', (s) => s.put(value, key));
  }
  delete(key: string): Promise<undefined> {
    return this.run('readwrite', (s) => s.delete(key));
  }
  keys(): Promise<string[]> {
    return this.run('readonly', (s) => s.getAllKeys()).then((k) => k.map(String));
  }
  async getAll<T>(): Promise<T[]> {
    return this.run('readonly', (s) => s.getAll()) as Promise<T[]>;
  }
  clear(): Promise<undefined> {
    return this.run('readwrite', (s) => s.clear());
  }
}
