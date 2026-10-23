import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { addToFocus, backupJson, buildSchedule, createWord, gradeWord, isDueOn, isFocusDueOn, mergeStates, parseBackup, resetWord, STORAGE_KEY, type AppState } from './lib';
import { db, openWorkspace, persistWorkspace } from './db';

const day = '2026-10-22';
const makeState = (): AppState => ({ words: [{ ...createWord({ word: 'test', meaning: '测试' }, '2026-10-20'), nextReviewDate: day }], skipped: [], settings: { dailyClaim: 30, lastClaimDate: '' }, revlog: [] });
const memory = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value), removeItem: (key: string) => memory.delete(key) }, configurable: true });

beforeEach(async () => { memory.clear(); await db.delete(); await db.open(); });

describe('daily FSRS', () => {
  it('keeps A4 as the same word card, schedules tomorrow, is idempotent, and exits only after success', () => {
    const state = makeState();
    const id = state.words[0].id;
    const focused = { ...state, words: state.words.map(w => w.id === id ? addToFocus(w, day, '模糊') : w) };
    expect(focused.words[0].id).toBe(id);
    expect(focused.words[0].focus).toMatchObject({ active: true, addedAt: day, nextDate: '2026-10-23' });
    expect(isFocusDueOn(focused.words[0], '2026-10-23')).toBe(true);
    const duplicate = { ...focused, words: focused.words.map(w => w.id === id ? addToFocus(w, day, '再次点击') : w) };
    expect(duplicate.words[0].focus).toEqual(focused.words[0].focus);
    const failed = gradeWord(duplicate, id, '2026-10-23', 1);
    expect(failed.words[0].focus?.active).toBe(true);
    const passed = gradeWord(failed, id, failed.words[0].nextReviewDate, 3);
    expect(passed.words[0].focus?.active).toBe(false);
    expect(passed.words[0].nextReviewDate > '2026-10-23').toBe(true);
  });
  it('grades once per day and persists a future due date and log', () => {
    const state = makeState();
    const graded = gradeWord(state, state.words[0].id, day, 3);
    expect(graded.words[0].card?.reps).toBeGreaterThan(0);
    expect(graded.words[0].nextReviewDate > day).toBe(true);
    expect(graded.revlog).toHaveLength(1);
    expect(gradeWord(graded, state.words[0].id, day, 1)).toEqual(graded);
  });
  it('keeps a manual reset when the page is subsequently completed', () => {
    const state = makeState();
    const reset = resetWord(state, state.words[0].id, day);
    expect(reset.words[0].isHard).toBe(true);
    expect(reset.words[0].nextReviewDate).toBe('2026-10-23');
    expect(gradeWord(reset, state.words[0].id, day, 3)).toEqual(reset);
  });
  it('handles a local month boundary without a UTC date offset', () => {
    const state = makeState();
    state.words[0].nextReviewDate = '2026-10-31';
    const reset = resetWord(state, state.words[0].id, '2026-10-31');
    expect(reset.words[0].nextReviewDate).toBe('2026-11-01');
  });
  it('excludes mastered words, and only projects the next known due date', () => {
    const state = makeState();
    expect(isDueOn({ ...state.words[0], mastered: true }, day)).toBe(false);
    const schedule = buildSchedule([{ ...state.words[0], nextReviewDate: '2026-10-24' }], day);
    expect(schedule['2026-10-24'].planned).toHaveLength(1);
    expect(Object.values(schedule).reduce((n, s) => n + s.planned.length, 0)).toBe(1);
  });
});

describe('backup safety', () => {
  it('round-trips cards, settings and review logs', () => {
    const state = makeState();
    const graded = gradeWord(state, state.words[0].id, day, 1);
    expect(parseBackup(backupJson(graded), day)).toEqual(graded);
  });
  it('rejects an invalid entry rather than partially replacing the database', () => {
    const state = makeState();
    expect(() => parseBackup(JSON.stringify({ ...state, version: 3, words: [...state.words, { word: 'broken' }] }), day)).toThrow();
    expect(() => parseBackup(JSON.stringify({ ...state, version: 3, revlog: [{ id: 'bad' }] }), day)).toThrow();
    expect(() => parseBackup(JSON.stringify({ ...state, version: 3, settings: { dailyClaim: -1, lastClaimDate: '' } }), day)).toThrow();
    expect(() => parseBackup(JSON.stringify({ ...state, version: 3, words: [{ ...state.words[0], card: { ...state.words[0].card, due: 'broken' } }] }), day)).toThrow();
    expect(() => parseBackup(JSON.stringify({ ...state, version: 3, words: [state.words[0], state.words[0]] }), day)).toThrow();
  });
  it('can grade the local due schedule after merging a same-day audit log', () => {
    const local = makeState();
    const incoming = makeState();
    const reviewed = gradeWord(incoming, incoming.words[0].id, day, 3);
    const merged = mergeStates(local, reviewed);
    const graded = gradeWord(merged, local.words[0].id, day, 1);
    expect(graded.words[0].nextReviewDate > day).toBe(true);
    expect(graded.words[0].reviewHistory).toContain(day);
    expect(graded.revlog).toHaveLength(2);
    expect(gradeWord(graded, local.words[0].id, day, 3)).toEqual(graded);
  });
  it('can reset the local schedule after merging an incoming reset audit log', () => {
    const local = makeState();
    const incoming = makeState();
    const merged = mergeStates(local, resetWord(incoming, incoming.words[0].id, day));
    const reset = resetWord(merged, local.words[0].id, day);
    expect(reset.words[0].nextReviewDate).toBe('2026-10-23');
    expect(reset.words[0].isHard).toBe(true);
    expect(reset.revlog).toHaveLength(2);
    expect(resetWord(reset, local.words[0].id, day)).toEqual(reset);
    expect(gradeWord(reset, local.words[0].id, day, 3)).toEqual(reset);
  });
  it('merges duplicate spellings without replacing the current schedule', () => {
    const state = makeState();
    const incoming = makeState();
    incoming.words[0].word = 'TEST';
    const reviewed = gradeWord(incoming, incoming.words[0].id, day, 3);
    const merged = mergeStates(state, reviewed);
    expect(merged.words).toHaveLength(1);
    expect(merged.words[0].nextReviewDate).toEqual(state.words[0].nextReviewDate);
    expect(merged.words[0]).toEqual(state.words[0]);
    expect(merged.revlog[0].wordId).toBe(state.words[0].id);
    expect(mergeStates(merged, reviewed).revlog).toHaveLength(1);
  });
});

describe('IndexedDB migration', () => {
  it('migrates v2 once and preserves due dates and original localStorage', async () => {
    const state = makeState();
    const old = JSON.stringify({ ...state, version: 2 });
    localStorage.setItem(STORAGE_KEY, old);
    const first = await openWorkspace(day);
    expect(first.fresh).toBe(false);
    expect(first.state.words[0].nextReviewDate).toBe(day);
    expect(first.state.words[0].card?.due).toBeTruthy();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(old);
    await persistWorkspace({ ...first.state, words: [], revlog: [] });
    const reopened = await openWorkspace(day);
    expect(reopened.state.words).toEqual([]);
    expect(reopened.fresh).toBe(false);
  });
  it('refuses corrupt legacy data without silently seeding over it', async () => {
    localStorage.setItem(STORAGE_KEY, '{broken');
    await expect(openWorkspace(day)).rejects.toThrow();
    expect(await db.words.count()).toBe(0);
    expect(await db.meta.count()).toBe(0);
  });
  it('refuses an invalid save and preserves the prior snapshot', async () => {
    const first = await openWorkspace(day);
    const broken = { ...first.state, words: [{ ...makeState().words[0], meaning: '' }] };
    await expect(persistWorkspace(broken)).rejects.toThrow();
    expect((await openWorkspace(day)).state).toEqual(first.state);
  });
  it('does not hide a corrupted card table on reopen', async () => {
    await openWorkspace(day);
    await persistWorkspace(makeState());
    await db.cards.clear();
    await expect(openWorkspace(day)).rejects.toThrow();
  });
  it('rejects stale-tab writes rather than overwriting an external save', async () => {
    const first = await openWorkspace(day);
    // A second tab has its own module state but shares IndexedDB.
    await db.meta.put({ key: 'revision', value: 10 });
    await expect(persistWorkspace({ ...first.state, skipped: ['stale'] })).rejects.toThrow('其他标签页');
    expect((await openWorkspace(day)).state.skipped).toEqual(first.state.skipped);
  });
  it('reloads an atomic saved grade including its card and log', async () => {
    const opened = await openWorkspace(day);
    const state = makeState();
    const graded = gradeWord(state, state.words[0].id, day, 1);
    await persistWorkspace(graded);
    expect((await openWorkspace(day)).state).toEqual(graded);
    expect(opened.fresh).toBe(true);
  });
});
