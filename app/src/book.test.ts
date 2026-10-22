import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import sequence from './data/book-sequence.json';
import { BOOK, BOOK_GROUPS, BOOK_WORD_COUNT } from './bookCatalog';
import { beginGroup, confirmBookWord, dailyPlan, getBookProgress, getBookStats, getBookWord } from './book';
import { backupJson, createWord, gradeWord, mergeStates, parseBackup, type AppState } from './lib';
import { db, openWorkspace, persistWorkspace } from './db';

const today = '2026-10-22';
const empty = (): AppState => ({ words: [], revlog: [], skipped: [], settings: { dailyClaim: 30, lastClaimDate: '' } });
const memory = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value) }, configurable: true });
const complete = (state: AppState, day = today): AppState => {
  const group = getBookStats(state).current!;
  let next = beginGroup(state, group.id);
  for (const _ of group.words) next = confirmBookWord(next, day);
  return next;
};

beforeEach(async () => { memory.clear(); await db.delete(); await db.open(); });

describe('book catalog', () => {
  it('keeps all 3630 words in exact order across the 22 real chapters', () => {
    expect(BOOK.title).toBe('雅思词汇真经');
    expect(BOOK.edition).toBe('去重整理版');
    expect(BOOK.units).toHaveLength(22);
    expect(BOOK_WORD_COUNT).toBe(3630);
    expect(BOOK.units.flatMap(u => u.words)).toEqual(sequence);
    expect(BOOK_GROUPS.flatMap(g => g.words)).toEqual(sequence);
    expect(BOOK.units.map(u => [u.title, u.words[0], u.words[u.words.length - 1]])).toEqual([
      ['自然地理', 'atmosphere', 'petroleum'], ['植物研究', 'photosynthesis', 'optimal'],
      ['动物保护', 'biologist', 'shepherd'], ['太空探索', 'galaxy', 'hopeless'],
      ['学校教育', 'education', 'fee'], ['科技发明', 'technology', 'circumstance'],
      ['文化历史', 'culture', 'adversity'], ['语言演化', 'language', 'contention'],
      ['娱乐运动', 'medium', 'bow'], ['物品材料', 'stuff', 'durable'],
      ['时尚潮流', 'fashion', 'slight'], ['饮食健康', 'food', 'slice'],
      ['建筑场所', 'architecture', 'internal'], ['交通旅行', 'navigate', 'swift'],
      ['国家政府', 'republic', 'Germany'], ['社会经济', 'economy', 'collaborate'],
      ['法律法规', 'law', 'instruct'], ['沙场争锋', 'violence', 'veteran'],
      ['社会角色', 'pioneer', 'coward'], ['行为动作', 'act', 'sideways'],
      ['身心健康', 'feel', 'stereotype'], ['时间日期', 'daily', 'incidentally']
    ]);
  });
  it('uses groups of 25 without crossing chapters, retaining every chapter tail', () => {
    for (const unit of BOOK.units) {
      expect(unit.groups.map(g => g.index)).toEqual(unit.groups.map((_, i) => i + 1));
      expect(unit.groups.flatMap(g => g.words)).toEqual(unit.words);
      expect(unit.groups.slice(0, -1).every(g => g.words.length === 25)).toBe(true);
      expect(unit.groups[unit.groups.length - 1].words.length).toBeGreaterThan(0);
      expect(unit.groups[unit.groups.length - 1].words.length).toBeLessThanOrEqual(25);
      expect(unit.groups.every(g => g.unitId === unit.id && g.unitTitle === unit.title)).toBe(true);
    }
    expect(BOOK.units[0].groups[BOOK.units[0].groups.length - 1].words).toHaveLength(16);
    expect(new Set(BOOK_GROUPS.map(g => g.id)).size).toBe(BOOK_GROUPS.length);
  });
  it('has a usable exact-name definition for every word, including both dictionary gaps', () => {
    expect(sequence.every(word => getBookWord(word).word === word && getBookWord(word).meaning.trim())).toBe(true);
    expect(getBookWord('El Niño').meaning).toBe('n. 厄尔尼诺现象');
    expect(getBookWord('shade-tolerant').meaning).toBe('adj. 耐阴的');
  });
});

describe('ordered first study', () => {
  it('plans two complete groups of 50 and never treats an imported word as learned', () => {
    const state = empty();
    state.words.push(createWord(getBookWord('atmosphere'), today));
    expect(getBookProgress(state).dailyGroups).toBe(2);
    expect(dailyPlan(state, today).groups.map(g => g.id)).toEqual(['u01-g01', 'u01-g02']);
    expect(dailyPlan(state, today).wordCount).toBe(50);
    expect(getBookStats(state)).toMatchObject({ total: 3630, learned: 0, remaining: 3630, mastered: 0, percent: 0, completedGroups: 0 });
    const started = beginGroup(state, 'u01-g01');
    expect(started.bookLearning!.active).toEqual({ groupId: 'u01-g01', seen: 0 });
    expect(getBookStats(started).learned).toBe(0);
    expect(started.words).toEqual(state.words);
    expect(beginGroup(started, 'u01-g01')).toBe(started);
    expect(beginGroup(started, 'u01-g02')).toBe(started);
  });
  it('counts only a full group and adds its cards once with tomorrow due dates', () => {
    let state = beginGroup(empty(), 'u01-g01');
    for (let i = 0; i < 24; i++) state = confirmBookWord(state, today);
    expect(state.bookLearning!.active!.seen).toBe(24);
    expect(getBookStats(state).learned).toBe(0);
    expect(state.words).toHaveLength(0);
    state = confirmBookWord(state, today);
    expect(state.bookLearning!.active).toBeUndefined();
    expect(state.bookLearning!.completed).toEqual({ 'u01-g01': today });
    expect(getBookStats(state)).toMatchObject({ learned: 25, remaining: 3605, completedGroups: 1 });
    expect(state.words).toHaveLength(25);
    expect(state.words.every(w => w.nextReviewDate === '2026-10-23')).toBe(true);
    expect(confirmBookWord(state, today)).toBe(state);
    expect(beginGroup(state, 'u01-g01')).toBe(state);
    expect(dailyPlan(state, today)).toMatchObject({ completed: 1, wordCount: 50 });
    expect(dailyPlan(state, today).remainingGroups.map(g => g.id)).toEqual(['u01-g02']);
  });
  it('preserves an existing reviewed card and distinguishes mastery from first-study completion', () => {
    let state = empty();
    const existing = createWord(getBookWord('atmosphere'), '2026-10-20');
    state.words = [{ ...existing, nextReviewDate: today }];
    state = gradeWord(state, existing.id, today, 1);
    state.words[0].isMastered = true;
    const original = JSON.stringify(state.words[0]);
    const logs = state.revlog;
    state = complete(state);
    expect(JSON.stringify(state.words.find(w => w.id === existing.id))).toBe(original);
    expect(state.revlog).toBe(logs);
    expect(state.words).toHaveLength(25);
    expect(getBookStats(state)).toMatchObject({ learned: 25, mastered: 1 });
  });
  it('does not slide today’s plan after finishing and starts the next pair tomorrow', () => {
    let state = complete(complete(empty()));
    expect(dailyPlan(state, today)).toMatchObject({ completed: 2, wordCount: 50, remainingGroups: [] });
    expect(dailyPlan(state, today).groups.map(g => g.id)).toEqual(['u01-g01', 'u01-g02']);
    expect(dailyPlan(state, '2026-10-23').groups.map(g => g.id)).toEqual(['u01-g03', 'u01-g04']);
    state = { ...state, bookLearning: { ...state.bookLearning!, dailyGroups: 3 } };
    expect(dailyPlan(state, today).remainingGroups.map(g => g.id)).toEqual(['u01-g03']);
  });
  it('plans the actual chapter-tail word count and continues into the next chapter in order', () => {
    let state = empty();
    for (let i = 0; i < 9; i++) state = complete(state, '2026-10-21');
    expect(dailyPlan(state, today).groups.map(g => g.id)).toEqual(['u01-g10', 'u02-g01']);
    expect(dailyPlan(state, today).wordCount).toBe(41);
    state = complete(state);
    expect(getBookStats(state)).toMatchObject({ learned: 241, remaining: 3389 });
    expect(getBookStats(state).current!.unitId).toBe('u02');
  });
});

describe('book progress persistence and recovery', () => {
  it('round-trips partial study and group completion through backup and IndexedDB', async () => {
    await openWorkspace(today);
    let state = beginGroup(empty(), 'u01-g01');
    state = confirmBookWord(state, today);
    state = confirmBookWord(state, today);
    expect(parseBackup(backupJson(state), today)).toEqual(state);
    await persistWorkspace(state);
    state = (await openWorkspace(today)).state;
    expect(state.bookLearning!.active!.seen).toBe(2);
    expect(state.words).toHaveLength(0);
    for (let i = 2; i < 25; i++) state = confirmBookWord(state, today);
    await persistWorkspace(state);
    const loaded = (await openWorkspace(today)).state;
    expect(loaded.bookLearning).toEqual(state.bookLearning);
    expect(loaded.words.slice().sort((a, b) => a.id.localeCompare(b.id))).toEqual(state.words.slice().sort((a, b) => a.id.localeCompare(b.id)));
    expect(getBookStats(loaded).learned).toBe(25);
  });
  it('leaves legacy backups without invented book completion', () => {
    const old = empty();
    old.words = [createWord(getBookWord('atmosphere'), today)];
    for (const version of [1, 2, 3]) {
      const loaded = parseBackup(JSON.stringify({ ...old, version }), today);
      expect(loaded.bookLearning).toBeUndefined();
      expect(getBookStats(loaded).learned).toBe(0);
    }
  });
  it('rejects unknown books/groups, invalid dates, jumping completion and invalid cursors', () => {
    const base = getBookProgress(empty());
    const bad = [
      { ...base, bookId: 'unknown' }, { ...base, dailyGroups: 0 }, { ...base, dailyGroups: 11 },
      { ...base, dailyGroups: 1.5 }, { ...base, completed: { unknown: today } },
      { ...base, completed: { 'u01-g01': '2026-02-30' } },
      { ...base, completed: { 'u01-g02': today } },
      { ...base, active: { groupId: 'u01-g01', seen: -1 } },
      { ...base, active: { groupId: 'u01-g01', seen: 25 } },
      { ...base, active: { groupId: 'u01-g02', seen: 0 } },
      { ...base, completed: { 'u01-g01': today }, active: { groupId: 'u01-g01', seen: 0 } }
    ];
    for (const bookLearning of bad) expect(() => parseBackup(JSON.stringify({ ...empty(), version: 3, bookLearning }), today)).toThrow();
  });
  it('restores the incoming daily target when no local book preference exists', () => {
    const incoming = complete(empty());
    incoming.bookLearning!.dailyGroups = 5;
    const merged = mergeStates(empty(), incoming);
    expect(merged.bookLearning!.dailyGroups).toBe(5);
    expect(getBookStats(merged).learned).toBe(25);
  });
  it('merges completed prefixes, keeps the earliest completion date and furthest valid cursor', () => {
    const local = complete(empty(), '2026-10-21');
    local.bookLearning!.dailyGroups = 3;
    let incoming = complete(empty(), today);
    incoming = beginGroup(incoming, 'u01-g02');
    incoming = confirmBookWord(confirmBookWord(incoming, today), today);
    const merged = mergeStates(local, incoming);
    expect(merged.bookLearning).toEqual({ bookId: BOOK.id, dailyGroups: 3, completed: { 'u01-g01': '2026-10-21' }, active: { groupId: 'u01-g02', seen: 2 } });
    expect(dailyPlan(merged, today).completed).toBe(0);
    expect(mergeStates(merged, incoming)).toEqual(merged);
    const further = complete(incoming);
    const advanced = mergeStates(merged, further);
    expect(getBookStats(advanced).learned).toBe(50);
    expect(advanced.bookLearning!.active).toBeUndefined();
    expect(parseBackup(backupJson(advanced), today)).toEqual(advanced);
  });
});
