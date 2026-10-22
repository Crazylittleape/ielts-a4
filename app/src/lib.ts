import { createEmptyCard, fsrs, Rating, State, type Card } from 'ts-fsrs';
import { BOOK, BOOK_GROUPS } from './bookCatalog';

export const STORAGE_KEY = 'ielts_a4_workspace_v2';
export const LEGACY_KEY = 'ielts_a4_workspace_v1';
export const INTERVALS = [1, 2, 4, 7, 15, 30];
export const MAX_STAGE = INTERVALS.length - 1;
export const STAGE_LABELS = ['迁移 S0', '迁移 S1', '迁移 S2', '迁移 S3', '迁移 S4', '迁移 S5'];
export type SerializedCard = Omit<Card, 'due' | 'last_review'> & { due: string; last_review?: string };
export interface ReviewEntry { id: string; wordId: string; day: string; rating: 0 | 1 | 2 | 3 | 4; log: Record<string, unknown> };

export interface WordItem {
  id: string;
  word: string;
  phonetic: string;
  meaning: string;
  synonyms: string;
  createdAt: string;
  stage: number;
  nextReviewDate: string;
  reviewHistory: string[];
  isHard: boolean;
  tag?: string;
  card?: SerializedCard;
  isFavorite?: boolean;
  isMastered?: boolean;
  favorite?: boolean;
  mastered?: boolean;
  focus?: { active: boolean; addedAt: string; nextDate: string; reason?: string };
}

export interface WordFields {
  word: string;
  meaning: string;
  phonetic?: string;
  synonyms?: string;
  tag?: string;
}

export interface AppState {
  revlog: ReviewEntry[];
  words: WordItem[];
  skipped: string[];
  settings: { dailyClaim: number; lastClaimDate: string };
  bookLearning?: BookLearning;
}

export interface BookLearning {
  bookId: string;
  dailyGroups: number;
  completed: Record<string, string>;
  active?: { groupId: string; seen: number; round?: 0 | 1 | 2; retry?: number[]; inRetry?: boolean };
}

export const pad2 = (n: number) => String(n).padStart(2, '0');

export function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseDate(s: string): Date {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function todayStr(): string {
  return formatDate(new Date());
}

export function addDays(s: string, n: number): string {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return formatDate(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseDate(a).getTime() - parseDate(b).getTime()) / 86400000);
}

export function isValidDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return formatDate(parseDate(s)) === s;
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function uniqSorted(arr: string[]): string[] {
  return Array.from(new Set(arr)).sort();
}

const scheduler = fsrs({ enable_short_term: false, enable_fuzz: false });

function serializeCard(card: Card): SerializedCard {
  return { ...card, due: card.due.toISOString(), last_review: card.last_review?.toISOString() };
}

export function migrateCard(w: WordItem): SerializedCard {
  if (w.card) return w.card;
  const card = createEmptyCard(parseDate(w.nextReviewDate));
  const reviews = w.reviewHistory.filter((h) => h !== w.createdAt);
  if (reviews.length) {
    card.reps = reviews.length;
    card.stability = INTERVALS[w.stage];
    card.difficulty = 5;
    card.state = State.Review;
    card.last_review = parseDate(reviews[reviews.length - 1]);
    card.scheduled_days = Math.max(1, diffDays(w.nextReviewDate, reviews[reviews.length - 1]));
  }
  return serializeCard(card);
}

function hydrateCard(w: WordItem): Card {
  const c = migrateCard(w);
  return { ...c, due: new Date(c.due), last_review: c.last_review ? new Date(c.last_review) : undefined };
}

export function isDueOn(w: WordItem, day: string): boolean {
  return !w.isMastered && !w.mastered && w.nextReviewDate <= day && !w.reviewHistory.includes(day);
}

function scheduleReview(w: WordItem, day: string, rating: 1 | 2 | 3 | 4): { word: WordItem; log: Record<string, unknown> } {
  const result = scheduler.next(hydrateCard(w), parseDate(day), rating as Rating.Again | Rating.Hard | Rating.Good | Rating.Easy);
  // A4 is a daily worksheet: even Again is reviewed on the next local day.
  const dueDay = formatDate(result.card.due) > day ? formatDate(result.card.due) : addDays(day, 1);
  result.card.due = parseDate(dueDay);
  const focus = w.focus?.active ? { ...w.focus, active: rating <= 2, nextDate: dueDay } : w.focus;
  return {
    word: { ...w, card: serializeCard(result.card), nextReviewDate: dueDay, reviewHistory: uniqSorted([...w.reviewHistory, day]), isHard: w.isHard || result.card.lapses >= 4, ...(focus ? { focus } : {}) },
    log: JSON.parse(JSON.stringify(result.log)) as Record<string, unknown>
  };
}

export function addToFocus(w: WordItem, day: string, reason = '词书复习薄弱'): WordItem {
  const nextDate = addDays(day, 1);
  const existing = w.focus;
  const due = w.nextReviewDate > nextDate ? nextDate : w.nextReviewDate;
  return { ...w, nextReviewDate: due, focus: { active: true, addedAt: existing?.addedAt ?? day, nextDate, reason: existing?.reason ?? reason } };
}

export function isFocusDueOn(w: WordItem, day: string): boolean {
  return Boolean(w.focus?.active && w.focus.nextDate <= day && !w.reviewHistory.includes(day));
}

export function completeReview(w: WordItem, day: string): WordItem {
  return isDueOn(w, day) ? scheduleReview(w, day, 3).word : w;
}

export function gradeWord(state: AppState, id: string, day: string, rating: 1 | 2 | 3 | 4): AppState {
  if (!isValidDate(day) || ![1, 2, 3, 4].includes(rating)) throw new Error('无效的复习日期或评分');
  const word = state.words.find((w) => w.id === id);
  // The active word schedule is authoritative. Imported logs are audit history
  // and must not block a still-due local card. isDueOn also deduplicates grades.
  if (!word || !isDueOn(word, day)) return state;
  const next = scheduleReview(word, day, rating);
  return { ...state, words: state.words.map((w) => w.id === id ? next.word : w), revlog: [...state.revlog, { id: uid(), wordId: id, day, rating, log: next.log }] };
}

export function hardReset(w: WordItem, day: string): WordItem {
  const due = addDays(day, 1);
  return { ...w, isHard: true, stage: 0, nextReviewDate: due, card: serializeCard(createEmptyCard(parseDate(due))) };
}

export function resetWord(state: AppState, id: string, day: string): AppState {
  if (!isValidDate(day)) throw new Error('无效的复习日期');
  const word = state.words.find((w) => w.id === id);
  if (!word) return state;
  // Deduplicate against the actual reset card, not imported reset audit logs.
  if (word.isHard && word.nextReviewDate === addDays(day, 1) && word.card?.state === State.New && word.card.reps === 0) return state;
  return { ...state, words: state.words.map((w) => w.id === id ? hardReset(w, day) : w), revlog: [...state.revlog, { id: uid(), wordId: id, day, rating: 0, log: { action: 'reset' } }] };
}

export function createWord(f: WordFields, day: string): WordItem {
  return {
    id: uid(),
    card: serializeCard(createEmptyCard(parseDate(addDays(day, 1)))),
    isFavorite: false,
    isMastered: false,
    word: f.word.trim(),
    phonetic: (f.phonetic || '').trim(),
    meaning: f.meaning.trim(),
    synonyms: (f.synonyms || '').trim(),
    createdAt: day,
    stage: 0,
    nextReviewDate: addDays(day, INTERVALS[0]),
    reviewHistory: [day],
    isHard: false,
    tag: (f.tag || '').trim() || undefined
  };
}

export function normalizeWord(raw: unknown, fallbackDay: string): WordItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const word = typeof r.word === 'string' ? r.word.trim() : '';
  const meaning = typeof r.meaning === 'string' ? r.meaning.trim() : '';
  if (!word || !meaning) return null;
  const createdAt = isValidDate(r.createdAt) ? r.createdAt : fallbackDay;
  let stage = Number(r.stage);
  if (!Number.isFinite(stage)) stage = 0;
  stage = Math.max(0, Math.min(MAX_STAGE, Math.floor(stage)));
  const history = Array.isArray(r.reviewHistory) ? r.reviewHistory.filter(isValidDate) : [];
  const nextReviewDate = isValidDate(r.nextReviewDate) ? r.nextReviewDate : addDays(createdAt, INTERVALS[stage]);
  return {
    id: typeof r.id === 'string' && r.id ? r.id : uid(),
    word,
    phonetic: typeof r.phonetic === 'string' ? r.phonetic.trim() : '',
    meaning,
    synonyms: typeof r.synonyms === 'string' ? r.synonyms.trim() : '',
    createdAt,
    stage,
    nextReviewDate,
    reviewHistory: uniqSorted(history.length ? history : [createdAt]),
    isHard: Boolean(r.isHard),
    tag: typeof r.tag === 'string' && r.tag.trim() ? r.tag.trim() : undefined,
    card: r.card as SerializedCard | undefined,
    isFavorite: Boolean(r.isFavorite ?? r.favorite),
    isMastered: Boolean(r.isMastered ?? r.mastered),
    focus: isRecord(r.focus) && typeof r.focus.active === 'boolean' && isValidDate(r.focus.addedAt) && isValidDate(r.focus.nextDate)
      ? { active: r.focus.active, addedAt: r.focus.addedAt, nextDate: r.focus.nextDate, ...(typeof r.focus.reason === 'string' ? { reason: r.focus.reason } : {}) }
      : undefined
  };
}

export interface DaySchedule {
  done: string[];
  due: { id: string; stage: number; overdue: boolean }[];
  planned: { id: string; stage: number }[];
  added: string[];
}

export function buildSchedule(words: WordItem[], today: string, horizonDays = 240): Record<string, DaySchedule> {
  const map: Record<string, DaySchedule> = {};
  const get = (d: string) => map[d] || (map[d] = { done: [], due: [], planned: [], added: [] });
  const end = addDays(today, horizonDays);
  words.forEach((w) => {
    get(w.createdAt).added.push(w.id);
    w.reviewHistory.forEach((h) => {
      if (h !== w.createdAt) get(h).done.push(w.id);
    });
    if (w.isMastered || w.mastered) return;
    if (isDueOn(w, today)) get(today).due.push({ id: w.id, stage: w.stage, overdue: w.nextReviewDate < today });
    else if (w.nextReviewDate > today && w.nextReviewDate <= end) get(w.nextReviewDate).planned.push({ id: w.id, stage: w.stage });
  });
  return map;
}

const CJK = /[\u3400-\u9fff\uf900-\ufaff]/;

export function parseBatchLine(line: string): WordFields | null {
  let s = line.trim().replace(/^\d+[.、)\]]\s*/, '');
  if (!s) return null;
  let phonetic = '';
  const ph = s.match(/\/[^/]{1,60}\/|\[[^\]]{1,60}\]/);
  if (ph && /[ˈˌːəɪʊæɒɔɑʌɜðθŋʃʒ]/.test(ph[0])) {
    phonetic = ph[0].replace(/^\[|\]$/g, '').replace(/^\/|\/$/g, '');
    phonetic = `/${phonetic}/`;
    s = s.replace(ph[0], ' ').replace(/\s+/g, ' ').trim();
  }
  let parts: string[];
  if (s.includes('\t')) parts = s.split('\t');
  else if (/\s[-–—]\s|^[^\s]+[-–—]\s|\s[-–—][^\s]/.test(s) && /[-–—]/.test(s)) parts = s.split(/\s*[-–—]\s*/);
  else if (/[:：]/.test(s)) parts = s.split(/\s*[:：]\s*/);
  else if (/\s{2,}/.test(s)) parts = s.split(/\s{2,}/);
  else {
    const m = s.match(/^([A-Za-z][A-Za-z'’\- ]*?)\s+(.*)$/);
    if (!m) return null;
    parts = [m[1], m[2]];
  }
  parts = parts.map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const word = parts[0];
  if (!/^[A-Za-z][A-Za-z'’\- ]*$/.test(word)) return null;
  let meaning = parts[1];
  let synonyms = parts.slice(2).join(', ');
  if (!synonyms) {
    const m2 = meaning.match(/^(.*[\u3400-\u9fff\uf900-\ufaff）)】」；，])\s*[-–—]?\s*([A-Za-z][A-Za-z ,;'’\-/]*[A-Za-z])$/);
    if (m2 && CJK.test(m2[1])) {
      meaning = m2[1].trim().replace(/[；，]$/, '');
      synonyms = m2[2].trim();
    }
  }
  if (!meaning) return null;
  return { word, meaning, phonetic, synonyms };
}

export interface BatchResult {
  items: WordFields[];
  duplicates: string[];
  invalid: string[];
}

export function parseBatchText(text: string, existing: WordItem[]): BatchResult {
  const have = new Set(existing.map((w) => w.word.toLowerCase()));
  const seen = new Set<string>();
  const items: WordFields[] = [];
  const duplicates: string[] = [];
  const invalid: string[] = [];
  text.split(/\r?\n/).forEach((line) => {
    if (!line.trim()) return;
    const f = parseBatchLine(line);
    if (!f) {
      invalid.push(line.trim());
      return;
    }
    const k = f.word.toLowerCase();
    if (have.has(k) || seen.has(k)) {
      duplicates.push(f.word);
      return;
    }
    seen.add(k);
    items.push(f);
  });
  return { items, duplicates, invalid };
}

export function seedWords(today: string): WordItem[] {
  const d0 = today;
  const d1 = addDays(today, -1);
  const d3 = addDays(today, -3);
  const mk = (f: WordFields, created: string, stage: number, next: string, history: string[], isHard = false): WordItem => ({
    ...createWord(f, created),
    card: undefined,
    stage,
    nextReviewDate: next,
    reviewHistory: uniqSorted(history),
    isHard
  });
  return [
    mk({ word: 'ubiquitous', phonetic: '/juːˈbɪk.wɪ.təs/', meaning: 'adj. 无处不在的，普遍存在的', synonyms: 'pervasive, omnipresent' }, d3, 1, d0, [d3, addDays(d3, 1)]),
    mk({ word: 'mitigate', phonetic: '/ˈmɪt.ɪ.ɡeɪt/', meaning: 'v. 缓解，减轻（严重性）', synonyms: 'alleviate, ease, relieve' }, d3, 1, d0, [d3, addDays(d3, 1)]),
    mk({ word: 'exacerbate', phonetic: '/ɪɡˈzæs.ə.beɪt/', meaning: 'v. 使恶化，使加剧', synonyms: 'aggravate, worsen' }, d3, 0, d0, [d3, addDays(d3, 1)], true),
    mk({ word: 'deteriorate', phonetic: '/dɪˈtɪə.ri.ə.reɪt/', meaning: 'v. 恶化，变坏，退化', synonyms: 'decline, degenerate, worsen' }, d1, 0, d0, [d1]),
    mk({ word: 'sedentary', phonetic: '/ˈsed.ən.tər.i/', meaning: 'adj. 久坐的，缺乏运动的', synonyms: 'inactive, desk-bound' }, d1, 0, d0, [d1]),
    mk({ word: 'detrimental', phonetic: '/ˌdet.rɪˈmen.təl/', meaning: 'adj. 有害的，不利的', synonyms: 'harmful, damaging, adverse' }, d1, 0, d0, [d1]),
    mk({ word: 'compelling', phonetic: '/kəmˈpel.ɪŋ/', meaning: 'adj. 令人信服的；引人入胜的', synonyms: 'convincing, persuasive, gripping' }, d0, 0, addDays(d0, 1), [d0]),
    mk({ word: 'inevitable', phonetic: '/ɪˈnev.ɪ.tə.bəl/', meaning: 'adj. 不可避免的，必然发生的', synonyms: 'unavoidable, inescapable' }, d0, 0, addDays(d0, 1), [d0])
  ];
}

export const DEFAULT_SETTINGS = { dailyClaim: 30, lastClaimDate: '' };

export function initialState(today: string): AppState {
  return { words: seedWords(today).map((w) => ({ ...w, card: migrateCard(w) })), skipped: [], settings: { ...DEFAULT_SETTINGS }, revlog: [] };
}

export function loadState(today: string): { state: AppState; fresh: boolean } {
  const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY);
  if (raw !== null) return { state: parseBackup(raw, today), fresh: false };
  return { state: initialState(today), fresh: true };
}

export function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, backupJson(state));
}

export function backupJson(state: AppState): string {
  return JSON.stringify({ app: 'ielts-a4-workspace', version: 3, exportedAt: new Date().toISOString(), ...state }, null, 2);
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isTimestamp = (value: unknown): value is string => typeof value === 'string' && value.length > 10 && Number.isFinite(Date.parse(value));

function validCard(value: unknown): value is SerializedCard {
  if (!isRecord(value) || !isTimestamp(value.due) || (value.last_review !== undefined && !isTimestamp(value.last_review))) return false;
  const fields = ['stability', 'difficulty', 'elapsed_days', 'scheduled_days', 'learning_steps', 'reps', 'lapses'];
  return fields.every((key) => typeof value[key] === 'number' && Number.isFinite(value[key]) && Number(value[key]) >= 0) && typeof value.state === 'number' && [0, 1, 2, 3].includes(value.state) && Number(value.difficulty) <= 10 && (Number(value.reps) === 0 || isTimestamp(value.last_review)) && ['reps', 'lapses', 'scheduled_days', 'learning_steps'].every((key) => Number.isInteger(Number(value[key])));
}

function parseBookLearning(value: unknown): BookLearning {
  if (!isRecord(value) || value.bookId !== BOOK.id || typeof value.dailyGroups !== 'number' || !Number.isInteger(value.dailyGroups) || value.dailyGroups < 1 || value.dailyGroups > 10 || !isRecord(value.completed)) throw new Error('词书学习设置无效');
  const completed: Record<string, string> = {};
  const count = Object.keys(value.completed).length;
  if (count > BOOK_GROUPS.length) throw new Error('词书完成记录无效');
  for (const [i, group] of BOOK_GROUPS.entries()) {
    const day = value.completed[group.id];
    if (i < count) {
      if (!isValidDate(day)) throw new Error('词书完成记录必须按组顺序保存，且日期有效');
      completed[group.id] = day;
    } else if (day !== undefined) throw new Error('词书完成记录必须按组顺序保存');
  }
  const progress: BookLearning = { bookId: BOOK.id, dailyGroups: value.dailyGroups, completed };
  if (value.active !== undefined) {
    const active = value.active;
    const next = BOOK_GROUPS[count];
    if (!isRecord(active) || !next || active.groupId !== next.id || typeof active.seen !== 'number' || !Number.isInteger(active.seen) || active.seen < 0 || active.seen > next.words.length) throw new Error('词书学习位置无效');
    const seen = active.seen;
    const round = active.round === undefined ? 0 : active.round;
    const retry = active.retry === undefined ? [] : active.retry;
    const inRetry = active.inRetry === undefined ? false : active.inRetry;
    if (typeof round !== 'number' || ![0, 1, 2].includes(round) || !Array.isArray(retry) || retry.some(index => typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= next.words.length) || new Set(retry).size !== retry.length || typeof inRetry !== 'boolean' || (inRetry ? seen !== next.words.length || retry.length === 0 : seen >= next.words.length || retry.some(index => index >= seen))) throw new Error('词书学习轮次或重试记录无效');
    progress.active = { groupId: next.id, seen, ...(active.round === undefined ? {} : { round: round as 0 | 1 | 2 }), ...(active.retry === undefined ? {} : { retry }), ...(active.inRetry === undefined ? {} : { inRetry }) };
  }
  return progress;
}

export function parseBackup(text: string, today: string): AppState {
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed) && !isRecord(parsed)) throw new Error('备份格式无效');
  const obj = isRecord(parsed) ? parsed : {};
  if (obj.version !== undefined && ![1, 2, 3].includes(Number(obj.version))) throw new Error('暂不支持这个备份版本');
  const strict = obj.version === 3;
  const arr = Array.isArray(parsed) ? parsed : obj.words;
  if (!Array.isArray(arr)) throw new Error('JSON 里找不到 words 数组');
  const ids = new Set<string>();
  const names = new Set<string>();
  const words = arr.map((raw, index) => {
    const w = normalizeWord(raw, today);
    if (!w || !isRecord(raw)) throw new Error(`第 ${index + 1} 个单词无效，未导入任何数据`);
    if (strict && (typeof raw.id !== 'string' || !raw.id || !isValidDate(raw.createdAt) || !isValidDate(raw.nextReviewDate) || !Array.isArray(raw.reviewHistory) || !raw.reviewHistory.every(isValidDate) || typeof raw.isHard !== 'boolean' || typeof raw.stage !== 'number' || !Number.isInteger(raw.stage) || raw.stage < 0 || raw.stage > MAX_STAGE || ['phonetic', 'synonyms'].some((k) => typeof raw[k] !== 'string') || (raw.tag !== undefined && typeof raw.tag !== 'string') || (raw.card !== undefined && !validCard(raw.card)) || ['isFavorite', 'isMastered', 'favorite', 'mastered'].some((k) => raw[k] !== undefined && typeof raw[k] !== 'boolean'))) throw new Error(`第 ${index + 1} 个单词的日期或调度数据无效`);
    if (ids.has(w.id) || names.has(w.word.toLowerCase())) throw new Error('备份包含重复单词或 ID');
    ids.add(w.id); names.add(w.word.toLowerCase());
    // Legacy versions did not contain FSRS cards; history and due dates are retained.
    w.card = strict && raw.card ? raw.card as SerializedCard : migrateCard({ ...w, card: undefined });
    if (!strict) { w.isFavorite = Boolean(raw.isFavorite ?? raw.favorite); w.isMastered = Boolean(raw.isMastered ?? raw.mastered); }
    return w;
  });
  if (strict && (!Array.isArray(obj.skipped) || !Array.isArray(obj.revlog) || !isRecord(obj.settings))) throw new Error('备份缺少词桶、复习日志或设置');
  if (obj.skipped !== undefined && (!Array.isArray(obj.skipped) || !obj.skipped.every((v) => typeof v === 'string'))) throw new Error('跳过词表无效');
  const settings = { ...DEFAULT_SETTINGS };
  if (obj.settings !== undefined) {
    if (!isRecord(obj.settings)) throw new Error('设置无效');
    const { dailyClaim, lastClaimDate } = obj.settings;
    if (dailyClaim !== undefined && (typeof dailyClaim !== 'number' || !Number.isInteger(dailyClaim) || dailyClaim < 1 || dailyClaim > 500)) throw new Error('每日新词目标无效');
    if (lastClaimDate !== undefined && lastClaimDate !== '' && !isValidDate(lastClaimDate)) throw new Error('领取日期无效');
    if (strict && (dailyClaim === undefined || lastClaimDate === undefined)) throw new Error('设置缺少字段');
    settings.dailyClaim = dailyClaim as number ?? DEFAULT_SETTINGS.dailyClaim;
    settings.lastClaimDate = lastClaimDate as string ?? '';
  }
  const logIds = new Set<string>();
  const revlog: ReviewEntry[] = [];
  if (strict) for (const entry of obj.revlog as unknown[]) {
    if (!isRecord(entry) || typeof entry.id !== 'string' || !entry.id || logIds.has(entry.id) || typeof entry.wordId !== 'string' || !ids.has(entry.wordId) || !isValidDate(entry.day) || ![0, 1, 2, 3, 4].includes(Number(entry.rating)) || typeof entry.rating !== 'number' || !isRecord(entry.log)) throw new Error('复习日志无效');
    const log = entry.log;
    if (entry.rating === 0 ? log.action !== 'reset' : !isTimestamp(log.review) || !isTimestamp(log.due) || log.rating !== entry.rating || typeof log.state !== 'number' || ![0, 1, 2, 3].includes(log.state) || ['stability', 'difficulty', 'elapsed_days', 'last_elapsed_days', 'scheduled_days', 'learning_steps'].some((key) => typeof log[key] !== 'number' || !Number.isFinite(log[key]) || Number(log[key]) < 0)) throw new Error('复习日志内容无效');
    logIds.add(entry.id); revlog.push(entry as unknown as ReviewEntry);
  }
  return { words, skipped: Array.isArray(obj.skipped) ? uniqSorted(obj.skipped as string[]) : [], settings, revlog, ...(obj.bookLearning === undefined ? {} : { bookLearning: parseBookLearning(obj.bookLearning) }) };
}

function mergeBookLearning(current?: BookLearning, incoming?: BookLearning): BookLearning | undefined {
  if (!current && !incoming) return undefined;
  const completed = { ...current?.completed };
  for (const [id, date] of Object.entries(incoming?.completed ?? {})) {
    if (!completed[id] || date < completed[id]) completed[id] = date;
  }
  const next = BOOK_GROUPS.find(group => !completed[group.id]);
  const cursors = [current?.active, incoming?.active].filter((cursor): cursor is NonNullable<BookLearning['active']> => Boolean(cursor && cursor.groupId === next?.id));
  cursors.sort((a, b) => (b.round ?? 0) - (a.round ?? 0) || Number(b.inRetry ?? false) - Number(a.inRetry ?? false) || b.seen - a.seen);
  const active = cursors[0] ? { ...cursors[0] } : undefined;
  if (active) {
    const retry = [...new Set(cursors.filter(cursor => (cursor.round ?? 0) === (active.round ?? 0)).flatMap(cursor => cursor.retry ?? []))];
    if (retry.length || active.retry !== undefined) active.retry = retry;
  }
  return { bookId: BOOK.id, dailyGroups: current?.dailyGroups ?? incoming?.dailyGroups ?? 2, completed, ...(active ? { active: { ...active } } : {}) };
}

export function mergeStates(current: AppState, incoming: AppState): AppState {
  const words = current.words.slice();
  const byName = new Map(words.map((w) => [w.word.toLowerCase(), w]));
  const usedIds = new Set(words.map((w) => w.id));
  const mapped = new Map<string, string>();
  for (const word of incoming.words) {
    const existing = byName.get(word.word.toLowerCase());
    if (existing) {
      mapped.set(word.id, existing.id);
      // Keep the current card, due date and history as one coherent schedule.
      // Incoming raw logs remain available for audit/backup, without rescheduling.
      continue;
    }
    const id = usedIds.has(word.id) ? uid() : word.id;
    const next = { ...word, id }; words.push(next); byName.set(word.word.toLowerCase(), next); usedIds.add(id); mapped.set(word.id, id);
  }
  const revlog = current.revlog.slice();
  const seen = new Set(revlog.map((l) => l.id));
  const signatures = new Set(revlog.map((l) => `${l.wordId}|${l.day}|${l.rating}|${JSON.stringify(l.log)}`));
  for (const entry of incoming.revlog) {
    const wordId = mapped.get(entry.wordId);
    if (!wordId) continue;
    const signature = `${wordId}|${entry.day}|${entry.rating}|${JSON.stringify(entry.log)}`;
    if (signatures.has(signature)) continue;
    revlog.push({ ...entry, wordId, id: seen.has(entry.id) ? uid() : entry.id });
    seen.add(revlog[revlog.length - 1].id); signatures.add(signature);
  }
  const bookLearning = mergeBookLearning(current.bookLearning, incoming.bookLearning);
  return { ...current, words, skipped: uniqSorted([...current.skipped, ...incoming.skipped]), revlog, ...(bookLearning ? { bookLearning } : {}) };
}

export const mergeBackup = mergeStates;

let voiceCache: SpeechSynthesisVoice | null = null;

function pickVoice(): SpeechSynthesisVoice | null {
  if (voiceCache) return voiceCache;
  const voices = window.speechSynthesis.getVoices();
  const gb = voices.filter((v) => /en[-_]GB/i.test(v.lang));
  const preferred = gb.find((v) => /Daniel|Kate|Serena|Google UK English Female|Google UK English Male|Martha|Arthur/i.test(v.name)) || gb[0];
  voiceCache = preferred || voices.find((v) => /^en/i.test(v.lang)) || null;
  return voiceCache;
}

export function speak(text: string): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-GB';
    u.rate = 0.88;
    u.pitch = 1;
    const v = pickVoice();
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    voiceCache = null;
    pickVoice();
  };
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function weekdayCN(d: Date): string {
  return ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
}
