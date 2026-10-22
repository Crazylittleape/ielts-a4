import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Home, BookOpenText, PlusCircle, Library, X } from 'lucide-react';
import type { AppState, WordFields, WordItem } from './lib';
import { buildSchedule, createWord, gradeWord, resetWord, parseBackup, mergeBackup, seedWords, speak, todayStr, uniqSorted } from './lib';
import { openWorkspace, persistWorkspace } from './db';
import { MatchingGame, Statistics } from './Practice';
import { Dashboard } from './Dashboard';
import { A4View } from './A4View';
import { AddView } from './AddView';
import { BankView } from './BankView';
import { Confetti, Field, Toast, inputCls, primaryBtn, ghostBtn } from './ui';

type Tab = 'home' | 'a4' | 'add' | 'bank' | 'quiz' | 'stats';
type ToastTone = 'ok' | 'warn' | 'info';

function useToday(): string {
  const [today, setToday] = useState(todayStr);
  useEffect(() => {
    const tick = () => setToday((t) => (t === todayStr() ? t : todayStr()));
    const id = setInterval(tick, 30000);
    const onVis = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);
  return today;
}

function EditSheet({ word, onSave, onClose }: { word: WordItem; onSave: (w: WordItem) => void; onClose: () => void }) {
  const [f, setF] = useState({ word: word.word, phonetic: word.phonetic, meaning: word.meaning, synonyms: word.synonyms, tag: word.tag || '' });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-ink/30 backdrop-blur-sm" onClick={onClose}>
      <div className="sheet-up w-full rounded-t-[28px] bg-white px-5 pb-8 pt-3 shadow-sheet" style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }} onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-rose-100" />
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-serif text-xl font-semibold text-ink">编辑单词</h3>
          <button type="button" onClick={onClose} className="rounded-xl bg-rose-50 p-1.5 text-ink-soft" aria-label="关闭"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <Field label="英文单词"><input className={inputCls} value={f.word} onChange={(e) => set('word', e.target.value)} autoCapitalize="none" /></Field>
          <Field label="中文释义"><input className={inputCls} value={f.meaning} onChange={(e) => set('meaning', e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="音标"><input className={inputCls} value={f.phonetic} onChange={(e) => set('phonetic', e.target.value)} /></Field>
            <Field label="同义替换"><input className={inputCls} value={f.synonyms} onChange={(e) => set('synonyms', e.target.value)} autoCapitalize="none" /></Field>
          </div>
          <Field label="来源标签" hint="选填，如 真经 List 3"><input className={inputCls} value={f.tag} onChange={(e) => set('tag', e.target.value)} /></Field>
          <div className="grid grid-cols-[1fr_2fr] gap-2 pt-1">
            <button type="button" className={ghostBtn} onClick={onClose}>取消</button>
            <button
              type="button"
              className={primaryBtn}
              disabled={!f.word.trim() || !f.meaning.trim()}
              onClick={() => onSave({ ...word, word: f.word.trim(), phonetic: f.phonetic.trim(), meaning: f.meaning.trim(), synonyms: f.synonyms.trim(), tag: f.tag.trim() || undefined })}
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabBar({ tab, onChange, due }: { tab: Tab; onChange: (t: Tab) => void; due: number }) {
  const items: { key: Tab; label: string; Icon: typeof Home }[] = [
    { key: 'home', label: '看板', Icon: Home },
    { key: 'a4', label: 'A4 刷词', Icon: BookOpenText },
    { key: 'add', label: '录入', Icon: PlusCircle },
    { key: 'bank', label: '词库', Icon: Library }
  ];
  return (
    <nav className="tabbar fixed inset-x-0 bottom-0 z-30 border-t border-rose-100/70 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[480px]">
        {items.map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button key={key} type="button" onClick={() => onChange(key)} className="relative flex flex-1 flex-col items-center gap-0.5 pb-1 pt-2.5">
              <span className={`relative rounded-2xl px-4 py-1 transition ${active ? 'bg-rose-50 text-rose-500' : 'text-ink-faint'}`}>
                <Icon size={22} strokeWidth={active ? 2.4 : 2} />
                {key === 'a4' && due > 0 && <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-rose-500 px-1 text-center text-[10px] font-extrabold leading-[18px] text-white">{due}</span>}
              </span>
              <span className={`text-[10px] font-extrabold ${active ? 'text-rose-500' : 'text-ink-faint'}`}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default function App() {
  const today = useToday();
  const [state, setState] = useState<AppState | null>(null);
  const current = useRef<AppState | null>(null);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const busy = useRef(false);
  const [tab, setTab] = useState<Tab>('home');
  const [a4Date, setA4Date] = useState(today);
  const [selectedDay, setSelectedDay] = useState(today);
  const [toast, setToast] = useState<{ msg: string; tone: ToastTone } | null>(null);
  const [confetti, setConfetti] = useState<{ title: string; subtitle: string } | null>(null);
  const [editing, setEditing] = useState<WordItem | null>(null);
  const toastTimer = useRef<number | null>(null);
  const showToast = useCallback((msg: string, tone: ToastTone = 'info') => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ msg, tone });
    toastTimer.current = window.setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    let active = true;
    openWorkspace(todayStr()).then(result => {
      if (!active) return;
      current.current = result.state;
      setState(result.state);
      if (result.fresh) showToast('已载入示例词，可在词库清空后录入自己的词', 'info');
    }).catch(error => { if (active) setLoadError(String(error instanceof Error ? error.message : error)); });
    return () => { active = false; };
  }, [showToast]);

  const commit = async (next: AppState): Promise<boolean> => {
    if (busy.current || !current.current) return false;
    if (next === current.current) return true;
    busy.current = true; setSaving(true); setSaveError('');
    try {
      await persistWorkspace(next);
      current.current = next; setState(next);
      return true;
    } catch (error) {
      setSaveError(String(error instanceof Error ? error.message : error));
      showToast('保存失败，已有记录未被覆盖，请查看页面顶部提示', 'warn');
      return false;
    } finally { busy.current = false; setSaving(false); }
  };
  const updateWords = (fn: (words: WordItem[]) => WordItem[]) => {
    const s = current.current;
    if (s) return commit({ ...s, words: fn(s.words) });
    return Promise.resolve(false);
  };
  const schedule = useMemo(() => buildSchedule(state?.words || [], today), [state?.words, today]);
  const todayWords = state?.words.filter(w => w.createdAt === today || (!w.isMastered && w.nextReviewDate <= today) || w.reviewHistory.includes(today)) || [];
  const gameWords = todayWords.length ? todayWords : state?.words || [];
  const onSpeak = useCallback((word: string) => { if (!speak(word)) showToast('当前浏览器不支持语音朗读', 'warn'); }, [showToast]);
  const openA4 = (day: string) => { setA4Date(day); setTab('a4'); window.scrollTo({top:0}); };
  const addWords = async (items: WordFields[]): Promise<number> => {
    const s = current.current;
    if (!s || busy.current) return 0;
    const have = new Set(s.words.map(w => w.word.toLowerCase()));
    const fresh: WordItem[] = [];
    items.forEach(f => {
      const key = f.word.trim().toLowerCase();
      if (!key || !f.meaning.trim() || have.has(key)) return;
      have.add(key); fresh.push(createWord(f, today));
    });
    if (!fresh.length) return 0;
    const next = { ...s, words: [...s.words, ...fresh], settings: {...s.settings, lastClaimDate:today} };
    return await commit(next) ? fresh.length : 0;
  };
  const onGrade = async (id: string, rating: 1 | 2 | 3 | 4) => {
    const s = current.current;
    if (s && await commit(gradeWord(s, id, today, rating))) showToast('评分已保存，FSRS 排期已更新', 'ok');
  };
  const onHardReset = async (id: string) => {
    const s = current.current;
    if (s && await commit(resetWord(s, id, today))) showToast('已重置为顽固词，明天再复习', 'warn');
  };
  const onCheckout = async (ids: string[]) => {
    const s = current.current;
    if (!s || busy.current) return;
    const next = ids.reduce((result, id) => gradeWord(result, id, today, 3), s);
    const count = next.revlog.length - s.revlog.length;
    if (await commit(next)) {
      setConfetti({title:'今日打卡完成', subtitle:`已保存 ${count} 个词的复习评分，排期已更新`});
    }
  };
  const onSaveEdit = async (word: WordItem) => {
    if (current.current?.words.some(w => w.id !== word.id && w.word.toLowerCase() === word.word.toLowerCase())) { showToast('词库里已有同名单词', 'warn'); return; }
    if (await updateWords(words => words.map(w => w.id === word.id ? word : w))) { setEditing(null); showToast('已保存', 'ok'); }
  };
  const onDelete = async (id: string) => {
    const s = current.current;
    const w = s?.words.find(w => w.id === id);
    if (s && w && window.confirm(`删除「${w.word}」和它的复习记录？`)) await commit({...s, words:s.words.filter(w => w.id !== id), revlog:s.revlog.filter(l => l.wordId !== id)});
  };
  const toggle = (id: string, key: 'isHard' | 'isFavorite' | 'isMastered') => updateWords(words => words.map(w => w.id === id ? {...w, [key]:!w[key]} : w));
  const onImport = async (text: string, mode: 'merge' | 'replace'): Promise<boolean> => {
    const s = current.current;
    if (!s) return false;
    try {
      const incoming = parseBackup(text, today);
      if (mode === 'replace' && !window.confirm(`用备份中的 ${incoming.words.length} 词和全部日志覆盖当前记录？`)) return false;
      const next = mode === 'replace' ? incoming : mergeBackup(s, incoming);
      const saved = await commit(next);
      if (saved) showToast(`已恢复 ${next.words.length} 词及复习日志`, 'ok');
      return saved;
    } catch (error) { showToast(`导入失败：${error instanceof Error ? error.message : error}`, 'warn'); return false; }
  };
  const onResetSeed = async () => {
    const s = current.current;
    if (s && window.confirm('用示例词覆盖当前词库和复习日志？建议先导出备份。')) await commit({...s, words:seedWords(today), revlog:[]});
  };
  const onClearAll = async () => { const s = current.current; if (s) await commit({...s, words:[], revlog:[]}); };
  const onSkip = async (word: string) => { const s = current.current; if (s) await commit({...s, skipped:uniqSorted([...s.skipped, word])}); };
  const onSetDailyClaim = async (n: number) => { const s = current.current; if (s) await commit({...s, settings:{...s.settings, dailyClaim:n}}); };
  const changeTab = (t: Tab) => { if (t === 'a4') setA4Date(today); setTab(t); window.scrollTo({top:0}); };

  if (!state) return <main className="mx-auto max-w-[480px] space-y-4 p-6"><h1 className="text-xl font-bold">雅思 A4</h1><p role={loadError ? 'alert' : 'status'}>{loadError ? `读取失败：${loadError}。已有数据未被覆盖。请保留原始数据后重试。` : '正在读取本机学习记录…'}</p>{loadError && <button className={primaryBtn} onClick={() => location.reload()}>重试读取</button>}</main>;
  return <div className="mx-auto min-h-screen max-w-[480px] font-ui text-ink">
    {saveError && <div role="alert" className="sticky top-0 z-[90] bg-honey-100 p-4 text-sm"><p>保存未完成：{saveError}</p><button type="button" className={ghostBtn} onClick={() => location.reload()}>重新读取学习记录</button></div>}
    <fieldset disabled={saving} className="min-w-0 border-0 p-0">
      {tab === 'home' && <><div className="flex gap-2 px-4 pt-3"><button className={ghostBtn} onClick={() => changeTab('quiz')}>60 秒配对</button><button className={ghostBtn} onClick={() => changeTab('stats')}>学习统计</button></div><Dashboard words={state.words} today={today} schedule={schedule} selectedDay={selectedDay} onSelectDay={setSelectedDay} onOpenA4={openA4} onSpeak={onSpeak} /></>}
      {tab === 'a4' && <A4View words={state.words} today={today} date={a4Date} schedule={schedule} onBack={() => setTab('home')} onHardReset={onHardReset} onCheckout={onCheckout} onGrade={onGrade} onSpeak={onSpeak} onEdit={setEditing} />}
      {tab === 'add' && <AddView words={state.words} skipped={state.skipped} dailyClaim={state.settings.dailyClaim} onAdd={addWords} onSkip={onSkip} onSetDailyClaim={onSetDailyClaim} toast={showToast} />}
      {tab === 'bank' && <BankView state={state} today={today} onEdit={setEditing} onDelete={onDelete} onToggleHard={id => toggle(id,'isHard')} onToggleFavorite={id => toggle(id,'isFavorite')} onToggleMastered={id => toggle(id,'isMastered')} onSpeak={onSpeak} onImport={onImport} onResetSeed={onResetSeed} onClearAll={onClearAll} toast={showToast} />}
      {tab === 'quiz' && <MatchingGame words={gameWords} scopeLabel={todayWords.length ? '今日新词与复习词' : '今天没有任务，使用全部词库加练'} onBack={() => setTab('home')} onSpeak={onSpeak} />}
      {tab === 'stats' && <Statistics state={state} today={today} onBack={() => setTab('home')} />}
      <TabBar tab={tab} onChange={changeTab} due={schedule[today]?.due.length || 0} />
      {editing && <EditSheet word={editing} onSave={onSaveEdit} onClose={() => setEditing(null)} />}
    </fieldset>
    {saving && <p role="status" className="fixed left-1/2 top-2 z-[80] -translate-x-1/2 rounded-full bg-white px-4 py-2 text-sm shadow-card">正在保存…</p>}
    {confetti && <Confetti title={confetti.title} subtitle={confetti.subtitle} onClose={() => setConfetti(null)} />}
    {toast && <Toast message={toast.msg} tone={toast.tone} />}
  </div>;
}
