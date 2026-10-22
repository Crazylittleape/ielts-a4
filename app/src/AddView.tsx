import { useMemo, useState } from 'react';
import { Wand2, ClipboardPaste, BookMarked, Sparkles, Star, SkipForward, Search, Plus, Check } from 'lucide-react';
import type { WordFields, WordItem } from './lib';
import { parseBatchText } from './lib';
import bookSequence from './data/book-sequence.json';
import type { DictEntry } from './dict';
import { ieltsEntries, lookup, searchDict } from './dict';
import { Card, Field, PageHeader, Segmented, inputCls, primaryBtn, softBtn, ghostBtn, SectionTitle } from './ui';

type Sub = 'single' | 'book' | 'paste' | 'claim';

interface Props {
  words: WordItem[];
  skipped: string[];
  dailyClaim: number;
  onAdd: (items: WordFields[]) => Promise<number>;
  onSkip: (word: string) => void;
  onSetDailyClaim: (n: number) => void;
  toast: (msg: string, tone?: 'ok' | 'warn' | 'info') => void;
}

export function AddView({ words, skipped, dailyClaim, onAdd, onSkip, onSetDailyClaim, toast }: Props) {
  const [sub, setSub] = useState<Sub>('single');
  return (
    <div className="safe-bottom-pad">
      <PageHeader title="录入新词" subtitle="今天录入 · 明天 +1 天开始复习 · 自动排期" />
      <div className="space-y-4 px-4 pt-1">
        <Segmented
          options={[
            { key: 'single', label: '单条' },
            { key: 'book', label: '真经词序' },
            { key: 'paste', label: '批量粘贴' },
            { key: 'claim', label: '词库领取' }
          ]}
          value={sub}
          onChange={setSub}
        />
        {sub === 'single' && <SingleAdd words={words} onAdd={onAdd} toast={toast} />}
        {sub === 'book' && <BookImport words={words} skipped={skipped} dailyClaim={dailyClaim} onSetDailyClaim={onSetDailyClaim} onAdd={onAdd} toast={toast} />}
        {sub === 'paste' && <PasteImport words={words} onAdd={onAdd} toast={toast} />}
        {sub === 'claim' && <Claim words={words} skipped={skipped} dailyClaim={dailyClaim} onAdd={onAdd} onSkip={onSkip} onSetDailyClaim={onSetDailyClaim} toast={toast} />}
      </div>
    </div>
  );
}

function SingleAdd({ words, onAdd, toast }: { words: WordItem[]; onAdd: Props['onAdd']; toast: Props['toast'] }) {
  const [f, setF] = useState<WordFields>({ word: '', meaning: '', phonetic: '', synonyms: '' });
  const [suggest, setSuggest] = useState<DictEntry | null>(null);
  const set = (k: keyof WordFields, v: string) => setF((p) => ({ ...p, [k]: v }));
  const exists = useMemo(() => words.some((w) => w.word.toLowerCase() === f.word.trim().toLowerCase()), [words, f.word]);

  const tryLookup = () => {
    const e = lookup(f.word);
    setSuggest(e);
    if (e) {
      setF((p) => ({ ...p, phonetic: p.phonetic || e.phonetic, meaning: p.meaning || e.meaning }));
    }
  };

  const submit = async () => {
    if (!f.word.trim() || !f.meaning.trim()) {
      toast('英文单词和中文释义是必填的', 'warn');
      return;
    }
    if (exists) {
      toast('词库里已经有这个词了', 'warn');
      return;
    }
    const n = await onAdd([f]);
    if (n > 0) {
      toast(`已录入「${f.word.trim()}」· 明天开始复习`, 'ok');
      setF({ word: '', meaning: '', phonetic: '', synonyms: '' });
      setSuggest(null);
    }
  };

  return (
    <Card className="space-y-3 p-4">
      <Field label="英文单词" hint="必填 · 输入后自动查词典补全">
        <div className="flex gap-2">
          <input className={inputCls} value={f.word} onChange={(e) => set('word', e.target.value)} onBlur={tryLookup} placeholder="ubiquitous" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
          <button type="button" className={`${softBtn} shrink-0`} onClick={tryLookup}>
            <Wand2 size={15} /> 补全
          </button>
        </div>
        {exists && <p className="mt-1 px-1 text-[11px] font-bold text-honey-500">词库里已有这个词</p>}
        {suggest && (
          <p className="mt-1 px-1 text-[11px] font-semibold text-sage-500">
            词典：{suggest.word} {suggest.phonetic} {suggest.collins > 0 && `· 柯林斯 ${'★'.repeat(suggest.collins)}`} {suggest.ielts && '· 雅思'}
          </p>
        )}
      </Field>
      <Field label="中文释义" hint="必填">
        <input className={inputCls} value={f.meaning} onChange={(e) => set('meaning', e.target.value)} placeholder="adj. 无处不在的，普遍存在的" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="音标" hint="选填">
          <input className={inputCls} value={f.phonetic} onChange={(e) => set('phonetic', e.target.value)} placeholder="/juːˈbɪk.wɪ.təs/" />
        </Field>
        <Field label="同义替换" hint="选填">
          <input className={inputCls} value={f.synonyms} onChange={(e) => set('synonyms', e.target.value)} placeholder="pervasive" autoCapitalize="none" />
        </Field>
      </div>
      <button type="button" className={`${primaryBtn} w-full`} onClick={submit}>
        <Plus size={18} /> 录入并排进FSRS日历
      </button>
    </Card>
  );
}

interface BookRow {
  word: string;
  entry: DictEntry | null;
  meaning: string;
}

function BookImport({ words, skipped, dailyClaim, onSetDailyClaim, onAdd, toast }: Pick<Props, 'words' | 'skipped' | 'dailyClaim' | 'onSetDailyClaim' | 'onAdd' | 'toast'>) {
  const [listNo, setListNo] = useState('1');
  const [text, setText] = useState(bookSequence.slice(0, 30).join('\n'));
  const [rows, setRows] = useState<BookRow[] | null>(null);
  const [dups, setDups] = useState<string[]>([]);
  const have = new Set([...words.map(w => w.word.toLowerCase()), ...skipped.map(w => w.toLowerCase())]);
  const nextWords = bookSequence.filter(word => !have.has(word.toLowerCase())).map(word => ({word, entry:lookup(word)})).filter(row => row.entry && row.entry.word.toLowerCase() === row.word.toLowerCase()).slice(0,dailyClaim);
  const claimSequence = async () => {
    const n = await onAdd(nextWords.map(row => ({word:row.word, meaning:row.entry!.meaning, phonetic:row.entry!.phonetic, tag:'真经词序 · 每日领取'})));
    if (n) toast(`已按词序领取 ${n} 词，自动跳过已录入和已认识的词`, 'ok');
  };

  const parse = () => {
    const have = new Set(words.map((w) => w.word.toLowerCase()));
    const seen = new Set<string>();
    const out: BookRow[] = [];
    const d: string[] = [];
    text
      .split(/[\n,，;；、\t]+/)
      .map((s) => s.trim().replace(/^\d+[.、)\]]?\s*/, '').replace(/\s*[\/\[].*$/, '').replace(/[^\p{L}'’\- ]+$/u, '').trim())
      .filter(Boolean)
      .forEach((w) => {
        if (!/^\p{L}[\p{L}'’\- ]*$/u.test(w)) return;
        const k = w.toLowerCase();
        if (seen.has(k)) return;
        seen.add(k);
        if (have.has(k)) {
          d.push(w);
          return;
        }
        const e = lookup(w);
        out.push({ word: e && e.word.toLowerCase() !== k && w.split(' ').length === 1 ? w : w, entry: e, meaning: e ? e.meaning : '' });
      });
    setRows(out);
    setDups(d);
    if (out.length === 0) toast('没有识别到新的英文单词', 'warn');
  };

  const found = rows ? rows.filter((r) => r.entry) : [];
  const missing = rows ? rows.filter((r) => !r.entry) : [];
  const ready = rows ? rows.filter((r) => r.meaning.trim()) : [];

  const confirm = async () => {
    if (!rows) return;
    const tag = listNo.trim() ? `真经词序 30词组 ${listNo.trim()}` : '自定义词单';
    const items: WordFields[] = ready.map((r) => ({ word: r.word, meaning: r.meaning.trim(), phonetic: r.entry ? r.entry.phonetic : '', synonyms: '', tag }));
    const n = await onAdd(items);
    if (!n) return;
    toast(`已排入 ${n} 个词 · ${tag} · 明天开始复习`, 'ok');
    setRows(null);
    setText('');
  };

  return (
    <div className="space-y-3">
      <Card className="space-y-3 p-4">
        <div className="flex items-start gap-2 rounded-2xl bg-lilac-50 px-3 py-2.5 text-[11px] font-semibold leading-relaxed text-lilac-500">
          <BookMarked size={16} className="mt-0.5 shrink-0" />
          <span>
            内置 3,630 个去重英文词序，按每组 30 词分成 121 组（非原书 List）。音标、释义来自 ECDICT；2 个缺失词需手填。也可粘贴自己的清单，每行一个或用逗号分隔。
          </span>
        </div>
        <div><p className="mb-2 text-xs font-bold text-ink-soft">每日新词目标</p>
          <Segmented size="sm" options={[{key:'10',label:'10'},{key:'20',label:'20'},{key:'30',label:'30'},{key:'50',label:'50'}]} value={String(dailyClaim)} onChange={value => onSetDailyClaim(Number(value))} />
        </div>
        <button type="button" className={primaryBtn} disabled={!nextWords.length} onClick={claimSequence}>按词序领取接下来 {nextWords.length} 词</button>
        <p className="text-xs text-ink-soft">自动继续未录入的词序；缺少释义的 2 词可在分组预览中手填。</p>
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <Field label="内置 30 词组">
            <select aria-label="内置词组" className={inputCls} value={listNo} onChange={e => { setListNo(e.target.value); setText(bookSequence.slice((Number(e.target.value)-1)*30, Number(e.target.value)*30).join('\n')); setRows(null); }}>
              {Array.from({length:121}, (_,i) => <option key={i} value={i+1}>第 {i+1} 组</option>)}
            </select>
          </Field>
          <Field label="来源标签" hint="自动">
            <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-500">真经词序 · 30词组 {listNo}</div>
          </Field>
        </div>
        <Field label="英文单词清单">
          <textarea className={`${inputCls} min-h-[140px] font-serif`} value={text} onChange={(e) => setText(e.target.value)} placeholder={'abandon\nabolish\naboriginal\nabstract\n…'} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        </Field>
        <button type="button" className={`${primaryBtn} w-full`} onClick={parse} disabled={!text.trim()}>
          <Wand2 size={18} /> 查词典补全音标与释义
        </button>
      </Card>

      {rows && (
        <Card className="p-4 fade-in">
          <SectionTitle right={<span className="text-[11px] font-bold text-ink-faint">补全 {found.length} · 需手填 {missing.length} · 重复 {dups.length}</span>}>预览</SectionTitle>
          <ul className="max-h-[320px] space-y-1.5 overflow-y-auto no-scrollbar">
            {rows.map((r, i) => (
              <li key={r.word} className={`rounded-2xl px-3 py-2 ${r.entry ? 'bg-sage-50/70' : 'bg-honey-100/60'}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-serif text-[15px] font-semibold text-ink">{r.word}</span>
                  <span className="truncate text-[11px] font-semibold text-ink-soft">{r.entry ? r.entry.phonetic : '词典未收录'}</span>
                </div>
                {r.entry ? (
                  <p className="text-[12px] font-bold text-ink">{r.meaning}</p>
                ) : (
                  <input
                    className={`${inputCls} mt-1 py-2 text-[14px]`}
                    placeholder="手填中文释义（留空则跳过）"
                    value={r.meaning}
                    onChange={(e) => setRows((prev) => (prev ? prev.map((x, j) => (j === i ? { ...x, meaning: e.target.value } : x)) : prev))}
                  />
                )}
              </li>
            ))}
          </ul>
          {dups.length > 0 && <p className="mt-2 text-[11px] font-semibold text-ink-faint">已在词库（跳过）：{dups.join('，')}</p>}
          <button type="button" className={`${primaryBtn} mt-3 w-full`} onClick={confirm} disabled={ready.length === 0}>
            <Sparkles size={18} /> 排入FSRS日历 · {ready.length} 词
          </button>
        </Card>
      )}
    </div>
  );
}

function PasteImport({ words, onAdd, toast }: { words: WordItem[]; onAdd: Props['onAdd']; toast: Props['toast'] }) {
  const [text, setText] = useState('');
  const preview = useMemo(() => (text.trim() ? parseBatchText(text, words) : null), [text, words]);

  const confirm = async () => {
    if (!preview || preview.items.length === 0) return;
    const n = await onAdd(preview.items);
    if (!n) return;
    toast(`已解析并排入 ${n} 个词 · 明天开始复习`, 'ok');
    if (n > 0) setText('');
  };

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-start gap-2 rounded-2xl bg-rose-50 px-3 py-2.5 text-[11px] font-semibold leading-relaxed text-rose-500">
        <ClipboardPaste size={16} className="mt-0.5 shrink-0" />
        <span>
          每行一个词，格式 <b>单词 - 中文释义 - 同义词</b>，分隔符支持「-」「:」「Tab」或两个以上空格；行里带 /音标/ 会自动识别。
        </span>
      </div>
      <textarea
        className={`${inputCls} min-h-[160px]`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'abandon - v. 放弃 - give up\neloquent /ˈel.ə.kwənt/ adj. 雄辩的 - articulate\ncoherent: adj. 连贯的'}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      {preview && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 text-[11px] font-extrabold">
            <span className="rounded-full bg-sage-100 px-2.5 py-1 text-sage-500">可导入 {preview.items.length}</span>
            {preview.duplicates.length > 0 && <span className="rounded-full bg-honey-100 px-2.5 py-1 text-honey-500">重复 {preview.duplicates.length}</span>}
            {preview.invalid.length > 0 && <span className="rounded-full bg-rose-100 px-2.5 py-1 text-rose-500">无法解析 {preview.invalid.length}</span>}
          </div>
          {preview.items.length > 0 && (
            <ul className="max-h-[200px] space-y-1 overflow-y-auto no-scrollbar">
              {preview.items.map((it) => (
                <li key={it.word} className="flex items-baseline gap-2 rounded-xl bg-cream px-3 py-1.5 text-[12px]">
                  <span className="font-serif text-[14px] font-semibold text-ink">{it.word}</span>
                  <span className="text-ink-soft">{it.phonetic}</span>
                  <span className="truncate font-bold text-ink">{it.meaning}</span>
                  {it.synonyms && <span className="truncate italic text-lilac-500">≈ {it.synonyms}</span>}
                </li>
              ))}
            </ul>
          )}
          {preview.invalid.length > 0 && <p className="text-[11px] font-semibold text-rose-400">无法解析：{preview.invalid.slice(0, 5).join(' / ')}{preview.invalid.length > 5 ? ' …' : ''}</p>}
        </div>
      )}
      <button type="button" className={`${primaryBtn} w-full`} onClick={confirm} disabled={!preview || preview.items.length === 0}>
        <Sparkles size={18} /> 一键解析并排入FSRS日历
      </button>
    </Card>
  );
}

function Claim({ words, skipped, dailyClaim, onAdd, onSkip, onSetDailyClaim, toast }: { words: WordItem[]; skipped: string[]; dailyClaim: number; onAdd: Props['onAdd']; onSkip: Props['onSkip']; onSetDailyClaim: Props['onSetDailyClaim']; toast: Props['toast'] }) {
  const [level, setLevel] = useState<'core' | 'all'>('core');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const have = useMemo(() => new Set(words.map((w) => w.word.toLowerCase())), [words]);
  const skip = useMemo(() => new Set(skipped.map((s) => s.toLowerCase())), [skipped]);
  const pool = useMemo(() => ieltsEntries().filter((e) => (level === 'all' || (!e.basic && e.collins < 5)) && !have.has(e.word.toLowerCase()) && !skip.has(e.word.toLowerCase())), [level, have, skip]);
  const total = useMemo(() => ieltsEntries().length, []);
  const learned = useMemo(() => ieltsEntries().filter((e) => have.has(e.word.toLowerCase())).length, [have]);
  const results = useMemo(() => (q.trim() ? searchDict(q, 20).filter((e) => !have.has(e.word.toLowerCase())) : []), [q, have]);

  const toEntryFields = (e: DictEntry): WordFields => ({ word: e.word, meaning: e.meaning, phonetic: e.phonetic, synonyms: '', tag: 'ECDICT 雅思' });

  const claimTop = async () => {
    const items = pool.slice(0, dailyClaim).map(toEntryFields);
    const n = await onAdd(items);
    if (!n) return;
    toast(`已领取 ${n} 个雅思核心词 · 明天开始复习`, 'ok');
  };
  const claimPicked = async () => {
    const items = pool.filter((e) => picked.has(e.word)).map(toEntryFields);
    const n = await onAdd(items);
    if (!n) return;
    setPicked(new Set());
    toast(`已加入 ${n} 个词`, 'ok');
  };

  return (
    <div className="space-y-3">
      <Card className="space-y-3 p-4">
        <div className="flex items-start gap-2 rounded-2xl bg-sage-50 px-3 py-2.5 text-[11px] font-semibold leading-relaxed text-sage-500">
          <Star size={16} className="mt-0.5 shrink-0" />
          <span>
            内置词库来自开源词典 <b>ECDICT</b>（MIT 协议）中标注为「雅思」的 {total} 个词，按真实语料词频排序。「进阶核心」已剔除中学词和牛津 3000 基础词，只留雅思 6.5+ 需要的词。已学 {learned} / {total}。
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><p className="mb-2 text-xs font-bold text-ink-soft">词汇范围</p>
            <Segmented size="sm" options={[{ key: 'core', label: '进阶核心' }, { key: 'all', label: '全部' }]} value={level} onChange={setLevel} />
          </div>
          <div><p className="mb-2 text-xs font-bold text-ink-soft">每日领取数</p>
            <Segmented size="sm" options={[{ key: '10', label: '10' }, { key: '20', label: '20' }, { key: '30', label: '30' }, { key: '50', label: '50' }]} value={String(dailyClaim) as '10' | '20' | '30' | '50'} onChange={(k) => onSetDailyClaim(Number(k))} />
          </div>
        </div>
        <button type="button" className={`${primaryBtn} w-full`} onClick={claimTop} disabled={pool.length === 0}>
          <Sparkles size={18} /> 领取接下来 {Math.min(dailyClaim, pool.length)} 个高频词为今日新词
        </button>
      </Card>

      <Card className="p-4">
        <SectionTitle right={<span className="text-[11px] font-bold text-ink-faint">剩余 {pool.length} 词 · 勾选可单独加入</span>}>接下来的词（按词频）</SectionTitle>
        <ul className="max-h-[360px] space-y-1 overflow-y-auto no-scrollbar">
          {pool.slice(0, 60).map((e) => {
            const on = picked.has(e.word);
            return (
              <li key={e.word} className={`flex items-center gap-2 rounded-2xl px-2 py-1.5 ${on ? 'bg-rose-50' : ''}`}>
                <button
                  type="button"
                  onClick={() =>
                    setPicked((p) => {
                      const n = new Set(p);
                      if (n.has(e.word)) n.delete(e.word);
                      else n.add(e.word);
                      return n;
                    })
                  }
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-rose-400 bg-rose-400 text-white' : 'border-rose-200 text-transparent'}`}
                >
                  <Check size={13} strokeWidth={3} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-serif text-[15px] font-semibold text-ink">{e.word}</span>
                    <span className="truncate text-[11px] font-semibold text-ink-soft">{e.phonetic}</span>
                    {e.collins > 0 && <span className="text-[10px] text-honey-500">{'★'.repeat(e.collins)}</span>}
                  </div>
                  <p className="truncate text-[12px] font-bold text-ink-soft">{e.meaning}</p>
                </div>
                <button type="button" onClick={() => onSkip(e.word)} className="shrink-0 rounded-xl px-2 py-1 text-[10px] font-extrabold text-ink-faint active:bg-stone-100" title="已认识，跳过">
                  <SkipForward size={12} className="mr-0.5 inline" />认识
                </button>
              </li>
            );
          })}
        </ul>
        {picked.size > 0 && (
          <button type="button" className={`${softBtn} mt-3 w-full`} onClick={claimPicked}>
            <Plus size={15} /> 加入勾选的 {picked.size} 个词
          </button>
        )}
      </Card>

      <Card className="p-4">
        <SectionTitle>搜索整本词典加词</SectionTitle>
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input className={`${inputCls} pl-10`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="输入英文开头或中文…" autoCapitalize="none" autoCorrect="off" />
        </div>
        {results.length > 0 && (
          <ul className="mt-2 max-h-[240px] space-y-1 overflow-y-auto no-scrollbar">
            {results.map((e) => (
              <li key={e.word} className="flex items-center gap-2 rounded-2xl px-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-serif text-[15px] font-semibold text-ink">{e.word}</span>
                    <span className="truncate text-[11px] font-semibold text-ink-soft">{e.phonetic}</span>
                  </div>
                  <p className="truncate text-[12px] font-bold text-ink-soft">{e.meaning}</p>
                </div>
                <button
                  type="button"
                  className={`${ghostBtn} shrink-0 px-3 py-1.5 text-xs`}
                  onClick={async () => {
                    const n = await onAdd([{ ...toEntryFields(e), tag: 'ECDICT' }]);
                    if (n > 0) toast(`已加入「${e.word}」`, 'ok');
                  }}
                >
                  <Plus size={13} /> 加入
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
