import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Shuffle, Volume2, Flame, Check, Pencil, CheckCircle2 } from 'lucide-react';
import type { DaySchedule, FocusSummary, WordItem } from './lib';
import { diffDays, parseDate, randomMaskSides, shuffle, weekdayCN } from './lib';
import { reviewIds, type ReviewScope } from './calendar';
import { Segmented, StageChip, primaryBtn, Empty, ExampleBlock } from './ui';

type MaskMode = 'all' | 'en' | 'cn' | 'random';

const MASK_MODES: { key: MaskMode; emoji: string; label: string; hint: string }[] = [
  { key: 'all', emoji: '👁️', label: '全显', hint: '中英文全部清晰显示' },
  { key: 'en', emoji: '🇬🇧', label: '只看英', hint: '只看英文 · 默想中文释义' },
  { key: 'cn', emoji: '🇨🇳', label: '只看中', hint: '只看中文 · 回想英文拼写' },
  { key: 'random', emoji: '🎲', label: '随机', hint: '每页英文、中文各遮约一半 · 乱序后重新分配 · 轻点可偷看' }
];

interface Props {
  words: WordItem[];
  today: string;
  date: string;
  schedule: Record<string, DaySchedule>;
  scope: ReviewScope;
  onScopeChange: (scope: ReviewScope) => void;
  allDueCount: number;
  onOpenBook: () => void;
  onBack: () => void;
  onHardReset: (id: string) => void;
  onCheckout: (ids: string[]) => void;
  onLater: () => void;
  focusSummary: FocusSummary;
  onGrade: (id: string, rating: 1 | 2 | 3 | 4) => void;
  onSpeak: (w: string) => void;
  onEdit: (w: WordItem) => void;
}

export function A4View({ words, today, date, schedule, scope, onScopeChange, allDueCount, onOpenBook, onBack, onHardReset, onCheckout, onLater, focusSummary, onGrade, onSpeak, onEdit }: Props) {
  const isToday = date === today;
  const [practice, setPractice] = useState<string[]>([]);
  const focusOnly = scope === 'focus';
  const [page, setPage] = useState(0);
  useEffect(() => { setPractice([]); setChecked(new Set()); setRevealed(new Set()); setPage(0); }, [date, today, scope]);
  const byId = useMemo(() => new Map(words.map((w) => [w.id, w])), [words]);
  const baseIds = useMemo(() => practice.length ? practice : reviewIds(schedule, date, today), [schedule, date, today, practice]);

  const [order, setOrder] = useState<string[]>(baseIds);
  useEffect(() => {
    setOrder((prev) => {
      const kept = prev.filter((id) => baseIds.includes(id));
      const added = baseIds.filter((id) => !kept.includes(id));
      return [...kept, ...added];
    });
  }, [baseIds]);

  const [mode, setMode] = useState<MaskMode>('all');
  const [seed, setSeed] = useState(1);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const list = order.map((id) => byId.get(id)).filter((w): w is WordItem => Boolean(w));
  const pageCount = Math.max(1, Math.ceil(list.length / 8));
  const currentPage = Math.min(page, pageCount - 1);
  const pageWords = list.slice(currentPage * 8, currentPage * 8 + 8);
  const doneSet = new Set(schedule[today]?.done ?? []);
  const dueSet = new Set(schedule[today]?.due.map(w => w.id) ?? []);
  const live = isToday && !practice.length;
  const pendingIds = live ? pageWords.filter(w => dueSet.has(w.id)).map(w => w.id) : [];
  const pageRated = live ? pageWords.filter(w => doneSet.has(w.id) && !dueSet.has(w.id)).length : 0;
  const checkedPending = pendingIds.filter(id => checked.has(id));
  const unrated = pendingIds.length - checkedPending.length;
  const checkedDue = live ? list.filter(w => dueSet.has(w.id) && checked.has(w.id)).map(w => w.id) : [];
  const checkedCount = practice.length ? checked.size : checkedDue.length;
  useEffect(() => { setChecked(prev => new Set([...prev].filter(id => baseIds.includes(id)))); }, [baseIds]);

  const pageKey = pageWords.map(w => w.id).join('|');
  const randomSides = useMemo(() => randomMaskSides(pageKey ? pageKey.split('|') : [], seed, currentPage), [pageKey, seed, currentPage]);

  const sideMasked = (w: WordItem, pageIndex: number, side: 'en' | 'cn') => {
    const key = `${w.id}:${side}`;
    if (revealed.has(key)) return false;
    if (mode === 'all') return false;
    if (mode === 'random') return randomSides[pageIndex] === side;
    return mode === 'en' ? side === 'cn' : side === 'en';
  };

  const toggleReveal = (w: WordItem, side: 'en' | 'cn') => {
    const key = `${w.id}:${side}`;
    setRevealed((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  };

  const toggleCheck = (id: string) =>
    setChecked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const d = parseDate(date);
  const rel = diffDays(date, today);
  const relLabel = rel === 0 ? '今日任务' : rel < 0 ? `${-rel} 天前的记录` : `${rel} 天后的预计安排`;
  const hint = MASK_MODES.find((m) => m.key === mode)?.hint;

  return (
    <div className="paper-desk safe-bottom-pad">
      <header className="safe-top sticky top-0 z-20 border-b border-blush bg-cream/95 px-3 pb-2 shadow-card backdrop-blur-md">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onBack} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-ink shadow-card" aria-label="返回">
            <ChevronLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[20px] font-semibold leading-tight text-ink">
              {d.getMonth() + 1} 月 {d.getDate()} 日 <span className="text-rose-400">·</span> {focusOnly ? '重点攻坚 A4' : '全部 FSRS A4'}
            </h1>
            <p className="text-[11px] font-bold text-ink-soft">
              {relLabel} · 周{weekdayCN(d)} · {list.length} 词{isToday ? ` · ${checkedCount} 已勾选` : ' · 只读'}
            </p>
            {focusOnly && isToday && !practice.length && <p className="text-[11px] font-bold text-honey-700" data-testid="focus-lifecycle">今日待复习 {focusSummary.due} · 今日已完成 {focusSummary.done} · 未到期 {focusSummary.waiting} · 已退出 {focusSummary.exited}</p>}
          </div>
          <button
            type="button"
            onClick={() => {
              setOrder((o) => shuffle(o));
              setSeed((s) => s + 1);
            }}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-2xl bg-white px-3 text-xs font-extrabold text-ink shadow-card"
          >
            <Shuffle size={14} /> 乱序
          </button>
        </div>
        <div className="mt-2">
          <Segmented options={MASK_MODES} value={mode} onChange={setMode} />
          <p className="mt-1 text-center text-[11px] font-bold text-ink-soft">{hint}</p>
            <button type="button" className="mt-2 min-h-11 w-full rounded-xl border border-rose-100 bg-white px-3 text-xs font-bold text-rose-600" onClick={() => onScopeChange(focusOnly ? 'all' : 'focus')}>{focusOnly ? '当前：重点攻坚 · 切换全部 FSRS 到期' : '当前：全部 FSRS 到期 · 切换重点攻坚'}</button>
        </div>
      </header>

      <div className="px-3 pt-3">
        {list.length === 0 ? (
          <div className="paper paper-empty">
            <Empty emoji="🌷" title={isToday ? '今天没有待复习的单词' : '这一天没有单词'} desc={focusOnly ? '在词书学完一组后，勾选没记牢的词点「加入 A4」，次日开始攻坚。旧记录未保存 A4 上下文时，可切换全部复习查看。' : '从词书学习或录入新词开始；未来日期仅显示当前下次到期预测。'} />
            <div className="mt-3 flex flex-col gap-2">
              {focusOnly && isToday && allDueCount > 0 && <button type="button" className="min-h-11 w-full rounded-xl border border-rose-100 bg-white px-3 text-sm font-bold text-rose-500" onClick={() => onScopeChange('all')}>查看全部 FSRS 到期 · {allDueCount} 词</button>}
              {focusOnly && <button type="button" className="min-h-11 w-full rounded-xl bg-white px-3 text-sm font-bold text-ink" onClick={onOpenBook}>去词书学习并加入 A4</button>}
            </div>
            {focusOnly && isToday && focusSummary.waiting > 0 && focusSummary.nextDate && <p className="mt-2 text-center text-xs font-bold text-honey-700">另有 {focusSummary.waiting} 词攻坚中，最早 {focusSummary.nextDate} 到期</p>}
          </div>
        ) : (
          <div className="paper relative flex flex-col pb-5 pt-5">
            <div className="paper-heading mx-5 mb-4 border-b border-stone-300 pb-4">
              <p className="text-[10px] tracking-[0.22em] text-stone-500">IELTS / PERSONAL WORKSHEET</p>
              <div className="mt-2 flex items-baseline justify-between gap-2"><h2 className="text-xl font-bold text-stone-800">{practice.length ? '自由加练' : focusOnly ? '重点词攻坚' : '长期复习'}</h2><span className="text-xs tabular-nums text-stone-500">{date}</span></div>
              <p className="mt-2 text-xs text-stone-600">{date > today ? '预计复习' : date < today ? '实际复习记录' : '今日复习'} · 本页 {pageWords.length} 词 · 第 {currentPage + 1} / {pageCount} 页</p>
              <p className="mt-1 break-words text-[11px] text-stone-500">来源：{[...new Set(pageWords.map(w => w.tag || '我的单词'))].join(' / ')}</p>
            </div>
            <div className="mb-2 grid grid-cols-2 px-6 text-[10px] font-bold tracking-widest text-stone-500"><span>ENGLISH / 英文</span><span>中文 / 同义替换</span></div>
            <ol className="divide-y divide-stone-200/80 mx-3">
              {pageWords.map((w, pageIndex) => {
                const idx = currentPage * 8 + pageIndex;
                const done = isToday && !practice.length && doneSet.has(w.id) && !dueSet.has(w.id);
                const isChecked = checked.has(w.id) || done;
                const enMasked = sideMasked(w, pageIndex, 'en');
                const cnMasked = sideMasked(w, pageIndex, 'cn');
                return (
                  <li key={w.id} data-masked={enMasked ? 'en' : cnMasked ? 'cn' : 'none'} className={`relative flex flex-wrap items-stretch gap-1 px-1 py-4 transition ${done ? 'paper-row-done' : isChecked ? 'paper-row-ticked' : ''}`}>
                    <div className="flex w-6 shrink-0 flex-col items-center justify-center text-[10px] font-bold text-stone-400">
                      <span>{String(idx + 1).padStart(2, '0')}</span>
                      <StageChip word={w} stage={w.stage} compact />
                    </div>
                    <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
                      <button type="button" onClick={() => (enMasked || revealed.has(`${w.id}:en`) ? toggleReveal(w, 'en') : onSpeak(w.word))} className="min-w-0 text-left">
                        <div className={`${enMasked ? 'masked' : ''} min-w-0 px-1 py-0.5`}>
                          <div className="flex items-start gap-1">
                            <span className="min-w-0 break-words font-serif text-[20px] font-semibold leading-tight text-ink">{w.word}</span>
                            {w.isHard && <Flame size={11} className="mt-0.5 shrink-0 text-honey-500" />}
                          </div>
                          <div className="flex items-center gap-1 text-[12px] font-normal text-ink-soft">
                            <Volume2 size={10} className="shrink-0 text-stone-400" />
                            <span className="break-all leading-tight">{w.phonetic || '点击朗读'}</span>
                          </div>
                          {w.tag && new Set(pageWords.map(item => item.tag)).size > 1 && <div className="break-words text-[10px] text-stone-500">{w.tag}</div>}
                        </div>
                      </button>
                      <button type="button" onClick={() => (cnMasked || revealed.has(`${w.id}:cn`) ? toggleReveal(w, 'cn') : onEdit(w))} className="min-w-0 text-left">
                        <div className={`${cnMasked ? 'masked' : ''} min-w-0 px-1 py-0.5`}>
                          <div className="break-words text-[14px] font-medium leading-snug text-ink">{w.meaning}</div>
                          {w.synonyms && <div className="break-words text-[12px] italic text-stone-600">≈ {w.synonyms}</div>}
                          {w.focus?.reason && <div className="truncate text-[9px] font-bold text-honey-600">{w.focus.reason}</div>}
                        </div>
                      </button>
                    </div>
                    <ExampleBlock word={w} onSpeak={onSpeak} className="w-full pl-7" />
                    <div className="flex w-full flex-wrap items-center justify-end gap-1 pt-2">
                      {done && <span className="mr-auto pl-7 text-xs font-bold text-sage-500">✓ 今日已评分</span>}
                      {isToday && !practice.length && !done && <>
                      {([[1, '忘记'], [2, '困难'], [3, '记住'], [4, '轻松']] as const).map(([rating, label]) => <button key={rating} type="button" aria-label={`${label}：${w.word}`} className={`min-h-11 min-w-11 rounded-lg border bg-white/80 px-2.5 text-xs font-bold ${rating === 3 ? 'border-rose-300 text-rose-600' : rating === 4 ? 'border-sage-300 text-sage-500' : 'border-stone-300 text-stone-700'}`} onClick={() => onGrade(w.id, rating)}>{label}</button>)}
                    </>}
                      <button type="button" disabled={!isToday || !!practice.length || done} onClick={() => onHardReset(w.id)} title={`顽固词重置：${w.word}`} className={`flex h-11 w-10 items-center justify-center rounded-xl active:bg-honey-100 disabled:opacity-40 ${w.isHard ? 'text-honey-500' : 'text-ink-soft'}`} aria-label={`顽固词重置：${w.word}`}>
                        <Flame size={16} />
                      </button>
                      <button
                        type="button"
                        disabled={done || !isToday}
                        onClick={() => !done && isToday && toggleCheck(w.id)}
                        className={`ml-0.5 flex h-11 w-11 items-center justify-center rounded-full border-2 transition ${
                          isChecked ? 'border-sage-500 bg-sage-500 text-white' : 'border-stone-400 bg-white text-transparent'
                        }`}
                        aria-label={done ? `已评分：${w.word}` : `勾选记住：${w.word}`}
                        title={isToday ? undefined : '非今日只读，到当天再打卡'}
                        aria-pressed={isChecked}
                      >
                        <Check size={15} strokeWidth={3} />
                      </button>
                    </div>

                  </li>
                );
              })}
            </ol>
            <footer className="mx-5 mt-auto flex justify-between border-t border-stone-200 pt-3 text-[10px] tracking-widest text-stone-500"><span>IELTS · A4 STUDY NOTES</span><span>{String(currentPage + 1).padStart(2, '0')} / {String(pageCount).padStart(2, '0')}</span></footer>
          </div>
        )}

        {pageCount > 1 && <div className="mt-4 flex items-center justify-between text-sm">
          <button type="button" disabled={currentPage === 0} className="min-h-11 rounded-xl bg-white px-4 font-bold shadow-card disabled:opacity-40" onClick={() => { setPage(currentPage - 1); window.scrollTo({ top: 0 }); }}>上一张</button>
          <span className="text-xs text-stone-600">{currentPage + 1} / {pageCount}</span>
          <button type="button" disabled={currentPage === pageCount - 1} className="min-h-11 rounded-xl bg-white px-4 font-bold shadow-card disabled:opacity-40" onClick={() => { setPage(currentPage + 1); window.scrollTo({ top: 0 }); }}>下一张</button>
        </div>}
        {isToday && !practice.length && list.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-center text-sm font-extrabold text-ink" aria-live="polite">本页已评分 {pageRated} / {pageRated + pendingIds.length}</p>
            {checkedDue.length > 0 && <button type="button" className={`${primaryBtn} mb-2 w-full text-[15px]`} onClick={() => { const ids = checkedDue; onCheckout(ids); setChecked(prev => new Set([...prev].filter(id => !ids.includes(id)))); }}>
              <CheckCircle2 size={18} /> 提交已勾选 {checkedDue.length} 词 · 按「记住」评分
            </button>}
            {pendingIds.length > 0 ? (
              <>
                {unrated > 0 && <p className="mt-2 text-center text-[11px] font-semibold text-ink-soft">未评分的 {unrated} 词保留在今日待复习，可稍后处理。只有你点了评分或勾选后提交的词才会更新排期。</p>}
                <button type="button" className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-white text-sm font-bold text-ink-soft" onClick={onLater}>稍后处理</button>
              </>
            ) : (
              <div role="status" className="rounded-2xl border border-sage-200 bg-sage-50 px-4 py-3 text-center text-sm font-extrabold text-sage-500">本页已完成 ✓ 可以继续用遮挡模式再默一遍</div>
            )}
          </div>
        )}
        {isToday && (practice.length > 0 || (schedule[today]?.due.length ?? 0) === 0) && <div className="mt-4 text-center">
          <button type="button" className={primaryBtn} disabled={!words.some(w => !w.isMastered)} onClick={() => { setPractice(shuffle(words.filter(w => !w.isMastered)).slice(0, 30).map(w => w.id)); setChecked(new Set()); }}>随机加练 · 最多 30 词</button>
          <p className="mt-2 text-xs text-ink-soft">{practice.length ? '加练模式：遮挡、勾选和朗读不改变 FSRS 排期。' : '没有待复习任务时，可以自由加练。'}</p>
        </div>}
        {!isToday && list.length > 0 && (
          <p className="mt-3 text-center text-[11px] font-semibold text-ink-faint">
            {date < today ? '历史记录只读，不会改动排期' : '这是预计安排，评分后可能变化 · 到当天再打卡'}
            <button type="button" className="ml-1 inline-flex items-center text-rose-500" onClick={() => list[0] && onEdit(list[0])}>
              <Pencil size={11} className="mr-0.5" />
              点中文可编辑
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
