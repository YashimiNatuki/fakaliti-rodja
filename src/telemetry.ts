// SYS telemetry: poll system:info, score CPU% and MEM% against a rolling baseline with Z-score.
import { useEffect, useRef, useState } from 'react';
import { invoke } from './api';
import { Rolling, evaluate, type Reading } from './lib/zscore';

export interface Telemetry {
  info: any | null;
  cpu: Reading | null;
  mem: Reading | null;
  cpuH: Reading[]; // last 60 scored samples, for the sparkline
  memH: Reading[];
  anomaly: boolean;
}

const EMPTY: Telemetry = { info: null, cpu: null, mem: null, cpuH: [], memH: [], anomaly: false };
const KEEP = 60;

export function useTelemetry(active: boolean, intervalMs = 2000): Telemetry {
  const [t, setT] = useState<Telemetry>(EMPTY);
  const cpuW = useRef(new Rolling(KEEP));
  const memW = useRef(new Rolling(KEEP));

  useEffect(() => {
    if (!active) return;
    let alive = true;
    const tick = async () => {
      try {
        const info = await invoke('system:info');
        if (!alive) return;
        const cpu = evaluate(cpuW.current, info.cpuPct, { threshold: 2, sdFloor: 2 });
        const mem = evaluate(memW.current, info.memUsedPct, { threshold: 2, sdFloor: 0.5 });
        setT(prev => ({
          info, cpu, mem,
          cpuH: [...prev.cpuH, cpu].slice(-KEEP),
          memH: [...prev.memH, mem].slice(-KEEP),
          anomaly: cpu.anomaly || mem.anomaly
        }));
      } catch { /* no bridge */ }
    };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => { alive = false; clearInterval(id); };
  }, [active, intervalMs]);

  return t;
}
