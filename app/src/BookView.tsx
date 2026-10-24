import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Check, ChevronRight, Lock, Volume2 } from 'lucide-react';
import type { AppState } from './lib';
import { BOOK, BOOK_GROUPS, type BookGroup } from './bookCatalog';
import { dailyPlan, getBookProgress, getBookStats, getBookQuestion, getBookWord, checkBookSpelling, type BookAnswer } from './book';
import { Card, PageHeader, Field, inputCls, primaryBtn, ghostBtn } from './ui';

interface Props {
  state: AppState;
  today: string;
  onBegin: (groupId: string) => Promise<boolean>;
  onAnswer: (answer: BookAnswer) => Promise<boolean>;
  onSetDailyGroups: (count: number) => void;
  onSpeak: (word: string) => void;
  onFocus: (word: string, reason?: string) => Promise<boolean>;
  onUnfocus: (word: string) => Promise<boolean>;
}

function FocusPicker({ group, state, missed, onFocus, onUnfocus, onSpeak }: { group: BookGroup; state: AppState; missed: string[]; onFocus: Props['onFocus']; onUnfocus: Props['onUnfocus']; onSpeak: Props['onSpeak'] }) {
  const focused = new Set(state.words.filter(word => word.focus?.active).map(word => word.word.toLowerCase()));
  const missedSet = new Set(missed.map(word => word.toLowerCase()));
  const ordered = [...group.words.filter(word => missedSet.has(word.toLowerCase())), ...group.words.filter(word => !missedSet.has(word.toLowerCase()))];
  const chosen = group.words.filter(word => focused.has(word.toLowerCase())).length;
  return <Card className="p-4 text-left">
    <h3 className="text-base font-bold">挑出没记牢的词加入 A4</h3>
    <p className="mt-1 text-xs leading-relaxed text-ink-soft">只有你点选的词进入 A4 攻坚，明天开始复习；其余词按长期 FSRS 安排。{missed.length ? '本次出错的词排在最前。' : ''}</p>
    <p role="status" className="mt-2 text-sm font-bold text-honey-700">{chosen ? `已选 ${chosen} 词加入 A4 · 明天只复习这些` : '尚未选择 A4 攻坚词'}</p>
    <ul className="mt-2 divide-y divide-stone-100">{ordered.map(name => {
      const isFocused = focused.has(name.toLowerCase());
      const isMissed = missedSet.has(name.toLowerCase());
      return <li key={name} className="flex items-center gap-3 py-3">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSpeak(name)}>
          <span className="flex flex-wrap items-baseline gap-x-2"><span className="break-words font-serif text-lg font-semibold leading-tight">{name}</span>{isMissed && <span className="rounded bg-rose-50 px-1.5 text-[10px] font-bold text-rose-600">本次出错</span>}</span>
          <span className="mt-0.5 line-clamp-2 block break-words text-xs text-ink-soft">{getBookWord(name).meaning}</span>
        </button>
        <button type="button" aria-label={`${isFocused ? '移出' : '加入'} A4：${name}`} onClick={() => void (isFocused ? onUnfocus(name) : onFocus(name, isMissed ? '词书回忆出错' : '词书自选薄弱'))} className={`min-h-11 shrink-0 rounded-xl border px-3 text-xs font-bold ${isFocused ? 'border-sage-200 bg-sage-50 text-sage-500' : 'border-honey-300 bg-honey-50 text-ink'}`}>{isFocused ? <>已加入 ✓<span className="block text-[10px] font-normal">点按撤销</span></> : '加入 A4'}</button>
      </li>;
    })}</ul>
  </Card>;
}

export function BookView({ state, today, onBegin, onAnswer, onSetDailyGroups, onSpeak, onFocus, onUnfocus }: Props) {
  const [screen, setScreen] = useState<'library' | 'book' | 'unit' | 'study' | 'review'>('library');
  const [missed, setMissed] = useState<Record<string, string[]>>({});
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

  const focusedNames = new Set(state.words.filter(word => word.focus?.active).map(word => word.word.toLowerCase()));
  const submitAnswer = async (answer: BookAnswer) => {
    const groupId = active?.groupId;
    const name = question?.word.word;
    const wrong = answer.kind === 'recall' ? !answer.remembered : !checkBookSpelling(name ?? '', answer.text);
    if (await onAnswer(answer)) {
      if (groupId && name && wrong) setMissed(prev => ({ ...prev, [groupId]: [...new Set([...(prev[groupId] ?? []), name])] }));
      if (groupId) setFinishedId(groupId);
      setRevealed(false); setSpelling(''); setChecked(null);
    }
  };
  const focusButton = (name: string, reason: string) => focusedNames.has(name.toLowerCase())
    ? <button type="button" disabled className="w-full rounded-2xl border border-sage-200 bg-sage-50 px-4 py-2.5 text-sm font-bold text-sage-500">已加入 A4 · 明天复习 ✓</button>
    : <button type="button" className="w-full rounded-2xl border border-honey-300 bg-honey-50 px-4 py-2.5 text-sm font-bold text-ink" onClick={() => void onFocus(name, reason)}>加入 A4 攻坚 · 明天复习</button>;
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
      {!state.words.length && !Object.keys(progress.completed).length && <div data-testid="first-run-guide"><Card className="p-4">
        <h2 className="text-sm font-extrabold text-ink">第一次使用 · 三步上手</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-ink-soft">
          <li>打开词书，按顺序学一组：先教学，再回忆检查，最后拼写强化。</li>
          <li>学完一组，只把没记牢的词点“加入 A4”，记得的词不用管。</li>
          <li>第二天打开“A4 刷词”，只复习你挑的词；逐词评分后自动安排下次复习。</li>
        </ol>
        <p className="mt-2 text-[11px] text-ink-faint">这里没有示例词，词库从你学的第一组开始。</p>
      </Card></div>}
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
    if (!active || !activeGroup || !question) {
      const finished = BOOK_GROUPS.find(group => group.id === finishedId && progress.completed[group.id]);
      return <div className="safe-bottom-pad"><PageHeader title="初学完成" /><div className="space-y-4 px-4"><Card className="space-y-4 p-6 text-center"><Check className="mx-auto text-sage-500" size={36} /><h2 className="text-2xl font-bold">本组学习完成</h2><p className="text-sm text-ink-soft">已计入词书进度，新词从明天开始长期复习。</p></Card>{finished && <FocusPicker group={finished} state={state} missed={missed[finished.id] ?? []} onFocus={onFocus} onUnfocus={onUnfocus} onSpeak={onSpeak} />}<button type="button" className={`${primaryBtn} w-full`} onClick={() => go('book')}>返回词书</button></div></div>;
    }
    const { word, kind, round } = question;
    const mode = ['英文回忆中文', '音标回忆中文', '中文拼写英文'][round];
    const spellingMode = kind === 'spelling';
    const showTarget = kind === 'english' || (kind === 'phonetic' && !word.phonetic) || revealed || checked !== null;
    return <div className="safe-bottom-pad">
      <PageHeader title={`${activeGroup.unitTitle} · 第 ${activeGroup.index} 组`} subtitle={question.inRetry ? `错题重练 · 剩余 ${question.pendingRetries} 题` : `本轮第 ${active.seen + 1} / ${activeGroup.words.length} 词`} left={back('book')} />
      <div className="space-y-4 px-4">
        <Card className="space-y-5 px-6 py-8 text-center">
          <p className="text-xs font-bold text-lilac-500">第 {round + 1} / 3 轮 · {mode}</p>
          {spellingMode ? <p className="whitespace-pre-line text-left text-lg leading-relaxed">{word.meaning}</p> : <>
            {showTarget && <h2 className="break-words font-serif text-4xl font-semibold">{word.word}</h2>}
            {word.phonetic && <p className={`${kind === 'phonetic' && !revealed ? 'text-3xl' : 'text-sm'} break-words text-ink-soft`}>{word.phonetic}</p>}
            {kind === 'phonetic' && !word.phonetic && <p className="text-xs text-ink-soft">暂无音标，本题使用英文提示</p>}
            <button type="button" className={ghostBtn} onClick={() => onSpeak(word.word)} aria-label={showTarget ? `朗读 ${word.word}` : '朗读提示'}><Volume2 size={17} /> 朗读</button>
            {revealed ? <p className="whitespace-pre-line border-t border-rose-50 pt-5 text-left text-base leading-relaxed">{word.meaning}</p> : <button type="button" className={`${ghostBtn} w-full`} onClick={() => setRevealed(true)}>显示答案</button>}
          </>}
          {spellingMode && <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (checked === null && spelling.trim()) setChecked(spelling); }}>
            <Field label="英文拼写"><input className={inputCls} aria-label="英文拼写" value={spelling} onChange={event => setSpelling(event.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" readOnly={checked !== null} placeholder="输入英文" /></Field>
            {checked === null ? <><button type="submit" className={`${primaryBtn} w-full`} disabled={!spelling.trim()}>检查拼写</button><button type="button" className={`${ghostBtn} w-full`} onClick={() => setChecked('')}>想不起来</button></> : <div role="status" className="space-y-2 text-left text-sm">
              <p className={checkBookSpelling(word.word, checked) ? 'font-bold text-sage-500' : 'font-bold text-rose-500'}>{checkBookSpelling(word.word, checked) ? '拼写正确' : '拼写有误，稍后重练'}</p>
              <p>你的答案：{checked || '未作答'}</p><p>正确答案：{word.word}</p>
            </div>}
          </form>}
        </Card>
        {!spellingMode && revealed && <div className="space-y-3"><div className="grid grid-cols-2 gap-3"><button type="button" className={ghostBtn} onClick={() => void submitAnswer({kind:'recall',remembered:false})}>没想起</button><button type="button" className={primaryBtn} onClick={() => void submitAnswer({kind:'recall',remembered:true})}>想起来了</button></div>{focusButton(word.word, '词书回忆模糊/忘记')}</div>}
        {spellingMode && checked !== null && <div className="space-y-3"><button type="button" className={`${primaryBtn} w-full`} onClick={() => void submitAnswer({kind:'spelling',text:checked})}>继续</button>{focusButton(word.word, checkBookSpelling(word.word, checked) ? '词书拼写不稳' : '词书拼写出错')}</div>}
        <p className="px-2 text-center text-xs leading-relaxed text-ink-soft">每轮错题会在轮末重练。确认后自动保存，完成三轮后计入已学。</p>
      </div>
    </div>;
  }

  const reviewGroup = BOOK_GROUPS.find(group => group.id === reviewId && progress.completed[group.id]);
  if (screen === 'review' && reviewGroup) return <div className="safe-bottom-pad">
    <PageHeader title={`${reviewGroup.unitTitle} · 第 ${reviewGroup.index} 组`} subtitle={`已完成 ${progress.completed[reviewGroup.id]} · 选词加入 A4`} left={back('unit')} />
    <div className="px-4"><FocusPicker group={reviewGroup} state={state} missed={missed[reviewGroup.id] ?? []} onFocus={onFocus} onUnfocus={onUnfocus} onSpeak={onSpeak} /></div>
  </div>;

  if (screen === 'unit') return <div className="safe-bottom-pad">
    <PageHeader title={unit.title} subtitle={`第 ${BOOK.units.indexOf(unit) + 1} 单元 · ${unit.words.length} 词 · ${unit.groups.length} 组`} left={back('book')} />
    <div className="space-y-3 px-4">
      <p className="text-xs leading-relaxed text-ink-soft">每组 25 词，章末余词单独一组；完成前一组后继续下一组。</p>
      {unit.groups.map(group => {
        const done = Boolean(progress.completed[group.id]);
        const available = !done && stats.current?.id === group.id && (Boolean(active) || plan.remainingGroups.length > 0);
        return <Card key={group.id} className="p-4"><button type="button" className="flex w-full items-center justify-between gap-3 text-left disabled:text-ink-faint" disabled={!available && !done} onClick={() => { if (done) { setReviewId(group.id); go('review'); } else void start(group); }}><span><span className="block text-sm font-bold">第 {group.index} 组 · {group.words.length} 词</span><span className="mt-1 block text-xs">{done ? '已完成 · 选词加入 A4' : active?.groupId === group.id ? `学习中 · 第 ${(active.round ?? 0) + 1} / 3 轮` : available ? '待学习' : '待解锁'}</span></span>{done ? <Check size={18} className="text-sage-500" /> : available ? <ChevronRight size={18} /> : <Lock size={16} />}</button><p className="mt-2 text-xs text-ink-faint">{group.words[0]} — {group.words[group.words.length - 1]}</p></Card>;
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
