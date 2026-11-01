import { useEffect, type ReactNode } from 'react';
import { Volume2 } from 'lucide-react';
import { STAGE_LABELS, type WordExample, type WordItem } from './lib';
import { exampleFor, highlightParts } from './book';

export const inputCls =
  'w-full rounded-lg border border-[#CFC8B8] bg-[#FCFBF7] px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-faint focus:border-[#181715] focus:outline-none focus:ring-2 focus:ring-[#181715]/10 transition';

export const primaryBtn =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#181715] bg-[#181715] px-5 py-2.5 text-sm font-semibold tracking-wide text-[#FAF7F0] shadow-button transition hover:bg-[#2B2925] active:translate-y-[0.5px] disabled:translate-y-0 disabled:opacity-40 disabled:pointer-events-none';

export const softBtn =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-[#D2C9B8] bg-[#EAE3D5] px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-[#E1D8C6] active:translate-y-[0.5px] disabled:translate-y-0 disabled:opacity-40';

export const ghostBtn =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-[#D4CDC0] bg-[#FAF7F0] px-4 py-2.5 text-sm font-semibold text-ink shadow-[0_1px_1px_rgba(24,23,21,0.03)] transition hover:bg-[#EFE9DC] hover:border-[#BDB4A3] active:translate-y-[0.5px] disabled:translate-y-0 disabled:opacity-40';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-[#D5CEC0] bg-[#FAF7F0] shadow-card ${className}`}>{children}</div>;
}

/** Sourced example sentence with read-aloud; renders nothing without an example. */
export function ExampleBlock({ word, onSpeak, className = '', expanded = false }: { word: WordExample & { word: string }; onSpeak: (text: string) => void; className?: string; expanded?: boolean }) {
  const example = exampleFor(word);
  if (!example) return null;
  const content = <>
    <p lang="en" className="mt-1.5 break-words font-serif text-[15px] leading-relaxed text-ink">{highlightParts(example.exampleEn, word.word).map((part, index) => part.hit ? <mark key={index} className="rounded-sm bg-[#EED9A4] px-1 py-0.5 font-semibold text-[#181715]">{part.text}</mark> : part.text)}</p>
    {example.exampleZh && <p className="mt-0.5 break-words text-xs leading-relaxed text-ink-soft">{example.exampleZh}</p>}
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      <button type="button" aria-label={`朗读例句：${word.word}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-[#D4CDC0] bg-[#FCFBF7] px-2.5 text-xs font-semibold text-ink hover:bg-[#EFE9DC] transition" onClick={() => onSpeak(example.exampleEn)}><Volume2 size={13} /> 朗读例句</button>
      <span className="break-words font-mono text-[10px] text-ink-faint">来源：{example.exampleSource}</span>
    </div>
  </>;
  if (expanded) return <div className={`border-l-2 border-[#9A3424]/50 pl-3 text-left ${className}`} data-testid="example">{content}</div>;
  return <details className={`text-left ${className}`} data-testid="example">
    <summary className="cursor-pointer text-xs font-semibold tracking-wide text-ink-soft hover:text-ink">例句：{word.word}</summary>
    {content}
  </details>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between border-b border-[#DFD8C8] pb-2">
      <h2 className="font-serif text-[16px] font-semibold tracking-tight text-ink">{children}</h2>
      {right}
    </div>
  );
}

export function PageHeader({ title, subtitle, left, right }: { title: ReactNode; subtitle?: ReactNode; left?: ReactNode; right?: ReactNode }) {
  return (
    <header className="safe-top sticky top-0 z-20 border-b border-[#D5CEC0] bg-[#F3EFE6]/95 px-4 pb-3 backdrop-blur-md sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {left}
          <div className="min-w-0">
            <h1 className="truncate font-serif text-[23px] sm:text-[25px] font-semibold leading-tight tracking-[-0.02em] text-ink">{title}</h1>
            {subtitle && <p className="mt-0.5 text-[11px] font-medium tracking-wide text-ink-soft">{subtitle}</p>}
          </div>
        </div>
        {right}
      </div>
    </header>
  );
}

const STAGE_STYLE = [
  'border-[#DFC3B5] bg-[#F7EFEA] text-[#82281A]',
  'border-[#E3CA96] bg-[#F9F3E6] text-[#5E3E09]',
  'border-[#D5CEC0] bg-[#EFECE6] text-[#46443F]',
  'border-[#B4D0C2] bg-[#ECF3EF] text-[#174736]',
  'border-[#C8C2B4] bg-[#EAE5DA] text-[#3B3833]',
  'border-[#D5CEC0] bg-[#F1EFEA] text-[#524E46]'
];

export function StageChip({ stage, compact = false, word }: { stage: number; compact?: boolean; word?: WordItem }) {
  const s = Math.max(0, Math.min(STAGE_LABELS.length - 1, stage));
  return (
    <span className={`inline-flex shrink-0 items-center rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none ${STAGE_STYLE[s]}`}>
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
    <div className="flex rounded-lg border border-[#D2C9B8] bg-[#E6DFD1] p-1 shadow-[inset_0_1px_2px_rgba(24,23,21,0.05)]">
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={active}
            aria-label={o.emoji ? `${o.emoji}${o.label}` : undefined}
            onClick={() => onChange(o.key)}
            className={`flex-1 rounded-md py-1.5 font-semibold transition ${size === 'sm' ? 'min-h-9 text-[11px]' : 'min-h-10 text-[12px]'} ${
              active ? 'border border-[#D5CEC0]/80 bg-[#FAF7F0] text-ink shadow-[0_1px_2px_rgba(24,23,21,0.08)]' : 'text-ink-soft hover:text-ink'
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
  const cls = tone === 'ok' ? 'border-[#174736] bg-[#215E49]' : tone === 'warn' ? 'border-[#5E3E09] bg-[#764F0E]' : 'border-[#181715] bg-[#181715]';
  return (
    <div className={`toast-in fixed left-1/2 z-[70] max-w-[88vw] rounded-lg border px-4 py-2.5 text-center text-[13px] font-semibold text-[#FAF7F0] shadow-paper ${cls}`} style={{ bottom: 'calc(96px + env(safe-area-inset-bottom))' }}>
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
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/45 p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="done-title" aria-describedby="done-desc" className="fade-in w-full max-w-sm rounded-xl border border-[#CFC7B6] border-t-2 border-t-[#181715] bg-paper px-7 py-8 text-center shadow-paper" onClick={e => e.stopPropagation()}>
        <div data-testid="done-stamp" aria-hidden="true" className="stamp-in mx-auto flex h-24 w-24 items-center justify-center rounded-full border-[4px] border-double border-sage-500 font-serif text-lg font-bold tracking-widest text-sage-500">已复习</div>
        <h3 id="done-title" className="mt-4 font-serif text-2xl font-semibold text-ink">{title}</h3>
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
      <span className="mb-1.5 flex items-baseline gap-2 px-0.5 text-xs font-semibold tracking-wide text-ink">
        {label}
        {hint && <span className="font-normal text-ink-faint">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function Empty({ emoji, title, desc }: { emoji: string; title: string; desc?: string }) {
  return (
    <div className="px-6 py-10 text-center">
      <div aria-hidden="true" className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-[#D5CEC0] bg-[#EFE9DC] font-serif text-sm font-semibold text-ink-soft">§</div>
      <span className="sr-only">{emoji}</span>
      <p className="mt-3 font-serif text-base font-semibold text-ink">{title}</p>
      {desc && <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-ink-soft">{desc}</p>}
    </div>
  );
}
