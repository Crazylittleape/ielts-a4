import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, Flame, ArrowRight, Volume2 } from 'lucide-react';
import type { DaySchedule, WordItem } from './lib';
import { addDays, formatDate, parseDate, weekdayCN, diffDays } from './lib';
import { Card, PageHeader, Segmented, StageChip, primaryBtn, Empty } from './ui';

interface Props {
  words: WordItem[];
  today: string;
  schedule: Record<string, DaySchedule>;
  selectedDay: string;
  onSelectDay: (d: string) => void;
  onOpenA4: (d: string) => void;
  onSpeak: (w: string) => void;
}

type CalMode = 'month' | 'week';

function monthGrid(anchor: Date): (string | null)[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12);
  const start = first.getDay();
  const days = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < start; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(formatDate(new Date(anchor.getFullYear(), anchor.getMonth(), d, 12)));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function weekGrid(anchor: string): string[] {
  const d = parseDate(anchor);
  const start = addDays(anchor, -d.getDay());
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function Dashboard({ words, today, schedule, selectedDay, onSelectDay, onOpenA4, onSpeak }: Props) {
  const [mode, setMode] = useState<CalMode>('month');
  const [anchor, setAnchor] = useState<string>(today);

  const stats = useMemo(() => {
    const s = schedule[today] || { due: [], done: [], planned: [], added: [] };
    const hard = words.filter((w) => w.isHard).length;
    return { due: s.due.length, done: s.done.length, added: s.added.length, total: words.length, hard };
  }, [schedule, today, words]);

  const cells = useMemo(() => (mode === 'month' ? monthGrid(parseDate(anchor)) : weekGrid(anchor)), [mode, anchor]);

  const shift = (n: number) => {
    if (mode === 'month') {
      const d = parseDate(anchor);
      d.setDate(1);
      d.setMonth(d.getMonth() + n);
      setAnchor(formatDate(d));
    } else setAnchor(addDays(anchor, 7 * n));
  };

  const anchorDate = parseDate(anchor);
  const monthLabel = `${anchorDate.getFullYear()} 年 ${anchorDate.getMonth() + 1} 月`;
  const sel = schedule[selectedDay] || { due: [], done: [], planned: [], added: [] };
  const byId = useMemo(() => new Map(words.map((w) => [w.id, w])), [words]);

  const preview = useMemo(() => {
    const groups: { stage: number; items: WordItem[]; kind: 'due' | 'done' | 'planned' | 'added' }[] = [];
    const push = (kind: 'due' | 'done' | 'planned' | 'added', stage: number, w: WordItem | undefined) => {
      if (!w) return;
      let g = groups.find((x) => x.kind === kind && x.stage === stage);
      if (!g) {
        g = { stage, items: [], kind };
        groups.push(g);
      }
      g.items.push(w);
    };
    if (selectedDay === today) {
      sel.due.forEach((d) => push('due', d.stage, byId.get(d.id)));
      sel.done.forEach((id) => {
        const w = byId.get(id);
        if (w) push('done', Math.max(0, w.stage - 1), w);
      });
    } else if (selectedDay < today) {
      sel.done.forEach((id) => {
        const w = byId.get(id);
        if (w) push('done', w.stage, w);
      });
    } else {
      sel.planned.forEach((p) => push('planned', p.stage, byId.get(p.id)));
    }
    sel.added.forEach((id) => push('added', 0, byId.get(id)));
    const order = { due: 0, planned: 1, done: 2, added: 3 };
    return groups.sort((a, b) => order[a.kind] - order[b.kind] || a.stage - b.stage);
  }, [sel, selectedDay, today, byId]);

  const selDate = parseDate(selectedDay);
  const rel = diffDays(selectedDay, today);
  const relLabel = rel === 0 ? '今天' : rel === 1 ? '明天' : rel === -1 ? '昨天' : rel > 0 ? `${rel} 天后` : `${-rel} 天前`;
  const selCount = selectedDay === today ? sel.due.length + sel.done.length : selectedDay < today ? sel.done.length : sel.planned.length;

  return (
    <div className="safe-bottom-pad">
      <PageHeader
        title={
          <>
            Hello, <span className="italic text-rose-500">IELTS</span>
          </>
        }
        subtitle={`${today} · 周${weekdayCN(parseDate(today))} · 艾宾浩斯 A4 工作台`}
      />

      <div className="space-y-4 px-4 pt-1">
        <Card className="relative overflow-hidden p-5">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-rose-100/70 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-8 h-36 w-36 rounded-full bg-lilac-100/80 blur-2xl" />
          <div className="relative">
            <p className="text-xs font-extrabold tracking-[0.2em] text-rose-400">TODAY</p>
            <div className="mt-1 flex items-end gap-2">
              <span className="font-serif text-[56px] font-semibold leading-none text-ink">{stats.due}</span>
              <span className="pb-2 text-sm font-bold text-ink-soft">词 待复习</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
              <span className="rounded-full bg-sage-100 px-2.5 py-1 text-sage-500">已完成 {stats.done}</span>
              <span className="rounded-full bg-lilac-100 px-2.5 py-1 text-lilac-500">今日新词 {stats.added}</span>
              <span className="rounded-full bg-honey-100 px-2.5 py-1 text-honey-500">
                <Flame size={11} className="-mt-0.5 mr-0.5 inline" />
                顽固 {stats.hard}
              </span>
              <span className="rounded-full bg-stone-100 px-2.5 py-1 text-stone-500">词库 {stats.total}</span>
            </div>
            <button type="button" className={`${primaryBtn} mt-5 w-full text-[15px]`} onClick={() => onOpenA4(today)}>
              <Sparkles size={18} />
              {stats.due > 0 ? '立即开始今日 A4 纸刷词' : stats.done > 0 ? '今日已打卡 · 再翻一遍 A4 纸' : '今天没有任务 · 去录入新词'}
            </button>
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button type="button" className="rounded-xl p-1.5 text-ink-soft active:bg-rose-50" onClick={() => shift(-1)} aria-label="上一页">
                <ChevronLeft size={18} />
              </button>
              <button type="button" className="min-w-[112px] text-center text-sm font-extrabold text-ink" onClick={() => { setAnchor(today); onSelectDay(today); }}>
                {monthLabel}
              </button>
              <button type="button" className="rounded-xl p-1.5 text-ink-soft active:bg-rose-50" onClick={() => shift(1)} aria-label="下一页">
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="w-[120px]">
              <Segmented size="sm" options={[{ key: 'month', label: '月' }, { key: 'week', label: '周' }]} value={mode} onChange={setMode} />
            </div>
          </div>
          <div className="grid grid-cols-7 gap-y-1 text-center">
            {['日', '一', '二', '三', '四', '五', '六'].map((d) => (
              <div key={d} className="pb-1 text-[10px] font-extrabold text-ink-faint">
                {d}
              </div>
            ))}
            {cells.map((day, i) => {
              if (!day) return <div key={`e${i}`} />;
              const s = schedule[day];
              const isToday = day === today;
              const isSel = day === selectedDay;
              const due = s ? s.due.length : 0;
              const done = s ? s.done.length : 0;
              const planned = s ? s.planned.length : 0;
              const added = s ? s.added.length : 0;
              const num = parseDate(day).getDate();
              return (
                <button key={day} type="button" onClick={() => onSelectDay(day)} className="flex flex-col items-center py-0.5">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold transition ${
                      isSel ? 'bg-gradient-to-br from-rose-400 to-lilac-400 text-white shadow-md shadow-rose-200' : isToday ? 'bg-rose-100 text-rose-600' : day < today ? 'text-ink-faint' : 'text-ink'
                    }`}
                  >
                    {num}
                  </span>
                  <span className="mt-0.5 flex h-4 items-center gap-0.5 text-[9px] font-extrabold leading-none">
                    {due > 0 && <span className="rounded-full bg-rose-500 px-1 py-0.5 text-white">{due}</span>}
                    {done > 0 && <span className="rounded-full bg-sage-100 px-1 py-0.5 text-sage-500">✓{done}</span>}
                    {planned > 0 && day > today && <span className="rounded-full bg-stone-100 px-1 py-0.5 text-stone-400">{planned}</span>}
                    {added > 0 && due === 0 && done === 0 && !(planned > 0 && day > today) && <span className="h-1.5 w-1.5 rounded-full bg-lilac-300" />}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] font-bold text-ink-faint">
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-500" />待复习</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-sage-300" />已完成</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-stone-300" />未来预测</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-lilac-300" />录入</span>
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-extrabold tracking-wide text-ink-soft">{relLabel} · 周{weekdayCN(selDate)}</p>
              <h3 className="font-serif text-lg font-semibold text-ink">
                {selDate.getMonth() + 1} 月 {selDate.getDate()} 日 · {selCount} 词
              </h3>
            </div>
            {selCount > 0 && (
              <button type="button" className="inline-flex items-center gap-1 rounded-2xl bg-rose-50 px-3 py-2 text-xs font-extrabold text-rose-600" onClick={() => onOpenA4(selectedDay)}>
                进入该日 A4 纸 <ArrowRight size={14} />
              </button>
            )}
          </div>
          {preview.length === 0 ? (
            <Empty emoji="🍃" title="这一天没有安排" desc={selectedDay < today ? '那天没有复习记录' : '录入新词后会自动排期'} />
          ) : (
            <div className="space-y-3">
              {preview.map((g) => (
                <div key={`${g.kind}-${g.stage}`}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <StageChip word={g.items[0]} stage={g.stage} />
                    <span className="text-[11px] font-bold text-ink-faint">
                      {g.kind === 'due' ? '待复习' : g.kind === 'done' ? '已完成' : g.kind === 'planned' ? '预计复习' : '当日录入'} · {g.items.length} 词
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {g.items.map((w) => (
                      <button
                        key={`${g.kind}-${w.id}`}
                        type="button"
                        onClick={() => onSpeak(w.word)}
                        className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 font-serif text-[14px] ${
                          g.kind === 'done' ? 'border-sage-100 bg-sage-50 text-sage-500 line-through decoration-sage-300' : 'border-rose-100 bg-white text-ink'
                        }`}
                        title={w.meaning}
                      >
                        {w.word}
                        {w.isHard && <Flame size={11} className="text-honey-500" />}
                        <Volume2 size={11} className="text-ink-faint" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <p className="pt-1 text-[10px] font-semibold text-ink-faint">FSRS 根据每次评分调整间隔；日历仅显示当前下一次到期预测。</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
