import { useEffect, useMemo, useState } from 'react';
import type { AppState, WordItem } from './lib';
import { addDays, buildSchedule, shuffle } from './lib';
import { Card, PageHeader, primaryBtn, ghostBtn } from './ui';

function round(words: WordItem[]): WordItem[] {
  const meanings = new Set<string>();
  return shuffle(words).filter(w => {
    if (meanings.has(w.meaning)) return false;
    meanings.add(w.meaning);
    return true;
  }).slice(0, 4);
}

export function MatchingGame({ words, scopeLabel, onBack, onSpeak }: { words: WordItem[]; scopeLabel: string; onBack: () => void; onSpeak: (s: string) => void }) {
  const [playing, setPlaying] = useState(false);
  const [deadline, setDeadline] = useState(0);
  const [remaining, setRemaining] = useState(60);
  const [items, setItems] = useState<WordItem[]>([]);
  const [choices, setChoices] = useState<WordItem[]>([]);
  const [selected, setSelected] = useState('');
  const [matched, setMatched] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [feedback, setFeedback] = useState('');
  const next = () => { const a = round(words); setItems(a); setChoices(shuffle(a)); setMatched([]); setSelected(''); };
  useEffect(() => {
    if (!playing) return;
    const tick = () => {
      const n = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(n);
      if (!n) { setPlaying(false); setSelected(''); }
    };
    tick();
    const timer = window.setInterval(tick, 200);
    return () => window.clearInterval(timer);
  }, [playing, deadline]);
  const match = (id: string) => {
    if (!playing || !selected || Date.now() >= deadline || matched.includes(id)) return;
    if (id !== selected) { setCombo(0); setFeedback('再想一想，连击已重置'); setSelected(''); return; }
    const word = items.find(w => w.id === id)!;
    onSpeak(word.word);
    setScore(s => s + 10 + Math.min(combo, 10) * 2);
    setCombo(c => c + 1);
    setFeedback('配对正确');
    const complete = [...matched, id];
    setMatched(complete); setSelected('');
    if (complete.length === items.length) next();
  };
  return <div className="safe-bottom-pad">
    <PageHeader title="60 秒英汉配对" subtitle={`${scopeLabel} · 答对朗读 · 不改排期`} />
    <div className="space-y-4 px-4"><button type="button" className={ghostBtn} onClick={onBack}>返回看板</button>
      <Card className="space-y-4 p-4">
        <div className="flex justify-between font-bold"><span role="timer">剩余 {remaining} 秒</span><span>得分 {score}</span><span>连击 {combo}</span></div>
        {!playing ? <><p>{deadline ? '本局结束，可以再来一局。' : '随时练一局。先选左侧英文，再选右侧中文。'}</p><button type="button" className={primaryBtn} disabled={new Set(words.map(w => w.meaning)).size < 2} onClick={() => { next(); setScore(0); setCombo(0); setRemaining(60); setDeadline(Date.now()+60000); setFeedback(''); setPlaying(true); }}>开始 60 秒挑战</button>{new Set(words.map(w => w.meaning)).size < 2 && <p>至少需要 2 个释义不同的词。</p>}</> : <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">{items.map(w => <button key={w.id} type="button" disabled={matched.includes(w.id)} aria-pressed={selected===w.id} className={`w-full break-words rounded-2xl border p-3 text-left font-serif ${selected===w.id ? 'border-rose-400 bg-rose-50' : 'border-rose-100 bg-white'} disabled:opacity-20`} onClick={() => setSelected(w.id)}>{w.word}</button>)}</div>
          <div className="space-y-2">{choices.map(w => <button key={w.id} type="button" disabled={matched.includes(w.id)} className="w-full rounded-2xl border border-lilac-100 bg-white p-3 text-left text-sm disabled:opacity-20" onClick={() => match(w.id)}>{w.meaning}</button>)}</div>
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
