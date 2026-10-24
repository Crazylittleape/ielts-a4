import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppState, WordItem } from './lib';
import { addDays, buildSchedule, shuffle } from './lib';
import { Card, PageHeader, primaryBtn, ghostBtn } from './ui';

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
const emptyStats = { matches: 0, attempts: 0, rounds: 0 };

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
  // Refs hold the authoritative game state so rapid taps between renders cannot double count.
  const game = useRef({ deadline: 0, items: [] as WordItem[], matched: new Set<string>(), selected: '', combo: 0, over: true });
  const canStart = distinctMeanings(words) >= 2;

  const finish = () => {
    if (game.current.over) return;
    game.current.over = true;
    game.current.selected = '';
    setSelected('');
    setRemaining(0);
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
    setRemaining(GAME_SECONDS);
    setPhase('playing');
  };

  useEffect(() => {
    if (phase !== 'playing') return;
    const tick = () => {
      const n = Math.max(0, Math.ceil((game.current.deadline - Date.now()) / 1000));
      setRemaining(n);
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
    setFeedback('配对正确');
    setMatched([...g.matched]);
    const complete = g.matched.size === g.items.length;
    setStats(s => ({ matches: s.matches + 1, attempts: s.attempts + 1, rounds: s.rounds + (complete ? 1 : 0) }));
    if (complete) {
      setRoundNo(n => n + 1);
      setFeedback('本轮完成，已换下一轮');
      deal(g.items.map(w => w.id));
    }
  };
  const accuracy = stats.attempts ? `${Math.round((stats.matches / stats.attempts) * 100)}%` : '—';

  return <div className="safe-bottom-pad">
    <PageHeader title="60 秒英汉配对" subtitle={`${scopeLabel} · 答对朗读 · 只练习，不改排期`} />
    <div className="space-y-4 px-4">
      <button type="button" className={ghostBtn} onClick={onBack}>返回首页</button>
      <Card className="min-w-0 space-y-4 p-4">
        <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 font-bold">
          <span role="timer" aria-live="polite" aria-atomic="true">剩余 {remaining} 秒</span>
          <span>得分 {score}</span>
          <span>连击 {combo}</span>
          {phase === 'playing' && <span>第 {roundNo} 轮</span>}
        </div>
        {phase === 'idle' && <>
          <p>随时练一局。先选左侧英文，再选右侧中文；每轮最多 4 对，完成后自动换下一轮。</p>
          <button type="button" className={primaryBtn} disabled={!canStart} aria-describedby={canStart ? undefined : 'match-reason'} onClick={begin}>开始 60 秒挑战</button>
          {!canStart && <p id="match-reason" className="text-sm text-ink-soft">至少需要 2 个释义不同的词才能开始。请先在词书学习或录入新词。</p>}
        </>}
        {phase === 'over' && <section aria-label="本局总结" className="space-y-3">
          <h2 className="text-lg font-bold">时间到 · 本局总结</h2>
          <ul className="grid grid-cols-2 gap-2 text-sm">
            <li>总分 {score}</li>
            <li>匹配 {stats.matches} 对</li>
            <li>正确率 {accuracy}</li>
            <li>完成 {stats.rounds} 轮</li>
          </ul>
          <p className="text-xs text-ink-soft">练习结果不保存，也不会改动复习排期。</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={primaryBtn} disabled={!canStart} onClick={begin}>再来一局</button>
            <button type="button" className={ghostBtn} onClick={onBack}>返回</button>
          </div>
        </section>}
        {phase === 'playing' && <div className="grid grid-cols-2 gap-3">
          <div role="group" aria-label="英文" className="min-w-0 space-y-2">
            {items.map(w =>
              <button key={w.id} type="button" disabled={matched.includes(w.id)} aria-pressed={selected === w.id} className={`w-full break-words rounded-2xl border p-3 text-left font-serif ${selected === w.id ? 'border-rose-400 bg-rose-50' : 'border-rose-100 bg-white'} disabled:opacity-20`} onClick={() => pick(w.id)}>{w.word}</button>
            )}
          </div>
          <div role="group" aria-label="中文" className="min-w-0 space-y-2">
            {choices.map(w =>
              <button key={w.id} type="button" disabled={matched.includes(w.id)} className="w-full break-words rounded-2xl border border-lilac-100 bg-white p-3 text-left text-sm disabled:opacity-20" onClick={() => match(w.id)}>{w.meaning}</button>
            )}
          </div>
        </div>}
        <p role="status" className="text-sm text-ink-soft">{feedback}</p>
      </Card>
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
    <div className="space-y-4 px-4"><button type="button" className={ghostBtn} onClick={onBack}>返回看板</button>
      <Card className="grid grid-cols-3 gap-2 p-4 text-center text-sm">
        <div>总词数<strong className="block text-2xl">{state.words.length}</strong></div><div>已掌握<strong className="block text-2xl">{state.words.filter(w => w.isMastered).length}</strong></div><div>顽固词<strong className="block text-2xl">{state.words.filter(w => w.isHard).length}</strong></div>
      </Card>
      <Card className="p-4"><h2 className="mb-3 font-bold">每日复习热力图</h2><div className="grid grid-flow-col grid-rows-7 gap-1">{days.map(day => <span key={day} role="img" aria-label={`${day}：${counts.get(day) || 0} 词`} title={`${day}：${counts.get(day) || 0} 词`} className={`aspect-square rounded-sm ${(counts.get(day) || 0) >= 30 ? 'bg-rose-500' : counts.get(day) ? 'bg-rose-200' : 'bg-stone-100'}`} />)}</div><p className="mt-2 text-xs text-ink-soft">浅色 1–29 词，深色 ≥30 词；不含录入和配对小测。</p></Card>
      <Card className="p-4"><h2 className="mb-3 font-bold">未来 7 天到期预测</h2><ul className="space-y-2 text-sm">{nextDays.map(day => <li className="flex justify-between" key={day}><span>{day}</span><strong>{schedule[day]?.planned.length || 0} 词</strong></li>)}</ul><p className="mt-3 text-xs leading-relaxed text-ink-soft">仅按当前下一次到期日期统计。逾期任务留在今天，未来评分后排期会改变；此处不是固定任务承诺。</p></Card>
    </div>
  </div>;
}
