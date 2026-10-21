import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { openDB, IDBPDatabase } from 'idb';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  ts: number;
}

interface ChatState {
  messages: ChatMessage[];
  add: (msg: Omit<ChatMessage, 'ts'>) => void;
  clear: () => void;
  loadFromElectron: () => Promise<void>;
  persistToElectron: () => Promise<void>;
}

let dbPromise: Promise<IDBPDatabase> | null = null;
function getDB() {
  if (!dbPromise) {
    dbPromise = openDB('fakaliti-v421', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('chat')) {
          db.createObjectStore('chat');
        }
      }
    });
  }
  return dbPromise;
}

const electronStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const db = await getDB();
    const val = await db.get('chat', name);
    return val ?? null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    const db = await getDB();
    await db.put('chat', value, name);
    try {
      const { ipcRenderer } = (window as any).require('electron');
      const parsed = JSON.parse(value);
      await ipcRenderer.invoke('chat:save', parsed.state.messages);
    } catch {}
  },
  removeItem: async (name: string): Promise<void> => {
    const db = await getDB();
    await db.delete('chat', name);
  }
};

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      add: (msg) => {
        const next = [...get().messages, { ...msg, ts: Date.now() }];
        set({ messages: next });
        get().persistToElectron();
      },
      clear: () => {
        set({ messages: [] });
        get().persistToElectron();
      },
      loadFromElectron: async () => {
        try {
          const { ipcRenderer } = (window as any).require('electron');
          const hist = await ipcRenderer.invoke('chat:get');
          if (Array.isArray(hist) && hist.length) set({ messages: hist });
        } catch {}
      },
      persistToElectron: async () => {
        try {
          const { ipcRenderer } = (window as any).require('electron');
          await ipcRenderer.invoke('chat:save', get().messages);
        } catch {}
      }
    }),
    {
      name: 'fakaliti-chat-v421',
      storage: createJSONStorage(() => electronStorage)
    }
  )
);
