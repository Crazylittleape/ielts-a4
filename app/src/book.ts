import { BOOK, BOOK_GROUPS, BOOK_WORD_COUNT, type BookGroup } from './bookCatalog';
import { allEntries } from './dict';
import { addToFocus, createWord, isValidDate, type AppState, type BookLearning, type WordExample, type WordFields } from './lib';
import examples from './data/book-examples.json';

export function getBookProgress(state: AppState): BookLearning {
  return state.bookLearning ?? { bookId: BOOK.id, dailyGroups: 2, completed: {} };
}

export function getBookStats(state: AppState) {
  const progress = getBookProgress(state);
  const completed = BOOK_GROUPS.filter(group => progress.completed[group.id]);
  const names = new Set(completed.flatMap(group => group.words.map(word => word.toLowerCase())));
  const learned = names.size;
  return {
    total: BOOK_WORD_COUNT,
    learned,
    remaining: BOOK_WORD_COUNT - learned,
    mastered: state.words.filter(word => names.has(word.word.toLowerCase()) && (word.isMastered || word.mastered)).length,
    percent: Math.round(learned / BOOK_WORD_COUNT * 1000) / 10,
    completedGroups: completed.length,
    current: BOOK_GROUPS.find(group => !progress.completed[group.id])
  };
}

export function dailyPlan(state: AppState, today: string) {
  const progress = getBookProgress(state);
  const done = BOOK_GROUPS.filter(group => progress.completed[group.id] === today);
  const remainingGroups = BOOK_GROUPS.filter(group => !progress.completed[group.id]).slice(0, Math.max(0, progress.dailyGroups - done.length));
  const groups = [...done, ...remainingGroups];
  return { groups, completed: done.length, wordCount: groups.reduce((sum, group) => sum + group.words.length, 0), remainingGroups };
}

let dictionary: Map<string, ReturnType<typeof allEntries>[number]> | undefined;
const definitions: Record<string, string> = { 'El Niño': 'n. 厄尔尼诺现象', 'shade-tolerant': 'adj. 耐阴的' };

export type BookExample = Required<Pick<WordExample, 'exampleEn' | 'exampleSource'>> & Pick<WordExample, 'exampleZh'>;
/** Sourced example sentences keyed by headword; see docs/BOOK-SOURCE.md. Empty until a licensed source is added. */
export const BOOK_EXAMPLES: Record<string, BookExample> = examples;

export function getBookWord(word: string, exampleData: Record<string, BookExample> = BOOK_EXAMPLES): WordFields {
  dictionary ??= new Map(allEntries().map(entry => [entry.word.toLowerCase(), entry]));
  const entry = dictionary.get(word.toLowerCase());
  const meaning = definitions[word] ?? entry?.meaning;
  if (!meaning) throw new Error(`词书中缺少「${word}」的释义`);
  return { word, meaning, phonetic: entry?.phonetic ?? '', synonyms: '', tag: BOOK.title, ...exampleData[word] };
}

export function beginGroup(state: AppState, groupId: string): AppState {
  const progress = getBookProgress(state);
  if (progress.active || getBookStats(state).current?.id !== groupId) return state;
  return { ...state, bookLearning: { ...progress, active: { groupId, seen: 0, round: 0, retry: [], inRetry: false } } };
}

export type BookAnswer = { kind: 'recall'; remembered: boolean } | { kind: 'spelling'; text: string };

export function getBookQuestion(state: AppState) {
  const active = getBookProgress(state).active;
  const group = getBookStats(state).current;
  if (!active || !group || active.groupId !== group.id) return undefined;
  const round = active.round ?? 0;
  const inRetry = active.inRetry ?? false;
  const retry = active.retry ?? [];
  const wordIndex = inRetry ? retry[0] : active.seen;
  const kind = (['english', 'phonetic', 'spelling'] as const)[round];
  return { word: getBookWord(group.words[wordIndex]), wordIndex, kind, round, inRetry, pendingRetries: retry.length };
}

export function checkBookSpelling(expected: string, typed: string): boolean {
  const normalize = (value: string) => value.normalize('NFC').toLowerCase().trim().replace(/\s+/g, ' ');
  const answer = normalize(typed);
  return answer.length > 0 && answer === normalize(expected);
}

export function answerBookQuestion(state: AppState, today: string, answer: BookAnswer): AppState {
  if (!isValidDate(today)) throw new Error('无效的学习日期');
  const progress = getBookProgress(state);
  const question = getBookQuestion(state);
  if (!question || !progress.active) return state;
  if (answer.kind !== (question.kind === 'spelling' ? 'spelling' : 'recall')) throw new Error('回答类型与学习轮次不匹配');
  const correct = answer.kind === 'spelling' ? checkBookSpelling(question.word.word, answer.text) : answer.remembered;
  const group = getBookStats(state).current!;
  let round = question.round;
  let seen = progress.active.seen;
  let retry = [...(progress.active.retry ?? [])];
  let inRetry = question.inRetry;
  if (inRetry) {
    retry.shift();
    if (!correct) retry.push(question.wordIndex);
  } else {
    if (!correct && !retry.includes(question.wordIndex)) retry.push(question.wordIndex);
    seen++;
  }
  if (seen === group.words.length && retry.length) inRetry = true;
  if (seen === group.words.length && retry.length === 0 && round < 2) {
    round = (round + 1) as 1 | 2;
    seen = 0;
    inRetry = false;
  }
  if (seen < group.words.length || retry.length) return { ...state, bookLearning: { ...progress, active: { groupId: group.id, seen, round, retry, inRetry } } };
  const have = new Set(state.words.map(word => word.word.toLowerCase()));
  const fresh = group.words.filter(word => !have.has(word.toLowerCase())).map(word => createWord({ ...getBookWord(word), tag: bookGroupTag(group) }, today));
  return {
    ...state,
    words: [...state.words, ...fresh],
    bookLearning: { bookId: BOOK.id, dailyGroups: progress.dailyGroups, completed: { ...progress.completed, [group.id]: today } }
  };
}

export const bookGroupTag = (group: BookGroup) => `${BOOK.title} · ${group.unitTitle} · 第 ${group.index} 组`;

let groupByWord: Map<string, BookGroup> | undefined;

export function bookGroupOfWord(word: string): BookGroup | undefined {
  groupByWord ??= new Map(BOOK_GROUPS.flatMap(group => group.words.map(name => [name.toLowerCase(), group] as const)));
  return groupByWord.get(word.trim().toLowerCase());
}

/** Adds a studied/active-group book word to A4 on its single shared card. */
export function focusBookWord(state: AppState, word: string, today: string, reason = '词书回忆模糊/忘记'): AppState {
  if (!isValidDate(today)) throw new Error('无效的学习日期');
  const key = word.trim().toLowerCase();
  const existing = state.words.find(item => item.word.toLowerCase() === key);
  if (existing) {
    const next = addToFocus(existing, today, reason);
    return next === existing ? state : { ...state, words: state.words.map(item => item.id === existing.id ? next : item) };
  }
  const group = bookGroupOfWord(key);
  const progress = getBookProgress(state);
  if (!group || !(progress.completed[group.id] || progress.active?.groupId === group.id)) return state;
  const name = group.words.find(item => item.toLowerCase() === key)!;
  return { ...state, words: [...state.words, addToFocus(createWord({ ...getBookWord(name), tag: bookGroupTag(group) }, today), today, reason)] };
}
