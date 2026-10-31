import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';

type Tone = 'neutral' | 'primary' | 'danger';
const tones: Record<Tone, string> = {
  neutral: 'border-line text-text hover:border-cy/60 hover:text-cy',
  primary: 'border-cy/70 bg-cy/10 text-cy hover:bg-cy/20',
  danger: 'border-red/50 text-red hover:bg-red/10'
};

export function Btn({ tone = 'neutral', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone }) {
  return (
    <button
      type="button"
      {...p}
      className={`inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border px-3 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]} ${className}`}
    />
  );
}

const fieldCls =
  'w-full rounded-md border border-line bg-surface px-2.5 text-[13px] text-text placeholder:text-dim/70 focus:border-cy/70 focus:ring-1 focus:ring-cy/40';

export const Field = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...p }, ref) => <input ref={ref} {...p} className={`h-9 ${fieldCls} ${className}`} />
);
Field.displayName = 'Field';

export function Select({ className = '', children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={`relative ${className}`}>
      <select {...p} className={`h-9 appearance-none pr-8 ${fieldCls}`}>
        {children}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-dim" aria-hidden />
    </div>
  );
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-[11px] text-dim">
      {children}
    </label>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-line px-3 py-5 text-center">
      <div className="text-[13px] text-text">{title}</div>
      {children && <div className="mt-1 text-[12px] leading-relaxed text-dim">{children}</div>}
    </div>
  );
}

export type Dot = 'ok' | 'bad' | 'idle';
export function StatusDot({ state }: { state: Dot }) {
  const cls = state === 'ok' ? 'bg-cy shadow-[0_0_6px_rgb(var(--cy))]' : state === 'bad' ? 'bg-red' : 'bg-dim/60';
  return <span aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full ${cls}`} />;
}
