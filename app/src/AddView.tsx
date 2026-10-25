import { useMemo, useState } from 'react';
import { Wand2, ClipboardPaste, Plus, Sparkles } from 'lucide-react';
import type { WordFields, WordItem } from './lib';
import { parseBatchText } from './lib';
import type { DictEntry } from './dict';
import { lookup } from './dict';
import { Card, Field, PageHeader, Segmented, inputCls, primaryBtn, softBtn } from './ui';

type Sub = 'single' | 'paste';

interface Props {
  words: WordItem[];
  onAdd: (items: WordFields[]) => Promise<number>;
  toast: (msg: string, tone?: 'ok' | 'warn' | 'info') => void;
}

export function AddView({ words, onAdd, toast }: Props) {
  const [sub, setSub] = useState<Sub>('single');
  return (
    <div className="safe-bottom-pad">
      <PageHeader title="录入新词" subtitle="补充自定义词 · 词书学习请前往词书库" />
      <div className="space-y-4 px-4 pt-1">
        <Segmented
          options={[
            { key: 'single', label: '单条' },
            { key: 'paste', label: '批量粘贴' }
          ]}
          value={sub}
          onChange={setSub}
        />
        {sub === 'single' && <SingleAdd words={words} onAdd={onAdd} toast={toast} />}
        {sub === 'paste' && <PasteImport words={words} onAdd={onAdd} toast={toast} />}
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
        <Plus size={18} /> 录入并加入复习
      </button>
    </Card>
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
        <Sparkles size={18} /> 解析并加入复习
      </button>
    </Card>
  );
}
