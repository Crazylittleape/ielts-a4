import { useMemo, useRef, useState } from 'react';
import { Search, Volume2, Flame, Pencil, Trash2, Download, Copy, Upload, ClipboardPaste, Eraser, Database } from 'lucide-react';
import type { AppState, WordItem } from './lib';
import { isDueOn, backupJson, focusStatus } from './lib';
import { MAX_AUTO_BACKUPS, type BackupRow } from './db';
import { Card, PageHeader, StageChip, inputCls, softBtn, ghostBtn, SectionTitle, Empty } from './ui';

type Filter = 'all' | 'off' | 'focus' | 'history' | 'due' | 'hard' | 'favorite' | 'mastered' | 's0' | 's1' | 's2' | 's3' | 's4' | 's5';

interface Props {
  state: AppState;
  today: string;
  onEdit: (w: WordItem) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onToggleMastered: (id: string) => void;
  onToggleHard: (id: string) => void;
  onSpeak: (w: string) => void;
  onImport: (text: string, mode: 'merge' | 'replace') => Promise<boolean>;
  onUnfocus: (word: string) => Promise<boolean>;
  onJoin: (ids: string[]) => Promise<boolean>;
  autoBackups: BackupRow[];
  onDownloadBackup: (key: string) => void;
  storagePersisted: boolean | null;
  onClearAll: () => void;
  toast: (msg: string, tone?: 'ok' | 'warn' | 'info') => void;
}

export function BankView({ state, today, onEdit, onDelete, onToggleHard, onToggleFavorite, onToggleMastered, onSpeak, onImport, onUnfocus, onJoin, autoBackups, onDownloadBackup, storagePersisted, onClearAll, toast }: Props) {
  const { words } = state;
  const mistakes = useMemo(() => new Set(state.revlog.filter(log => log.rating === 1).map(log => log.wordId)), [state.revlog]);
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteMode, setPasteMode] = useState<'merge' | 'replace'>('merge');
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const tags = useMemo(() => Array.from(new Set(words.map((w) => w.tag).filter((t): t is string => Boolean(t)))).sort(), [words]);

  const list = useMemo(() => {
    const k = q.trim().toLowerCase();
    return words
      .filter((w) => {
        if (filter === 'off') return w.review === 'off';
        if (filter === 'focus') return Boolean(w.focus?.active);
        if (filter === 'history') return Boolean(w.focus || w.focusAddedDays?.length);
        if (filter === 'due') return isDueOn(w, today);
        if (filter === 'hard') return w.isHard || mistakes.has(w.id);
        if (filter === 'favorite') return w.isFavorite;
        if (filter === 'mastered') return w.isMastered;
        if (filter.startsWith('s')) return w.stage === Number(filter.slice(1));
        return true;
      })
      .filter((w) => !tag || w.tag === tag)
      .filter((w) => !k || w.word.toLowerCase().includes(k) || w.meaning.toLowerCase().includes(k) || w.phonetic.toLowerCase().includes(k) || w.synonyms.toLowerCase().includes(k))
      .sort((a, b) => (a.nextReviewDate < b.nextReviewDate ? -1 : a.nextReviewDate > b.nextReviewDate ? 1 : a.word.localeCompare(b.word)));
  }, [words, filter, q, tag, today, mistakes]);

  const offInList = list.filter(w => w.review === 'off' && !w.isMastered && !w.mastered);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: words.length, off: 0, focus: 0, history: 0, due: 0, hard: 0, favorite: 0, mastered: 0, s0: 0, s1: 0, s2: 0, s3: 0, s4: 0, s5: 0 };
    words.forEach((w) => {
      if (w.review === 'off') c.off++;
      if (w.focus?.active) c.focus++;
      if (w.focus || w.focusAddedDays?.length) c.history++;
      if (isDueOn(w, today)) c.due++;
      if (w.isHard || mistakes.has(w.id)) c.hard++;
      if (w.isFavorite) c.favorite++;
      if (w.isMastered) c.mastered++;
      c[`s${w.stage}` as Filter]++;
    });
    return c;
  }, [words, today, mistakes]);

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'off', label: '未加入复习' },
    { key: 'focus', label: 'A4 攻坚' },
    { key: 'history', label: '攻坚记录' },
    { key: 'due', label: '今日待复习' },
    { key: 'hard', label: '🔥 错词 / 顽固' },
    { key: 'favorite', label: '★ 收藏' },
    { key: 'mastered', label: '✓ 已掌握' },
  ];

  const download = () => {
    const blob = new Blob([backupJson(state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ielts-a4-backup-${today}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('已生成备份文件', 'ok');
  };

  const copy = async () => {
    const text = backupJson(state);
    try {
      await navigator.clipboard.writeText(text);
      toast('备份 JSON 已复制到剪贴板', 'ok');
    } catch {
      setPasteText(text);
      setPasteOpen(true);
      toast('浏览器拒绝写剪贴板，已把 JSON 放到下方文本框，请手动全选复制', 'info');
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => onImport(String(reader.result || ''), pasteMode);
    reader.readAsText(f);
    e.target.value = '';
  };

  return (
    <div className="safe-bottom-pad">
      <PageHeader title="我的单词" subtitle={`共 ${words.length} 词 · 顽固 ${counts.hard} · 今日待复习 ${counts.due}`} />
      <div className="space-y-4 px-4 pt-1">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input className={`${inputCls} pl-10`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索英文 / 中文 / 音标 / 同义词" autoCapitalize="none" autoCorrect="off" />
        </div>
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 no-scrollbar">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-extrabold transition ${filter === f.key ? 'bg-gradient-to-r from-rose-400 to-lilac-400 text-white shadow-md shadow-rose-200/60' : 'bg-white text-ink-soft shadow-card'}`}
            >
              {f.label} <span className="opacity-70">{counts[f.key]}</span>
            </button>
          ))}
        </div>
        {tags.length > 0 && (
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 no-scrollbar">
            <button type="button" onClick={() => setTag('')} className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-extrabold ${!tag ? 'bg-lilac-200 text-lilac-500' : 'bg-lilac-50 text-ink-soft'}`}>
              全部来源
            </button>
            {tags.map((t) => (
              <button key={t} type="button" onClick={() => setTag(t === tag ? '' : t)} className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-extrabold ${tag === t ? 'bg-lilac-200 text-lilac-500' : 'bg-lilac-50 text-ink-soft'}`}>
                {t}
              </button>
            ))}
          </div>
        )}

        {offInList.length > 0 && <Card className="space-y-2 p-4">
          <p className="text-xs leading-relaxed text-ink-soft">当前筛选里有 {offInList.length} 个已学但未加入复习的词。先用搜索、来源或筛选缩小范围，再统一加入。</p>
          <button type="button" className={`${softBtn} w-full`} onClick={() => void onJoin(offInList.map(w => w.id))}>将筛选出的 {offInList.length} 个未复习词加入复习</button>
        </Card>}
        <Card className="overflow-hidden">
          {list.length === 0 ? (
            <Empty emoji="🔍" title="没有匹配的单词" desc="换个筛选条件试试" />
          ) : (
            <ul className="divide-y divide-rose-50">
              {list.map((w) => (
                <li key={w.id} className="flex items-center gap-2 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <button type="button" onClick={() => onSpeak(w.word)} className="font-serif text-[17px] font-semibold text-ink">
                        {w.word}
                      </button>
                      <span className="text-[11px] font-semibold text-ink-soft">{w.phonetic}</span>
                      <StageChip word={w} stage={w.stage} />
                      {w.review === 'off' && <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10.5px] font-bold text-ink-soft">已学 · 未加入复习</span>}
                      {w.isHard && <Flame size={12} className="text-honey-500" />}
                    </div>
                    <p className="truncate text-[12.5px] font-bold text-ink">{w.meaning}</p>
                    <p className="truncate text-[10.5px] font-semibold text-ink-faint">
                      {w.synonyms && <span className="italic text-lilac-500">≈ {w.synonyms} · </span>}
                      {w.isMastered ? "已掌握 · 暂停排期" : `下次 ${w.nextReviewDate}`} · 复习 {w.reviewHistory.length - 1} 次{w.tag ? ` · ${w.tag}` : ''}
                    </p>
                    {(() => { const status = focusStatus(w, today, state.revlog); return status.key !== 'none' && <div className="mt-1 flex flex-wrap items-center gap-2 text-[10.5px] font-bold"><span className={`rounded px-1.5 py-0.5 ${w.focus?.active ? 'bg-honey-50 text-honey-700' : 'bg-stone-100 text-ink-soft'}`}>{status.label}</span>{w.focus?.active && <button type="button" className="min-h-8 rounded-lg border border-stone-200 px-2 text-ink-soft" onClick={() => void onUnfocus(w.word)}>移出 A4</button>}</div>; })()}
                  </div>
                  <div className="flex max-w-[104px] shrink-0 flex-wrap items-center justify-end">
                    <button type="button" className="rounded-xl p-1.5 text-xs text-rose-500" onClick={() => onToggleFavorite(w.id)} aria-label={w.isFavorite ? "取消收藏" : "收藏"}>{w.isFavorite ? "★" : "☆"}</button>
                    <button type="button" className="rounded-xl p-1.5 text-xs text-sage-500" onClick={() => onToggleMastered(w.id)}>{w.isMastered ? "恢复复习" : "掌握"}</button>
                    <button type="button" onClick={() => onSpeak(w.word)} className="rounded-xl p-1.5 text-ink-soft active:bg-rose-50" aria-label="朗读"><Volume2 size={16} /></button>
                    <button type="button" onClick={() => onToggleHard(w.id)} className={`rounded-xl p-1.5 active:bg-honey-100 ${w.isHard ? 'text-honey-500' : 'text-ink-faint'}`} aria-label="顽固"><Flame size={16} /></button>
                    <button type="button" onClick={() => onEdit(w)} className="rounded-xl p-1.5 text-ink-soft active:bg-rose-50" aria-label="编辑"><Pencil size={16} /></button>
                    <button type="button" onClick={() => onDelete(w.id)} className="rounded-xl p-1.5 text-rose-300 active:bg-rose-50" aria-label="删除"><Trash2 size={16} /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <p className="mb-3 text-xs text-ink-soft"><a className="underline" href="./licenses/NOTICE.txt" target="_blank" rel="noreferrer">数据来源与第三方许可</a></p>
          <SectionTitle right={<Database size={14} className="text-ink-faint" />}>数据备份与恢复</SectionTitle>
          <p className="mb-3 text-[11px] font-semibold leading-relaxed text-ink-soft">单词、词书进度和复习记录都只存在这台设备的浏览器里，换手机、清缓存都会丢。建议每周导出一次 JSON 存到 iCloud / 微信文件助手。</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={softBtn} onClick={download}><Download size={15} /> 下载 JSON 备份</button>
            <button type="button" className={softBtn} onClick={copy}><Copy size={15} /> 复制备份 JSON</button>
            <button type="button" className={ghostBtn} onClick={() => fileRef.current?.click()}><Upload size={15} /> 选择文件恢复</button>
            <button type="button" className={ghostBtn} onClick={() => setPasteOpen((v) => !v)}><ClipboardPaste size={15} /> 粘贴 JSON 恢复</button>
          </div>
          {storagePersisted !== null && <p data-testid="storage-status" className="mt-2 text-[11px] font-semibold leading-relaxed text-ink-soft">{storagePersisted ? '浏览器已允许持久保存本机记录。' : '浏览器未承诺持久保存：iPhone 请用 Safari「添加到主屏幕」后从主屏幕打开，并定期导出备份。'}</p>}
          {autoBackups.length > 0 && <div className="mt-3 rounded-xl bg-stone-50 p-3">
            <p className="text-[11px] font-extrabold text-ink-soft">自动备份 · 覆盖导入或清空前保存，保留最近 {MAX_AUTO_BACKUPS} 份，只存在本机</p>
            <ul className="mt-2 space-y-1.5">{autoBackups.map(b => {
              const label = b.reason === 'clear' ? '清空前' : '覆盖导入前';
              const d = b.createdAt ? new Date(b.createdAt) : null;
              const when = d ? `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : b.day;
              return <li key={b.key} className="flex items-center justify-between gap-2 text-[12px]">
                <span className="min-w-0 break-words">{label} · {when}{b.summary ? ` · ${b.summary.words} 词 · A4 ${b.summary.focus} 词 · 日志 ${b.summary.logs} 条` : ''}</span>
                <button type="button" className="min-h-9 shrink-0 rounded-lg border border-stone-200 bg-white px-2.5 text-xs font-bold" aria-label={`下载${label}的自动备份 ${when}`} onClick={() => onDownloadBackup(b.key)}><Download size={12} className="inline" /> 下载</button>
              </li>;
            })}</ul>
          </div>}
          <input ref={fileRef} type="file" accept="application/json,.json,text/plain" className="hidden" onChange={onFile} />
          <div className="mt-3 flex items-center gap-2 text-[11px] font-extrabold text-ink-soft">
            恢复方式：
            <button type="button" onClick={() => setPasteMode('merge')} className={`rounded-full px-2.5 py-1 ${pasteMode === 'merge' ? 'bg-sage-100 text-sage-500' : 'bg-stone-100'}`}>合并（按单词去重）</button>
            <button type="button" onClick={() => setPasteMode('replace')} className={`rounded-full px-2.5 py-1 ${pasteMode === 'replace' ? 'bg-rose-100 text-rose-500' : 'bg-stone-100'}`}>覆盖</button>
          </div>
          {pasteOpen && (
            <div className="mt-3 space-y-2 fade-in">
              <textarea className={`${inputCls} min-h-[120px] font-mono text-[12px]`} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder='{"words":[...]}' />
              <button type="button" className={`${softBtn} w-full`} disabled={!pasteText.trim()} onClick={async () => { if (await onImport(pasteText, pasteMode)) { setPasteText(''); setPasteOpen(false); } }}>
                <Upload size={15} /> {pasteMode === 'merge' ? '合并导入' : '覆盖恢复'}
              </button>
            </div>
          )}
          <div className="mt-4 grid grid-cols-1 gap-2 border-t border-rose-50 pt-3">
            {confirmClear ? (
              <button type="button" className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-rose-500 px-4 py-2.5 text-xs font-bold text-white" onClick={() => { onClearAll(); setConfirmClear(false); }}>
                <Eraser size={14} /> 确认清空单词和进度？
              </button>
            ) : (
              <button type="button" className={`${ghostBtn} text-xs text-rose-400`} onClick={() => { setConfirmClear(true); setTimeout(() => setConfirmClear(false), 4000); }}>
                <Eraser size={14} /> 清空单词和进度
              </button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
