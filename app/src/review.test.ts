import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { fsrs, Rating } from 'ts-fsrs';
import { BOOK_GROUPS } from './bookCatalog';
import { answerBookQuestion, beginGroup, getBookQuestion, groupMissed, joinGroupReview } from './book';
import { buildCalendar } from './calendar';
import { addDays, backupJson, createWord, gradeWord, isDueOn, mergeStates, parseBackup, parseDate, removeFromFocus, type AppState, type Density, type WordItem } from './lib';
import { db, openWorkspace, persistWorkspace } from './db';

const today = '2026-10-22';
const g1 = BOOK_GROUPS[0];
const empty = (settings: Partial<AppState['settings']> = {}): AppState => ({ words: [], revlog: [], skipped: [], settings: { dailyClaim: 30, lastClaimDate: '', ...settings } });
const memory = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value) }, configurable: true });
beforeEach(async () => { memory.clear(); await db.delete(); await db.open(); });

/** Finishes group 1; `wrong` decides per question (round, word) whether to answer wrong once. */
function finish(state: AppState, wrong: (round: number, word: string, inRetry: boolean) => boolean = () => false, day = today): AppState {
  let s = beginGroup(state, g1.id);
  for (let q = getBookQuestion(s); q; q = getBookQuestion(s)) {
    const bad = wrong(q.round, q.word.word, q.inRetry);
    s = answerBookQuestion(s, day, q.kind === 'spelling' ? { kind: 'spelling', text: bad ? '' : q.word.word } : { kind: 'recall', remembered: !bad });
  }
  return s;
}
const roundtrip = (s: AppState) => parseBackup(backupJson(s), today);

describe('missed words are a persistent per-group record', () => {
  const w = g1.words;
  const s = finish(empty(), (round, word, inRetry) => !inRetry && ((round === 0 && word === w[3]) || (round === 1 && (word === w[3] || word === w[7])) || (round === 2 && word === w[10])));
  it('collects any-round wrong answers once, in book order, and retry success does not erase them', () => {
    expect(groupMissed(s, g1.id)).toEqual([w[3], w[7], w[10]]);
    expect(s.bookLearning!.completed[g1.id]).toBe(today);
  });
  it('survives a mid-group reload, backup restore and merge', async () => {
    let mid = beginGroup(empty(), g1.id);
    mid = answerBookQuestion(mid, today, { kind: 'recall', remembered: false });
    await openWorkspace(today);
    await persistWorkspace(mid);
    const reopened = (await openWorkspace(today)).state;
    expect(reopened.bookLearning!.missed).toEqual({ [g1.id]: [w[0]] });
    expect(groupMissed(roundtrip(s), g1.id)).toEqual([w[3], w[7], w[10]]);
    expect(groupMissed(mergeStates(empty(), s), g1.id)).toEqual([w[3], w[7], w[10]]);
  });
  it('is unknown (not zero) for groups finished or started before it was recorded', () => {
    const old = { ...empty(), bookLearning: { bookId: 'ielts-bible-core-v1', dailyGroups: 2, completed: { [g1.id]: '2026-10-01' } } };
    expect(groupMissed(roundtrip(old), g1.id)).toBeNull();
    expect(() => joinGroupReview(old, g1.id, 'missed', today)).toThrow('历史错词记录不可用');
    const clean = finish(empty());
    expect(groupMissed(clean, g1.id)).toEqual([]);
  });
  it('rejects invalid missed records in a backup', () => {
    const bad = JSON.parse(backupJson(s));
    bad.bookLearning.missed[g1.id] = ['not-in-group'];
    expect(() => parseBackup(JSON.stringify(bad), today)).toThrow('错词记录无效');
  });
});

describe('only chosen words enter review', () => {
  it('a finished group is learned but schedules nothing until a batch choice', () => {
    const s = finish(empty());
    expect(s.words).toHaveLength(g1.words.length);
    expect(s.words.every(word => word.review === 'off')).toBe(true);
    const later = addDays(today, 3);
    expect(s.words.some(word => isDueOn(word, later))).toBe(false);
    const cal = buildCalendar(s, later);
    expect(cal.all[later]?.due ?? []).toHaveLength(0);
    expect(Object.values(buildCalendar(s, today).all).flatMap(day => day.planned)).toHaveLength(0);
    expect(buildCalendar(s, today).learning[today]).toEqual({ groups: 1, words: g1.words.length });
  });
  it('missed batch adds exactly the missed set, due tomorrow, without logs; repeat clicks change nothing', () => {
    const s = finish(empty(), (round, word, inRetry) => !inRetry && round === 1 && (word === g1.words[2] || word === g1.words[5]));
    const r = joinGroupReview(s, g1.id, 'missed', today);
    expect(r).toMatchObject({ total: 2, added: 2, kept: 0, already: 0 });
    const chosen = r.state.words.filter(word => word.focus?.active);
    expect(chosen.map(word => word.word)).toEqual([g1.words[2], g1.words[5]]);
    expect(chosen.every(word => word.review === undefined && word.nextReviewDate === addDays(today, 1) && parseDate(addDays(today, 1)).toISOString() === word.card!.due)).toBe(true);
    expect(r.state.revlog).toHaveLength(0);
    expect(r.state.settings.groupPick).toBe('missed');
    const tomorrow = addDays(today, 1);
    expect(buildCalendar(r.state, tomorrow).all[tomorrow].due.map(d => d.id).sort()).toEqual(chosen.map(word => word.id).sort());
    const again = joinGroupReview(r.state, g1.id, 'missed', today);
    expect(again.state).toBe(r.state);
    expect(again).toMatchObject({ added: 0, kept: 0, already: 2 });
  });
  it('all batch reports partial adds; zero missed is an explicit empty result', () => {
    const s = finish(empty(), (round, word, inRetry) => !inRetry && round === 0 && word === g1.words[0]);
    const first = joinGroupReview(s, g1.id, 'missed', today).state;
    const all = joinGroupReview(first, g1.id, 'all', today);
    expect(all).toMatchObject({ total: g1.words.length, added: g1.words.length - 1, already: 1 });
    expect(all.state.words.filter(word => word.focus?.active)).toHaveLength(g1.words.length);
    const none = joinGroupReview(finish(empty()), g1.id, 'missed', today);
    expect(none).toMatchObject({ total: 0, added: 0, kept: 0, already: 0 });
    expect(none.state.words.every(word => word.review === 'off')).toBe(true);
  });
  it('old scheduled cards keep their due date and card when joined; off→on gets a first due date', () => {
    const name = g1.words[0];
    const old: WordItem = { ...createWord({ word: name, meaning: 'x' }, '2026-10-01'), nextReviewDate: '2026-11-05' };
    let s: AppState = { ...empty(), words: [old], bookLearning: { bookId: 'ielts-bible-core-v1', dailyGroups: 2, completed: { [g1.id]: '2026-10-01' } } };
    s = gradeWord({ ...s, words: [{ ...old, nextReviewDate: today }] }, old.id, today, 3);
    const graded = s.words[0];
    const r = joinGroupReview(s, g1.id, 'all', today);
    const kept = r.state.words.find(word => word.id === old.id)!;
    expect(r.kept).toBe(1);
    expect(kept.card).toEqual(graded.card);
    expect(kept.nextReviewDate).toBe(graded.nextReviewDate);
    expect(kept.focus).toMatchObject({ active: true, nextDate: graded.nextReviewDate });
    expect(r.state.revlog).toEqual(s.revlog);
    const recreated = r.state.words.filter(word => word.id !== old.id);
    expect(recreated).toHaveLength(g1.words.length - 1);
    expect(recreated.every(word => word.nextReviewDate === addDays(today, 1) && word.focus?.active)).toBe(true);
  });
  it('a same-day undo of an off→on add returns the word to not-in-review', () => {
    const s = finish(empty());
    const r = joinGroupReview(s, g1.id, 'all', today).state;
    const undone = removeFromFocus(r.words[0], today);
    expect(undone.review).toBe('off');
    expect(undone.focus).toBeUndefined();
    expect(isDueOn(undone, addDays(today, 5))).toBe(false);
  });
  it('rejects review states other than off in a v3 backup', () => {
    const raw = JSON.parse(backupJson(finish(empty())));
    raw.words[0].review = 'maybe';
    expect(() => parseBackup(JSON.stringify(raw), today)).toThrow('复习状态无效');
  });
});

describe('review density changes future FSRS due dates only', () => {
  const dueWord = (extra: Partial<WordItem> = {}): WordItem => ({ ...createWord({ word: 'sample', meaning: '样本' }, '2026-10-20'), nextReviewDate: today, ...extra });
  const gradeWith = (density: Density | undefined, word: WordItem, rating: 1 | 2 | 3 | 4, day = today) =>
    gradeWord({ ...empty(density ? { density } : {}), words: [word] }, word.id, day, rating).words[0];
  const days = (w: WordItem, day = today) => Math.round((parseDate(w.nextReviewDate).getTime() - parseDate(day).getTime()) / 86400000);

  it('standard is identical to the previous scheduler and to a missing setting', () => {
    const legacy = fsrs({ enable_short_term: false, enable_fuzz: false });
    const word = dueWord();
    const card = { ...word.card!, due: new Date(word.card!.due), last_review: undefined };
    const expected = legacy.next(card, parseDate(today), Rating.Good).card.due;
    expect(gradeWith('standard', word, 3).nextReviewDate).toBe(gradeWith(undefined, word, 3).nextReviewDate);
    expect(parseDate(gradeWith(undefined, word, 3).nextReviewDate).toDateString()).toBe(expected.toDateString());
  });
  it('intense ≤ standard ≤ relaxed for new and review cards, with real differences', () => {
    const fresh = dueWord();
    const rows: number[][] = [];
    for (const rating of [2, 3, 4] as const) rows.push((['intense', 'standard', 'relaxed'] as const).map(d => days(gradeWith(d, fresh, rating))));
    // a card already in long-term review, graded again 20 days later
    const mature = gradeWith('standard', gradeWith('standard', fresh, 4), 3, addDays(today, 12));
    const next = addDays(mature.nextReviewDate, 0);
    rows.push((['intense', 'standard', 'relaxed'] as const).map(d => days(gradeWith(d, mature, 3, next), next)));
    for (const [i, s, r] of rows) { expect(i).toBeLessThanOrEqual(s); expect(s).toBeLessThanOrEqual(r); }
    expect(rows.some(([i, s]) => i < s)).toBe(true);
    expect(rows.some(([, s, r]) => s < r)).toBe(true);
  });
  it('forgetting is due the next day in every density and never produces an invalid date', () => {
    for (const d of ['intense', 'standard', 'relaxed'] as const) {
      const w = gradeWith(d, dueWord(), 1);
      expect(w.nextReviewDate).toBe(addDays(today, 1));
    }
  });
  it('changing density does not touch existing schedules, cards or logs', () => {
    let s: AppState = { ...empty(), words: [dueWord(), dueWord({ id: 'b', word: 'b2', nextReviewDate: '2026-12-01' })] };
    s = gradeWord(s, s.words[0].id, today, 3);
    const changed: AppState = { ...s, settings: { ...s.settings, density: 'intense' } };
    expect(changed.words).toEqual(s.words);
    expect(buildCalendar(changed, today)).toEqual(buildCalendar(s, today));
  });
  it('persists through IndexedDB and backups; old backups default to standard; invalid values are rejected', async () => {
    const s = { ...empty({ density: 'relaxed' as const, groupPick: 'all' as const }), words: [dueWord()] };
    await openWorkspace(today);
    await persistWorkspace(s);
    expect((await openWorkspace(today)).state.settings).toMatchObject({ density: 'relaxed', groupPick: 'all' });
    expect(roundtrip(s).settings.density).toBe('relaxed');
    const old = JSON.parse(backupJson(empty()));
    expect(parseBackup(JSON.stringify(old), today).settings.density).toBeUndefined();
    old.settings.density = 'turbo';
    expect(() => parseBackup(JSON.stringify(old), today)).toThrow('复习密度设置无效');
    old.settings.density = 'standard'; old.settings.groupPick = 'some';
    expect(() => parseBackup(JSON.stringify(old), today)).toThrow('组完成默认选择无效');
  });
});
