import { useEffect, type ReactNode } from 'react';
import { Volume2 } from 'lucide-react';
import { STAGE_LABELS, type WordExample, type WordItem } from './lib';
import { exampleFor, highlightParts } from './book';

export const inputCls =
  'w-full rounded-2xl border border-blush bg-white px-4 py-3 text-[15px] text-ink placeholder:text-ink-faint focus:border-rose-400 focus:outline-none focus:ring-3 focus:ring-rose-100/70 transition shadow-xs';

export const primaryBtn =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-5 py-3 text-sm font-bold text-white shadow-button transition hover:bg-rose-700 active:scale-[0.985] disabled:scale-100 disabled:opacity-40 disabled:pointer-events-none';

export const softBtn =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-600 transition hover:bg-rose-100/70 active:scale-[0.985] disabled:scale-100 disabled:opacity-40';

export const ghostBtn =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border border-blush bg-white px-4 py-2.5 text-sm font-bold text-ink shadow-[0_1px_2px_rgba(26,29,41,0.03)] transition hover:bg-stone-50/80 hover:border-stone-300 active:scale-[0.985] disabled:scale-100 disabled:opacity-40';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-blush/60 bg-white shadow-card ${className}`}>{children}</div>;
}

/** Sourced example sentence with read-aloud; renders nothing without an example. */
export function ExampleBlock({ word, onSpeak, className = '', expanded = false }: { word: WordExample & { word: string }; onSpeak: (text: string) => void; className?: string; expanded?: boolean }) {
  const example = exampleFor(word);
  if (!example) return null;
  const content = <>
    <p lang="en" className="mt-1 break-words font-serif text-[15px] leading-snug text-ink">{highlightParts(example.exampleEn, word.word).map((part, index) => part.hit ? <mark key={index} className="rounded-sm bg-[#FEF08A]/90 px-1 py-0.5 font-medium text-[#2C2100]">{part.text}</mark> : part.text)}</p>
    {example.exampleZh && <p className="mt-0.5 break-words text-xs text-ink-soft">{example.exampleZh}</p>}
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <button type="button" aria-label={`朗读例句：${word.word}`} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-stone-200 bg-white px-2 text-xs font-bold text-ink-soft" onClick={() => onSpeak(example.exampleEn)}><Volume2 size={13} /> 朗读例句</button>
      <span className="break-words text-[10px] text-ink-soft">来源：{example.exampleSource}</span>
    </div>
  </>;
  if (expanded) return <div className={`text-left ${className}`} data-testid="example">{content}</div>;
  return <details className={`text-left ${className}`} data-testid="example">
    <summary className="cursor-pointer text-xs font-bold text-ink-soft">例句：{word.word}</summary>
    {content}
  </details>;
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
    <header className="safe-top sticky top-0 z-20 border-b border-blush/40 bg-cream/90 px-5 pb-3 backdrop-blur-md">
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
  'bg-honey-100 text-honey-700',
  'bg-lilac-100 text-lilac-500',
  'bg-sage-100 text-sage-500',
  'bg-sky-100 text-sky-600',
  'bg-stone-100 text-stone-500'
];

export function StageChip({ stage, compact = false, word }: { stage: number; compact?: boolean; word?: WordItem }) {
  const s = Math.max(0, Math.min(STAGE_LABELS.length - 1, stage));
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold ${STAGE_STYLE[s]}`}>
      {word?.isMastered ? '已掌握' : word?.card ? (compact ? '复习' : ['新词', '学习', '复习', '重学'][word.card.state]) : '复习'}
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
    <div className="flex rounded-2xl bg-stone-200/60 p-1">
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.key)}
            className={`flex-1 rounded-xl py-1.5 font-bold transition ${size === 'sm' ? 'min-h-9 text-[11px]' : 'min-h-11 text-[12px]'} ${
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
  const cls = tone === 'ok' ? 'bg-sage-500' : tone === 'warn' ? 'bg-honey-600' : 'bg-ink';
  return (
    <div className={`toast-in fixed left-1/2 z-[70] max-w-[88vw] rounded-2xl px-4 py-2.5 text-center text-[13px] font-bold text-white shadow-lg ${cls}`} style={{ bottom: 'calc(96px + env(safe-area-inset-bottom))' }}>
      {message}
    </div>
  );
}

/** Completion stamp shown only after the grades were actually saved. */
export function DoneStamp({ title, subtitle, onClose }: { title: string; subtitle: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/40 p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="done-title" aria-describedby="done-desc" className="fade-in w-full max-w-sm rounded-[28px] bg-paper px-8 py-8 text-center shadow-paper" onClick={e => e.stopPropagation()}>
        <div data-testid="done-stamp" aria-hidden="true" className="stamp-in mx-auto flex h-24 w-24 items-center justify-center rounded-full border-[5px] border-double border-sage-500 font-serif text-lg font-bold tracking-widest text-sage-500">已复习</div>
        <h3 id="done-title" className="mt-4 font-serif text-2xl font-semibold text-ink">{title}</h3>
        <p id="done-desc" className="mt-2 text-sm font-semibold text-ink-soft">{subtitle}</p>
        <button type="button" autoFocus className={`${primaryBtn} mt-5 w-full`} onClick={onClose} onKeyDown={event => {
          // This dialog has one focusable control; keep Tab and Shift+Tab inside it.
          if (event.key === 'Tab') event.preventDefault();
        }}>
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
