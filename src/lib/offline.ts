export type QueuedScan = { client_scan_id: string; child_id: string; worker_id: string; captured_at: string; reference_type: string; reference_size_mm: number; image: Blob };
const DB = 'poshanscan-offline';
const STORE = 'scans';
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'client_scan_id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function transact<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore, resolve: (value: T) => void, reject: (error: unknown) => void) => void): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    tx.oncomplete = () => db.close();
    action(tx.objectStore(STORE), resolve, reject);
  });
}
export const listQueued = () => transact<QueuedScan[]>('readonly', (store, resolve, reject) => { const req = store.getAll(); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
export const saveQueued = (scan: QueuedScan) => transact<void>('readwrite', (store, resolve, reject) => { const req = store.put(scan); req.onsuccess = () => resolve(); req.onerror = () => reject(req.error); });
export const deleteQueued = (id: string) => transact<void>('readwrite', (store, resolve, reject) => { const req = store.delete(id); req.onsuccess = () => resolve(); req.onerror = () => reject(req.error); });
