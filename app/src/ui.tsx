import { useEffect, type ReactNode } from 'react';
import { Volume2 } from 'lucide-react';
import { STAGE_LABELS, type WordExample, type WordItem } from './lib';
import { exampleFor, highlightParts } from './book';

export const inputCls =
  'w-full rounded-sm border border-rule-2 bg-sheet px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-faint focus:border-ink focus:outline-none transition-colors disabled:border-rule disabled:bg-paper-2 disabled:text-ink-faint disabled:cursor-not-allowed';

export const primaryBtn =
  'inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-sm border border-accent bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink shadow-button transition-opacity hover:opacity-92 active:translate-y-[0.5px] disabled:translate-y-0 disabled:border-rule disabled:bg-paper-2 disabled:text-ink-faint disabled:cursor-not-allowed';

export const softBtn =
  'inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-sm border border-rule-2 bg-paper-2 px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-paper-3 active:translate-y-[0.5px] disabled:translate-y-0 disabled:border-rule disabled:bg-paper-2 disabled:text-ink-faint disabled:cursor-not-allowed';

export const ghostBtn =
  'inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-sm border border-rule bg-sheet px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-paper-2 hover:border-rule-2 active:translate-y-[0.5px] disabled:translate-y-0 disabled:border-rule disabled:bg-paper-2 disabled:text-ink-faint disabled:cursor-not-allowed';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-sm border border-rule border-t-2 border-t-accent-rule bg-sheet ${className}`}>{children}</div>;
}

/** Sourced example sentence with read-aloud; renders nothing without an example. */
export function ExampleBlock({ word, onSpeak, className = '', expanded = false }: { word: WordExample & { word: string }; onSpeak: (text: string) => void; className?: string; expanded?: boolean }) {
  const example = exampleFor(word);
  if (!example) return null;
  const content = <>
    <p lang="en" className="mt-1.5 break-words font-serif text-[15px] leading-relaxed text-ink">{highlightParts(example.exampleEn, word.word).map((part, index) => part.hit ? <mark key={index} className="rounded-sm bg-highlight px-1 py-0.5 font-medium text-ink">{part.text}</mark> : part.text)}</p>
    {example.exampleZh && <p className="mt-0.5 break-words text-xs leading-relaxed text-ink-soft">{example.exampleZh}</p>}
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      <button type="button" aria-label={`朗读例句：${word.word}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-sm border border-rule bg-sheet px-2.5 text-xs font-medium text-ink transition-colors hover:bg-paper-2" onClick={() => onSpeak(example.exampleEn)}><Volume2 size={13} /> 朗读例句</button>
      <span className="break-words text-xs text-ink-faint">来源：{example.exampleSource}</span>
    </div>
  </>;
  if (expanded) return <div className={`border-l-2 border-accent-rule pl-3 text-left ${className}`} data-testid="example">{content}</div>;
  return <details className={`text-left ${className}`} data-testid="example">
    <summary className="cursor-pointer text-xs font-medium text-ink-soft hover:text-ink">例句：{word.word}</summary>
    {content}
  </details>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between border-b border-rule pb-2">
      <h2 className="font-serif text-base font-bold tracking-tight text-ink">{children}</h2>
      {right}
    </div>
  );
}

export function PageHeader({ title, subtitle, left, right }: { title: ReactNode; subtitle?: ReactNode; left?: ReactNode; right?: ReactNode }) {
  return (
    <header className="safe-top sticky top-0 z-20 border-b border-rule-2 bg-paper px-4 pb-3.5 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {left}
          <div className="min-w-0">
            <h1 className="truncate font-serif text-2xl sm:text-[26px] font-bold leading-tight tracking-tight text-ink">{title}</h1>
            {subtitle && <div className="mt-0.5 text-xs font-medium text-ink-soft">{subtitle}</div>}
          </div>
        </div>
        {right}
      </div>
    </header>
  );
}

const STAGE_STYLE = [
  'border-accent-rule bg-accent-soft text-accent',
  'border-warn-rule bg-warn-soft text-warn',
  'border-rule bg-paper-2 text-ink-2',
  'border-success-rule bg-success-soft text-success',
  'border-rule-2 bg-paper-2 text-ink',
  'border-rule bg-paper-2 text-ink-soft'
];

export function StageChip({ stage, compact = false, word }: { stage: number; compact?: boolean; word?: WordItem }) {
  const s = Math.max(0, Math.min(STAGE_LABELS.length - 1, stage));
  return (
    <span className={`inline-flex shrink-0 items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-medium leading-none ${STAGE_STYLE[s]}`}>
      {word?.isMastered ? '已掌握' : word?.card ? (compact ? '复习' : ['新词', '学习', '复习', '重学'][word.card.state]) : '复习'}
    </span>
  );
}

export interface SegOption<T extends string> {
  key: T;
  label: string;
  ariaLabel?: string;
}

export function Segmented<T extends string>({ options, value, onChange, size = 'md' }: { options: SegOption<T>[]; value: T; onChange: (k: T) => void; size?: 'sm' | 'md' }) {
  return (
    <div className="flex rounded-sm border border-rule-2 bg-paper-3 p-1">
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={active}
            aria-label={o.ariaLabel}
            onClick={() => onChange(o.key)}
            className={`flex-1 whitespace-nowrap rounded-sm px-2 py-1.5 font-medium transition-colors ${size === 'sm' ? 'min-h-10 text-xs' : 'min-h-11 text-xs'} ${
              active ? 'border border-rule-2 bg-sheet text-ink' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toast({ message, tone }: { message: string; tone: 'ok' | 'warn' | 'info' }) {
  const cls = tone === 'ok' ? 'border-success bg-success text-success-ink' : tone === 'warn' ? 'border-warn bg-warn text-warn-ink' : 'border-ink bg-ink text-paper';
  return (
    <div className={`toast-in fixed left-1/2 z-[70] max-w-[88vw] rounded-sm border px-4 py-2.5 text-center text-[13px] font-medium shadow-paper ${cls}`} style={{ bottom: 'calc(96px + env(safe-area-inset-bottom))' }}>
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
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-scrim p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="done-title" aria-describedby="done-desc" className="fade-in w-full max-w-sm rounded-sm border border-rule border-t-2 border-t-ink bg-sheet px-7 py-8 text-center shadow-paper" onClick={e => e.stopPropagation()}>
        <div data-testid="done-stamp" aria-hidden="true" className="stamp-in mx-auto flex h-24 w-24 items-center justify-center rounded-full border-[4px] border-double border-success font-serif text-xl font-bold text-success">已复习</div>
        <h3 id="done-title" className="mt-4 font-serif text-2xl font-bold text-ink">{title}</h3>
        <p id="done-desc" className="mt-2 text-sm font-medium text-ink-soft">{subtitle}</p>
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
      <span className="mb-1.5 flex items-baseline gap-2 px-0.5 text-xs font-medium text-ink">
        {label}
        {hint && <span className="font-normal text-ink-faint">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function Empty({ title, desc }: { emoji?: string; title: string; desc?: string }) {
  return (
    <div className="px-6 py-10 text-center">
      <div aria-hidden="true" className="mx-auto flex h-10 w-10 items-center justify-center rounded-sm border border-rule bg-paper-2 font-serif text-sm font-bold text-ink-soft">§</div>
      <p className="mt-3 font-serif text-base font-bold text-ink">{title}</p>
      {desc && <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-ink-soft">{desc}</p>}
    </div>
  );
}
