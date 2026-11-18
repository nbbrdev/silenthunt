/**
 * The saved world in the browser's IndexedDB (T3-A, NBB-147): one record ("world") in one store.
 * One world at a time (RF-61).
 */
const DATABASE = "silenthunt";
const STORE = "saves";
const KEY = "world";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB não abriu"));
  });
}

/** Runs one request on the store and closes the database when the transaction ends. */
async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE, mode);
    const request = run(transaction.objectStore(STORE));
    transaction.oncomplete = () => {
      database.close();
      resolve(request.result);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("IndexedDB falhou"));
    };
  });
}

/** The saved world, or undefined if there is none. */
export async function readSave(): Promise<unknown> {
  return withStore<unknown>("readonly", (store) => store.get(KEY));
}

export async function writeSave(data: unknown): Promise<void> {
  await withStore("readwrite", (store) => store.put(data, KEY));
}

export async function deleteSave(): Promise<void> {
  await withStore("readwrite", (store) => store.delete(KEY));
}
