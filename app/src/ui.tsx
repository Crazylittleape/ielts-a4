import type { ReactNode } from 'react';
import { STAGE_LABELS, type WordItem } from './lib';

export const inputCls =
  'w-full rounded-2xl border border-rose-100 bg-white px-4 py-3 text-[16px] text-ink placeholder:text-ink-faint focus:border-rose-300 focus:outline-none focus:ring-4 focus:ring-rose-100/70 transition';

export const primaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-400 to-lilac-400 px-5 py-3.5 font-bold text-white shadow-lg shadow-rose-200/60 active:scale-[0.98] transition disabled:opacity-40 disabled:shadow-none';

export const softBtn =
  'inline-flex items-center justify-center gap-1.5 rounded-2xl bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-600 active:scale-[0.98] transition disabled:opacity-40';

export const ghostBtn =
  'inline-flex items-center justify-center gap-1.5 rounded-2xl border border-rose-100 bg-white px-4 py-2.5 text-sm font-bold text-ink-soft active:scale-[0.98] transition disabled:opacity-40';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl bg-white shadow-card ${className}`}>{children}</div>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between px-1">
      <h2 className="text-[15px] font-extrabold tracking-wide text-ink">{children}</h2>
      {right}
    </div>
  );
}

export function PageHeader({ title, subtitle, left, right }: { title: ReactNode; subtitle?: ReactNode; left?: ReactNode; right?: ReactNode }) {
  return (
    <header className="safe-top sticky top-0 z-20 bg-cream/85 px-5 pb-3 backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {left}
          <div className="min-w-0">
            <h1 className="truncate font-serif text-[26px] font-semibold leading-tight text-ink">{title}</h1>
            {subtitle && <p className="mt-0.5 text-xs font-semibold tracking-wide text-ink-soft">{subtitle}</p>}
          </div>
        </div>
        {right}
      </div>
    </header>
  );
}

const STAGE_STYLE = [
  'bg-rose-100 text-rose-600',
  'bg-honey-100 text-honey-500',
  'bg-lilac-100 text-lilac-500',
  'bg-sage-100 text-sage-500',
  'bg-sky-100 text-sky-600',
  'bg-stone-100 text-stone-500'
];

export function StageChip({ stage, compact = false, word }: { stage: number; compact?: boolean; word?: WordItem }) {
  const s = Math.max(0, Math.min(STAGE_LABELS.length - 1, stage));
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold ${STAGE_STYLE[s]}`}>
      {word?.isMastered ? '已掌握' : word?.card ? (compact ? 'FSRS' : ['新词', '学习', '复习', '重学'][word.card.state]) : 'FSRS'}
    </span>
  );
}

export interface SegOption<T extends string> {
  key: T;
  label: string;
  emoji?: string;
}

export function Segmented<T extends string>({ options, value, onChange, size = 'md' }: { options: SegOption<T>[]; value: T; onChange: (k: T) => void; size?: 'sm' | 'md' }) {
  return (
    <div className="flex rounded-2xl bg-rose-50/90 p-1">
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={`flex-1 rounded-xl py-1.5 font-bold transition ${size === 'sm' ? 'text-[11px]' : 'text-[12px]'} ${
              active ? 'bg-white text-rose-600 shadow-sm' : 'text-ink-soft'
            }`}
          >
            {o.emoji && <span className="mr-0.5">{o.emoji}</span>}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toast({ message, tone }: { message: string; tone: 'ok' | 'warn' | 'info' }) {
  const cls = tone === 'ok' ? 'bg-sage-500' : tone === 'warn' ? 'bg-honey-500' : 'bg-ink';
  return (
    <div className={`toast-in fixed left-1/2 z-[70] max-w-[88vw] rounded-2xl px-4 py-2.5 text-center text-[13px] font-bold text-white shadow-lg ${cls}`} style={{ bottom: 'calc(96px + env(safe-area-inset-bottom))' }}>
      {message}
    </div>
  );
}

const CONFETTI_COLORS = ['#F4C6D3', '#DF8AA3', '#D8C9EE', '#A88CD0', '#BFDBC9', '#79AC8D', '#F2CF8E', '#FFFFFF'];

export function Confetti({ title, subtitle, onClose }: { title: string; subtitle: string; onClose: () => void }) {
  const pieces = Array.from({ length: 70 }, (_, i) => ({
    left: `${(i * 137.5) % 100}%`,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    dx: `${((i * 53) % 120) - 60}px`,
    dur: `${2.2 + ((i * 7) % 10) / 10}s`,
    delay: `${((i * 11) % 12) / 10}s`,
    rot: `${(i * 47) % 360}deg`
  }));
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/30 backdrop-blur-sm" onClick={onClose}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {pieces.map((p, i) => (
          <span
            key={i}
            className="confetti-piece"
            style={{ left: p.left, background: p.color, transform: `rotate(${p.rot})`, ['--dx' as string]: p.dx, ['--dur' as string]: p.dur, ['--delay' as string]: p.delay }}
          />
        ))}
      </div>
      <div className="pop mx-8 rounded-[28px] bg-white px-8 py-8 text-center shadow-paper">
        <div className="text-5xl">🌸</div>
        <h3 className="mt-3 font-serif text-2xl font-semibold text-ink">{title}</h3>
        <p className="mt-2 text-sm font-semibold text-ink-soft">{subtitle}</p>
        <button type="button" className={`${primaryBtn} mt-5 w-full`} onClick={onClose}>
          好的
        </button>
      </div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline gap-2 px-1 text-xs font-extrabold tracking-wide text-ink-soft">
        {label}
        {hint && <span className="font-semibold text-ink-faint">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function Empty({ emoji, title, desc }: { emoji: string; title: string; desc?: string }) {
  return (
    <div className="px-6 py-10 text-center">
      <div className="text-4xl">{emoji}</div>
      <p className="mt-3 text-sm font-extrabold text-ink">{title}</p>
      {desc && <p className="mt-1 text-xs font-semibold text-ink-soft">{desc}</p>}
    </div>
  );
}
