import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BOOK, BOOK_GROUPS } from './bookCatalog';
import { addToFocus, createWord, gradeWord, initialState, STORAGE_KEY, type AppState } from './lib';
import { db, listAutoBackups, MAX_AUTO_BACKUPS, onWorkspaceEvent, openWorkspace, persistWorkspace, saveAutoBackup, type WorkspaceEvent } from './db';

const day = '2026-10-24';
const memory = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) }, configurable: true });

function realState(): AppState {
  const a = addToFocus(createWord({ word: 'alpha', meaning: '第一个' }, '2026-10-20'), '2026-10-22');
  const b = createWord({ word: 'beta', meaning: '第二个' }, '2026-10-20');
  const state = { ...initialState(day), words: [a, b], bookLearning: { bookId: BOOK.id, dailyGroups: 2, completed: { [BOOK_GROUPS[0].id]: '2026-10-21' } } };
  return gradeWord(state, a.id, '2026-10-23', 1);
}

/** Recreates exactly what Dexie `version(1)` (IndexedDB version 10) left on devices before the upgrade. */
function seedVersion1(state: AppState, revision: number, keepOpen = false): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('ielts-a4-v3', 10);
    req.onupgradeneeded = () => {
      const d = req.result;
      const words = d.createObjectStore('words', { keyPath: 'id' });
      words.createIndex('word', 'word'); words.createIndex('nextReviewDate', 'nextReviewDate');
      d.createObjectStore('cards', { keyPath: 'id' });
      const revlog = d.createObjectStore('revlog', { keyPath: 'id' });
      revlog.createIndex('wordId', 'wordId'); revlog.createIndex('day', 'day');
      d.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const d = req.result;
      const tx = d.transaction(['words', 'cards', 'revlog', 'meta'], 'readwrite');
      for (const { card, ...word } of state.words) { tx.objectStore('words').put(word); tx.objectStore('cards').put({ id: word.id, card }); }
      for (const log of state.revlog) tx.objectStore('revlog').put(log);
      for (const [key, value] of Object.entries({ initialized: true, revision, settings: state.settings, skipped: state.skipped, bookLearning: state.bookLearning })) tx.objectStore('meta').put({ key, value });
      tx.oncomplete = () => { if (!keepOpen) d.close(); resolve(d); };
      tx.onerror = () => reject(tx.error);
    };
  });
}

const until = async (check: () => boolean) => { for (let i = 0; i < 100 && !check(); i++) await new Promise(r => setTimeout(r, 10)); };

beforeEach(async () => {
  memory.clear();
  db.close();
  await Dexie.delete('ielts-a4-v3');
});

describe('Dexie version 1 → 2 upgrade', () => {
  it('keeps words, FSRS cards, A4 state, revlog, book progress and revision; never re-reads localStorage', async () => {
    const state = realState();
    await seedVersion1(state, 7);
    memory.set(STORAGE_KEY, JSON.stringify({ words: [{ word: 'stale', meaning: '旧' }] }));
    await db.open();
    expect(db.verno).toBe(2);
    const { state: loaded, fresh } = await openWorkspace(day);
    expect(fresh).toBe(false);
    expect(loaded.words.map(w => w.word).sort()).toEqual(['alpha', 'beta']);
    const alpha = loaded.words.find(w => w.word === 'alpha')!;
    const original = state.words.find(w => w.word === 'alpha')!;
    expect(alpha.card).toEqual(original.card);
    expect(alpha.focus).toEqual(original.focus);
    expect(alpha.focusAddedDays).toEqual(['2026-10-22']);
    expect(loaded.revlog).toEqual(state.revlog);
    expect(loaded.bookLearning).toEqual(state.bookLearning);
    await persistWorkspace({ ...loaded, words: loaded.words.filter(w => w.word === 'alpha') });
    expect((await db.meta.get('revision'))?.value).toBe(8);
    expect(await listAutoBackups()).toEqual([]);
  });

  it('waits for an old open tab instead of failing, tells the user, then loads the same records', async () => {
    const events: WorkspaceEvent[] = [];
    const off = onWorkspaceEvent(e => events.push(e));
    const old = await seedVersion1(realState(), 3, true);
    const opening = db.open();
    await until(() => events.includes('blocked'));
    expect(events).toContain('blocked');
    old.close();
    await opening;
    expect((await openWorkspace(day)).state.words).toHaveLength(2);
    off();
  });

  it('a newer version opened elsewhere closes this tab safely; later saves are refused with a refresh hint', async () => {
    const events: WorkspaceEvent[] = [];
    const off = onWorkspaceEvent(e => events.push(e));
    await db.open();
    const { state } = await openWorkspace(day);
    const newer = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('ielts-a4-v3', 30); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    expect(events).toContain('replaced');
    await expect(persistWorkspace({ ...state, words: realState().words })).rejects.toThrow('请刷新');
    newer.close();
    off();
  });
});

describe('automatic backups before destructive actions', () => {
  it('keeps several backups instead of overwriting the only one, newest first, and prunes beyond the limit', async () => {
    await db.open();
    const summary = { words: 1, focus: 0, logs: 0, groups: 0 };
    await saveAutoBackup('{"n":1}', day, 'import', summary);
    await saveAutoBackup('{"n":2}', day, 'clear', summary);
    let rows = await listAutoBackups();
    expect(rows.map(r => r.json)).toEqual(['{"n":2}', '{"n":1}']);
    expect(rows.map(r => r.reason)).toEqual(['clear', 'import']);
    for (let n = 3; n <= MAX_AUTO_BACKUPS + 2; n++) await saveAutoBackup(`{"n":${n}}`, day, 'import', summary);
    rows = await listAutoBackups();
    expect(rows).toHaveLength(MAX_AUTO_BACKUPS);
    expect(rows[0].json).toBe(`{"n":${MAX_AUTO_BACKUPS + 2}}`);
  });

  it('still lists the single legacy before-import backup written by the previous build', async () => {
    await db.open();
    await db.backups.put({ key: 'before-import', day: '2026-10-23', json: '{"legacy":true}' });
    await saveAutoBackup('{"n":1}', day, 'import', { words: 1, focus: 0, logs: 0, groups: 0 });
    expect((await listAutoBackups()).map(r => r.json)).toEqual(['{"n":1}', '{"legacy":true}']);
  });
});

describe('atomic writes and cross-tab notice', () => {
  it('a failed replace write rolls back completely and later saves still work', async () => {
    await db.open();
    await openWorkspace(day);
    const original = realState();
    await persistWorkspace(original);
    const revision = (await db.meta.get('revision'))?.value;
    const spy = vi.spyOn(db.revlog, 'bulkPut').mockImplementationOnce(() => { throw new Error('QuotaExceededError'); });
    const incoming = { ...initialState(day), words: [createWord({ word: 'gamma', meaning: '第三个' }, day)] };
    await expect(persistWorkspace(incoming)).rejects.toThrow('QuotaExceededError');
    spy.mockRestore();
    const { state } = await openWorkspace(day);
    expect(state.words.map(w => w.word).sort()).toEqual(['alpha', 'beta']);
    expect(state.revlog).toEqual(original.revlog);
    expect((await db.meta.get('revision'))?.value).toBe(revision);
    await persistWorkspace(incoming);
    expect((await db.meta.get('revision'))?.value).toBe(Number(revision) + 1);
  });

  it('tells other tabs right after a save, and reacts to saves from other tabs', async () => {
    const events: WorkspaceEvent[] = [];
    const off = onWorkspaceEvent(e => events.push(e));
    const otherTab = new BroadcastChannel('ielts-a4-workspace');
    const received: unknown[] = [];
    otherTab.onmessage = e => received.push(e.data);
    await db.open();
    const { state } = await openWorkspace(day);
    await persistWorkspace({ ...state, words: realState().words });
    await until(() => received.length > 0);
    expect(received[0]).toMatchObject({ type: 'changed', revision: 1 });
    otherTab.postMessage({ type: 'changed', revision: 2 });
    await until(() => events.includes('changed'));
    expect(events).toContain('changed');
    otherTab.close();
    off();
  });
});
