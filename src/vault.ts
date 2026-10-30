// Yotes vault store. IndexedDB holds ONLY ciphertext + salt + verifier.
// The derived key is non-extractable and lives in memory until lock().
import { create } from 'zustand';
import { openDB, IDBPDatabase } from 'idb';
import { deriveKey, newSalt, seal, open, makeVerifier, checkVerifier, type Sealed } from './lib/crypto';
import type { Note } from './lib/rag';

type Payload = Pick<Note, 'title' | 'content' | 'tags' | 'source'>;
interface Row extends Sealed { id: string; created: number }
interface Meta { salt: string; verifier: Sealed; iter?: number }

let dbp: Promise<IDBPDatabase> | null = null;
const db = () =>
  (dbp ??= openDB('yotes-v1', 1, {
    upgrade(d) {
      d.createObjectStore('meta');
      d.createObjectStore('notes', { keyPath: 'id' });
    }
  }));

const IDLE_MS = 5 * 60_000;

interface VaultState {
  status: 'loading' | 'new' | 'locked' | 'unlocked';
  notes: Note[];
  error: string;
  init: () => Promise<void>;
  create: (pass: string) => Promise<void>;
  unlock: (pass: string) => Promise<void>;
  lock: () => void;
  save: (id: string | null, p: Payload) => Promise<string>;
  remove: (id: string) => Promise<void>;
  exportRows: () => Promise<string>;
}

let key: CryptoKey | null = null;
let idle: ReturnType<typeof setTimeout> | undefined;

export const useVault = create<VaultState>((set, get) => {
  const touch = () => {
    clearTimeout(idle);
    idle = setTimeout(() => get().lock(), IDLE_MS);
  };

  const loadAll = async () => {
    const rows: Row[] = await (await db()).getAll('notes');
    const out: Note[] = [];
    for (const r of rows) {
      try {
        out.push({ id: r.id, created: r.created, ...(await open<Payload>(key!, r)) });
      } catch { /* corrupt/tampered row: skip, don't crash the vault */ }
    }
    out.sort((a, b) => b.created - a.created);
    set({ notes: out });
  };

  return {
    status: 'loading',
    notes: [],
    error: '',

    init: async () => {
      const meta = (await (await db()).get('meta', 'main')) as Meta | undefined;
      set({ status: meta ? 'locked' : 'new' });
    },

    create: async (pass) => {
      if (pass.length < 10) return set({ error: 'Passphrase min 10 karaktera.' });
      const salt = newSalt();
      key = await deriveKey(pass, salt);
      const meta: Meta = { salt, verifier: await makeVerifier(key) };
      await (await db()).put('meta', meta, 'main');
      set({ status: 'unlocked', notes: [], error: '' });
      touch();
    },

    unlock: async (pass) => {
      const meta = (await (await db()).get('meta', 'main')) as Meta | undefined;
      if (!meta) return set({ status: 'new' });
      const k = await deriveKey(pass, meta.salt, meta.iter);
      if (!(await checkVerifier(k, meta.verifier))) return set({ error: 'Pogrešna passphrase.' });
      key = k;
      await loadAll();
      set({ status: 'unlocked', error: '' });
      touch();
    },

    lock: () => {
      key = null; // drop the only reference to the key
      clearTimeout(idle);
      set({ status: 'locked', notes: [], error: '' });
    },

    save: async (id, p) => {
      if (!key) throw new Error('vault locked');
      const existing = id ? get().notes.find(n => n.id === id) : undefined;
      const rid = id ?? crypto.randomUUID();
      const created = existing?.created ?? Date.now();
      const sealed = await seal(key, p);
      await (await db()).put('notes', { id: rid, created, ...sealed } satisfies Row);
      await loadAll();
      touch();
      return rid;
    },

    remove: async (id) => {
      await (await db()).delete('notes', id);
      await loadAll();
      touch();
    },

    // encrypted backup: ciphertext rows + meta. Useless without the passphrase.
    exportRows: async () => {
      const d = await db();
      return JSON.stringify({ v: 1, meta: await d.get('meta', 'main'), notes: await d.getAll('notes') });
    }
  };
});
