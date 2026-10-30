// Single place that touches the Electron bridge (window.fk, exposed by electron/preload.cjs).

type Inv = (ch: string, ...args: unknown[]) => Promise<any>;

declare global {
  interface Window {
    fk?: { invoke: Inv; send: (ch: string, ...args: unknown[]) => void };
  }
}

export const hasBridge = () => typeof window !== 'undefined' && !!window.fk;

export const invoke: Inv = (ch, ...args) =>
  window.fk ? window.fk.invoke(ch, ...args) : Promise.reject(new Error('Electron bridge nije dostupan (browser mode)'));

export const send = (ch: string, ...args: unknown[]) => window.fk?.send(ch, ...args);
