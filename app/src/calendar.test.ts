import { describe, expect, it } from 'vitest';
import { BOOK, BOOK_GROUPS } from './bookCatalog';
import { addToFocus, backupJson, createWord, gradeWord, initialState, mergeStates, parseBackup, resetWord } from './lib';
import { buildCalendar, dayMarks, reviewIds } from './calendar';

const day = '2026-10-23';
describe('personal calendar', () => {
  it('starts empty and counts completed groups, not early-created cards', () => {
    const empty = initialState(day);
    expect(empty.words).toEqual([]);
    expect(buildCalendar(empty, day).learning).toEqual({});
    const words = ['alpha', 'beta'].map(word => addToFocus(createWord({ word, meaning: '难词' }, day), day));
    const a = { ...empty, words, bookLearning: { bookId: BOOK.id, dailyGroups: 2, completed: { [BOOK_GROUPS[0].id]: day, [BOOK_GROUPS[1].id]: day } } };
    const b = { ...empty, bookLearning: { bookId: BOOK.id, dailyGroups: 2, completed: { [BOOK_GROUPS[0].id]: day } } };
    expect(buildCalendar(a, day).learning[day]).toEqual({ groups: 2, words: 50 });
    expect(buildCalendar(b, day).learning[day]).toEqual({ groups: 1, words: 25 });
    expect(buildCalendar(a, day).focus[day].added).toHaveLength(2);
    expect(reviewIds(buildCalendar(a, day).focus, '2026-10-24', day)).toHaveLength(2);
    expect(reviewIds(buildCalendar(b, day).focus, '2026-10-24', day)).toEqual([]);
    expect(buildCalendar({ ...empty, words }, day).learning).toEqual({});
  });
  it('keeps actual focus review history after success and backup; resets are not reviews', () => {
    const word = addToFocus(createWord({ word: 'test', meaning: '测试' }, '2026-10-21'), '2026-10-21');
    const state = { ...initialState(day), words: [word] };
    const graded = gradeWord(state, word.id, '2026-10-22', 3);
    expect(graded.words[0].focus?.active).toBe(false);
    expect(graded.revlog[0].focus).toBe(true);
    const restored = parseBackup(backupJson(graded), day);
    const calendar = buildCalendar(restored, day);
    expect(reviewIds(calendar.focus, '2026-10-22', day)).toEqual([word.id]);
    expect(reviewIds(calendar.all, '2026-10-22', day)).toEqual([word.id]);
    expect(reviewIds(buildCalendar(resetWord(state, word.id, '2026-10-22'), day).all, '2026-10-22', day)).toEqual([]);
    expect(buildCalendar(state, day).focus[day].due[0].overdue).toBe(true);
    expect(buildCalendar(graded, day).focus[day]?.done ?? []).toEqual([]);
  });
  it('deduplicates actual attempts and does not infer legacy focus membership', () => {
    const word = createWord({ word: 'legacy', meaning: '旧词' }, '2026-10-20');
    word.reviewHistory.push('2026-10-21');
    const state = { ...initialState(day), words: [addToFocus(word, '2026-10-22')] };
    expect(reviewIds(buildCalendar(state, day).all, '2026-10-21', day)).toEqual([word.id]);
    expect(reviewIds(buildCalendar(state, day).focus, '2026-10-21', day)).toEqual([]);
    const graded = gradeWord(state, word.id, day, 1);
    graded.revlog.push({ ...graded.revlog[0], id: 'another-attempt' });
    expect(buildCalendar(graded, day).all[day].done).toHaveLength(1);
    expect(buildCalendar(graded, day).focus[day].done).toHaveLength(1);
  });
  it('rejects malformed new focus metadata while reading old backups', () => {
    const word = createWord({ word: 'test', meaning: '测试' }, day);
    const state = { ...initialState(day), words: [word] };
    expect(() => parseBackup(JSON.stringify({ ...state, version: 3, words: [{ ...word, focusAddedDays: ['invalid'] }] }), day)).toThrow();
    const graded = gradeWord({ ...state, words: [{ ...word, createdAt: '2026-10-20', reviewHistory: ['2026-10-20'], nextReviewDate: day }] }, word.id, day, 3);
    expect(() => parseBackup(JSON.stringify({ ...graded, version: 3, revlog: [{ ...graded.revlog[0], focus: 'yes' }] }), day)).toThrow();
  });
  it('merges focus evidence on duplicate words without replacing the local schedule', () => {
    const localWord = createWord({ word: 'test', meaning: '测试' }, '2026-10-20');
    const incomingWord = addToFocus(createWord({ word: 'TEST', meaning: '测试' }, '2026-10-21'), '2026-10-21');
    const local = { ...initialState(day), words: [localWord] };
    const incoming = { ...initialState(day), words: [incomingWord] };
    const merged = mergeStates(local, incoming);
    expect(merged.words).toHaveLength(1);
    expect(merged.words[0].nextReviewDate).toBe(localWord.nextReviewDate);
    expect(merged.words[0].card).toEqual(localWord.card);
    expect(merged.words[0].focus?.active).toBe(true);
    expect(merged.words[0].focus?.nextDate).toBe(localWord.nextReviewDate);
    expect(parseBackup(backupJson(merged), day).words[0].focusAddedDays).toEqual(['2026-10-21']);
  });
  it('keeps one synchronized due date and does not postpone repeated additions', () => {
    const word = addToFocus(createWord({ word: 'test', meaning: '测试' }, '2026-10-20'), '2026-10-21');
    expect(word.nextReviewDate).toBe('2026-10-22');
    expect(addToFocus(word, day)).toBe(word);
    const reset = resetWord({ ...initialState(day), words: [word] }, word.id, day);
    expect(reset.words[0].focus?.nextDate).toBe(reset.words[0].nextReviewDate);
    const passed = gradeWord({ ...initialState(day), words: [word] }, word.id, day, 3);
    const again = addToFocus(passed.words[0], '2026-10-24');
    expect(again.focusAddedDays).toEqual(['2026-10-21', '2026-10-24']);
    expect(again.card?.due.slice(0, 10)).toBe('2026-10-25');
  });
  it('rejects malformed focus state in v3 backups instead of silently dropping it', () => {
    const word = addToFocus(createWord({ word: 'test', meaning: '测试' }, '2026-10-21'), '2026-10-21');
    const state = { ...initialState(day), words: [word] };
    expect(parseBackup(backupJson(state), day).words[0].focus).toEqual(word.focus);
    for (const focus of [{ ...word.focus, active: 'yes' }, { ...word.focus, nextDate: undefined }, { ...word.focus, addedAt: '2026-02-30' }, { ...word.focus, reason: 3 }, 'active', null])
      expect(() => parseBackup(JSON.stringify({ ...state, version: 3, words: [{ ...word, focus }] }), day)).toThrow('A4 攻坚状态无效');
    expect(parseBackup(JSON.stringify({ version: 2, words: [{ ...word, focus: { active: 'yes' } }] }), day).words[0].focus).toBeUndefined();
  });
});

describe('calendar day marks', () => {
  const marks = (state: ReturnType<typeof initialState>, scope: 'focus' | 'all', date: string) =>
    dayMarks(buildCalendar(state, day), scope, date, day).map(m => `${m.kind}:${m.count}`);
  const build = () => {
    const due = addToFocus(createWord({ word: 'due', meaning: '待' }, '2026-10-20'), '2026-10-22');
    const done = addToFocus(createWord({ word: 'done', meaning: '完' }, '2026-10-20'), '2026-10-22');
    const fresh = addToFocus(createWord({ word: 'fresh', meaning: '新' }, day), day);
    const legacy = createWord({ word: 'legacy', meaning: '旧' }, '2026-10-19');
    legacy.reviewHistory.push('2026-10-21');
    const state = { ...initialState(day), words: [due, done, fresh, legacy], bookLearning: { bookId: BOOK.id, dailyGroups: 2, completed: { [BOOK_GROUPS[0].id]: '2026-10-21' } } };
    return gradeWord(state, done.id, day, 3);
  };
  it('today separates pending, completed and newly added A4 words', () => {
    expect(marks(build(), 'focus', day)).toEqual(['due:1', 'done:1', 'added:1']);
  });
  it('past days show only real records; A4 never counts book first-study', () => {
    const state = build();
    expect(marks(state, 'focus', '2026-10-22')).toEqual(['added:2']);
    expect(marks(state, 'focus', '2026-10-21')).toEqual([]);
    expect(marks(state, 'all', '2026-10-21')).toEqual(['done:1', 'learned:25']);
    expect(marks(state, 'all', '2026-10-19')).toEqual([]);
  });
  it('future days show only the current next-due prediction, labelled as predicted', () => {
    const state = build();
    const future = dayMarks(buildCalendar(state, day), 'focus', '2026-10-24', day);
    expect(future.map(m => `${m.kind}:${m.count}`)).toEqual(['planned:1']);
    expect(future[0]).toMatchObject({ text: '≈1', label: '预计到期 1 词' });
    expect(dayMarks(buildCalendar(state, day), 'focus', day, day).map(m => m.label)).toEqual(['待复习 1 词', '已完成 1 词', '新增攻坚 1 词']);
  });
});
