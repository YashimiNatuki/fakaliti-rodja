// Z = (X - mu) / sigma over a rolling window. Anomaly when |Z| > threshold.

export class Rolling {
  private xs: number[] = [];
  constructor(private cap = 60) {}

  push(x: number) {
    this.xs.push(x);
    if (this.xs.length > this.cap) this.xs.shift();
  }
  get n() {
    return this.xs.length;
  }
  get mean() {
    return this.n ? this.xs.reduce((a, b) => a + b, 0) / this.n : 0;
  }
  get sd() {
    if (this.n < 2) return 0;
    const m = this.mean;
    return Math.sqrt(this.xs.reduce((a, b) => a + (b - m) ** 2, 0) / (this.n - 1));
  }
}

export function zscore(x: number, mean: number, sd: number): number {
  return sd < 1e-9 ? 0 : (x - mean) / sd;
}

export interface Reading {
  x: number;
  z: number;
  mean: number;
  sd: number;
  n: number;
  anomaly: boolean;
}

export interface EvalOpts {
  threshold?: number; // |Z| above this is an anomaly (default 2)
  warmup?: number; // samples needed before anomalies can fire (default 10)
  sdFloor?: number; // min sigma, so a flat baseline doesn't flag tiny wobbles
}

// Score x against the PRIOR window, then add it. Scoring after pushing would
// let the outlier dilute its own baseline.
export function evaluate(w: Rolling, x: number, opts: EvalOpts = {}): Reading {
  const { threshold = 2, warmup = 10, sdFloor = 1 } = opts;
  const mean = w.mean;
  const sd = Math.max(w.sd, sdFloor);
  const n = w.n;
  const z = n >= 2 ? zscore(x, mean, sd) : 0;
  w.push(x);
  return { x, z, mean, sd, n, anomaly: n >= warmup && Math.abs(z) > threshold };
}
