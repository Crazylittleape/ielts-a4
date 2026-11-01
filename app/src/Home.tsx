import { ArrowRight, BookOpen, Check, Layers } from 'lucide-react';
import type { ReviewScope } from './calendar';
import type { DailyReport, NextStep } from './coach';
import { parseDate, weekdayCN } from './lib';

interface Props {
  today: string;
  report: DailyReport;
  step: NextStep;
  plan: { done: number; target: number };
  firstRun: boolean;
  onA4: (scope: ReviewScope) => void;
  onBook: () => void;
  onQuiz: () => void;
}

/** Today's single next action plus a report built only from saved records. */
export function TodayCoach({ today, report, step, plan, firstRun, onA4, onBook, onQuiz }: Props) {
  const d = parseDate(today);
  const view = step.kind === 'a4'
    ? step.scope === 'focus'
      ? { eyebrow: '下一步 · A4 攻坚', title: `A4 攻坚 · ${step.count} 词`, detail: '你选进复习的词。逐词评分后，下次复习会自动安排。', action: `开始复习 A4 · ${step.count} 词`, Icon: Layers, run: () => onA4('focus') }
      : { eyebrow: '下一步 · 到期复习', title: `全部到期复习 · ${step.count} 词`, detail: '今天到期的复习词。', action: `开始到期复习 · ${step.count} 词`, Icon: Layers, run: () => onA4('all') }
    : step.kind === 'book'
      ? { eyebrow: step.resume ? '下一步 · 继续本组' : firstRun ? '第一步 · 从词书开始' : '下一步 · 学新词', title: step.label, detail: step.resume ? '上次学到一半，接着完成三轮。' : `${step.words} 词 · 教学 → 回忆 → 拼写，学完一键选择要复习的词。`, action: `${step.resume ? '继续学习' : '开始学习'}：${step.label}`, Icon: BookOpen, run: onBook }
      : { eyebrow: '今日计划已完成', title: '今天的任务都完成了', detail: '想再练一会儿，可以玩 60 秒配对，不会改动复习排期。', action: '60 秒配对加练', Icon: Check, run: onQuiz };
  const items: [string, string][] = [['已复习', `${report.reviewed} 词`], ['其中记住', `${report.remembered} 词`], ['新学', `${report.learnedWords} 词`], ['A4 待复习', `${report.focusDue} 词`]];
  return (
    <section aria-labelledby="today-title" className="overflow-hidden rounded-xl border border-[#CFC7B6] border-t-[3px] border-t-[#181715] bg-[#FAF7F0] text-ink shadow-card">
      <div className="p-5 sm:p-6" data-testid="next-step">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2DBD0] pb-3">
          <p className="font-mono text-[11px] font-semibold tracking-[0.12em] text-ink-soft">{d.getMonth() + 1} 月 {d.getDate()} 日 · 周{weekdayCN(d)} · 今日学习</p>
          <span className="inline-flex items-center gap-1.5 rounded-sm border border-[#D4CDC0] bg-[#EFE9DC] px-2 py-0.5 text-[11px] font-semibold text-ink"><view.Icon size={13} aria-hidden="true" />{view.eyebrow}</span>
        </div>
        <h2 id="today-title" className="mt-4 break-words font-serif text-[28px] sm:text-[31px] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">{view.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{view.detail}</p>
        <button type="button" className="group mt-5 inline-flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-[#181715] bg-[#181715] px-4 py-3 text-[15px] font-semibold text-[#FAF7F0] shadow-button transition hover:bg-[#2B2925] active:translate-y-[0.5px]" onClick={view.run}>
          <span className="min-w-0 break-words text-left">{view.action}</span>
          <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-white/12 transition-transform group-hover:translate-x-0.5"><ArrowRight size={15} /></span>
        </button>
      </div>
      {!firstRun && <>
        <dl data-testid="daily-report" className="grid grid-cols-2 gap-px border-t border-[#D5CEC0] bg-[#D5CEC0] sm:grid-cols-4">
          {items.map(([label, value]) => <div key={label} className="bg-[#F4EFE4] px-4 py-3"><dt className="text-[11px] font-medium text-ink-soft">{label}</dt><dd className="mt-0.5 font-serif text-[19px] font-semibold tabular-nums text-ink">{value}</dd></div>)}
        </dl>
        <div className="flex items-center gap-3 border-t border-[#DFD8C8] bg-[#EFE9DC]/75 px-5 py-3">
          <span className="shrink-0 font-mono text-xs font-semibold text-ink-soft">词书今日 {Math.min(plan.done, plan.target)} / {plan.target} 组</span>
          <span aria-hidden="true" className="flex flex-1 gap-1">{Array.from({ length: plan.target }, (_, i) => <span key={i} className={`h-1.5 flex-1 rounded-xs ${i < plan.done ? 'bg-[#215E49]' : 'bg-[#D5CEC0]'}`} />)}</span>
        </div>
      </>}
    </section>
  );
}
