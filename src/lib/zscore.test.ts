import { describe, it, expect } from 'vitest';
import { Rolling, zscore, evaluate } from './zscore';

describe('zscore', () => {
  it('matches the textbook formula', () => {
    expect(zscore(12, 10, 2)).toBe(1);
    expect(zscore(6, 10, 2)).toBe(-2);
    expect(zscore(5, 5, 0)).toBe(0); // sd = 0 must not divide by zero
  });

  it('Rolling computes sample mean and sd', () => {
    const w = new Rolling(10);
    [2, 4, 4, 4, 5, 5, 7, 9].forEach(x => w.push(x));
    expect(w.mean).toBe(5);
    expect(w.sd).toBeCloseTo(2.138, 3);
  });

  it('Rolling drops the oldest sample past capacity', () => {
    const w = new Rolling(3);
    [1, 2, 3, 100].forEach(x => w.push(x));
    expect(w.n).toBe(3);
    expect(w.mean).toBe(35);
  });

  it('does not fire during warmup', () => {
    const w = new Rolling(60);
    for (let i = 0; i < 5; i++) evaluate(w, 10);
    expect(evaluate(w, 99).anomaly).toBe(false);
  });

  it('fires on a spike after warmup, not on noise', () => {
    const w = new Rolling(60);
    for (let i = 0; i < 20; i++) evaluate(w, 20 + (i % 3)); // 20,21,22 noise
    expect(evaluate(w, 21).anomaly).toBe(false);
    const spike = evaluate(w, 95);
    expect(spike.anomaly).toBe(true);
    expect(spike.z).toBeGreaterThan(2);
  });

  it('scores against the prior window, not including itself', () => {
    const w = new Rolling(60);
    for (let i = 0; i < 15; i++) evaluate(w, 10);
    const r = evaluate(w, 50);
    expect(r.mean).toBe(10); // baseline unaffected by the outlier being scored
  });

  it('sdFloor stops a flat baseline flagging a tiny change', () => {
    const w = new Rolling(60);
    for (let i = 0; i < 20; i++) evaluate(w, 30);
    expect(evaluate(w, 31).anomaly).toBe(false);
  });
});
