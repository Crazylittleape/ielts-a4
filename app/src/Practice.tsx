import { useEffect, useMemo, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import type { AppState, WordItem } from './lib';
import { addDays, buildSchedule, shuffle } from './lib';
import { Card, PageHeader, ghostBtn } from './ui';

export const GAME_SECONDS = 60;

export function distinctMeanings(words: WordItem[]): number {
  return new Set(words.map(w => w.meaning.trim())).size;
}

/** Up to 4 words with distinct meanings; avoids repeating the previous round when the pool allows it. */
export function matchRound(words: WordItem[], previous: string[] = [], random: (items: WordItem[]) => WordItem[] = shuffle): WordItem[] {
  const fresh = words.filter(w => !previous.includes(w.id));
  const pool = [...random(fresh), ...random(words.filter(w => previous.includes(w.id)))];
  const meanings = new Set<string>();
  return pool.filter(w => {
    const key = w.meaning.trim();
    if (meanings.has(key)) return false;
    meanings.add(key);
    return true;
  }).slice(0, 4);
}

type Phase = 'idle' | 'playing' | 'over';
const emptyStats = { matches: 0, attempts: 0, rounds: 0, bestCombo: 0 };
const stageBtn = 'inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-sm border border-ink bg-ink px-5 py-3 text-sm font-medium text-paper shadow-button transition-colors hover:bg-ink-2 active:translate-y-[0.5px] disabled:translate-y-0 disabled:border-rule disabled:bg-paper-2 disabled:text-ink-faint disabled:cursor-not-allowed';
const tileBtn = 'w-full min-h-12 break-words rounded-sm border p-3.5 text-left transition-colors active:translate-y-[0.5px] disabled:cursor-not-allowed';

export function MatchingGame({ words, scopeLabel, onBack, onSpeak }: { words: WordItem[]; scopeLabel: string; onBack: () => void; onSpeak: (s: string) => void }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [remaining, setRemaining] = useState(GAME_SECONDS);
  const [items, setItems] = useState<WordItem[]>([]);
  const [choices, setChoices] = useState<WordItem[]>([]);
  const [selected, setSelected] = useState('');
  const [matched, setMatched] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [roundNo, setRoundNo] = useState(1);
  const [stats, setStats] = useState(emptyStats);
  const [feedback, setFeedback] = useState('');
  const [announce, setAnnounce] = useState('');
  const [flash, setFlash] = useState<{ id: string; ok: boolean } | null>(null);
  const flashTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(flashTimer.current), []);
  const showFlash = (id: string, ok: boolean) => {
    window.clearTimeout(flashTimer.current);
    setFlash({ id, ok });
    flashTimer.current = window.setTimeout(() => setFlash(null), 240);
  };
  // Refs hold the authoritative game state so rapid taps between renders cannot double count.
  const game = useRef({ deadline: 0, items: [] as WordItem[], matched: new Set<string>(), selected: '', combo: 0, over: true });
  const meaningCount = distinctMeanings(words);
  const canStart = meaningCount >= 2;

  const finish = () => {
    if (game.current.over) return;
    game.current.over = true;
    game.current.selected = '';
    setSelected('');
    setRemaining(0);
    setAnnounce('时间到，本局结束');
    setPhase('over');
  };
  const deal = (previous: string[]) => {
    const next = matchRound(words, previous);
    game.current.items = next;
    game.current.matched = new Set();
    game.current.selected = '';
    setItems(next);
    setChoices(shuffle(next));
    setMatched([]);
    setSelected('');
  };
  const begin = () => {
    if (!canStart) return;
    game.current = { deadline: Date.now() + GAME_SECONDS * 1000, items: [], matched: new Set(), selected: '', combo: 0, over: false };
    deal([]);
    setScore(0);
    setCombo(0);
    setRoundNo(1);
    setStats(emptyStats);
    setFeedback('');
    setAnnounce('');
    setFlash(null);
    setRemaining(GAME_SECONDS);
    setPhase('playing');
  };

  useEffect(() => {
    if (phase !== 'playing') return;
    const tick = () => {
      const n = Math.max(0, Math.ceil((game.current.deadline - Date.now()) / 1000));
      setRemaining(n);
      // Announce once when the final 10 seconds start instead of reading every second.
      if (n > 0 && n <= 10) setAnnounce(a => a || `还剩 ${n} 秒`);
      if (!n) finish();
    };
    tick();
    const timer = window.setInterval(tick, 200);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, [phase]);

  const live = () => {
    if (game.current.over) return false;
    if (Date.now() >= game.current.deadline) { finish(); return false; }
    return true;
  };
  const pick = (id: string) => {
    if (!live() || game.current.matched.has(id)) return;
    game.current.selected = id;
    setSelected(id);
    setFeedback('');
  };
  const match = (id: string) => {
    const g = game.current;
    if (!live() || !g.selected || g.matched.has(id)) return;
    const chosen = g.selected;
    g.selected = '';
    setSelected('');
    if (id !== chosen) {
      g.combo = 0;
      setCombo(0);
      setStats(s => ({ ...s, attempts: s.attempts + 1 }));
      setFeedback('再想一想，连击已重置');
      showFlash(id, false);
      return;
    }
    const word = g.items.find(w => w.id === id);
    if (!word) return;
    g.matched.add(id);
    const bonus = Math.min(g.combo, 10) * 2;
    g.combo += 1;
    onSpeak(word.word);
    setScore(s => s + 10 + bonus);
    setCombo(g.combo);
    setFeedback(bonus ? `配对正确 +${10 + bonus}（连击加分）` : '配对正确 +10');
    showFlash(id, true);
    setMatched([...g.matched]);
    const complete = g.matched.size === g.items.length;
    const best = g.combo;
    setStats(s => ({ matches: s.matches + 1, attempts: s.attempts + 1, rounds: s.rounds + (complete ? 1 : 0), bestCombo: Math.max(s.bestCombo, best) }));
    if (complete) {
      setRoundNo(n => n + 1);
      setFeedback('本轮完成，已换下一轮');
      deal(g.items.map(w => w.id));
    }
  };
  const accuracy = stats.attempts ? `${Math.round((stats.matches / stats.attempts) * 100)}%` : '—';
  const urgent = phase === 'playing' && remaining <= 10;
  const tileState = (id: string, isSelected: boolean) => matched.includes(id)
    ? 'border-success-rule bg-success-soft text-success'
    : flash?.id === id && !flash.ok ? 'nudge border-accent bg-accent-soft text-accent'
    : isSelected ? 'border-ink bg-ink text-paper shadow-button' : 'border-rule bg-sheet text-ink hover:bg-paper-2 hover:border-rule-2';

  return <div className="safe-bottom-pad">
    <PageHeader title="60 秒英汉配对" subtitle={<><span className="inline">{scopeLabel} · 答对朗读</span><span className="inline"> · 只练习，不改排期</span></>} />
    <div className="mx-auto max-w-3xl space-y-4 px-4 pt-4 sm:px-6">
      <button type="button" className={ghostBtn} onClick={onBack}>返回首页</button>
      <section className="stage min-w-0 rounded-sm border border-rule border-t-2 border-t-ink bg-sheet p-5 text-ink shadow-paper sm:p-6">
        <p data-testid="timer-announce" aria-live="polite" className="sr-only">{announce}</p>
        {phase === 'idle' && <div className="space-y-4">
          <h2 className="font-serif text-2xl font-bold text-ink">准备好就开始</h2>
          <ol className="space-y-2 border-y border-rule py-3 text-sm leading-relaxed text-ink-soft">
            <li>① 先点左侧英文，再点右侧对应的中文</li>
            <li>② 每轮最多 4 对，配完自动换下一轮</li>
            <li>③ 连续答对有连击加分，答错连击清零</li>
          </ol>
          <div className="text-xs text-ink-soft"><div className="inline">词源：{scopeLabel} · {words.length} 词</div><div className="inline"> · {meaningCount} 个不同释义</div></div>
          <button type="button" className={`${stageBtn} w-full`} disabled={!canStart} aria-describedby={canStart ? undefined : 'match-reason'} onClick={begin}>开始 60 秒挑战</button>
          {!canStart && <p id="match-reason" className="text-sm text-ink-soft">至少需要 2 个释义不同的词才能开始。请先在词书学习或录入新词。</p>}
        </div>}
        {phase === 'playing' && <div className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <span role="timer" aria-live="off" className={`flex items-baseline gap-1 ${urgent ? 'text-accent' : 'text-ink'}`}><span className="text-xs font-medium text-ink-soft">剩余 </span><span className="font-mono text-4xl font-bold tabular-nums">{remaining}</span><span className="text-sm font-medium text-ink-soft"> 秒</span></span>
            <div className="flex flex-wrap justify-end gap-1.5 font-mono text-xs font-medium">
              <span className="rounded-sm border border-rule bg-paper-2 px-2.5 py-1 text-ink">得分 {score}</span>
              <span className={`rounded-sm border px-2.5 py-1 ${combo >= 2 ? 'border-ink bg-ink text-paper' : 'border-rule bg-paper-2 text-ink'}`}>连击 {combo}</span>
              <span className="rounded-sm border border-rule bg-paper-2 px-2.5 py-1 text-ink">第 {roundNo} 轮</span>
            </div>
          </div>
          <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-sm bg-paper-3"><div className={`h-full ${urgent ? 'bg-accent' : 'bg-ink'}`} style={{ width: `${(remaining / GAME_SECONDS) * 100}%` }} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div role="group" aria-label="英文" className="min-w-0 space-y-2">
              {items.map(w =>
                <button key={w.id} type="button" disabled={matched.includes(w.id)} aria-pressed={selected === w.id} className={`${tileBtn} font-serif text-[17px] ${tileState(w.id, selected === w.id)}`} onClick={() => pick(w.id)}>{matched.includes(w.id) && <Check size={14} strokeWidth={3} aria-hidden="true" className="mr-1 inline align-[-2px]" />}{w.word}</button>
              )}
            </div>
            <div role="group" aria-label="中文" className="min-w-0 space-y-2">
              {choices.map(w =>
                <button key={w.id} type="button" disabled={matched.includes(w.id)} className={`${tileBtn} text-sm ${tileState(w.id, false)} ${flash?.id === w.id && flash.ok ? 'glow' : ''}`} onClick={() => match(w.id)}>{matched.includes(w.id) && <Check size={14} strokeWidth={3} aria-hidden="true" className="mr-1 inline align-[-2px]" />}{w.meaning}</button>
              )}
            </div>
          </div>
        </div>}
        {phase === 'over' && <section aria-label="本局总结" className="space-y-4 text-center">
          <h2 className="font-serif text-lg font-bold text-ink">时间到 · 本局总结</h2>
          <p className="pop"><span className="block text-xs font-medium text-ink-soft">总分 </span><strong className="block font-serif text-6xl font-bold tabular-nums text-ink">{score}</strong></p>
          <ul className="grid grid-cols-2 gap-2 font-mono text-sm font-medium">
            <li className="rounded-sm border border-rule bg-paper-2 px-3 py-3">匹配 {stats.matches} 对</li>
            <li className="rounded-sm border border-rule bg-paper-2 px-3 py-3">正确率 {accuracy}</li>
            <li className="rounded-sm border border-rule bg-paper-2 px-3 py-3">完成 {stats.rounds} 轮</li>
            <li className="rounded-sm border border-rule bg-paper-2 px-3 py-3">最高连击 {stats.bestCombo}</li>
          </ul>
          <p className="text-xs text-ink-soft">练习结果不保存，也不会改动复习排期。</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={stageBtn} disabled={!canStart} onClick={begin}>再来一局</button>
            <button type="button" className={ghostBtn} onClick={onBack}>返回</button>
          </div>
        </section>}
        {phase === 'playing' && <p role="status" className="mt-3 min-h-5 font-mono text-xs font-medium text-ink-soft">{feedback}</p>}
      </section>
    </div>
  </div>;
}

export function Statistics({ state, today, onBack }: { state: AppState; today: string; onBack: () => void }) {
  const schedule = useMemo(() => buildSchedule(state.words, today, 7), [state.words, today]);
  const days = Array.from({ length: 84 }, (_, i) => addDays(today, i - 83));
  const counts = new Map<string, number>();
  state.words.forEach(w => w.reviewHistory.filter(d => d !== w.createdAt).forEach(d => counts.set(d, (counts.get(d) || 0) + 1)));
  const nextDays = Array.from({ length: 7 }, (_, i) => addDays(today, i + 1));
  return <div className="safe-bottom-pad">
    <PageHeader title="学习统计" subtitle="最近 12 周 · 本机数据" />
    <div className="space-y-5 px-4 pt-4 sm:px-6"><button type="button" className={ghostBtn} onClick={onBack}>返回看板</button>
      <Card className="grid grid-cols-3 divide-x divide-rule p-5 text-center text-xs text-ink-soft">
        <div>总词数<strong className="mt-1 block font-serif text-2xl font-bold tabular-nums text-ink">{state.words.length}</strong></div><div>已掌握<strong className="mt-1 block font-serif text-2xl font-bold tabular-nums text-ink">{state.words.filter(w => w.isMastered).length}</strong></div><div>顽固词<strong className="mt-1 block font-serif text-2xl font-bold tabular-nums text-ink">{state.words.filter(w => w.isHard).length}</strong></div>
      </Card>
      <div className="grid gap-5 lg:grid-cols-12 lg:items-start">
        <Card className="p-5 lg:col-span-7"><h2 className="mb-3 font-serif text-base font-bold text-ink">每日复习热力图</h2><div className="grid grid-flow-col grid-rows-7 gap-1">{days.map(day => <span key={day} role="img" aria-label={`${day}：${counts.get(day) || 0} 词`} title={`${day}：${counts.get(day) || 0} 词`} className={`aspect-square rounded-sm border border-rule ${(counts.get(day) || 0) >= 30 ? 'bg-ink' : counts.get(day) ? 'bg-accent' : 'bg-paper-2'}`} />)}</div><p className="mt-2 text-xs text-ink-soft">浅色 1 至 29 词，深色 ≥30 词；不含录入和配对小测。</p></Card>
        <Card className="p-5 lg:col-span-5"><h2 className="mb-3 font-serif text-base font-bold text-ink">未来 7 天到期预测</h2><ul className="divide-y divide-rule font-mono text-sm tabular-nums">{nextDays.map(day => <li className="flex justify-between py-2" key={day}><span className="text-ink-soft">{day}</span><strong className="text-ink">{schedule[day]?.planned.length || 0} 词</strong></li>)}</ul><p className="mt-3 text-xs leading-relaxed text-ink-soft">仅按当前下一次到期日期统计。逾期任务留在今天，未来评分后排期会改变；此处不是固定任务承诺。</p></Card>
      </div>
    </div>
  </div>;
}
