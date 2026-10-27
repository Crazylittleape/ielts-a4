import { useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, Layers } from 'lucide-react';
import type { AppState, WordItem } from './lib';
import { shuffle } from './lib';
import { exampleFor, highlightParts } from './book';
import { Card, Segmented, ghostBtn, primaryBtn } from './ui';

type Scope = 'missed' | 'all';

function scopedWords(state: AppState, scope: Scope): WordItem[] {
  if (scope === 'all') return state.words;
  const missed = new Set(Object.values(state.bookLearning?.missed ?? {}).flat().map(word => word.toLowerCase()));
  return state.words.filter(word => missed.has(word.word.toLowerCase()) || word.focus?.active);
}

export function ContextCloze({ state, onBack, onA4 }: { state: AppState; onBack: () => void; onA4: () => void }) {
  const [scope, setScope] = useState<Scope>('missed');
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);
  const words = useMemo(() => scopedWords(state, scope), [state, scope]);
  const questions = useMemo(() => words.flatMap(word => {
    const example = exampleFor(word);
    if (!example) return [];
    const parts = highlightParts(example.exampleEn, word.word);
    return parts.some(part => part.hit) ? [{ word, example, parts }] : [];
  }), [words]);
  const question = questions[index];
  const choices = useMemo(() => {
    if (!question) return [];
    const seen = new Set([question.word.word.toLowerCase()]);
    const distractors = shuffle([
      ...questions.map(item => item.word),
      ...state.words
    ]).filter(word => {
      const key = word.word.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 3);
    return shuffle([question.word, ...distractors]);
  }, [question]);
  const canStart = Boolean(question && choices.length >= 2);

  const changeScope = (next: Scope) => {
    setScope(next);
    setIndex(0);
    setSelected(null);
    setCorrect(0);
    setFinished(false);
  };
  const answer = (word: string) => {
    if (selected !== null) return;
    setSelected(word);
    if (word.toLowerCase() === question?.word.word.toLowerCase()) setCorrect(value => value + 1);
  };
  const next = () => {
    setSelected(null);
    if (index + 1 >= questions.length) setFinished(true);
    else setIndex(value => value + 1);
  };
  const retry = () => {
    setIndex(0);
    setSelected(null);
    setCorrect(0);
    setFinished(false);
  };

  return <div className="safe-bottom-pad">
    <header className="safe-top sticky top-0 z-20 flex items-center gap-3 bg-cream/95 px-4 pb-3 pt-2 backdrop-blur-md">
      <button type="button" className="min-h-11 min-w-11 rounded-xl text-ink-soft" aria-label="返回词书" onClick={onBack}><ArrowLeft size={20} /></button>
      <h1 className="font-serif text-2xl font-semibold text-ink">语境填空</h1>
    </header>
    <main className="space-y-4 px-4">
      <Card className="space-y-3 p-4">
        <Segmented options={[{ key: 'missed', label: '错词与 A4 攻坚词' }, { key: 'all', label: '全部已学词' }]} value={scope} onChange={changeScope} />
        <p className="text-center text-xs font-bold text-ink-soft">范围内有例句的词 {questions.length} / {words.length}</p>
      </Card>
      {!canStart && <Card className="space-y-3 p-5 text-center">
        <p className="text-sm leading-relaxed text-ink-soft">{questions.length === 0 ? '这个范围暂时没有带例句的词。先去词书学习，或在 A4 中加入攻坚词后再来练习。' : '至少需要两个不同的词才能开始语境填空。'}</p>
        <div className="grid grid-cols-2 gap-2"><button type="button" className={ghostBtn} onClick={onBack}><BookOpen size={16} />返回词书</button><button type="button" className={ghostBtn} onClick={onA4}><Layers size={16} />去 A4</button></div>
      </Card>}
      {canStart && finished && <section role="region" aria-label="本轮总结"><Card className="space-y-4 p-6 text-center">
        <h2 className="text-xl font-extrabold text-ink">本轮完成</h2>
        <p className="text-sm text-ink-soft">答对 {correct} / {questions.length} 题</p>
        <button type="button" className={`${primaryBtn} w-full`} onClick={retry}>重练本轮</button>
        <button type="button" className={`${ghostBtn} w-full`} onClick={onBack}>返回词书</button>
      </Card></section>}
      {canStart && !finished && question && <Card className="space-y-4 p-5">
        <p className="text-xs font-bold text-ink-soft">第 {index + 1} / {questions.length} 题 · 选出句中空缺的词</p>
        <p data-testid="cloze-question" className="break-words font-serif text-lg leading-relaxed text-ink">{question.parts.map((part, i) => part.hit ? <span key={i}>____</span> : part.text)}</p>
        {question.example.exampleZh && <p className="text-sm leading-relaxed text-ink-soft">{question.example.exampleZh}</p>}
        <div data-testid="cloze-choices" className="grid grid-cols-2 gap-2">{choices.map(choice => {
          const isAnswer = choice.word.toLowerCase() === question.word.word.toLowerCase();
          const chosen = selected?.toLowerCase() === choice.word.toLowerCase();
          const style = selected === null ? ghostBtn : isAnswer ? 'inline-flex min-h-11 items-center justify-center rounded-2xl border border-sage-500 bg-sage-100 px-4 py-2.5 text-sm font-bold text-sage-700' : chosen ? 'inline-flex min-h-11 items-center justify-center rounded-2xl border border-rose-400 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-600' : ghostBtn;
          return <button key={choice.id} type="button" className={style} disabled={selected !== null} onClick={() => answer(choice.word)}>{choice.word}</button>;
        })}</div>
        {selected !== null && <div role="status" className="space-y-2 border-t border-blush pt-3">
          <p className={`font-bold ${selected.toLowerCase() === question.word.word.toLowerCase() ? 'text-sage-700' : 'text-rose-600'}`}>{selected.toLowerCase() === question.word.word.toLowerCase() ? '回答正确' : `再想想 · 正确答案：${question.word.word}`}</p>
          <p lang="en" className="break-words font-serif text-base leading-relaxed text-ink">{question.parts.map((part, i) => part.hit ? <mark key={i} className="rounded-sm bg-[#FDE68A] px-0.5 text-[#332000]">{part.text}</mark> : part.text)}</p>
          {question.example.exampleZh && <p className="text-sm text-ink-soft">{question.example.exampleZh}</p>}
          <p className="break-words text-xs text-ink-soft">来源：{question.example.exampleSource}</p>
          <button type="button" className={`${primaryBtn} w-full`} onClick={next}>{index + 1 === questions.length ? '查看本轮总结' : '下一题'}</button>
        </div>}
      </Card>}
    </main>
  </div>;
}
