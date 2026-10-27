import { BOOK, BOOK_GROUPS, BOOK_WORD_COUNT, type BookGroup } from './bookCatalog';
import { allEntries } from './dict';
import { addToFocus, createWord, isValidDate, joinReview, type AppState, type BookLearning, type GroupPick, type JoinResult, type WordExample, type WordFields } from './lib';
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

export function exampleFor(word: { word: string } & WordExample): BookExample | null {
  if (word.exampleEn && word.exampleSource) {
    return { exampleEn: word.exampleEn, exampleSource: word.exampleSource, ...(word.exampleZh ? { exampleZh: word.exampleZh } : {}) };
  }
  const exact = BOOK_EXAMPLES[word.word];
  if (exact) return exact;
  const key = Object.keys(BOOK_EXAMPLES).find(name => name.toLowerCase() === word.word.toLowerCase());
  return key ? BOOK_EXAMPLES[key] : null;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function inflections(token: string): string[] {
  const roots = new Set([token]);
  if (/ise$/i.test(token)) roots.add(token.replace(/ise$/i, 'ize'));
  if (/ize$/i.test(token)) roots.add(token.replace(/ize$/i, 'ise'));
  const forms = new Set<string>();
  for (const root of roots) {
    forms.add(root);
    forms.add(`${root}s`);
    forms.add(`${root}es`);
    forms.add(`${root}ed`);
    forms.add(`${root}d`);
    forms.add(`${root}ing`);
    if (/[^aeiou]y$/i.test(root)) {
      forms.add(root.replace(/y$/i, 'ies'));
      forms.add(root.replace(/y$/i, 'ied'));
    }
    if (/e$/i.test(root)) forms.add(root.slice(0, -1) + 'ing');
  }
  return [...forms].sort((a, b) => b.length - a.length);
}

export function highlightParts(sentence: string, word: string): { text: string; hit: boolean }[] {
  const tokens = word.trim().split(/\s+/);
  if (!sentence || !tokens.length || !tokens.some(Boolean)) return [{ text: sentence, hit: false }];
  const phrase = [...tokens.slice(0, -1).map(escapeRegExp), `(?:${inflections(tokens[tokens.length - 1]).map(escapeRegExp).join('|')})`].join('\\s+');
  const expression = new RegExp(`(?<![\\p{L}\\p{N}\\p{M}_-])${phrase}(?![\\p{L}\\p{N}\\p{M}_-])`, 'giu');
  const parts: { text: string; hit: boolean }[] = [];
  let last = 0;
  for (const match of sentence.matchAll(expression)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ text: sentence.slice(last, index), hit: false });
    parts.push({ text: match[0], hit: true });
    last = index + match[0].length;
  }
  if (last < sentence.length || !parts.length) parts.push({ text: sentence.slice(last), hit: false });
  return parts;
}

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
  return { ...state, bookLearning: { ...progress, missed: { ...progress.missed, [groupId]: [] }, active: { groupId, seen: 0, round: 0, retry: [], inRetry: false } } };
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
  const known = progress.missed?.[group.id];
  const missed = !correct && known && !known.includes(question.word.word) ? { ...progress.missed, [group.id]: [...known, question.word.word] } : progress.missed;
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
  if (seen < group.words.length || retry.length) return { ...state, bookLearning: { ...progress, ...(missed ? { missed } : {}), active: { groupId: group.id, seen, round, retry, inRetry } } };
  const have = new Set(state.words.map(word => word.word.toLowerCase()));
  // Learned words are recorded but stay out of review until the user picks them on the completion page.
  const fresh = group.words.filter(word => !have.has(word.toLowerCase())).map(word => ({ ...createWord({ ...getBookWord(word), tag: bookGroupTag(group) }, today), review: 'off' as const }));
  return {
    ...state,
    words: [...state.words, ...fresh],
    bookLearning: { bookId: BOOK.id, dailyGroups: progress.dailyGroups, completed: { ...progress.completed, [group.id]: today }, ...(missed ? { missed } : {}) }
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

/** Words missed in this group, in book order; null when the group was started before missed words were recorded. */
export function groupMissed(state: AppState, groupId: string): string[] | null {
  const list = getBookProgress(state).missed?.[groupId];
  const group = BOOK_GROUPS.find(g => g.id === groupId);
  return list && group ? group.words.filter(word => list.includes(word)) : null;
}

export interface GroupJoinResult extends JoinResult { total: number }

/** One atomic batch: the whole finished group, or its recorded missed words, into review/A4. */
export function joinGroupReview(state: AppState, groupId: string, pick: GroupPick, today: string): GroupJoinResult {
  if (!isValidDate(today)) throw new Error('无效的学习日期');
  const group = BOOK_GROUPS.find(g => g.id === groupId);
  if (!group || !getBookProgress(state).completed[groupId]) throw new Error('只能把已完成的学习组加入复习');
  const names = pick === 'all' ? group.words : groupMissed(state, groupId);
  if (!names) throw new Error('这一组的历史错词记录不可用');
  const byName = new Map(state.words.map(word => [word.word.toLowerCase(), word]));
  // A word deleted from My Words since the group was finished is recreated on demand.
  const created = names.filter(name => !byName.has(name.toLowerCase())).map(name => ({ ...createWord({ ...getBookWord(name), tag: bookGroupTag(group) }, today), review: 'off' as const }));
  const words = [...state.words, ...created];
  const ids = names.map(name => (byName.get(name.toLowerCase()) ?? created.find(word => word.word === name))!.id);
  const reason = pick === 'all' ? '词书本组全部' : '词书本组错词';
  const result = joinReview({ ...state, words }, ids, today, reason);
  const changed = result.state !== state && (result.added || result.kept);
  const remember = state.settings.groupPick !== pick;
  const next = changed || remember ? { ...(changed ? result.state : state), settings: { ...state.settings, groupPick: pick } } : state;
  return { ...result, state: next, total: names.length };
}
