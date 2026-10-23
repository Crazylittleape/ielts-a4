import { BOOK_GROUPS } from './bookCatalog';
import { addDays, isDueOn, type AppState, type DaySchedule } from './lib';

export type ReviewScope = 'focus' | 'all';
export const emptyDay = (): DaySchedule => ({ due: [], done: [], planned: [], added: [] });

/** A4 is a subset of the same FSRS cards; historical focus needs event evidence. */
export function buildCalendar(state: AppState, today: string) {
  const all: Record<string, DaySchedule> = {};
  const focus: Record<string, DaySchedule> = {};
  const learning: Record<string, { groups: number; words: number }> = {};
  const get = (map: Record<string, DaySchedule>, day: string) => map[day] ??= emptyDay();
  const logs = new Map<string, typeof state.revlog>();
  const reviewDays = new Map<string, Set<string>>();
  for (const log of state.revlog) {
    const days = reviewDays.get(log.wordId) ?? new Set<string>();
    days.add(log.day);
    reviewDays.set(log.wordId, days);
    const key = `${log.wordId}|${log.day}`;
    logs.set(key, [...(logs.get(key) ?? []), log]);
  }
  for (const word of state.words) {
    const days = new Set([...word.reviewHistory.filter(day => day !== word.createdAt), ...(reviewDays.get(word.id) ?? [])]);
    for (const day of days) {
      if (day > today) continue;
      const events = logs.get(`${word.id}|${day}`);
      if (events ? events.some(log => log.rating > 0) : word.reviewHistory.includes(day)) get(all, day).done.push(word.id);
      if (events?.some(log => log.rating > 0 && log.focus === true)) get(focus, day).done.push(word.id);
    }
    for (const day of word.focusAddedDays ?? (word.focus ? [word.focus.addedAt] : [])) {
      if (day <= today) get(focus, day).added.push(word.id);
    }
    if (word.isMastered || word.mastered) continue;
    for (const map of word.focus?.active ? [all, focus] : [all]) {
      if (isDueOn(word, today)) get(map, today).due.push({ id: word.id, stage: word.stage, overdue: word.nextReviewDate < today });
      else if (word.nextReviewDate > today && word.nextReviewDate <= addDays(today, 240)) get(map, word.nextReviewDate).planned.push({ id: word.id, stage: word.stage });
    }
  }
  for (const group of BOOK_GROUPS) {
    const day = state.bookLearning?.completed[group.id];
    if (!day || day > today) continue;
    const count = learning[day] ??= { groups: 0, words: 0 };
    count.groups++;
    count.words += group.words.length;
  }
  return { all, focus, learning };
}

export type PersonalCalendar = ReturnType<typeof buildCalendar>;

export function reviewIds(schedule: Record<string, DaySchedule>, date: string, today: string): string[] {
  const day = schedule[date] ?? emptyDay();
  return [...new Set(date < today ? day.done : date > today ? day.planned.map(item => item.id) : [...day.due.map(item => item.id), ...day.done])];
}
