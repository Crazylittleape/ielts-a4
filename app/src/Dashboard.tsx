import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ArrowRight, Volume2 } from 'lucide-react';
import type { WordItem } from './lib';
import { addDays, formatDate, parseDate, weekdayCN, diffDays } from './lib';
import { DAY_KIND_LABEL, DAY_MARK_LEGEND, dayKind, dayMarks, emptyDay, reviewIds, type DayMarkKind, type PersonalCalendar, type ReviewScope } from './calendar';
import { Card, PageHeader, Segmented, primaryBtn, Empty } from './ui';

interface Props {
  words: WordItem[];
  today: string;
  calendar: PersonalCalendar;
  selectedDay: string;
  onSelectDay: (d: string) => void;
  onOpenA4: (d: string, scope: ReviewScope) => void;
  onOpenBook: () => void;
  onSpeak: (w: string) => void;
}
type CalMode = 'month' | 'week';
const MARK_COLOR: Record<DayMarkKind, string> = { due: 'text-rose-600', done: 'text-sage-500', added: 'text-lilac-500', learned: 'text-honey-700', planned: 'text-stone-500' };

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

export function Dashboard({ words, today, calendar, selectedDay, onSelectDay, onOpenA4, onOpenBook, onSpeak }: Props) {
  const [mode, setMode] = useState<CalMode>('month');
  const [scope, setScope] = useState<ReviewScope>('focus');
  const [anchor, setAnchor] = useState(today);
  const schedule = calendar[scope];
  const current = calendar.focus[today] ?? emptyDay();
  const all = calendar.all[today] ?? emptyDay();
  const learned = calendar.learning[today];
  const cells = useMemo(() => mode === 'month' ? monthGrid(parseDate(anchor)) : weekGrid(anchor), [mode, anchor]);
  const byId = useMemo(() => new Map(words.map(w => [w.id, w])), [words]);
  const selected = schedule[selectedDay] ?? emptyDay();
  const ids = reviewIds(schedule, selectedDay, today);
  const selectedLearning = calendar.learning[selectedDay];
  const selectedFocus = calendar.focus[selectedDay] ?? emptyDay();
  const rel = diffDays(selectedDay, today);
  const relLabel = rel === 0 ? '今天' : rel === 1 ? '明天' : rel === -1 ? '昨天' : rel > 0 ? `${rel} 天后` : `${-rel} 天前`;
  const shift = (n: number) => {
    if (mode === 'week') return setAnchor(addDays(anchor, 7 * n));
    const d = parseDate(anchor); d.setDate(1); d.setMonth(d.getMonth() + n); setAnchor(formatDate(d));
  };
  const anchorDate = parseDate(anchor);
  const focusCount = reviewIds(calendar.focus, today, today).length;
  const selectedKind = dayKind(selectedDay, today);
  const selectedMarks = dayMarks(calendar, scope, selectedDay, today);
  const doneIds = new Set(selected.done);
  const chipStatus = (id: string) => selectedKind === 'future' ? '预计' : doneIds.has(id) ? '已完成' : '待复习';
  const selectedAdded = selectedKind !== 'future' ? selected.added.filter(id => !ids.includes(id)) : [];
  const allCount = reviewIds(calendar.all, today, today).length;
  return <div className="safe-bottom-pad">
    <PageHeader title="我的学习日历" subtitle={`${today} · 周${weekdayCN(parseDate(today))} · 记录来自本机学习`} />
    <div className="space-y-4 px-4 pt-1">
      <Card className="border border-blush/60 p-6 shadow-card">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold tracking-[0.16em] text-rose-700">TODAY / A4 攻坚</span>
        <div className="mt-3 flex items-baseline gap-2"><span className="font-serif text-[52px] font-semibold leading-none text-ink">{current.due.length}</span><span className="text-sm font-medium text-ink-soft">词待攻坚</span></div>
        <p className="mt-2 text-xs text-ink-soft">含逾期 {current.due.filter(w => w.overdue).length} 词 · 已完成 {current.done.length} 词 · 今日新增攻坚 {current.added.length} 词</p>
        <div className="mt-4 grid grid-cols-2 gap-3 border-y border-blush/50 py-3.5 text-sm">
          <div><p className="text-xs text-ink-soft">词书初学 · 已完成</p><p className="mt-1 font-bold" data-testid="today-learning">{learned?.groups ?? 0} 组 / {learned?.words ?? 0} 词</p></div>
          <div><p className="text-xs text-ink-soft">全部长期复习（含 A4）</p><p className="mt-1 font-bold">待复习 {all.due.length} · 已完成 {all.done.length}</p></div>
        </div>
        <button type="button" className={`${primaryBtn} mt-4 w-full`} onClick={() => onOpenA4(today, 'focus')}>今日 A4 攻坚 · {focusCount} 词 <ArrowRight size={16} /></button>
        <button type="button" className="mt-2.5 min-h-11 w-full rounded-2xl border border-blush bg-white text-sm font-bold text-ink shadow-xs transition hover:bg-stone-50 active:scale-[0.985]" onClick={() => onOpenA4(today, 'all')}>今日全部复习 · {allCount} 词</button>
        {!words.length && <button type="button" className="mt-3 min-h-11 w-full text-sm font-bold text-rose-600" onClick={onOpenBook}>从词书开始学习</button>}
      </Card>
      <Card className="border border-blush/60 p-5 shadow-card">
        <Segmented options={[{ key: 'focus', label: 'A4 攻坚' }, { key: 'all', label: '全部复习' }]} value={scope} onChange={setScope} />
        <div className="my-3 flex items-center justify-between">
          <div className="flex items-center">
            <button type="button" className="flex h-11 w-11 items-center justify-center text-ink-soft" onClick={() => shift(-1)} aria-label="上一页"><ChevronLeft size={18} /></button>
            <button type="button" className="min-h-11 text-sm font-bold" onClick={() => { setAnchor(today); onSelectDay(today); }}>{anchorDate.getFullYear()} 年 {anchorDate.getMonth() + 1} 月</button>
            <button type="button" className="flex h-11 w-11 items-center justify-center text-ink-soft" onClick={() => shift(1)} aria-label="下一页"><ChevronRight size={18} /></button>
          </div>
          <div className="w-24"><Segmented size="sm" options={[{ key: 'month', label: '月' }, { key: 'week', label: '周' }]} value={mode} onChange={setMode} /></div>
        </div>
        <div className="grid grid-cols-7 gap-y-1 text-center">
          {['日', '一', '二', '三', '四', '五', '六'].map(d => <div key={d} className="pb-1 text-[11px] text-ink-soft">{d}</div>)}
          {cells.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} />;
            const marks = dayMarks(calendar, scope, day, today);
            return <button type="button" key={day} aria-label={`选择日期 ${day}${marks.length ? `：${marks.map(m => m.label).join('，')}` : ''}`} onClick={() => onSelectDay(day)} className="flex min-h-14 min-w-0 flex-col items-center py-1">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition ${day === selectedDay ? 'bg-rose-600 text-white shadow-xs' : day === today ? 'bg-rose-100/90 text-rose-700 font-bold' : 'hover:bg-stone-100'}`}>{parseDate(day).getDate()}</span>
              {marks.map(m => <span key={m.kind} aria-hidden="true" className={`mt-0.5 text-[10px] font-bold leading-none ${MARK_COLOR[m.kind]}`}>{m.text}</span>)}
            </button>;
          })}
        </div>
        <p className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-ink-soft">{DAY_MARK_LEGEND.map(l => <span key={l.kind}><b className={MARK_COLOR[l.kind]}>{l.symbol}</b> {l.label}</span>)}</p>
        <p className="mt-1 text-center text-[11px] text-ink-soft">过去只显示真实记录；未来只显示每张卡当前的下次到期（预计）</p>
      </Card>
      <Card className="border border-blush/60 p-5 shadow-card">
        <p className="text-xs font-bold text-ink-soft">{relLabel} · {selectedDay} · 周{weekdayCN(parseDate(selectedDay))}</p>
        <h2 className="mt-1 text-lg font-bold">{scope === 'focus' ? 'A4 攻坚' : '全部复习'} · {ids.length} 词{selectedDay > today ? '（预计）' : ''}</h2>
        <p className="mt-1 text-sm font-bold text-ink" data-testid="day-breakdown">{DAY_KIND_LABEL[selectedKind]}：{selectedMarks.length ? selectedMarks.map(m => m.label).join(' · ') : '无'}</p>
        {selectedDay <= today && <div className="mt-3 space-y-1 text-xs text-ink-soft">
          <p>词书初学：{selectedLearning?.groups ?? 0} 组 / {selectedLearning?.words ?? 0} 词</p>
          <p>全部复习：已完成 {calendar.all[selectedDay]?.done.length ?? 0} 词{selectedDay === today ? ` · 待复习 ${all.due.length} 词` : ''}</p>
          <p>A4 攻坚：已完成 {selectedFocus.done.length} 词 · 新增 {selectedFocus.added.length} 词</p>
        </div>}
        {ids.length > 0 ? <>
          <div className="mt-4 flex flex-wrap gap-2">{ids.map(id => {
            const word = byId.get(id); if (!word) return null;
            const status = chipStatus(id);
            return <button type="button" key={id} title={word.meaning} aria-label={`${word.word}（${status}）`} onClick={() => onSpeak(word.word)} className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 font-serif text-[15px] transition active:scale-95 ${status === '已完成' ? 'border-sage-200 bg-sage-50 text-sage-600 font-medium' : status === '预计' ? 'border-dashed border-stone-300 bg-white/60 text-ink-soft' : 'border-blush bg-white text-ink shadow-xs hover:border-stone-300'}`}>{status === '已完成' && <span aria-hidden="true" className="font-sans text-xs">✓</span>}{word.word}<Volume2 size={13} className="text-ink-soft/70" /></button>;
          })}</div>
          <button type="button" className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-2xl bg-rose-50 text-sm font-bold text-rose-600 transition hover:bg-rose-100/70 active:scale-[0.985]" onClick={() => onOpenA4(selectedDay, scope)}>打开{scope === 'focus' ? ' A4 攻坚' : '全部复习'} · {ids.length} 词 <ArrowRight size={14} className="inline" /></button>
        </> : null}
        {selectedAdded.length > 0 && <p className="mt-3 text-xs text-ink-soft">当日新增攻坚：<span className="font-serif text-sm text-ink">{selectedAdded.map(id => byId.get(id)?.word).filter(Boolean).join('、')}</span></p>}
        {ids.length > 0 ? null : <Empty emoji="🍃" title={selectedDay > today ? '暂无预计复习' : '暂无此范围的复习记录'} desc={selectedDay > today ? '评分后，下次到期日会随记忆情况调整' : '学完一组后，一键加入本组错词或全部词，次日开始复习'} />}
        <p className="mt-3 text-[11px] leading-relaxed text-ink-soft">{selectedDay > today ? '预计仅包含每张卡片目前的下次到期日，实际安排会随评分变化。' : selectedDay < today ? '历史按当日唯一词卡计数。旧记录没有 A4 上下文时，仅归入全部复习。' : `本范围待复习 ${selected.due.length} 词，已完成 ${selected.done.length} 词；两者合并为此页清单。`}</p>
      </Card>
      <p className="px-1 text-[11px] leading-relaxed text-ink-soft">学习记录保存在当前浏览器。不同设备尚未同步，同一浏览器共用本机记录。A4 是全部复习中的重点词，两个数字不可相加。</p>
    </div>
  </div>;
}
