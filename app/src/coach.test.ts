import { describe, expect, it } from 'vitest';
import { buildCalendar } from './calendar';
import { createWord, gradeWord, type AppState } from './lib';
import { beginGroup } from './book';
import { BOOK_GROUPS } from './bookCatalog';
import { dailyReport, nextStep } from './coach';

const today = '2026-10-22';
const due = (word: string, extra = {}) => ({ ...createWord({ word, meaning: `${word} 释义` }, '2026-10-20'), nextReviewDate: today, ...extra });
const base = (words: AppState['words'] = []): AppState => ({ words, revlog: [], skipped: [], settings: { dailyClaim: 30, lastClaimDate: '' } });
const report = (s: AppState) => dailyReport(s, buildCalendar(s, today), today);

describe('daily report', () => {
  it('is all zero for a new user and writes nothing', () => {
    const s = base();
    expect(report(s)).toEqual({ reviewed: 0, remembered: 0, learnedWords: 0, learnedGroups: 0, focusDue: 0, allDue: 0 });
    expect(s.words).toHaveLength(0);
  });
  it('counts reviewed words once and remembered from the saved rating (a second same-day grade is ignored)', () => {
    let s = base([due('a'), due('b'), due('c')]);
    const [a, b] = s.words;
    s = gradeWord(s, a.id, today, 3);
    s = gradeWord(s, a.id, today, 1);
    s = gradeWord(s, b.id, today, 1);
    const r = report(s);
    expect(r.reviewed).toBe(2);
    expect(r.remembered).toBe(1);
    expect(r.allDue).toBe(s.words.filter(w => w.nextReviewDate <= today).length);
  });
  it('counts today\'s finished book groups from the real progress record', () => {
    const g = BOOK_GROUPS[0];
    const s = { ...base(), bookLearning: { bookId: 'x', dailyGroups: 2, completed: { [g.id]: today, [BOOK_GROUPS[1].id]: '2026-10-21' } } };
    expect(report(s)).toMatchObject({ learnedGroups: 1, learnedWords: g.words.length });
  });
});

describe('next step', () => {
  it('prefers A4 focus, then all due, then the book, then rest', () => {
    const focus = due('f', { focus: { active: true, addedAt: '2026-10-21', nextDate: today } });
    let s = base([due('a'), focus]);
    expect(nextStep(s, report(s), today)).toEqual({ kind: 'a4', scope: 'focus', count: 1 });
    s = base([due('a')]);
    expect(nextStep(s, report(s), today)).toEqual({ kind: 'a4', scope: 'all', count: 1 });
    s = base();
    expect(nextStep(s, report(s), today)).toMatchObject({ kind: 'book', groupId: BOOK_GROUPS[0].id, resume: false });
    s = beginGroup(base(), BOOK_GROUPS[0].id);
    expect(nextStep(s, report(s), today)).toMatchObject({ kind: 'book', groupId: BOOK_GROUPS[0].id, resume: true });
    s = { ...base(), bookLearning: { bookId: 'x', dailyGroups: 1, completed: { [BOOK_GROUPS[0].id]: today } } };
    expect(nextStep(s, report(s), today)).toEqual({ kind: 'rest' });
  });
});
