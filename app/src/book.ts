import { BOOK, BOOK_GROUPS, BOOK_WORD_COUNT } from './bookCatalog';
import { allEntries } from './dict';
import { createWord, isValidDate, type AppState, type BookLearning, type WordFields } from './lib';

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

export function getBookWord(word: string): WordFields {
  dictionary ??= new Map(allEntries().map(entry => [entry.word.toLowerCase(), entry]));
  const entry = dictionary.get(word.toLowerCase());
  const meaning = definitions[word] ?? entry?.meaning;
  if (!meaning) throw new Error(`词书中缺少「${word}」的释义`);
  return { word, meaning, phonetic: entry?.phonetic ?? '', synonyms: '', tag: BOOK.title };
}

export function beginGroup(state: AppState, groupId: string): AppState {
  const progress = getBookProgress(state);
  if (progress.active || getBookStats(state).current?.id !== groupId) return state;
  return { ...state, bookLearning: { ...progress, active: { groupId, seen: 0 } } };
}

export function confirmBookWord(state: AppState, today: string): AppState {
  if (!isValidDate(today)) throw new Error('无效的学习日期');
  const progress = getBookProgress(state);
  const group = getBookStats(state).current;
  if (!progress.active || !group || progress.active.groupId !== group.id) return state;
  const seen = progress.active.seen + 1;
  if (seen < group.words.length) return { ...state, bookLearning: { ...progress, active: { groupId: group.id, seen } } };
  const have = new Set(state.words.map(word => word.word.toLowerCase()));
  const fresh = group.words.filter(word => !have.has(word.toLowerCase())).map(word => createWord({ ...getBookWord(word), tag: `${BOOK.title} · ${group.unitTitle} · 第 ${group.index} 组` }, today));
  return {
    ...state,
    words: [...state.words, ...fresh],
    bookLearning: { bookId: BOOK.id, dailyGroups: progress.dailyGroups, completed: { ...progress.completed, [group.id]: today } }
  };
}
