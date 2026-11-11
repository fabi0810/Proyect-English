import type { ReactNode } from 'react';
import { Info, Lightbulb, LoaderCircle, TriangleAlert, CircleAlert } from 'lucide-react';
import type { Level } from '../../types/content';
import { LEVEL_META } from '../../services/content/taxonomy';
import { cn } from '../../utils/cn';

export function Card({ className, children, as: Tag = 'div' }: { className?: string; children: ReactNode; as?: 'div' | 'section' | 'article' }) {
  return <Tag className={cn('card card-pad', className)}>{children}</Tag>;
}

export function CardTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-4 flex items-center justify-between gap-3', className)}>
      <h2 className="text-lg font-semibold tracking-tight text-ink">{children}</h2>
      {action}
    </div>
  );
}

export type Tone = 'neutral' | 'brand' | 'info' | 'success' | 'danger' | 'warning' | 'coral' | 'ink';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-ink-soft',
  brand: 'bg-brand-soft text-brand',
  info: 'bg-info-soft text-info',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
  warning: 'bg-warning-soft text-warning',
  coral: 'bg-coral text-white',
  ink: 'bg-ink text-on-ink',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', TONES[tone], className)}>
      {children}
    </span>
  );
}

export function LevelBadge({ level, size = 'sm', className }: { level: Level; size?: 'sm' | 'lg'; className?: string }) {
  const meta = LEVEL_META[level];
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-mono font-bold text-white',
        meta.color,
        size === 'sm' ? 'h-6 min-w-8 px-1.5 text-[11px]' : 'h-10 min-w-12 px-2 text-base',
        className,
      )}
    >
      {level}
    </span>
  );
}

export function ProgressBar({
  value,
  className,
  barClassName = 'bg-brand',
  size = 'md',
  label,
}: {
  value: number;
  className?: string;
  barClassName?: string;
  size?: 'xs' | 'sm' | 'md';
  label?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn('w-full overflow-hidden rounded-full bg-surface-3', size === 'xs' ? 'h-1' : size === 'sm' ? 'h-1.5' : 'h-2.5', className)}
    >
      <div className={cn('h-full rounded-full transition-[width] duration-500', barClassName)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ProgressRing({ value, size = 64, stroke = 7, className, children }: { value: number; size?: number; stroke?: number; className?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.min(1, Math.max(0, value));
  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--brand)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

export function Stat({ value, label, tone, className }: { value: ReactNode; label: ReactNode; tone?: 'success' | 'brand' | 'ink' | 'danger' | 'warning'; className?: string }) {
  const color = tone === 'success' ? 'text-success' : tone === 'brand' ? 'text-brand' : tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-ink';
  return (
    <div className={cn('rounded-2xl border border-line bg-surface px-4 py-3 text-center', className)}>
      <div className={cn('font-mono text-2xl font-bold tabular-nums', color)}>{value}</div>
      <div className="label-mono mt-0.5">{label}</div>
    </div>
  );
}

export function Pill({ active, onClick, children, className, count }: { active?: boolean; onClick?: () => void; children: ReactNode; className?: string; count?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-[13px] font-semibold transition-colors',
        active ? 'border-transparent bg-ink text-on-ink' : 'border-line bg-surface text-ink-soft hover:bg-surface-2',
        className,
      )}
    >
      {children}
      {count !== undefined && <span className={cn('font-mono text-[11px]', active ? 'opacity-80' : 'text-muted')}>{count}</span>}
    </button>
  );
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; disabled?: boolean }[];
  className?: string;
}) {
  return (
    <div role="tablist" className={cn('flex w-full gap-1 rounded-2xl border border-line bg-surface-2 p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all disabled:opacity-40',
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, children, action, className }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-3xl border border-dashed border-line px-6 py-12 text-center', className)}>
      {icon && <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-muted">{icon}</div>}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {children && <div className="mt-1 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Callout({ tone = 'info', title, children, className }: { tone?: 'info' | 'tip' | 'warning' | 'exception' | 'danger'; title?: ReactNode; children: ReactNode; className?: string }) {
  const map = {
    info: { cls: 'bg-info-soft border-info/20 text-ink', icon: <Info size={18} className="text-info" /> },
    tip: { cls: 'bg-success-soft border-success/20 text-ink', icon: <Lightbulb size={18} className="text-success" /> },
    warning: { cls: 'bg-warning-soft border-warning/25 text-ink', icon: <TriangleAlert size={18} className="text-warning" /> },
    exception: { cls: 'bg-brand-soft border-brand/20 text-ink', icon: <CircleAlert size={18} className="text-brand" /> },
    danger: { cls: 'bg-danger-soft border-danger/20 text-ink', icon: <CircleAlert size={18} className="text-danger" /> },
  }[tone];
  return (
    <div className={cn('flex gap-3 rounded-2xl border px-4 py-3.5', map.cls, className)}>
      <div className="mt-0.5 shrink-0">{map.icon}</div>
      <div className="min-w-0 text-[14.5px] leading-relaxed">
        {title && <div className="mb-0.5 font-semibold">{title}</div>}
        {children}
      </div>
    </div>
  );
}

export function Loading({ label = 'Cargando…', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-2 py-16 text-sm text-muted', className)}>
      <LoaderCircle size={18} className="animate-spin" /> {label}
    </div>
  );
}

export function ErrorBox({ error }: { error: Error | string }) {
  return (
    <Callout tone="danger" title="No se pudo cargar el contenido">
      {typeof error === 'string' ? error : error.message}
    </Callout>
  );
}

export function KeyHint({ children }: { children: ReactNode }) {
  return <kbd className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted">{children}</kbd>;
}

export const TONE_TEXT: Record<'success' | 'warning' | 'danger' | 'muted', string> = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  muted: 'text-muted',
};
