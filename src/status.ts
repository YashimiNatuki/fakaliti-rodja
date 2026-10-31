import { useCallback, useEffect, useState } from 'react';
import { invoke } from './api';

export interface TorState { up: boolean; port: number | null }
export interface Status {
  ollama: boolean | null; // null = not checked yet
  tor: TorState | null;
  refresh: () => Promise<void>;
}

// One poller for the things the status line shows. Cheap local probes, every 15 s.
export function useStatus(): Status {
  const [ollama, setOllama] = useState<boolean | null>(null);
  const [tor, setTor] = useState<TorState | null>(null);

  const refresh = useCallback(async () => {
    const [o, t] = await Promise.all([
      invoke('ollama:status').catch(() => ({ up: false })),
      invoke('tor:status').catch(() => ({ up: false, port: null }))
    ]);
    setOllama(!!o.up);
    setTor(t);
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, [refresh]);

  return { ollama, tor, refresh };
}
