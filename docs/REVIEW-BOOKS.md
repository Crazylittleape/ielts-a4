# Book-first learning verification (2026-10-22)

Base: `13b5cbfbdb509c9a92dc48c9e37940bfb2200173`.

## Requirements review

Independent review confirmed 22 sourced chapters, ordered chapter-local groups of25 with tails, completion-only learned counts, persistent partial-study cursor, two-group default daily plan, separate mastery, unchanged existing FSRS cards/logs, and old backup compatibility.

The review found one P2: importing a book backup onto a workspace without book progress discarded its daily group target. A regression test reproduced expected5/actual2; the fix keeps the local target when present and otherwise restores the incoming target. The regression and all29 tests passed afterward.

## Code-quality review

Independent review of persistence, backup merging, ordered learning, completion/card creation and UI integration found no blockers. The reviewer independently ran the29 core/content/book tests successfully and verified the target fallback fix.

## Final checks

- `rtk proxy npm test`:29 passed.
- `rtk proxy npm run build`:TypeScript/Vite succeeded.
- `rtk proxy npm run test:e2e -- --reporter=line`:16 passed, eight scenarios each on mobile Chromium and WebKit. Includes target/reload, chapter tail display, opening without credit, partial resume, completion25, next group in order, clearing progress, FSRS, backups, offline and stale-tab protection.
- `rtk proxy git diff --check`:passed.
- Screenshots inspected at390 CSS pixels:book library, overview, unit and revealed study card. Study screen has no horizontal overflow.

Actual iPhone hardware checks remain for Safari speech, Add to Home Screen, standalone launch and storage persistence. No production deployment was performed.
