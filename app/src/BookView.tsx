import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, BookOpen, Check, ChevronRight, Lock, Volume2 } from 'lucide-react';
import type { AppState, Density, GroupPick, Settings } from './lib';
import { BOOK, BOOK_GROUPS, type BookGroup } from './bookCatalog';
import { dailyPlan, getBookProgress, getBookStats, getBookQuestion, getBookWord, checkBookSpelling, groupMissed, type BookAnswer, type GroupJoinResult } from './book';
import { Card, PageHeader, Field, inputCls, primaryBtn, ghostBtn, ExampleBlock, Segmented } from './ui';
import type { ReviewScope } from './calendar';
import { nextStep, type DailyReport } from './coach';
import { TodayCoach } from './Home';

interface Props {
  state: AppState;
  today: string;
  onBegin: (groupId: string) => Promise<boolean>;
  onAnswer: (answer: BookAnswer) => Promise<boolean>;
  onSetDailyGroups: (count: number) => void;
  onSpeak: (word: string) => void;
  onJoinGroup: (groupId: string, pick: GroupPick) => Promise<GroupJoinResult | null>;
  onSaveSettings: (patch: Partial<Settings>) => Promise<boolean>;
  report?: DailyReport;
  onOpenA4?: (scope: ReviewScope) => void;
  onQuiz?: () => void;
  more?: ReactNode;
  appearance?: ReactNode;
}

const PICK_LABEL: Record<GroupPick, string> = { missed: '本组错词', all: '本组全部' };
const DENSITY_OPTIONS: { key: Density; label: string }[] = [{ key: 'relaxed', label: '轻松' }, { key: 'standard', label: '标准' }, { key: 'intense', label: '强化' }];

export function joinMessage(r: GroupJoinResult): string {
  if (!r.total) return '本组没有错词，没有加入任何词';
  const joined = r.added + r.kept;
  const extra = [r.already ? `${r.already} 词已在复习中` : '', r.mastered ? `${r.mastered} 词已标记掌握，保持不变` : ''].filter(Boolean).join('；');
  if (!joined) return `没有新加入：${extra || '这些词都已在复习中'}`;
  return `已加入 ${joined} 词${r.added ? '，明天开始复习' : ''}${r.kept ? `（其中 ${r.kept} 词保留原复习日期）` : ''}${extra ? `；${extra}` : ''}`;
}

function GroupReview({ group, state, onJoin, onSpeak }: { group: BookGroup; state: AppState; onJoin: Props['onJoinGroup']; onSpeak: Props['onSpeak'] }) {
  const [result, setResult] = useState('');
  const [pending, setPending] = useState(false);
  const missed = groupMissed(state, group.id);
  const missedSet = new Set(missed ?? []);
  const byName = new Map(state.words.map(word => [word.word.toLowerCase(), word]));
  const inReview = (name: string) => { const w = byName.get(name.toLowerCase()); return Boolean(w && w.review !== 'off' && !w.isMastered && !w.mastered); };
  const mastered = (name: string) => { const w = byName.get(name.toLowerCase()); return Boolean(w && (w.isMastered || w.mastered)); };
  const reviewing = group.words.filter(inReview).length;
  const preferred = state.settings.groupPick ?? 'missed';
  const run = async (pick: GroupPick) => {
    if (pending) return;
    setPending(true);
    try { const r = await onJoin(group.id, pick); setResult(r ? joinMessage(r) : '保存失败，没有加入任何词'); } finally { setPending(false); }
  };
  const options: { pick: GroupPick; count: number | null }[] = [{ pick: 'missed', count: missed ? missed.length : null }, { pick: 'all', count: group.words.length }];
  if (preferred === 'all') options.reverse();
  return <Card className="p-4 text-left">
    <h3 className="text-base font-bold">把这一组加入复习</h3>
    <p className="mt-1 text-xs leading-relaxed text-ink-soft">新加入的词明天出现在 A4。已有复习日期保持不变，未选择的新词只记为已学。</p>
    <div className="mt-3 grid gap-2">
      {options.map(({ pick, count }) => <button key={pick} type="button" disabled={pending || count === null} aria-describedby={count === null ? `missed-na-${group.id}` : undefined} className={`${pick === preferred ? primaryBtn : ghostBtn} w-full`} onClick={() => void run(pick)}>{count === null ? '本组错词 · 记录不可用' : `${PICK_LABEL[pick]} ${count} 词`}</button>)}
    </div>
    {missed === null && <p id={`missed-na-${group.id}`} className="mt-2 text-xs text-ink-soft">历史错词记录不可用：这一组在记录错词之前学习，可以选择本组全部。</p>}
    <p role="status" className="mt-2 min-h-5 text-sm font-bold text-sage-500">{result}</p>
    <p className="text-xs font-bold text-ink-soft">已在复习 {reviewing} / {group.words.length} 词</p>
    <ul className="mt-2 divide-y divide-stone-100">{group.words.map(name => {
      const isMissed = missedSet.has(name);
      return <li key={name} className="flex items-center gap-3 py-2.5">
        <button type="button" className="min-h-11 min-w-0 flex-1 text-left" aria-label={`朗读 ${name}`} onClick={() => onSpeak(name)}>
          <span className="flex flex-wrap items-baseline gap-x-2"><span className="break-words font-serif text-lg font-semibold leading-tight">{name}</span>{isMissed && <span className="rounded bg-rose-50 px-1.5 text-[11px] font-bold text-rose-600">本次出错</span>}</span>
          <span className="mt-0.5 line-clamp-2 block break-words text-xs text-ink-soft">{getBookWord(name).meaning}</span>
        </button>
        <span className="shrink-0 text-xs font-bold text-ink-soft">{mastered(name) ? '已标记掌握' : inReview(name) ? '已加入复习' : '未加入复习'}</span>
      </li>;
    })}</ul>
  </Card>;
}

export function BookView({ state, today, onBegin, onAnswer, onSetDailyGroups, onSpeak, onJoinGroup, onSaveSettings, report, onOpenA4, onQuiz, more, appearance }: Props) {
  const [screen, setScreen] = useState<'library' | 'book' | 'unit' | 'study' | 'review'>('library');
  const [finishedId, setFinishedId] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [unitId, setUnitId] = useState(BOOK.units[0].id);
  const [revealed, setRevealed] = useState(false);
  const [spelling, setSpelling] = useState('');
  const [checked, setChecked] = useState<string | null>(null);
  const progress = getBookProgress(state);
  const stats = getBookStats(state);
  const plan = dailyPlan(state, today);
  const active = progress.active;
  const activeGroup = BOOK_GROUPS.find(group => group.id === active?.groupId);
  const unit = BOOK.units.find(item => item.id === unitId)!;
  const question = getBookQuestion(state);
  useEffect(() => { setRevealed(false); setSpelling(''); setChecked(null); }, [active?.groupId, active?.seen, question?.round, question?.inRetry, question?.wordIndex]);

  const submitAnswer = async (answer: BookAnswer) => {
    const groupId = active?.groupId;
    if (await onAnswer(answer)) {
      if (groupId) setFinishedId(groupId);
      setRevealed(false); setSpelling(''); setChecked(null);
    }
  };
  const go = (next: typeof screen) => { setScreen(next); window.scrollTo({ top: 0 }); };
  const start = async (group: BookGroup) => {
    if (await onBegin(group.id)) go('study');
  };
  const back = (next: typeof screen) => <button type="button" className="min-h-11 min-w-11 shrink-0 rounded-xl p-2 text-ink-soft" aria-label="返回" onClick={() => go(next)}><ArrowLeft size={20} /></button>;
  const bar = <div role="progressbar" aria-label="词书学习进度" aria-valuemin={0} aria-valuemax={stats.total} aria-valuenow={stats.learned} className="h-2 overflow-hidden rounded-full bg-rose-50"><div className="h-full rounded-full bg-gradient-to-r from-rose-400 to-lilac-400" style={{ width: `${stats.percent}%` }} /></div>;
  const firstRun = !state.words.length && !Object.keys(progress.completed).length;
  const step = report ? nextStep(state, report, today) : null;
  const currentLabel = stats.current ? `${stats.current.unitTitle} · 第 ${stats.current.index} 组` : '全书初学完成';

  if (screen === 'library') return <div className="safe-bottom-pad">
    <PageHeader title="词书库" subtitle="选一本书，按单元慢慢学完" />
    <div className="space-y-4 px-4">
      {report && step && <TodayCoach today={today} report={report} step={step} plan={{ done: plan.completed, target: progress.dailyGroups }} firstRun={firstRun} onA4={scope => onOpenA4?.(scope)} onQuiz={() => onQuiz?.()} onBook={() => { const group = step.kind === 'book' ? BOOK_GROUPS.find(g => g.id === step.groupId) : undefined; if (group) void start(group); }} />}
      {firstRun && <div data-testid="first-run-guide"><Card className="p-4">
        <h2 className="text-sm font-extrabold text-ink">第一次使用 · 三步上手</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-ink-soft">
          <li>打开词书，按顺序学一组：先教学，再回忆检查，最后拼写强化。</li>
          <li>学完一组，一键把本组错词（或全部词）加入复习。</li>
          <li>第二天打开“A4 刷词”，逐词评分，下次复习会自动安排。</li>
        </ol>
        <p className="mt-2 text-[11px] text-ink-faint">这里没有示例词，词库从你学的第一组开始。</p>
      </Card></div>}
      <Card className="overflow-hidden">
        <div className="flex items-start gap-4 bg-cream p-5">
          <div aria-hidden="true" className="flex h-28 w-20 shrink-0 flex-col justify-between rounded-r-xl border-l-[6px] border-honey-300 bg-rose-600 p-3 text-honey-100 shadow-[3px_4px_0_rgba(39,42,61,0.18)]"><BookOpen size={21} /><span className="font-serif text-xs font-bold leading-snug">雅思<br />词汇真经</span></div>
          <div className="min-w-0 flex-1 pt-1"><p className="text-xs font-bold text-lilac-500">我的词书 · 第 {stats.completedGroups + (stats.current ? 1 : 0)} / {BOOK_GROUPS.length} 组</p><h2 className="mt-2 font-serif text-xl font-semibold">{BOOK.title}</h2><p className="mt-2 text-xs text-ink-soft">{BOOK.edition} · 22 单元</p><p className="mt-1 text-xs text-ink-soft">共 {stats.total} 词 · 每组 25 词</p></div>
        </div>
        <div className="space-y-3 p-5">
          <div className="flex justify-between text-xs font-bold"><span>已学 {stats.learned} / {stats.total} 词</span><span>{stats.percent.toFixed(1)}%</span></div>
          {bar}
          <p className="text-xs text-ink-soft">剩余 {stats.remaining} 词 · {currentLabel}</p>
          <button type="button" className={`${primaryBtn} w-full`} aria-label="雅思词汇真经" onClick={() => go('book')}>打开词书 <ChevronRight size={16} /></button>
        </div>
      </Card>
      {more}
      {appearance}
    </div>
  </div>;

  if (screen === 'study') {
    if (!active || !activeGroup || !question) {
      const finished = BOOK_GROUPS.find(group => group.id === finishedId && progress.completed[group.id]);
      return <div className="safe-bottom-pad"><PageHeader title="初学完成" /><div className="space-y-4 px-4"><Card className="space-y-4 p-6 text-center"><div aria-hidden="true" className="stamp-in mx-auto flex h-20 w-20 items-center justify-center rounded-full border-[5px] border-double border-sage-500 text-sage-500"><Check size={34} /></div><h2 className="text-2xl font-bold">本组初学完成</h2><p className="text-sm text-ink-soft">已计入词书初学进度。选择要复习的词：</p></Card>{finished && <GroupReview group={finished} state={state} onJoin={onJoinGroup} onSpeak={onSpeak} />}<button type="button" className={`${primaryBtn} w-full`} onClick={() => go('book')}>返回词书</button></div></div>;
    }
    const { word, kind, round } = question;
    const mode = ['英文回忆中文', '音标回忆中文', '中文拼写英文'][round];
    const spellingMode = kind === 'spelling';
    const showTarget = kind === 'english' || (kind === 'phonetic' && !word.phonetic) || revealed || checked !== null;
    return <div className="safe-bottom-pad flex min-h-[calc(100dvh-3.5rem)] flex-col">
      <header className="safe-top flex items-center gap-3 px-4 pb-3 pt-2">
        {back('book')}
        <div className="min-w-0 flex-1">
          <p aria-label={`第 ${round + 1} / 3 轮 · ${mode}`} className="text-sm font-extrabold tabular-nums text-ink">第 {round + 1}/3 轮 · {Math.min(active.seen + 1, activeGroup.words.length)}/{activeGroup.words.length}</p>
          {question.inRetry && <p className="text-[11px] font-bold text-rose-600">错题重练 · 剩余 {question.pendingRetries} 题</p>}
        </div>
      </header>
      <main className="flex flex-1 flex-col justify-center px-4">
        <Card className="flex min-h-[34vh] flex-col justify-center space-y-5 bg-white px-6 py-8 text-center">
          {spellingMode ? <p className="whitespace-pre-line text-center text-xl leading-relaxed text-ink">{word.meaning}</p> : <>
            {showTarget && <h2 className="break-words font-serif text-4xl font-semibold text-ink">{word.word}</h2>}
            {word.phonetic && <p className={`${kind === 'phonetic' && !revealed ? 'text-3xl' : 'text-sm'} break-words text-ink-soft`}>{word.phonetic}</p>}
            {kind === 'phonetic' && !word.phonetic && <p className="text-xs text-ink-soft">暂无音标，本题使用英文提示</p>}
            <button type="button" className={`${ghostBtn} self-center`} onClick={() => onSpeak(word.word)} aria-label={showTarget ? `朗读 ${word.word}` : '朗读提示'}><Volume2 size={17} /> 朗读</button>
            {revealed ? <><p className="whitespace-pre-line border-t border-rose-50 pt-5 text-left text-base leading-relaxed text-ink">{word.meaning}</p><ExampleBlock word={word} onSpeak={onSpeak} expanded /></> : <p className="text-sm text-ink-soft">回想中文释义</p>}
          </>}
          {spellingMode && <form id="study-spelling" className="space-y-4" onSubmit={event => { event.preventDefault(); if (checked === null && spelling.trim()) setChecked(spelling); }}>
            <Field label="英文拼写"><input className={inputCls} aria-label="英文拼写" value={spelling} onChange={event => setSpelling(event.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" readOnly={checked !== null} placeholder="输入英文" /></Field>
            {checked !== null && <div role="status" className="space-y-2 text-left text-sm">
              <p className={checkBookSpelling(word.word, checked) ? 'font-bold text-sage-500' : 'font-bold text-rose-500'}>{checkBookSpelling(word.word, checked) ? '拼写正确' : '拼写有误，稍后重练'}</p>
              <p>你的答案：{checked || '未作答'}</p><p>正确答案：{word.word}</p>
              <ExampleBlock word={word} onSpeak={onSpeak} expanded />
            </div>}
          </form>}
        </Card>
      </main>
      <footer className="mt-auto space-y-2 px-4 pb-3 pt-3">
        {!spellingMode && <div className="grid grid-cols-2 gap-3">
          {revealed ? <><button type="button" className={ghostBtn} onClick={() => void submitAnswer({kind:'recall',remembered:false})}>没想起</button><button type="button" className={primaryBtn} onClick={() => void submitAnswer({kind:'recall',remembered:true})}>想起来了</button></> : <button type="button" className={`${primaryBtn} col-span-2 w-full`} onClick={() => setRevealed(true)}>显示答案</button>}
        </div>}
        {spellingMode && checked === null && <div className="grid grid-cols-2 gap-3"><button type="submit" form="study-spelling" className={primaryBtn} disabled={!spelling.trim()}>检查拼写</button><button type="button" className={ghostBtn} onClick={() => setChecked('')}>想不起来</button></div>}
        {spellingMode && checked !== null && <button type="button" className={`${primaryBtn} w-full`} onClick={() => void submitAnswer({kind:'spelling',text:checked})}>继续</button>}
      </footer>
    </div>;
  }

  const reviewGroup = BOOK_GROUPS.find(group => group.id === reviewId && progress.completed[group.id]);
  if (screen === 'review' && reviewGroup) return <div className="safe-bottom-pad">
    <PageHeader title={`${reviewGroup.unitTitle} · 第 ${reviewGroup.index} 组`} subtitle={`已完成 ${progress.completed[reviewGroup.id]}`} left={back('unit')} />
    <div className="px-4"><GroupReview group={reviewGroup} state={state} onJoin={onJoinGroup} onSpeak={onSpeak} /></div>
  </div>;

  if (screen === 'unit') return <div className="safe-bottom-pad">
    <PageHeader title={unit.title} subtitle={`第 ${BOOK.units.indexOf(unit) + 1} 单元 · ${unit.words.length} 词 · ${unit.groups.length} 组`} left={back('book')} />
    <div className="space-y-3 px-4">
      <p className="text-xs leading-relaxed text-ink-soft">每组 25 词，章末余词单独一组；完成前一组后继续下一组。</p>
      {unit.groups.map(group => {
        const done = Boolean(progress.completed[group.id]);
        const available = !done && stats.current?.id === group.id && (Boolean(active) || plan.remainingGroups.length > 0);
        return <Card key={group.id} className="p-4"><button type="button" className="flex w-full items-center justify-between gap-3 text-left disabled:text-ink-faint" disabled={!available && !done} onClick={() => { if (done) { setReviewId(group.id); go('review'); } else void start(group); }}><span><span className="block text-sm font-bold">第 {group.index} 组 · {group.words.length} 词</span><span className="mt-1 block text-xs">{done ? '本组初学完成' : active?.groupId === group.id ? `学习中 · 第 ${(active.round ?? 0) + 1} / 3 轮` : available ? '待学习' : '待解锁'}</span></span>{done ? <Check size={18} className="text-sage-500" /> : available ? <ChevronRight size={18} /> : <Lock size={16} />}</button><p className="mt-2 text-xs text-ink-faint">{group.words[0]} — {group.words[group.words.length - 1]}</p></Card>;
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
      </Card>
      <Card className="space-y-4 p-5">
        <h2 id="study-settings" className="text-sm font-bold">学习设置</h2>
        <div><p className="mb-1.5 text-xs font-bold text-ink-soft" id="pick-label">组完成页的默认选择</p><div role="group" aria-labelledby="pick-label"><Segmented options={[{ key: 'missed' as GroupPick, label: '本组错词' }, { key: 'all' as GroupPick, label: '本组全部单词' }]} value={state.settings.groupPick ?? 'missed'} onChange={pick => void onSaveSettings({ groupPick: pick })} /></div><p className="mt-1 text-xs text-ink-soft">组完成页会把这个选项放在最前面，点按后才会加入。</p></div>
        <div><p className="mb-1.5 text-xs font-bold text-ink-soft" id="density-label">复习密度</p><div role="group" aria-labelledby="density-label"><Segmented options={DENSITY_OPTIONS} value={state.settings.density ?? 'standard'} onChange={density => void onSaveSettings({ density })} /></div><p className="mt-1 text-xs leading-relaxed text-ink-soft">越密集，间隔越短、每日任务通常越多。保存后用于之后的每次评分，已经排好的日期不变。</p></div>
      </Card>
      <div className="flex items-center justify-between px-1"><h2 className="text-sm font-bold">单元目录</h2><span className="text-xs text-ink-faint">已完成 {stats.completedGroups} / {BOOK_GROUPS.length} 组</span></div>
      {BOOK.units.map((item, index) => {
        const learned = item.groups.filter(group => progress.completed[group.id]).reduce((sum, group) => sum + group.words.length, 0);
        return <Card key={item.id} className="p-4"><button type="button" className="flex w-full items-center justify-between gap-3 text-left" onClick={() => { setUnitId(item.id); go('unit'); }}><span><span className="block text-sm font-bold">第 {index + 1} 单元 {item.title}</span><span className="mt-1 block text-xs text-ink-soft">已学 {learned} / {item.words.length} 词 · {item.groups.length} 组</span></span><ChevronRight size={17} className="shrink-0 text-ink-faint" /></button></Card>;
      })}
    </div>
  </div>;
}
