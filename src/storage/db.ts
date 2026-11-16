/**
 * Armazenamento local persistente.
 * - IndexedDB (banco "adivinhe-a-musica"): dados do jogo, catálogo e backups.
 * - localStorage: cópia espelho dos dados (recuperação) e preferências rápidas.
 * Nada é enviado para servidores.
 */
import type { AppData, BackupEntry, Catalog } from '../types';

const DB_NAME = 'adivinhe-a-musica';
const DB_VERSION = 1;
const STORE = 'kv';
const LS_MIRROR = 'adm:data-mirror';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  if (!db) return lsGet<T>(key);
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => resolve(undefined);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  if (!db) return lsSet(key, value);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function lsGet<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem('adm:' + key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function lsSet(key: string, value: unknown): void {
  try {
    localStorage.setItem('adm:' + key, JSON.stringify(value));
  } catch {
    /* cota excedida — o IndexedDB é a fonte principal */
  }
}

export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* ignore */
  }
  return false;
}

// ─── Dados do jogo ────────────────────────────────────────────

export async function loadData(): Promise<AppData | undefined> {
  const fromIdb = await idbGet<AppData>('data');
  if (fromIdb) return fromIdb;
  try {
    const raw = localStorage.getItem(LS_MIRROR);
    if (raw) return JSON.parse(raw) as AppData;
  } catch {
    /* ignore */
  }
  return undefined;
}

export async function saveData(data: AppData): Promise<void> {
  await idbSet('data', data);
  try {
    localStorage.setItem(LS_MIRROR, JSON.stringify(data));
  } catch {
    /* espelho é opcional (pode exceder a cota) */
  }
}

// ─── Catálogo ─────────────────────────────────────────────────

export async function loadCatalog(): Promise<Catalog | undefined> {
  return idbGet<Catalog>('catalog');
}

export async function saveCatalog(c: Catalog): Promise<void> {
  await idbSet('catalog', c);
}

// ─── Backups automáticos ──────────────────────────────────────

const MAX_BACKUPS = 15;

export async function listBackups(): Promise<BackupEntry[]> {
  return (await idbGet<BackupEntry[]>('backups')) ?? [];
}

export async function createBackup(reason: string, data: AppData): Promise<BackupEntry> {
  const entry: BackupEntry = {
    id: 'bk_' + Date.now().toString(36),
    createdAt: new Date().toISOString(),
    reason,
    data: JSON.parse(JSON.stringify(data)),
  };
  const list = await listBackups();
  list.unshift(entry);
  await idbSet('backups', list.slice(0, MAX_BACKUPS));
  return entry;
}
