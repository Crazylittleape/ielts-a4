import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Shuffle, Volume2, Flame, Check, Pencil, CheckCircle2 } from 'lucide-react';
import type { DaySchedule, WordItem } from './lib';
import { diffDays, isDueOn, parseDate, shuffle, weekdayCN } from './lib';
import { Segmented, StageChip, primaryBtn, Empty } from './ui';

type MaskMode = 'all' | 'en' | 'cn' | 'random';

const MASK_MODES: { key: MaskMode; emoji: string; label: string; hint: string }[] = [
  { key: 'all', emoji: '👁️', label: '全显', hint: '中英文全部清晰显示' },
  { key: 'en', emoji: '🇬🇧', label: '只看英', hint: '只看英文 · 默想中文释义' },
  { key: 'cn', emoji: '🇨🇳', label: '只看中', hint: '只看中文 · 回想英文拼写' },
  { key: 'random', emoji: '🎲', label: '随机', hint: '每行随机遮挡一侧 · 轻点可偷看' }
];

interface Props {
  words: WordItem[];
  today: string;
  date: string;
  schedule: Record<string, DaySchedule>;
  onBack: () => void;
  onHardReset: (id: string) => void;
  onCheckout: (ids: string[]) => void;
  onGrade: (id: string, rating: 1 | 2 | 3 | 4) => void;
  onSpeak: (w: string) => void;
  onEdit: (w: WordItem) => void;
}

export function A4View({ words, today, date, schedule, onBack, onHardReset, onCheckout, onGrade, onSpeak, onEdit }: Props) {
  const isToday = date === today;
  const [practice, setPractice] = useState<string[]>([]);
  useEffect(() => { setPractice([]); setChecked(new Set()); setRevealed(new Set()); }, [date, today]);
  const byId = useMemo(() => new Map(words.map((w) => [w.id, w])), [words]);

  const baseIds = useMemo(() => {
    const s = schedule[date];
    if (isToday) {
      const due = words.filter((w) => isDueOn(w, today)).map((w) => w.id);
      const done = words.filter((w) => w.reviewHistory.includes(today) && w.createdAt !== today && !isDueOn(w, today)).map((w) => w.id);
      return practice.length ? practice : Array.from(new Set([...due, ...done]));
    }
    if (!s) return [] as string[];
    if (date < today) return Array.from(new Set([...s.done, ...s.added]));
    return Array.from(new Set([...s.planned.map((p) => p.id), ...s.added]));
  }, [words, schedule, date, today, isToday, practice]);

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

  useEffect(() => {
    setRevealed(new Set());
  }, [mode, seed]);

  const list = order.map((id) => byId.get(id)).filter((w): w is WordItem => Boolean(w));
  const doneSet = useMemo(() => new Set(words.filter((w) => w.reviewHistory.includes(today) && w.createdAt !== today && !isDueOn(w, today)).map((w) => w.id)), [words, today]);
  const pendingIds = isToday && !practice.length ? list.filter((w) => !doneSet.has(w.id)).map((w) => w.id) : [];

  const randomSide = (id: string, idx: number) => {
    let h = seed * 9301 + idx * 49297;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return h % 2 === 0 ? 'en' : 'cn';
  };

  const sideMasked = (w: WordItem, idx: number, side: 'en' | 'cn') => {
    const key = `${w.id}:${side}`;
    if (revealed.has(key)) return false;
    if (mode === 'all') return false;
    if (mode === 'random') return randomSide(w.id, idx) === side;
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
  const relLabel = rel === 0 ? '今日任务' : rel < 0 ? `${-rel} 天前的记录` : `${rel} 天后的预习`;
  const hint = MASK_MODES.find((m) => m.key === mode)?.hint;

  return (
    <div className="safe-bottom-pad">
      <header className="safe-top sticky top-0 z-20 bg-cream/90 px-3 pb-2 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onBack} className="rounded-2xl bg-white p-2 text-ink shadow-card" aria-label="返回">
            <ChevronLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-serif text-[20px] font-semibold leading-tight text-ink">
              {d.getMonth() + 1} 月 {d.getDate()} 日 <span className="text-rose-400">·</span> 电子 A4 纸
            </h1>
            <p className="text-[11px] font-bold text-ink-soft">
              {relLabel} · 周{weekdayCN(d)} · {list.length} 词 · {checked.size} 已勾选
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setOrder((o) => shuffle(o));
              setSeed((s) => s + 1);
            }}
            className="inline-flex items-center gap-1 rounded-2xl bg-white px-3 py-2 text-xs font-extrabold text-ink shadow-card"
          >
            <Shuffle size={14} /> 乱序
          </button>
        </div>
        <div className="mt-2">
          <Segmented options={MASK_MODES} value={mode} onChange={setMode} />
          <p className="mt-1 text-center text-[10px] font-bold text-ink-faint">{hint}</p>
        </div>
      </header>

      <div className="px-3 pt-1">
        {list.length === 0 ? (
          <div className="paper rounded-2xl shadow-paper">
            <Empty emoji="🌷" title={isToday ? '今天没有待复习的单词' : '这一天没有单词'} desc="去「录入」添加新词，明天就会出现在这里" />
          </div>
        ) : (
          <div className="paper paper-edge relative rounded-2xl pb-5 pt-3 shadow-paper">
            <div className="mb-1 flex items-center justify-between px-3 pl-[52px] text-[10px] font-extrabold tracking-wider text-rose-300">
              <span>ENGLISH · 英文</span>
              <span className="mr-14">中文 · 同义替换</span>
            </div>
            <ol className="divide-y divide-rose-100/70">
              {list.map((w, idx) => {
                const done = isToday && !practice.length && doneSet.has(w.id);
                const isChecked = checked.has(w.id) || done;
                const enMasked = sideMasked(w, idx, 'en');
                const cnMasked = sideMasked(w, idx, 'cn');
                return (
                  <li key={w.id} className={`relative flex flex-wrap items-stretch gap-1 px-2 py-2 transition ${isChecked ? 'opacity-45' : ''}`}>
                    <div className="flex w-10 shrink-0 flex-col items-center justify-center text-[10px] font-extrabold text-rose-300">
                      <span>{String(idx + 1).padStart(2, '0')}</span>
                      <StageChip word={w} stage={w.stage} compact />
                    </div>
                    <div className="grid min-w-0 flex-1 grid-cols-[1.05fr_1fr] gap-1.5">
                      <button type="button" onClick={() => (enMasked || revealed.has(`${w.id}:en`) ? toggleReveal(w, 'en') : onSpeak(w.word))} className="min-w-0 text-left">
                        <div className={`${enMasked ? 'masked' : ''} min-w-0 px-1 py-0.5`}>
                          <div className="flex items-start gap-1">
                            <span className="break-words font-serif text-[16px] font-semibold leading-tight text-ink">{w.word}</span>
                            {w.isHard && <Flame size={11} className="mt-0.5 shrink-0 text-honey-500" />}
                          </div>
                          <div className="flex items-center gap-1 text-[10.5px] font-semibold text-ink-soft">
                            <Volume2 size={10} className="shrink-0 text-rose-300" />
                            <span className="break-all leading-tight">{w.phonetic || '点击朗读'}</span>
                          </div>
                        </div>
                      </button>
                      <button type="button" onClick={() => (cnMasked || revealed.has(`${w.id}:cn`) ? toggleReveal(w, 'cn') : onEdit(w))} className="min-w-0 text-left">
                        <div className={`${cnMasked ? 'masked' : ''} min-w-0 px-1 py-0.5`}>
                          <div className="line-clamp-2 text-[13px] font-bold leading-snug text-ink">{w.meaning}</div>
                          {w.synonyms && <div className="truncate text-[11px] font-semibold italic text-lilac-500">≈ {w.synonyms}</div>}
                        </div>
                      </button>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button type="button" disabled={!isToday || !!practice.length || done} onClick={() => onHardReset(w.id)} className={`rounded-xl p-1.5 active:bg-honey-100 ${w.isHard ? 'text-honey-500' : 'text-ink-faint'}`} aria-label="顽固词重置">
                        <Flame size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => !done && toggleCheck(w.id)}
                        className={`ml-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2 transition ${
                          isChecked ? 'border-sage-400 bg-sage-400 text-white' : 'border-rose-200 bg-white text-transparent'
                        }`}
                        aria-label="记住了"
                      >
                        <Check size={15} strokeWidth={3} />
                      </button>
                    </div>
                    {isToday && !practice.length && !done && <div className="flex w-full justify-end gap-1 pt-1">
                      {([[1, '忘记'], [2, '困难'], [3, '记住'], [4, '轻松']] as const).map(([rating, label]) => <button key={rating} type="button" className="rounded-lg bg-rose-50 px-3 py-1.5 text-[11px] font-bold text-rose-600" onClick={() => onGrade(w.id, rating)}>{label}</button>)}
                    </div>}
                  </li>
                );
              })}
            </ol>
            <p className="mt-3 px-4 text-right font-serif text-[11px] italic text-rose-300">— IELTS · FSRS A4 · {date} —</p>
          </div>
        )}

        {isToday && !practice.length && list.length > 0 && (
          <div className="mt-4">
            {pendingIds.length > 0 ? (
              <>
                <button type="button" className={`${primaryBtn} w-full text-[15px]`} onClick={() => onCheckout(pendingIds)}>
                  <CheckCircle2 size={18} /> 完成本页复习打卡 · {pendingIds.length} 词
                </button>
                <p className="mt-2 text-center text-[11px] font-semibold text-ink-faint">未单独评分的待复习词按「记住」提交；每词每天仅调度一次，🔥 重置词明天再来</p>
              </>
            ) : (
              <div className="rounded-2xl bg-sage-50 px-4 py-3 text-center text-sm font-extrabold text-sage-500">今日已全部打卡 ✓ 可以继续用遮挡模式再默一遍</div>
            )}
          </div>
        )}
        {isToday && pendingIds.length === 0 && <div className="mt-4 text-center">
          <button type="button" className={primaryBtn} disabled={!words.some(w => !w.isMastered)} onClick={() => { setPractice(shuffle(words.filter(w => !w.isMastered)).slice(0, 30).map(w => w.id)); setChecked(new Set()); }}>随机加练 · 最多 30 词</button>
          <p className="mt-2 text-xs text-ink-soft">{practice.length ? '加练模式：遮挡、勾选和朗读不改变 FSRS 排期。' : '没有待复习任务时，可以自由加练。'}</p>
        </div>}
        {!isToday && list.length > 0 && (
          <p className="mt-3 text-center text-[11px] font-semibold text-ink-faint">
            {date < today ? '历史记录只读，不会改动排期' : '这是预习，不会改动排期 · 到当天再打卡'}
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
