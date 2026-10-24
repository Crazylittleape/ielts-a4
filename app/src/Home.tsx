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
      ? { eyebrow: '下一步 · A4 攻坚', title: `A4 攻坚 · ${step.count} 词`, detail: '你在词书里挑出的薄弱词。逐词评分后，FSRS 自动安排下次复习。', action: `开始复习 A4 · ${step.count} 词`, Icon: Layers, run: () => onA4('focus') }
      : { eyebrow: '下一步 · 到期复习', title: `全部到期复习 · ${step.count} 词`, detail: 'A4 攻坚已清空，这些是 FSRS 安排在今天的词。', action: `开始到期复习 · ${step.count} 词`, Icon: Layers, run: () => onA4('all') }
    : step.kind === 'book'
      ? { eyebrow: step.resume ? '下一步 · 继续本组' : firstRun ? '第一步 · 从词书开始' : '下一步 · 学新词', title: step.label, detail: step.resume ? '上次学到一半，接着完成三轮。' : `${step.words} 词 · 教学 → 回忆 → 拼写，学完把薄弱词加入 A4。`, action: `${step.resume ? '继续学习' : '开始学习'}：${step.label}`, Icon: BookOpen, run: onBook }
      : { eyebrow: '今日计划已完成', title: '今天的任务都完成了', detail: '想再练一会儿，可以玩 60 秒配对，不会改动复习排期。', action: '60 秒配对加练', Icon: Check, run: onQuiz };
  const items: [string, string][] = [['已复习', `${report.reviewed} 词`], ['其中记住', `${report.remembered} 词`], ['新学', `${report.learnedWords} 词`], ['A4 待复习', `${report.focusDue} 词`]];
  return (
    <section aria-labelledby="today-title" className="overflow-hidden rounded-3xl bg-rose-600 text-white shadow-card">
      <div className="p-5" data-testid="next-step">
        <p className="text-xs font-bold tracking-[0.16em] text-rose-100">{d.getMonth() + 1} 月 {d.getDate()} 日 · 周{weekdayCN(d)} · 今日学习</p>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold"><view.Icon size={14} aria-hidden="true" />{view.eyebrow}</p>
        <h2 id="today-title" className="mt-2 break-words font-serif text-[26px] font-semibold leading-tight">{view.title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-rose-100">{view.detail}</p>
        <button type="button" className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-[15px] font-extrabold text-rose-600 shadow-[0_3px_0_rgba(15,17,40,0.35)] transition active:translate-y-[2px] active:shadow-none" onClick={view.run}>
          <span className="min-w-0 break-words">{view.action}</span><ArrowRight size={16} aria-hidden="true" className="shrink-0" />
        </button>
      </div>
      {!firstRun && <>
        <dl data-testid="daily-report" className="grid grid-cols-2 gap-px border-t border-white/10 bg-white/10 sm:grid-cols-4">
          {items.map(([label, value]) => <div key={label} className="bg-rose-600 px-4 py-3"><dt className="text-[11px] font-bold text-rose-100">{label}</dt><dd className="mt-0.5 text-lg font-extrabold tabular-nums">{value}</dd></div>)}
        </dl>
        <div className="flex items-center gap-3 px-5 py-3">
          <span className="shrink-0 text-xs font-bold text-rose-100">词书今日 {Math.min(plan.done, plan.target)} / {plan.target} 组</span>
          <span aria-hidden="true" className="flex flex-1 gap-1">{Array.from({ length: plan.target }, (_, i) => <span key={i} className={`h-2 flex-1 rounded-full ${i < plan.done ? 'bg-sage-300' : 'bg-white/20'}`} />)}</span>
        </div>
        <p className="px-5 pb-4 text-[11px] text-rose-100">数字都来自这台设备上的学习记录。</p>
      </>}
    </section>
  );
}
