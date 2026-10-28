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
    <section aria-labelledby="today-title" className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#1B2334] via-[#232D42] to-[#1B2334] text-white shadow-card border border-white/10">
      <div className="p-6" data-testid="next-step">
        <p className="text-xs font-bold tracking-[0.16em] text-slate-300">{d.getMonth() + 1} 月 {d.getDate()} 日 · 周{weekdayCN(d)} · 今日学习</p>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-rose-100 tracking-wide backdrop-blur-xs"><view.Icon size={14} aria-hidden="true" />{view.eyebrow}</p>
        <h2 id="today-title" className="mt-2.5 break-words font-serif text-[28px] font-semibold leading-tight tracking-tight text-white">{view.title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-300/90">{view.detail}</p>
        <button type="button" className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#FCFAF5] px-4 py-3 text-[15px] font-bold text-[#1B2334] shadow-button transition hover:bg-white active:scale-[0.985]" onClick={view.run}>
          <span className="min-w-0 break-words">{view.action}</span><ArrowRight size={16} aria-hidden="true" className="shrink-0" />
        </button>
      </div>
      {!firstRun && <>
        <dl data-testid="daily-report" className="grid grid-cols-2 gap-px border-t border-white/10 bg-white/10 sm:grid-cols-4">
          {items.map(([label, value]) => <div key={label} className="bg-[#1B2334]/90 px-4 py-3"><dt className="text-[11px] font-semibold text-slate-400">{label}</dt><dd className="mt-0.5 text-lg font-bold tabular-nums text-white">{value}</dd></div>)}
        </dl>
        <div className="flex items-center gap-3 px-6 py-3.5 bg-[#161C2B]/85">
          <span className="shrink-0 text-xs font-semibold text-slate-300">词书今日 {Math.min(plan.done, plan.target)} / {plan.target} 组</span>
          <span aria-hidden="true" className="flex flex-1 gap-1">{Array.from({ length: plan.target }, (_, i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i < plan.done ? 'bg-sage-300' : 'bg-white/20'}`} />)}</span>
        </div>
      </>}
    </section>
  );
}
