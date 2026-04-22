import type { Cache, CacheHeader } from 'o1js';

/**
 * IndexedDB-backed o1js Cache. Compiled prover keys for our ZkProgram +
 * SmartContract are large (tens of MB total) but stable: the same source
 * always produces the same keys. After first compile, subsequent page
 * loads can pull keys straight from IndexedDB and skip the 30-60s
 * compile entirely.
 *
 * Trade-off: o1js's Cache interface is *synchronous* (read returns
 * `Uint8Array | undefined`, not a Promise), but IndexedDB is async.
 * We resolve this by warming up: at app start we read all known cache
 * entries into an in-memory Map, then `read()` is a synchronous Map
 * lookup. `write()` queues an async IDB put without blocking the
 * caller.
 *
 * If the cache is cold (first ever visit), `read()` returns undefined
 * — o1js falls back to compiling, then calls `write()` for each
 * artifact, which we persist to IDB. Next visit is fast.
 *
 * IndexedDB has a per-origin quota (typically several GB on desktop,
 * ~50MB on mobile Safari). If write fails (quota exceeded, private
 * browsing), we silently degrade to "compile every time" — same as
 * having no cache at all.
 */

const DB_NAME = 'zk-proof-of-origin-cache';
const STORE = 'circuit-keys';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadAll(): Promise<Map<string, Uint8Array>> {
  const map = new Map<string, Uint8Array>();
  if (typeof indexedDB === 'undefined') return map;
  let db: IDBDatabase;
  try {
    db = await openDb();
  } catch {
    return map;
  }
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        if (
          typeof cursor.key === 'string' &&
          cursor.value instanceof Uint8Array
        ) {
          map.set(cursor.key, cursor.value);
        }
        cursor.continue();
      } else {
        resolve();
      }
    };
    req.onerror = () => resolve(); // silent on failure
    tx.onerror = () => resolve();
  });
  db.close();
  return map;
}

async function putOne(key: string, value: Uint8Array): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  let db: IDBDatabase;
  try {
    db = await openDb();
  } catch {
    return;
  }
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
  db.close();
}

function cacheKey(header: CacheHeader): string {
  // o1js's persistentId is the canonical artifact identifier; uniqueId
  // changes when the source changes. Combine both so an upgrade
  // automatically invalidates without us tracking versions.
  return `${header.persistentId}|${header.uniqueId}|v${header.version}`;
}

let warmupPromise: Promise<Map<string, Uint8Array>> | null = null;
let warmedCache: Map<string, Uint8Array> | null = null;

/**
 * Call before any ZkProgram.compile() / SmartContract.compile().
 * Reads all cached artifacts from IDB into memory so subsequent
 * synchronous read() lookups are fast and complete.
 */
export async function warmCircuitCache(): Promise<void> {
  if (warmedCache) return;
  if (!warmupPromise) warmupPromise = loadAll();
  warmedCache = await warmupPromise;
}

export const idbCache: Cache = {
  read(header: CacheHeader): Uint8Array | undefined {
    return warmedCache?.get(cacheKey(header));
  },
  write(header: CacheHeader, value: Uint8Array): void {
    const key = cacheKey(header);
    if (warmedCache) warmedCache.set(key, value);
    void putOne(key, value);
  },
  canWrite: true,
};
