import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Home, BookOpenText, Library, X, Zap, BarChart3 } from 'lucide-react';
import type { AppState, StateSummary, WordFields, WordItem } from './lib';
import { backupJson, createWord, focusSummary, gradeWord, parseDate, removeFromFocus, resetWord, parseBackup, mergeBackup, speak, stateSummary, todayStr } from './lib';
import { dailyReport } from './coach';
import { buildCalendar, reviewIds, type ReviewScope } from './calendar';
import { applyUpdate, SW_UPDATE_EVENT } from './pwa';
import { listAutoBackups, onWorkspaceEvent, openWorkspace, persistWorkspace, saveAutoBackup, type BackupRow } from './db';
import { MatchingGame, Statistics } from './Practice';
import { Dashboard } from './Dashboard';
import { A4View } from './A4View';
import { AddView } from './AddView';
import { BookView } from './BookView';
import { beginGroup, answerBookQuestion, focusBookWord, getBookProgress, type BookAnswer } from './book';
import { BankView } from './BankView';
import { DoneStamp, Field, Toast, inputCls, primaryBtn, ghostBtn } from './ui';

type Tab = 'home' | 'dashboard' | 'a4' | 'add' | 'bank' | 'quiz' | 'stats';
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
    { key: 'home', label: '词书库', Icon: Library },
    { key: 'a4', label: 'A4 刷词', Icon: BookOpenText },
    { key: 'dashboard', label: '看板', Icon: Home },
    { key: 'bank', label: '我的单词', Icon: BookOpenText }
  ];
  return (
    <nav aria-label="主导航" className="tabbar fixed inset-x-0 bottom-0 z-30 border-t border-blush bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[480px]">
        {items.map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button key={key} type="button" aria-current={active ? 'page' : undefined} onClick={() => onChange(key)} className="relative flex min-h-14 flex-1 flex-col items-center gap-0.5 pb-1 pt-2">
              <span className={`relative rounded-2xl px-4 py-1 transition ${active ? 'bg-rose-100 text-rose-600' : 'text-ink-soft'}`}>
                <Icon size={22} strokeWidth={active ? 2.4 : 2} />
                {key === 'a4' && due > 0 && <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-rose-500 px-1 text-center text-[10px] font-extrabold leading-[18px] text-white">{due}</span>}
              </span>
              <span className={`text-[11px] font-extrabold ${active ? 'text-rose-600' : 'text-ink-soft'}`}>{label}</span>
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
  const [a4Scope, setA4Scope] = useState<ReviewScope>('focus');
  const [a4Back, setA4Back] = useState<Tab>('home');
  const [selectedDay, setSelectedDay] = useState(today);
  const shownToday = useRef(today);
  useEffect(() => {
    // A PWA resumed after midnight should not leave "today" views on yesterday.
    const previous = shownToday.current;
    if (previous === today) return;
    shownToday.current = today;
    setA4Date(day => day === previous ? today : day);
    setSelectedDay(day => day === previous ? today : day);
  }, [today]);
  const [toast, setToast] = useState<{ msg: string; tone: ToastTone } | null>(null);
  const [stamp, setStamp] = useState<{ title: string; subtitle: string } | null>(null);
  const [editing, setEditing] = useState<WordItem | null>(null);
  const [autoBackups, setAutoBackups] = useState<BackupRow[]>([]);
  const refreshBackups = useCallback(() => listAutoBackups().then(setAutoBackups).catch(() => undefined), []);
  useEffect(() => { void refreshBackups(); }, [refreshBackups]);
  const [blocked, setBlocked] = useState(false);
  const [staleElsewhere, setStaleElsewhere] = useState(false);
  const [update, setUpdate] = useState<ServiceWorker | null>(null);
  useEffect(() => {
    const onUpdate = (e: Event) => setUpdate((e as CustomEvent<ServiceWorker>).detail);
    window.addEventListener(SW_UPDATE_EVENT, onUpdate);
    return () => window.removeEventListener(SW_UPDATE_EVENT, onUpdate);
  }, []);
  const [storagePersisted, setStoragePersisted] = useState<boolean | null>(null);
  useEffect(() => onWorkspaceEvent(event => {
    if (event === 'blocked') setBlocked(true);
    else if (event === 'changed') setStaleElsewhere(true);
    else setSaveError('新版本已在其他窗口打开。请刷新本页后再操作，当前页面不会再写入学习记录。');
  }), []);
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
      setBlocked(false);
      // iOS Safari may evict site data of unused web pages; ask for persistent storage where supported.
      const storage = navigator.storage;
      if (storage?.persist && storage.persisted) storage.persisted().then(p => p || storage.persist()).then(p => { if (active) setStoragePersisted(p); }).catch(() => setStoragePersisted(false));
      if (result.fresh) showToast('词书已就绪，日历将记录你的实际学习进度', 'info');
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
  const calendar = useMemo(() => buildCalendar(state ?? { words: [], revlog: [], skipped: [], settings: { dailyClaim: 30, lastClaimDate: '' } }, today), [state, today]);
  const todayWords = state?.words.filter(w => w.createdAt === today || (!w.isMastered && w.nextReviewDate <= today) || w.reviewHistory.includes(today)) || [];
  const gameWords = todayWords.length ? todayWords : state?.words || [];
  const report = useMemo(() => state ? dailyReport(state, calendar, today) : null, [state, calendar, today]);
  const onSpeak = useCallback((word: string) => { if (!speak(word, () => showToast('朗读失败：请检查静音开关、音量或系统英语语音', 'warn'))) showToast('当前浏览器不支持语音朗读', 'warn'); }, [showToast]);
  const openA4 = (day: string, scope: ReviewScope = 'focus', from: Tab = 'dashboard') => { setA4Back(from); setA4Scope(scope); setA4Date(day); setTab('a4'); window.scrollTo({top:0}); };
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
    const next = { ...s, words: [...s.words, ...fresh] };
    return await commit(next) ? fresh.length : 0;
  };
  const onGrade = async (id: string, rating: 1 | 2 | 3 | 4) => {
    const s = current.current;
    if (!s) return;
    const next = gradeWord(s, id, today, rating);
    if (!await commit(next)) return;
    const due = next.words.find(w => w.id === id)?.nextReviewDate;
    const when = !due ? '' : due <= today ? '今天稍后' : `${parseDate(due).getMonth() + 1} 月 ${parseDate(due).getDate()} 日`;
    showToast(when ? `评分已保存 · 下次复习 ${when}` : '评分已保存，FSRS 排期已更新', 'ok');
  };
  const onHardReset = async (id: string) => {
    const s = current.current;
    if (s && await commit(resetWord(s, id, today))) showToast('已重置为顽固词，明天再复习', 'warn');
  };
  const onFocus = async (word: string, reason?: string) => {
    const s = current.current;
    if (!s) return false;
    const next = focusBookWord(s, word, today, reason);
    if (next === s) {
      if (s.words.some(w => w.word.toLowerCase() === word.toLowerCase() && w.focus?.active)) showToast('已在 A4 攻坚中，保持原任务', 'info');
      return next.words.some(w => w.word.toLowerCase() === word.toLowerCase() && w.focus?.active);
    }
    const saved = await commit(next);
    if (saved) showToast('已加入 A4 攻坚，明天开始复习', 'ok');
    return saved;
  };
  const onUnfocus = async (word: string) => {
    const s = current.current;
    const target = s?.words.find(w => w.word.toLowerCase() === word.toLowerCase() && w.focus?.active);
    if (!s || !target) return false;
    const saved = await commit({ ...s, words: s.words.map(w => w.id === target.id ? removeFromFocus(w, today) : w) });
    if (saved) showToast(target.focus?.before ? '已移出 A4，已恢复加入前的复习日期' : '已移出 A4，保留最新 FSRS 排期', 'ok');
    return saved;
  };
  const onCheckout = async (ids: string[]) => {
    const s = current.current;
    if (!s || busy.current) return;
    const next = ids.reduce((result, id) => gradeWord(result, id, today, 3), s);
    const count = next.revlog.length - s.revlog.length;
    if (await commit(next)) {
      setStamp({title:'今日打卡完成', subtitle:`已保存 ${count} 个词的复习评分，排期已更新`});
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
      if (mode === 'merge') {
        const next = mergeBackup(s, incoming);
        const added = next.words.length - s.words.length;
        const saved = await commit(next);
        if (saved) showToast(`合并完成：新增 ${added} 词 · 已有 ${incoming.words.length - added} 词保留本机排期 · 新增 ${next.revlog.length - s.revlog.length} 条日志`, 'ok');
        return saved;
      }
      const fmt = (x: StateSummary) => `${x.words} 词 · A4 ${x.focus} 词 · 复习日志 ${x.logs} 条 · 词书 ${x.groups} 组`;
      if (!window.confirm(`用备份覆盖当前记录？\n备份：${fmt(stateSummary(incoming))}\n当前：${fmt(stateSummary(s))}\n覆盖前会自动保存当前记录，可在“我的单词”下载。`)) return false;
      try { await saveAutoBackup(backupJson(s), today, 'import', stateSummary(s)); } catch { showToast('自动备份失败，已取消覆盖，请先手动下载备份', 'warn'); return false; }
      void refreshBackups();
      const saved = await commit(incoming);
      if (saved) showToast(`已覆盖恢复 ${incoming.words.length} 词；覆盖前的记录已自动备份`, 'ok');
      return saved;
    } catch (error) { showToast(`导入失败：${error instanceof Error ? error.message : error}`, 'warn'); return false; }
  };
  const onDownloadBackup = (key: string) => {
    const row = autoBackups.find(b => b.key === key);
    if (!row) { showToast('没有找到这份自动备份', 'warn'); return; }
    const url = URL.createObjectURL(new Blob([row.json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = `ielts-a4-before-${row.reason === 'clear' ? 'clear' : 'import'}-${row.day}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const onClearAll = async () => {
    const s = current.current;
    if (!s) return;
    const hasData = Boolean(s.words.length || s.revlog.length || s.bookLearning);
    if (hasData) {
      try { await saveAutoBackup(backupJson(s), today, 'clear', stateSummary(s)); } catch { showToast('自动备份失败，已取消清空，请先手动下载备份', 'warn'); return; }
      void refreshBackups();
    }
    if (await commit({...s, words:[], revlog:[], bookLearning:undefined}) && hasData) showToast('已清空；清空前的记录已自动备份，可在“数据备份与恢复”下载', 'ok');
  };
  const onBeginGroup = async (groupId: string) => {
    const s = current.current;
    if (!s) return false;
    const next = beginGroup(s, groupId);
    return next.bookLearning?.active?.groupId === groupId && await commit(next);
  };
  const onBookAnswer = async (answer: BookAnswer) => {
    const s = current.current;
    return s ? commit(answerBookQuestion(s, today, answer)) : false;
  };
  const onSetDailyGroups = async (dailyGroups: number) => {
    const s = current.current;
    if (s) await commit({ ...s, bookLearning: { ...getBookProgress(s), dailyGroups } });
  };
  const changeTab = (t: Tab) => { if (t === 'a4') { setA4Date(today); setA4Scope('focus'); setA4Back('home'); } setTab(t); window.scrollTo({top:0}); };

  if (!state) return <main className="mx-auto max-w-[480px] space-y-4 p-6"><h1 className="text-xl font-bold">雅思 A4</h1><p role={loadError ? 'alert' : 'status'}>{loadError ? `读取失败：${loadError}。已有数据未被覆盖。请保留原始数据后重试。` : blocked ? '另一个窗口仍在使用旧版本的学习记录。请关闭其他打开的本站页面或主屏幕 App，读取会自动继续。' : '正在读取本机学习记录…'}</p>{loadError && <button className={primaryBtn} onClick={() => location.reload()}>重试读取</button>}</main>;
  return <div className="mx-auto min-h-screen max-w-[480px] font-ui text-ink">
    {staleElsewhere && !saveError && <div role="alert" className="sticky top-0 z-[90] bg-honey-100 p-4 text-sm"><p>其他标签页已更新学习记录。请刷新后继续，避免在旧页面上操作。</p><button type="button" className={ghostBtn} onClick={() => location.reload()}>刷新学习记录</button></div>}
    {update && !staleElsewhere && !saveError && <div role="status" className="sticky top-0 z-[90] flex items-center justify-between gap-2 bg-sage-100 p-3 text-sm"><p>新版本已下载，学习记录不受影响。</p><button type="button" className={ghostBtn} disabled={saving} onClick={() => { window.dispatchEvent(new Event(SW_UPDATE_EVENT + ':apply')); applyUpdate(update); }}>立即更新</button></div>}
    {saveError && <div role="alert" className="sticky top-0 z-[90] bg-honey-100 p-4 text-sm"><p>保存未完成：{saveError}</p><button type="button" className={ghostBtn} onClick={() => location.reload()}>重新读取学习记录</button></div>}
    <fieldset disabled={saving} className="min-w-0 border-0 p-0">
      {tab === 'home' && <><div className="flex gap-2 px-4 pt-3"><button className={`${ghostBtn} border-honey-300 bg-honey-50`} onClick={() => changeTab('quiz')}><Zap size={16} className="text-honey-600" />60 秒配对</button><button className={ghostBtn} onClick={() => changeTab('stats')}><BarChart3 size={16} className="text-rose-500" />学习统计</button></div><BookView state={state} today={today} report={report ?? undefined} onOpenA4={scope => openA4(today, scope, 'home')} onQuiz={() => changeTab('quiz')} onBegin={onBeginGroup} onAnswer={onBookAnswer} onSetDailyGroups={onSetDailyGroups} onSpeak={onSpeak} onFocus={onFocus} onUnfocus={onUnfocus} /></>}
      {tab === 'dashboard' && <Dashboard words={state.words} today={today} calendar={calendar} onOpenBook={() => changeTab('home')} selectedDay={selectedDay} onSelectDay={setSelectedDay} onOpenA4={openA4} onSpeak={onSpeak} />}
      {tab === 'a4' && <A4View words={state.words} today={today} date={a4Date} scope={a4Scope} onScopeChange={setA4Scope} allDueCount={reviewIds(calendar.all, today, today).length} onOpenBook={() => changeTab('home')} schedule={calendar[a4Scope]} onBack={() => { setTab(a4Back); window.scrollTo({ top: 0 }); }} onHardReset={onHardReset} onCheckout={onCheckout} onLater={() => { setTab('home'); window.scrollTo({ top: 0 }); showToast('未评分的词保留在今日待复习，随时回来处理', 'info'); }} focusSummary={focusSummary(state, today)} onGrade={onGrade} onSpeak={onSpeak} onEdit={setEditing} />}
      {tab === 'add' && <><div className="px-4 pt-3"><button className={ghostBtn} onClick={() => changeTab('bank')}>返回我的单词</button></div><AddView words={state.words} onAdd={addWords} toast={showToast} /></>}
      {tab === 'bank' && <><div className="px-4 pt-3"><button className={ghostBtn} onClick={() => changeTab('add')}>录入新词</button></div><BankView state={state} today={today} onEdit={setEditing} onDelete={onDelete} onToggleHard={id => toggle(id,'isHard')} onToggleFavorite={id => toggle(id,'isFavorite')} onToggleMastered={id => toggle(id,'isMastered')} onSpeak={onSpeak} onImport={onImport} onUnfocus={onUnfocus} autoBackups={autoBackups} onDownloadBackup={onDownloadBackup} storagePersisted={storagePersisted} onClearAll={onClearAll} toast={showToast} /></>}
      {tab === 'quiz' && <MatchingGame words={gameWords} scopeLabel={todayWords.length ? '今日新词与复习词' : '今天没有任务，使用全部词库加练'} onBack={() => setTab('home')} onSpeak={onSpeak} />}
      {tab === 'stats' && <Statistics state={state} today={today} onBack={() => setTab('home')} />}
      <TabBar tab={tab} onChange={changeTab} due={calendar.focus[today]?.due.length ?? 0} />
      {editing && <EditSheet word={editing} onSave={onSaveEdit} onClose={() => setEditing(null)} />}
    </fieldset>
    {saving && <p role="status" className="fixed left-1/2 top-2 z-[80] -translate-x-1/2 rounded-full bg-white px-4 py-2 text-sm shadow-card">正在保存…</p>}
    {stamp && <DoneStamp title={stamp.title} subtitle={stamp.subtitle} onClose={() => setStamp(null)} />}
    {toast && <Toast message={toast.msg} tone={toast.tone} />}
  </div>;
}
