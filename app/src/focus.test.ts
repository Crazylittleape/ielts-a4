import { describe, expect, it } from 'vitest';
import { addToFocus, backupJson, createWord, focusStatus, focusSummary, gradeWord, initialState, isDueOn, mergeStates, parseBackup, removeFromFocus, resetWord, stateSummary, type AppState, type WordItem } from './lib';
import { buildCalendar, reviewIds } from './calendar';

const day = '2026-10-22';
const tomorrow = '2026-10-23';

describe('removing a word from A4', () => {
  it('undoes a same-day mistaken add without touching the shared card or other words', () => {
    const kept = addToFocus(createWord({ word: 'kept', meaning: '保留' }, day), day);
    const mistake = addToFocus(createWord({ word: 'mistake', meaning: '误点' }, day), day);
    const removed = removeFromFocus(mistake, day);

    expect(removed.id).toBe(mistake.id);
    expect(removed.card).toEqual(mistake.card);
    expect(removed.nextReviewDate).toBe(mistake.nextReviewDate);
    expect(removed.focus?.active ?? false).toBe(false);
    expect(removed.focusAddedDays ?? []).toEqual([]);

    const state: AppState = { ...initialState(day), words: [kept, removed] };
    const calendar = buildCalendar(state, day);
    expect(calendar.focus[day].added).toEqual([kept.id]);
    expect(reviewIds(calendar.focus, tomorrow, day)).toEqual([kept.id]);
    expect(reviewIds(calendar.all, tomorrow, day).sort()).toEqual([kept.id, removed.id].sort());
    expect(parseBackup(backupJson(state), day).words[1].focus?.active ?? false).toBe(false);
  });

  it('keeps earlier real A4 history when removing on a later day, and is a no-op for inactive words', () => {
    const word = addToFocus(createWord({ word: 'history', meaning: '历史' }, '2026-10-20'), '2026-10-20');
    const removed = removeFromFocus(word, day);
    expect(removed.focus).toMatchObject({ active: false, addedAt: '2026-10-20' });
    expect(removed.focusAddedDays).toEqual(['2026-10-20']);
    expect(buildCalendar({ ...initialState(day), words: [removed] }, day).focus['2026-10-20'].added).toEqual([word.id]);
    expect(removeFromFocus(removed, day)).toBe(removed);
    const plain = createWord({ word: 'plain', meaning: '普通' }, day);
    expect(removeFromFocus(plain, day)).toBe(plain);
    expect(addToFocus(removed, day).focus).toMatchObject({ active: true, addedAt: day, nextDate: tomorrow });
  });
});

/** A card graded Easy on 10-21 whose long-term due date is well after tomorrow. */
function longTermWord(name = 'steady'): { state: AppState; word: WordItem } {
  const created = createWord({ word: name, meaning: '稳定' }, '2026-10-20');
  const state = gradeWord({ ...initialState(day), words: [created] }, created.id, '2026-10-21', 4);
  return { state, word: state.words[0] };
}

describe('undoing A4 restores the pre-add schedule only while nothing newer happened', () => {
  it('add → undo restores the original due date, card and mastered flag', () => {
    const { word } = longTermWord();
    expect(word.nextReviewDate > tomorrow).toBe(true);
    const mastered = { ...word, isMastered: true };
    const added = addToFocus(mastered, day);
    expect(added.nextReviewDate).toBe(tomorrow);
    const undone = removeFromFocus(added, day);
    expect(undone.nextReviewDate).toBe(word.nextReviewDate);
    expect(undone.card).toEqual(word.card);
    expect(undone.isMastered).toBe(true);
    expect(undone.focus).toBeUndefined();
    expect(isDueOn({ ...undone, isMastered: false }, tomorrow)).toBe(false);
    // An undo on a later day before any grading also restores.
    const later = removeFromFocus(added, tomorrow);
    expect(later.nextReviewDate).toBe(word.nextReviewDate);
    expect(later.focus).toMatchObject({ active: false, addedAt: day });
    expect(later.focus && 'before' in later.focus).toBe(false);
  });

  it('add → grade → undo keeps the newest FSRS result instead of the snapshot', () => {
    const { state, word } = longTermWord();
    const focused = { ...state, words: [addToFocus(word, day)] };
    const graded = gradeWord(focused, word.id, tomorrow, 1);
    const afterGrade = graded.words[0];
    expect(afterGrade.focus?.active).toBe(true);
    expect(afterGrade.focus && 'before' in afterGrade.focus).toBe(false);
    const undone = removeFromFocus(afterGrade, tomorrow);
    expect(undone.nextReviewDate).toBe(afterGrade.nextReviewDate);
    expect(undone.card).toEqual(afterGrade.card);
    expect(undone.focus?.active).toBe(false);
  });

  it('add → reset → undo keeps the reset card', () => {
    const { state, word } = longTermWord();
    const reset = resetWord({ ...state, words: [addToFocus(word, day)] }, word.id, day).words[0];
    const undone = removeFromFocus(reset, day);
    expect(undone.card).toEqual(reset.card);
    expect(undone.isHard).toBe(true);
  });

  it('keeps the snapshot through a v3 backup, rejects a corrupt snapshot, and never copies it onto another card in a merge', () => {
    const { state, word } = longTermWord();
    const focusedState = { ...state, words: [addToFocus(word, day)] };
    const restored = parseBackup(backupJson(focusedState), day);
    expect(removeFromFocus(restored.words[0], day).nextReviewDate).toBe(word.nextReviewDate);
    const raw = JSON.parse(backupJson(focusedState));
    raw.words[0].focus.before = { nextReviewDate: 'soon', card: {} };
    expect(() => parseBackup(JSON.stringify(raw), day)).toThrow('A4 攻坚状态无效');
    const local = { ...initialState(day), words: [{ ...word, id: 'local' }] };
    const merged = mergeStates(local, restored).words[0];
    expect(merged.focus && 'before' in merged.focus).toBe(false);
  });
});

describe('A4 lifecycle status', () => {
  it('names every state a word can be in, using real review evidence', () => {
    const { state, word } = longTermWord();
    expect(focusStatus(word, day, state.revlog).key).toBe('none');
    const waiting = addToFocus(word, day);
    expect(focusStatus(waiting, day, state.revlog)).toMatchObject({ key: 'waiting', label: `攻坚中 · ${tomorrow} 到期` });
    expect(focusStatus(waiting, tomorrow, state.revlog)).toMatchObject({ key: 'due', label: '攻坚中 · 今日待复习' });
    const failed = gradeWord({ ...state, words: [waiting] }, word.id, tomorrow, 1);
    expect(focusStatus(failed.words[0], tomorrow, failed.revlog).key).toBe('doneStay');
    expect(focusStatus(failed.words[0], tomorrow, failed.revlog).label).toContain('今日已完成 · 继续攻坚');
    const passed = gradeWord({ ...state, words: [waiting] }, word.id, tomorrow, 3);
    expect(focusStatus(passed.words[0], tomorrow, passed.revlog)).toMatchObject({ key: 'doneExit', label: '今日已完成 · 已退出攻坚' });
    expect(focusStatus(passed.words[0], '2026-10-24', passed.revlog)).toMatchObject({ key: 'exited', label: '已退出攻坚 · 历史加入 1 次' });

    const summary = focusSummary({ ...passed, words: [...passed.words, addToFocus(createWord({ word: 'later', meaning: '之后' }, tomorrow), tomorrow)] }, tomorrow);
    expect(summary).toEqual({ due: 0, done: 1, waiting: 1, exited: 0, nextDate: '2026-10-24' });
  });
});

describe('import preview', () => {
  it('summarises words, A4 words, logs and finished groups', () => {
    const { state, word } = longTermWord();
    const s = { ...state, words: [addToFocus(word, day)], bookLearning: { bookId: 'ielts-bible-core-v1', dailyGroups: 2, completed: { 'u01-g01': day } } };
    expect(stateSummary(s)).toEqual({ words: 1, focus: 1, logs: 1, groups: 1 });
  });
});
