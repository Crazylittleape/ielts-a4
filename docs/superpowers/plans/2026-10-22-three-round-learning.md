# Three-round learning implementation plan

> **For agentic workers:** Use subagent-driven-development for core implementation and independent review. The user approved three full rounds; do not add a redundant permission pause.

**Goal:** Train each book group through English recall, phonetic recall and Chinese-to-English spelling, with retry and resume.

**Architecture:** Keep the existing book catalog and FSRS cards. Extend only the active learning cursor and use the existing transactional snapshot. A small fixed-three-round model replaces the single seen-pass completion; no configurable workflow engine.

**Tech Stack:** React/TypeScript, Dexie, ts-fsrs, Vitest, Playwright.

### Core and persistence

Files:`app/src/book.ts`, `app/src/lib.ts`, `app/src/book.test.ts` (db.ts only if necessary).

- [x] Write meaningful failing tests for75-step completion, wrong-answer retries, mode validation, spelling normalization, legacy active cursors, backup/merge/reload and reviewed-card preservation.
- [x] Run focused Vitest tests and observe failure before implementation.
- [x] Export `getBookQuestion(state)`, `checkBookSpelling(expected,typed)`, `answerBookQuestion(state,today,answer)`. Answers are `{kind:'recall',remembered:boolean}` or `{kind:'spelling',text:string}`. English/phonetic rounds require recall answers; spelling round requires text. Empty spelling means forgotten. `getBookQuestion` returns word fields, wordIndex, kind, zero-based round, inRetry and pendingRetries.
- [x] Extend active state with optional round/retry/inRetry, retaining seen and legacy shape. Preserve completed groups; validate retries and conservatively merge same-round failures.
- [x] Keep first-study card creation at final group completion and never mutate reviewed cards or review logs during attempts. Run all core tests.

### UI and browser verification

Files:`app/src/BookView.tsx`, `app/src/App.tsx`, `app/tests/workspace.spec.ts`.

- [x] Update browser expectations to three rounds and add cue-hiding, forgotten-answer retry and spelling feedback cases; observe their failure on the old preview.
- [x] Replace reveal/confirm with remembered/forgot for rounds1–2 and submit/feedback/continue for round3. Keep hidden targets out of accessible names. Label missing-phonetic fallback explicitly. Show round and retry progress and retain failed-save input/feedback.
- [x] Build and run mobile Chromium/WebKit tests. Inspect screenshots for recall, phonetic cue and spelling, including the mobile keyboard input layout.

### Review and handoff

- [x] Run independent spec and quality reviews, fix actionable findings and rerun affected checks.
- [x] Update CONTINUE, source notices and source/preview ZIPs plus Devin handoff and hashes. Bump app service-worker cache for preview release. Commit/push only the development branch; keep production root intact.
