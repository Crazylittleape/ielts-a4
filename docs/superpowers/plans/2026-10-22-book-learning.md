# Book-first learning implementation plan

> **For agentic workers:** Use subagent-driven-development for the core implementation and independent review. Continue through verification without an additional approval pause; the user approved this product model and requested a development branch for Devin.

**Goal:** Learn 《雅思词汇真经》 through its 22 chapters, in ordered groups of 25, with durable progress and a daily group target.

**Architecture:** Keep the existing FSRS word records intact. Store explicit book completion and an active study cursor separately in the same transactional IndexedDB snapshot; opening or importing a word never implies book completion. Use the current 3,630-word deduplicated transcription, mapped to chapter boundaries from a pinned public transcription; label the edition accurately.

**Tech Stack:** React, TypeScript, Dexie, ts-fsrs, Vitest, Playwright.

### 1. Catalog and learning state

Files: `app/src/data/book-units.json`, `app/src/bookCatalog.ts`, `app/src/book.ts`, `app/src/book.test.ts`, `app/src/lib.ts`, `app/src/db.ts`, `app/src/core.test.ts`, `app/package.json`.

- [x] Add failing tests for chapter coverage/order, 25-word groups, chapter tails, daily two-group planning, completion-only counts, resumable study, duplicate completion, existing card preservation, backup validation/merge and IndexedDB reload.
- [x] Run `rtk proxy npx vitest run src/book.test.ts src/core.test.ts` and confirm the feature tests fail before implementation.
- [x] Generate chapter offsets by aligning the existing sequence to `hefengxian/my-ielts` at `5cef573933663c4673c6e0093f1df04e68018b1a`, keeping all 3,630 words in their current order. Do not copy reference definitions or examples.
- [x] Implement explicit learning state, atomic first-study completion and persistence. Keep the current scheduling record when a word already exists. Add authored definitions for the two known dictionary gaps so no word is skipped.
- [x] Preserve old v1/v2/v3 imports without inventing completed book groups. Validate new fields and preserve them through backup, merge, reload and clearing.
- [x] Run the focused tests and `rtk proxy npm test`; all must pass.

### 2. Book library and study flow

Files: `app/src/BookView.tsx`, `app/src/App.tsx`, `app/src/AddView.tsx`, `app/tests/workspace.spec.ts`.

- [x] Replace the two old artificial-group/claim browser scenarios with failing tests for book overview, units, daily two-group target, opening without completion, individual-word progression, reload and the next ordered group.
- [x] Make the initial screen a book library. Show actual total, learned, remaining, mastery and current chapter/group. Keep FSRS reviews separately accessible. Move manual entry under the learned-word bank; remove the old book-import UI and daily-word claim entry.
- [x] Show chapter lists and groups in order; future groups remain locked until the preceding group is completed. A study card reveals its definition before the learner confirms the word. Persist each confirmed cursor position; add new cards and complete the group only on the final confirmation.
- [x] Allow daily group-count selection, default two groups. Show actual word count for chapter tails. Preserve the existing A4, statistics, games, backup and manual-add flows.
- [x] Run `rtk proxy npm run build` and `rtk proxy npm run test:e2e` on mobile Chromium and WebKit; inspect a mobile screenshot and check horizontal overflow.

### 3. Review and Devin handoff

Files: `docs/CONTINUE.md`, `docs/V3-PLAN.md`, `docs/BOOK-SOURCE.md`, output handoffs and ZIPs.

- [x] Review requirements and persistence safety; resolve actionable findings and rerun the affected checks.
- [x] Record the chapter provenance, deduplication boundary and remaining source uncertainties. Update handoff instructions to use daily groups, not the obsolete 30-word claim model.
- [x] Produce source/preview artifacts and a screenshot under the workspace `outputs/` folder.
- [x] Commit and push `codex/continue-v3`. Keep root production files and GitHub Pages deployment unchanged, as the user requested.
