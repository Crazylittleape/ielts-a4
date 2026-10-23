# Personal Calendar and Paper Implementation Plan

> **For agentic workers:** Execute inline with executing-plans; user has approved implementation and publishing.

**Goal:** Show each browser's real learning history and matching review scopes, with readable warm-white A4 sheets.

**Architecture:** Keep the existing word IDs, FSRS and IndexedDB snapshot. Add a calendar projection over AppState; store focus context on new review logs, and retain legacy history without inferring past focus membership. Dashboard and A4 share the same date/scope selectors.

**Tech Stack:** React, TypeScript, Tailwind, Dexie, Vitest, Playwright, GitHub Pages.

## 1. Calendar data

- [x] Add failing tests in `app/src/calendar.test.ts`: empty initial workspace; two users with different completed groups and focus selections; rating-zero exclusion; legacy history; focus history survives success and backup.
- [x] Run `rtk proxy npx vitest run src/calendar.test.ts` and confirm failures before implementing.
- [x] In `lib.ts`, start fresh workspaces empty, record optional `focus` review context and focus addition dates, preserve existing cards/history on load. Repeated active focus addition returns the same word. New addition schedules the shared card tomorrow; resets keep shared focus due synchronized.
- [x] Add `calendar.ts`: `buildCalendar(state,today)` returns all/focus date maps and completed book group counts; `reviewIds(schedule,date,today)` selects due+done today, done in past, planned in future. Unique word/day counts; no invented future rounds.
- [x] Run focused Vitest plus existing core/book/content tests. Seed only explicit test fixtures where needed.

## 2. Matching views

- [x] App owns `ReviewScope = 'focus' | 'all'`; dashboard actions pass scope and date, tab entry resets to focus.
- [x] Dashboard shows actual initial learning groups/words separately from review and A4; calendar distinguishes real history and future estimates. Date detail uses shared reviewIds and exact matching buttons. Explain local-device storage and legacy unknown focus history.
- [x] A4 uses supplied scope schedule for all dates; pending submission comes only from due IDs. Switching scope clears transient practice/reveal/check state.
- [x] Verify focused UI scenarios for today's all vs focus and tomorrow's selected words.

## 3. Paper and publishing

- [x] Replace paper gradients/ruling with warm-white background, subtle procedural grain, fine border and neutral shadows. Add date/count/source heading, readable rows and footer; use sans Chinese fallback after Times New Roman.
- [x] Bump service worker cache. Run `rtk npm test`, `rtk npm run build`, `rtk npm run test:e2e`; inspect mobile screenshots and overflow.
- [x] Commit and push development branch. Copy verified dist files to existing publishing clone while preserving README. Commit/push main and verify Pages deployment plus live HTML/cache marker.
- [x] Record actual validation and deliver live link; physical iPhone testing remains user validation.

Validation: 42 unit tests, 30 mobile browser checks, production build and screenshot inspection passed. Publishing status is recorded in the chat release report.
