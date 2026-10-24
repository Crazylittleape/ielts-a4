import Dexie, { type Table } from 'dexie';
import { loadState, parseBackup, todayStr, type AppState, type ReviewEntry, type SerializedCard, type StateSummary, type WordItem } from './lib';

interface MetaRow { key: string; value: unknown }
interface CardRow { id: string; card: SerializedCard }
export interface BackupRow { key: string; day: string; json: string; reason?: 'import' | 'clear'; createdAt?: string; summary?: StateSummary }
export type WorkspaceEvent = 'blocked' | 'replaced' | 'changed';
export const MAX_AUTO_BACKUPS = 5;
const listeners = new Set<(event: WorkspaceEvent) => void>();
const emit = (event: WorkspaceEvent) => listeners.forEach(fn => fn(event));
export function onWorkspaceEvent(fn: (event: WorkspaceEvent) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
let replacedElsewhere = false;
const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('ielts-a4-workspace');
if (channel) channel.onmessage = event => { if (event.data?.type === 'changed' && event.data.revision !== loadedRevision) emit('changed'); };

class WorkspaceDatabase extends Dexie {
  words!: Table<Omit<WordItem, 'card'>, string>;
  cards!: Table<CardRow, string>;
  revlog!: Table<ReviewEntry, string>;
  meta!: Table<MetaRow, string>;
  backups!: Table<BackupRow, string>;

  constructor() {
    super('ielts-a4-v3');
    this.version(1).stores({ words: 'id,word,nextReviewDate', cards: 'id', revlog: 'id,wordId,day', meta: 'key' });
    // Kept outside the snapshot tables so a replace import never clears it.
    this.version(2).stores({ backups: 'key' });
    // An old tab that never yields keeps the upgrade waiting; tell the user instead of failing.
    this.on('blocked', () => emit('blocked'));
    // A newer build opened elsewhere: close so its upgrade can run; refuse later writes here.
    this.on('versionchange', () => { replacedElsewhere = true; this.close(); emit('replaced'); return false; });
    this.on('ready', () => { replacedElsewhere = false; }, true);
  }
}

export const db = new WorkspaceDatabase();
let loadedRevision: number | null = null;

async function writeSnapshot(state: AppState, revision: number): Promise<void> {
  await Promise.all([db.words.clear(), db.cards.clear(), db.revlog.clear(), db.meta.clear()]);
  await db.words.bulkPut(state.words.map(({ card: _card, ...word }) => word));
  await db.cards.bulkPut(state.words.filter((w): w is WordItem & { card: SerializedCard } => Boolean(w.card)).map((w) => ({ id: w.id, card: w.card })));
  await db.revlog.bulkPut(state.revlog);
  await db.meta.bulkPut([
    { key: 'initialized', value: true },
    { key: 'revision', value: revision },
    { key: 'settings', value: state.settings },
    { key: 'skipped', value: state.skipped },
    ...(state.bookLearning ? [{ key: 'bookLearning', value: state.bookLearning }] : [])
  ]);
}

export async function persistWorkspace(state: AppState): Promise<void> {
  // Validate before opening a destructive transaction; no partial imports or writes.
  if (replacedElsewhere) throw new Error('学习记录已在新版本窗口中打开，请刷新本页后再操作，当前操作尚未保存。');
  const valid = parseBackup(JSON.stringify({ ...state, version: 3 }), todayStr());
  let savedRevision = 0;
  await db.transaction('rw', db.words, db.cards, db.revlog, db.meta, async () => {
    const actual = await db.meta.get('revision');
    if (loadedRevision === null || actual?.value !== loadedRevision) throw new Error('其他标签页已更新学习记录。请刷新后重试，当前操作尚未保存。');
    savedRevision = loadedRevision + 1;
    await writeSnapshot(valid, savedRevision);
  });
  loadedRevision = savedRevision;
  channel?.postMessage({ type: 'changed', revision: savedRevision });
}

export async function openWorkspace(today: string): Promise<{ state: AppState; fresh: boolean }> {
  // Reading localStorage may fail (privacy/security settings). Such failure must not
  // create a fresh database that would hide the original learning records.
  const existing = await db.meta.get('initialized');
  if (!existing) {
    const migrated = loadState(today);
    await db.transaction('rw', db.words, db.cards, db.revlog, db.meta, async () => {
      // StrictMode and two open tabs may both enter initialization. Only one wins.
      if (!(await db.meta.get('initialized'))) await writeSnapshot(migrated.state, 0);
    });
    return { state: await readSnapshot(today), fresh: migrated.fresh };
  }
  return { state: await readSnapshot(today), fresh: false };
}

async function readSnapshot(today: string): Promise<AppState> {
  return db.transaction('r', db.words, db.cards, db.revlog, db.meta, async () => {
    const [words, cards, revlog, settings, skipped, revision, bookLearning] = await Promise.all([
      db.words.toArray(), db.cards.toArray(), db.revlog.toArray(), db.meta.get('settings'), db.meta.get('skipped'), db.meta.get('revision'), db.meta.get('bookLearning')
    ]);
    if (!Number.isInteger(revision?.value) || Number(revision?.value) < 0) throw new Error('数据库版本记录损坏，请先保留备份');
    loadedRevision = Number(revision?.value);
    const byId = new Map(cards.map((row) => [row.id, row.card]));
    const wordIds = new Set(words.map((w) => w.id));
    if (words.some((w) => !byId.has(w.id)) || cards.some((c) => !wordIds.has(c.id))) throw new Error('数据库中的单词和复习卡不匹配，请先保留备份');
    return parseBackup(JSON.stringify({ version: 3, words: words.map((w) => ({ ...w, card: byId.get(w.id) })), revlog, settings: settings?.value, skipped: skipped?.value, bookLearning: bookLearning?.value }), today);
  });
}

let backupSeq = 0;
const newestFirst = (a: BackupRow, b: BackupRow) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || b.key.localeCompare(a.key);

/** Never overwrites an earlier automatic backup; keeps the newest MAX_AUTO_BACKUPS (a legacy row counts as oldest). */
export async function saveAutoBackup(json: string, day: string, reason: 'import' | 'clear', summary: StateSummary): Promise<void> {
  const now = Date.now();
  const key = `auto-${String(now).padStart(15, '0')}-${String(backupSeq++).padStart(6, '0')}`;
  await db.transaction('rw', db.backups, async () => {
    await db.backups.put({ key, day, json, reason, createdAt: new Date(now).toISOString(), summary });
    const stale = (await db.backups.toArray()).sort(newestFirst).slice(MAX_AUTO_BACKUPS);
    if (stale.length) await db.backups.bulkDelete(stale.map(row => row.key));
  });
}

export async function listAutoBackups(): Promise<BackupRow[]> {
  return (await db.backups.toArray()).sort(newestFirst);
}

export const loadDatabase = openWorkspace;
export const saveDatabase = persistWorkspace;
