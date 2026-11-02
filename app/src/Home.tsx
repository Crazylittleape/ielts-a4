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
      ? { eyebrow: '下一步：A4 攻坚', title: `A4 攻坚 · ${step.count} 词`, detail: '你选进复习的词。逐词评分后，下次复习会自动安排。', action: `开始复习 A4 · ${step.count} 词`, Icon: Layers, run: () => onA4('focus') }
      : { eyebrow: '下一步：到期复习', title: `全部到期复习 · ${step.count} 词`, detail: '今天到期的复习词。', action: `开始到期复习 · ${step.count} 词`, Icon: Layers, run: () => onA4('all') }
    : step.kind === 'book'
      ? { eyebrow: step.resume ? '下一步：继续本组' : firstRun ? '第一步：从词书开始' : '下一步：学新词', title: step.label, detail: step.resume ? '上次学到一半，接着完成三轮。' : `本组 ${step.words} 词，按教学、回忆、拼写三轮完成，学完一键选择要复习的词。`, action: `${step.resume ? '继续学习' : '开始学习'}：${step.label}`, Icon: BookOpen, run: onBook }
      : { eyebrow: '今日计划已完成', title: '今天的任务都完成了', detail: '想再练一会儿，可以玩 60 秒配对，不会改动复习排期。', action: '60 秒配对加练', Icon: Check, run: onQuiz };
  const items: [string, string][] = [['已复习', `${report.reviewed} 词`], ['其中记住', `${report.remembered} 词`], ['新学', `${report.learnedWords} 词`], ['A4 待复习', `${report.focusDue} 词`]];
  return (
    <section aria-labelledby="today-title" className="overflow-hidden rounded-sm border border-rule border-t-2 border-t-ink bg-sheet text-ink">
      <div className="p-5 sm:p-7" data-testid="next-step">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule pb-3">
          <p className="text-xs font-medium text-ink-soft">{d.getMonth() + 1} 月 {d.getDate()} 日 · 周{weekdayCN(d)}</p>
          <span className="inline-flex items-center gap-1.5 rounded-sm border border-rule bg-paper-2 px-2.5 py-0.5 text-xs font-medium text-ink"><view.Icon size={13} aria-hidden="true" />{view.eyebrow}</span>
        </div>
        <h2 id="today-title" className="mt-4 break-words font-serif text-3xl sm:text-4xl font-bold leading-tight tracking-tight text-ink">{view.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{view.detail}</p>
        <button type="button" className="group mt-6 inline-flex min-h-12 w-full items-center justify-between gap-3 rounded-sm border border-ink bg-ink px-5 py-3 text-[15px] font-medium text-paper shadow-button transition-colors hover:bg-ink-2 active:translate-y-[0.5px]" onClick={view.run}>
          <span className="min-w-0 break-words text-left">{view.action}</span>
          <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-rule-2 transition-transform group-hover:translate-x-0.5"><ArrowRight size={15} /></span>
        </button>
      </div>
      {!firstRun && <>
        <dl data-testid="daily-report" className="grid grid-cols-2 divide-y divide-rule border-t border-rule bg-paper-2 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          {items.map(([label, value]) => <div key={label} className="px-4 py-3.5"><dt className="text-xs font-medium text-ink-soft">{label}</dt><dd className="mt-1 font-serif text-xl font-bold tabular-nums text-ink">{value}</dd></div>)}
        </dl>
        <div className="flex items-center gap-3 border-t border-rule bg-paper px-5 py-3">
          <span className="shrink-0 text-xs font-medium text-ink-soft">词书今日 <span className="font-mono tabular-nums">{Math.min(plan.done, plan.target)} / {plan.target}</span> 组</span>
          <span aria-hidden="true" className="flex flex-1 gap-1">{Array.from({ length: plan.target }, (_, i) => <span key={i} className={`h-1.5 flex-1 rounded-sm ${i < plan.done ? 'bg-success' : 'bg-rule'}`} />)}</span>
        </div>
      </>}
    </section>
  );
}
