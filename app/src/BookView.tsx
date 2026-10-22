import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Check, ChevronRight, Lock, Volume2 } from 'lucide-react';
import type { AppState } from './lib';
import { BOOK, BOOK_GROUPS, type BookGroup } from './bookCatalog';
import { dailyPlan, getBookProgress, getBookStats, getBookWord } from './book';
import { Card, PageHeader, Field, inputCls, primaryBtn, ghostBtn } from './ui';

interface Props {
  state: AppState;
  today: string;
  onBegin: (groupId: string) => Promise<boolean>;
  onConfirmWord: () => Promise<boolean>;
  onSetDailyGroups: (count: number) => void;
  onSpeak: (word: string) => void;
}

export function BookView({ state, today, onBegin, onConfirmWord, onSetDailyGroups, onSpeak }: Props) {
  const [screen, setScreen] = useState<'library' | 'book' | 'unit' | 'study'>('library');
  const [unitId, setUnitId] = useState(BOOK.units[0].id);
  const [revealed, setRevealed] = useState(false);
  const progress = getBookProgress(state);
  const stats = getBookStats(state);
  const plan = dailyPlan(state, today);
  const active = progress.active;
  const activeGroup = BOOK_GROUPS.find(group => group.id === active?.groupId);
  const unit = BOOK.units.find(item => item.id === unitId)!;
  useEffect(() => { setRevealed(false); }, [active?.groupId, active?.seen]);

  const go = (next: typeof screen) => { setScreen(next); window.scrollTo({ top: 0 }); };
  const start = async (group: BookGroup) => {
    if (await onBegin(group.id)) go('study');
  };
  const back = (next: typeof screen) => <button type="button" className="rounded-xl p-2 text-ink-soft" aria-label="返回" onClick={() => go(next)}><ArrowLeft size={20} /></button>;
  const bar = <div role="progressbar" aria-label="词书学习进度" aria-valuemin={0} aria-valuemax={stats.total} aria-valuenow={stats.learned} className="h-2 overflow-hidden rounded-full bg-rose-50"><div className="h-full rounded-full bg-gradient-to-r from-rose-400 to-lilac-400" style={{ width: `${stats.percent}%` }} /></div>;
  const currentLabel = stats.current ? `${stats.current.unitTitle} · 第 ${stats.current.index} 组` : '全书初学完成';

  if (screen === 'library') return <div className="safe-bottom-pad">
    <PageHeader title="词书库" subtitle="选一本书，按单元慢慢学完" />
    <div className="space-y-4 px-4">
      <Card className="overflow-hidden">
        <div className="flex items-start gap-4 bg-lilac-50/60 p-5">
          <div className="flex h-28 w-20 shrink-0 flex-col justify-between rounded-r-xl border-l-4 border-rose-300 bg-rose-100 p-3 text-rose-600"><BookOpen size={21} /><span className="font-serif text-sm font-bold">雅思<br />词汇真经</span></div>
          <div className="min-w-0 flex-1 pt-1"><p className="text-xs font-bold text-lilac-500">我的词书</p><h2 className="mt-2 font-serif text-xl font-semibold">{BOOK.title}</h2><p className="mt-2 text-xs text-ink-soft">{BOOK.edition} · 22 单元</p><p className="mt-1 text-xs text-ink-soft">共 {stats.total} 词 · 每组 25 词</p></div>
        </div>
        <div className="space-y-3 p-5">
          <div className="flex justify-between text-xs font-bold"><span>已学 {stats.learned} / {stats.total} 词</span><span>{stats.percent.toFixed(1)}%</span></div>
          {bar}
          <p className="text-xs text-ink-soft">剩余 {stats.remaining} 词 · {currentLabel}</p>
          <button type="button" className={`${primaryBtn} w-full`} aria-label="雅思词汇真经" onClick={() => go('book')}>打开词书 <ChevronRight size={16} /></button>
        </div>
      </Card>
      <p className="px-1 text-xs leading-relaxed text-ink-soft">每天选择学几组，沿着词书顺序前进。已学记录和复习安排会保存在这台设备。</p>
    </div>
  </div>;

  if (screen === 'study') {
    if (!active || !activeGroup) return <div className="safe-bottom-pad"><PageHeader title="初学完成" /><div className="px-4"><Card className="space-y-4 p-6 text-center"><Check className="mx-auto text-sage-500" size={36} /><h2 className="font-serif text-2xl">本组学习完成</h2><p className="text-sm text-ink-soft">已计入词书进度，新词从明天开始复习。</p><button type="button" className={`${primaryBtn} w-full`} onClick={() => go('book')}>返回词书</button></Card></div></div>;
    const word = getBookWord(activeGroup.words[active.seen]);
    const last = active.seen === activeGroup.words.length - 1;
    return <div className="safe-bottom-pad">
      <PageHeader title={`${activeGroup.unitTitle} · 第 ${activeGroup.index} 组`} subtitle={`本组第 ${active.seen + 1} / ${activeGroup.words.length} 词`} left={back('book')} />
      <div className="space-y-4 px-4">
        <Card className="space-y-5 px-6 py-8 text-center">
          <p className="text-xs font-bold tracking-widest text-lilac-500">初学 · 按词书顺序</p>
          <h2 className="break-words font-serif text-4xl font-semibold">{word.word}</h2>
          <p className="text-sm text-ink-soft">{word.phonetic || '点击朗读听发音'}</p>
          <button type="button" className={ghostBtn} onClick={() => onSpeak(word.word)} aria-label={`朗读 ${word.word}`}><Volume2 size={17} /> 朗读</button>
          {revealed ? <p className="whitespace-pre-line border-t border-rose-50 pt-5 text-left text-base leading-relaxed">{word.meaning}</p> : <button type="button" className={`${ghostBtn} w-full`} onClick={() => setRevealed(true)}>显示释义</button>}
        </Card>
        {revealed && <button type="button" className={`${primaryBtn} w-full`} onClick={() => void onConfirmWord()}>{last ? '完成本组学习' : '已学习，下一词'}</button>}
        <p className="px-2 text-center text-xs leading-relaxed text-ink-soft">确认后自动保存，可随时返回。完成本组全部单词后计入已学。</p>
      </div>
    </div>;
  }

  if (screen === 'unit') return <div className="safe-bottom-pad">
    <PageHeader title={unit.title} subtitle={`第 ${BOOK.units.indexOf(unit) + 1} 单元 · ${unit.words.length} 词 · ${unit.groups.length} 组`} left={back('book')} />
    <div className="space-y-3 px-4">
      <p className="text-xs leading-relaxed text-ink-soft">每组 25 词，章末余词单独一组；完成前一组后继续下一组。</p>
      {unit.groups.map(group => {
        const done = Boolean(progress.completed[group.id]);
        const available = !done && stats.current?.id === group.id && (Boolean(active) || plan.remainingGroups.length > 0);
        return <Card key={group.id} className="p-4"><button type="button" className="flex w-full items-center justify-between gap-3 text-left disabled:text-ink-faint" disabled={!available} onClick={() => void start(group)}><span><span className="block text-sm font-bold">第 {group.index} 组 · {group.words.length} 词</span><span className="mt-1 block text-xs">{done ? '已完成' : active?.groupId === group.id ? `学习中 · 已确认 ${active.seen} 词` : available ? '待学习' : '待解锁'}</span></span>{done ? <Check size={18} className="text-sage-500" /> : available ? <ChevronRight size={18} /> : <Lock size={16} />}</button><p className="mt-2 text-xs text-ink-faint">{group.words[0]} — {group.words[group.words.length - 1]}</p></Card>;
      })}
    </div>
  </div>;

  return <div className="safe-bottom-pad">
    <PageHeader title={BOOK.title} subtitle={`${BOOK.edition} · 22 单元 · 每组 25 词`} left={back('library')} />
    <div className="space-y-4 px-4">
      <Card className="space-y-3 p-5">
        <div className="flex justify-between text-sm font-bold"><span>全书 {stats.total} 词</span><span>{stats.percent.toFixed(1)}%</span></div>
        {bar}
        <div className="grid grid-cols-2 gap-2 text-sm"><p>已学 {stats.learned} 词</p><p>剩余 {stats.remaining} 词</p></div>
        <p className="text-xs text-sage-500">已掌握 {stats.mastered} 词 · 与初学进度分别记录</p>
        <p className="border-t border-rose-50 pt-3 text-xs text-ink-soft">当前：{currentLabel}</p>
      </Card>
      <Card className="space-y-3 p-5">
        <Field label="每日学习组数"><select aria-label="每日学习组数" className={inputCls} value={progress.dailyGroups} onChange={event => onSetDailyGroups(Number(event.target.value))}>{Array.from({ length: 10 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} 组 · 通常 {(index + 1) * 25} 词</option>)}</select></Field>
        <p className="text-sm font-bold">今日计划 {plan.groups.length} 组 · {plan.wordCount} 词</p>
        <p className="text-xs text-ink-soft">今日已完成 {plan.completed} / {progress.dailyGroups} 组</p>
        <button type="button" className={`${primaryBtn} w-full`} disabled={!activeGroup && !plan.remainingGroups.length} onClick={() => { const group = activeGroup || plan.remainingGroups[0]; if (group) void start(group); }}>{activeGroup ? '继续本组学习' : plan.remainingGroups.length ? '开始今日学习' : stats.remaining ? '今日计划已完成' : '全书初学已完成'}</button>
        <p className="text-xs leading-relaxed text-ink-faint">章末不足 25 词时按实际词数计算。初学完成后，前往 A4 刷词完成到期复习。</p>
      </Card>
      <div className="flex items-center justify-between px-1"><h2 className="text-sm font-bold">单元目录</h2><span className="text-xs text-ink-faint">已完成 {stats.completedGroups} / {BOOK_GROUPS.length} 组</span></div>
      {BOOK.units.map((item, index) => {
        const learned = item.groups.filter(group => progress.completed[group.id]).reduce((sum, group) => sum + group.words.length, 0);
        return <Card key={item.id} className="p-4"><button type="button" className="flex w-full items-center justify-between gap-3 text-left" onClick={() => { setUnitId(item.id); go('unit'); }}><span><span className="block text-sm font-bold">第 {index + 1} 单元 {item.title}</span><span className="mt-1 block text-xs text-ink-soft">已学 {learned} / {item.words.length} 词 · {item.groups.length} 组</span></span><ChevronRight size={17} className="shrink-0 text-ink-faint" /></button></Card>;
      })}
    </div>
  </div>;
}
