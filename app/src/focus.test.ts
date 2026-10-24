import { describe, expect, it } from 'vitest';
import { addToFocus, backupJson, createWord, initialState, parseBackup, removeFromFocus, type AppState } from './lib';
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
