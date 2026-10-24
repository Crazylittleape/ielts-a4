import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import sequence from './data/book-sequence.json';
import { BOOK_EXAMPLES, getBookWord } from './book';
import { addToFocus, backupJson, createWord, gradeWord, initialState, mergeStates, parseBackup, type AppState } from './lib';
import { db, openWorkspace, persistWorkspace } from './db';

const day = '2026-10-22';
const memory = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) }, configurable: true });
beforeEach(async () => { memory.clear(); await db.delete(); await db.open(); });

// Test fixture only: not shipped content and not shown to users.
const example = { exampleEn: 'Fixture sentence for alpha.', exampleZh: '测试用例句。', exampleSource: 'test fixture' };
const withExample = () => createWord({ word: 'alpha', meaning: '第一个', ...example }, '2026-10-20');

describe('optional example fields', () => {
  it('are kept by createWord only when a source is given, and absent otherwise', () => {
    expect(withExample()).toMatchObject(example);
    const plain = createWord({ word: 'plain', meaning: '普通' }, day);
    expect('exampleEn' in plain || 'exampleZh' in plain || 'exampleSource' in plain).toBe(false);
    const unsourced = createWord({ word: 'nosource', meaning: '无来源', exampleEn: 'No source.' }, day);
    expect(unsourced.exampleEn).toBeUndefined();
  });

  it('round-trip through v3 JSON backup and legacy imports; invalid v3 example data is rejected', () => {
    const state: AppState = { ...initialState(day), words: [withExample(), createWord({ word: 'beta', meaning: '第二个' }, day)] };
    const restored = parseBackup(backupJson(state), day);
    expect(restored.words[0]).toMatchObject(example);
    expect(restored.words[1].exampleEn).toBeUndefined();
    expect(parseBackup(JSON.stringify({ words: [{ word: 'legacy', meaning: '旧', ...example }] }), day).words[0]).toMatchObject(example);
    const bad = JSON.parse(backupJson(state));
    bad.words[0].exampleEn = 5;
    expect(() => parseBackup(JSON.stringify(bad), day)).toThrow('例句');
    const unsourced = JSON.parse(backupJson(state));
    delete unsourced.words[0].exampleSource;
    expect(() => parseBackup(JSON.stringify(unsourced), day)).toThrow('例句');
  });

  it('survive IndexedDB persistence and a replace import, alongside A4 state and FSRS cards', async () => {
    const graded = gradeWord({ ...initialState(day), words: [{ ...addToFocus(withExample(), '2026-10-21'), nextReviewDate: day }] }, withExample().id, day, 2);
    await openWorkspace(day);
    await persistWorkspace(parseBackup(backupJson(graded), day));
    const { state } = await openWorkspace(day);
    expect(state.words[0]).toMatchObject(example);
    expect(state.words[0].card).toEqual(graded.words[0].card);
    expect(state.words[0].focus).toEqual(graded.words[0].focus);
    expect(state.revlog).toEqual(graded.revlog);
  });

  it('merge import adds examples to new words and fills a missing local example without touching the schedule', () => {
    const local = { ...initialState(day), words: [createWord({ word: 'alpha', meaning: '本机' }, '2026-10-01'), createWord({ word: 'kept', meaning: '保留', exampleEn: 'Local sentence.', exampleSource: 'my note' }, day)] };
    const incoming = { ...initialState(day), words: [withExample(), createWord({ word: 'kept', meaning: '保留', ...example }, day), createWord({ word: 'fresh', meaning: '新', ...example }, day)] };
    const merged = mergeStates(local, incoming);
    const alpha = merged.words.find(w => w.word === 'alpha')!;
    expect(alpha).toMatchObject({ ...example, id: local.words[0].id, meaning: '本机', nextReviewDate: local.words[0].nextReviewDate, card: local.words[0].card });
    expect(merged.words.find(w => w.word === 'kept')).toMatchObject({ exampleEn: 'Local sentence.', exampleSource: 'my note' });
    expect(merged.words.find(w => w.word === 'kept')!.exampleZh).toBeUndefined();
    expect(merged.words.find(w => w.word === 'fresh')).toMatchObject(example);
    expect(mergeStates(local, { ...initialState(day), words: [createWord({ word: 'alpha', meaning: 'x' }, day)] }).words[0]).toEqual(local.words[0]);
  });
});

describe('book example data', () => {
  it('ships only sourced examples for real book headwords (none are bundled yet), and never invents one', () => {
    const names = new Set((sequence as string[]).map(w => w.toLowerCase()));
    for (const [word, entry] of Object.entries(BOOK_EXAMPLES)) {
      expect(names.has(word.toLowerCase())).toBe(true);
      expect(entry.exampleEn.trim() && entry.exampleSource.trim()).toBeTruthy();
    }
    expect(Object.keys(BOOK_EXAMPLES)).toHaveLength(0);
    expect((sequence as string[]).filter(w => getBookWord(w).exampleEn)).toEqual([]);
  });

  it('passes a sourced example from the book data into the shared WordItem', () => {
    const fields = getBookWord('atmosphere', { atmosphere: example });
    expect(fields).toMatchObject({ word: 'atmosphere', ...example });
    expect(createWord(fields, day)).toMatchObject(example);
  });
});
