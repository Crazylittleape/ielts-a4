import type { AppState } from './lib';
import type { PersonalCalendar, ReviewScope } from './calendar';
import { BOOK_GROUPS } from './bookCatalog';
import { dailyPlan, getBookProgress } from './book';

/** Today's numbers, all derived from stored words, review logs and book progress. */
export interface DailyReport { reviewed: number; remembered: number; learnedWords: number; learnedGroups: number; focusDue: number; allDue: number }

export type NextStep =
  | { kind: 'a4'; scope: ReviewScope; count: number }
  | { kind: 'book'; groupId: string; label: string; words: number; resume: boolean }
  | { kind: 'rest' };

export function dailyReport(state: AppState, calendar: PersonalCalendar, today: string): DailyReport {
  const done = calendar.all[today]?.done ?? [];
  const last = new Map<string, number>();
  for (const log of state.revlog) if (log.day === today && log.rating > 0) last.set(log.wordId, log.rating);
  const learned = calendar.learning[today];
  return {
    reviewed: done.length,
    remembered: done.filter(id => (last.get(id) ?? 0) >= 3).length,
    learnedWords: learned?.words ?? 0,
    learnedGroups: learned?.groups ?? 0,
    focusDue: calendar.focus[today]?.due.length ?? 0,
    allDue: calendar.all[today]?.due.length ?? 0
  };
}

/** One real next action: due A4 words first, then other due cards, then the book. */
export function nextStep(state: AppState, report: DailyReport, today: string): NextStep {
  if (report.focusDue) return { kind: 'a4', scope: 'focus', count: report.focusDue };
  if (report.allDue) return { kind: 'a4', scope: 'all', count: report.allDue };
  const activeId = getBookProgress(state).active?.groupId;
  const active = activeId ? BOOK_GROUPS.find(group => group.id === activeId) : undefined;
  const group = active ?? dailyPlan(state, today).remainingGroups[0];
  if (!group) return { kind: 'rest' };
  return { kind: 'book', groupId: group.id, label: `${group.unitTitle} · 第 ${group.index} 组`, words: group.words.length, resume: Boolean(active) };
}
