import Dexie, { type Table } from 'dexie';
import { loadState, parseBackup, todayStr, type AppState, type ReviewEntry, type SerializedCard, type WordItem } from './lib';

interface MetaRow { key: string; value: unknown }
interface CardRow { id: string; card: SerializedCard }

class WorkspaceDatabase extends Dexie {
  words!: Table<Omit<WordItem, 'card'>, string>;
  cards!: Table<CardRow, string>;
  revlog!: Table<ReviewEntry, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super('ielts-a4-v3');
    this.version(1).stores({ words: 'id,word,nextReviewDate', cards: 'id', revlog: 'id,wordId,day', meta: 'key' });
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
  const valid = parseBackup(JSON.stringify({ ...state, version: 3 }), todayStr());
  let savedRevision = 0;
  await db.transaction('rw', db.words, db.cards, db.revlog, db.meta, async () => {
    const actual = await db.meta.get('revision');
    if (loadedRevision === null || actual?.value !== loadedRevision) throw new Error('其他标签页已更新学习记录。请刷新后重试，当前操作尚未保存。');
    savedRevision = loadedRevision + 1;
    await writeSnapshot(valid, savedRevision);
  });
  loadedRevision = savedRevision;
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

export const loadDatabase = openWorkspace;
export const saveDatabase = persistWorkspace;
