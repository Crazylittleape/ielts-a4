> Superseded product flow (2026-10-22): use `docs/superpowers/plans/2026-10-22-book-learning.md` and `docs/CONTINUE.md` for current behavior. The original 30-word/daily-claim book flow below is historical; it has been replaced by chapters and fixed groups of 25.

# V3 continuation

Continue Devin session 4689fedb63524b10a48c31625689b913 from recovered v2 source. Preserve A4 mobile styling.

1. Core: daily FSRS (Again/Hard/Good/Easy), Dexie words/cards/revlog/meta, safe one-time v1/v2 migration, validated complete backup merge/replace. Verify migration, idempotent grades, reset persistence, rollback and round trip tests.
2. UI: asynchronous loading/save gate; per-row grades, default Good bulk checkout; favorites/mastered; optional extra practice; 60-second matching game without scheduling writes; heatmap/next seven days. Verify browser interactions, reload persistence and console errors.
3. Content: built-in 3,630 unique English sequence; ECDICT definitions/phonetics; artificial groups of 30, not publisher List boundaries. Record upstream revisions/licenses and unresolved rights. Verify counts and lookup coverage.
4. Delivery: scoped offline cache, production build, mobile Chromium/WebKit QA, branch commit and source/handoff artifacts. Do not replace production until the implementation is reviewed.

## Scheduling assumptions

Use FSRS long-term daily scheduling with short-term learning disabled. New words enter tomorrow. A word receives at most one scheduling grade each local calendar day; extra practice never changes cards or revlog. Bulk completion grades only ungraded due words Good. Manual reset is durable and takes precedence over same-day bulk completion. Imported legacy stages approximate initial stability; old due dates and history remain intact, and are not represented as genuine FSRS reviews. Future calendar uses each card’s next due date only: later dates depend on future grades. Mastered words remain searchable/backupable but are excluded from automated review until restored.
