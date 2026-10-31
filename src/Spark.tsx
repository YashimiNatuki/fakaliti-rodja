import type { Reading } from './lib/zscore';

interface Props {
  data: Reading[];
  label: string;
}

const W = 240;
const H = 48;

// Line of the last 60 samples, shaded band = baseline mean +/- 2 sigma, red dots = anomalies.
export default function Spark({ data, label }: Props) {
  const last = data[data.length - 1];
  if (!last) {
    return <div className="h-[72px] rounded-md border border-line bg-surface px-3 py-2 text-[12px] text-dim">{label}: skupljam uzorke...</div>;
  }

  const xs = data.map(d => d.x);
  const lo0 = Math.min(...xs, last.mean - 2 * last.sd);
  const hi0 = Math.max(...xs, last.mean + 2 * last.sd);
  const pad = Math.max(2, (hi0 - lo0) * 0.12);
  const lo = Math.max(0, lo0 - pad);
  const hi = Math.min(100, hi0 + pad) <= lo + 10 ? lo + 10 : Math.min(100, hi0 + pad);
  const y = (v: number) => H - ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * H;
  const x = (i: number) => (data.length < 2 ? W : (i / (data.length - 1)) * W);

  const pts = data.map((d, i) => `${x(i).toFixed(1)},${y(d.x).toFixed(1)}`).join(' ');
  const bandTop = y(last.mean + 2 * last.sd);
  const bandBot = y(last.mean - 2 * last.sd);
  const hot = last.anomaly;

  return (
    <figure className="m-0 rounded-md border border-line bg-surface px-3 py-2">
      <figcaption className="mb-1 flex items-baseline justify-between text-[12px]">
        <span className="text-text">{label}</span>
        <span className={hot ? 'text-red' : 'text-dim'}>
          {last.x.toFixed(1)}% z {last.z >= 0 ? '+' : ''}{last.z.toFixed(2)}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="block h-12 w-full"
        role="img"
        aria-label={`${label} ${last.x.toFixed(1)} posto, z ${last.z.toFixed(2)}, ${hot ? 'anomalija' : 'normalno'}`}
      >
        <rect x="0" y={bandTop} width={W} height={Math.max(1, bandBot - bandTop)} fill="rgb(25 240 208 / 0.10)" />
        <polyline points={pts} fill="none" stroke={hot ? 'rgb(255 77 94)' : 'rgb(25 240 208)'} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
        {data.map((d, i) => d.anomaly && (
          <circle key={i} cx={x(i)} cy={y(d.x)} r="2.2" fill="rgb(255 77 94)" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="mt-1 text-[11px] text-dim">
        μ {last.mean.toFixed(1)} σ {last.sd.toFixed(1)} baseline {last.n}/60 {last.n < 10 ? '(zagrevanje)' : ''}
      </div>
    </figure>
  );
}
