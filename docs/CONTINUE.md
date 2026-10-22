# Continue v3

The source recovered from Devin lives in `app/`. Repository-root files remain the previous published build so merging source alone does not replace the live app.

## Local work

Node ^22.12, ^24, or >=26 required by Vitest (verified with Node 26.12). In `app/` run:

```sh
npm ci
npm test
npm run build
npx playwright install chromium webkit
npm run test:e2e
npm run preview -- --host 127.0.0.1
```

Keep `package-lock.json`. `app/dist/` contains the production static site; copy its entire contents to the chosen deployment directory only after preview review. It runs at either `/` or `/ielts-a4/` because assets and manifest use relative URLs. Keep `.nojekyll` at the publishing root.

## Product and data decisions

- Daily FSRS, `ts-fsrs@5.4.2`, short-term learning and random interval fuzz disabled. Four visible grades. At most one scheduling review per word/local day. Again never schedules earlier than the next local day.
- New words first appear tomorrow. Whole-page checkout applies Good only to ungraded due words. Manual reset is persisted, restores a new FSRS card due tomorrow, and cannot be overwritten by same-day checkout.
- Legacy stages seed approximate initial stability; due dates/history retained. No fabricated FSRS log is generated for legacy history. Old localStorage stays untouched as a recovery source.
- Dexie database `ielts-a4-v3`: words/cards/revlog/meta. Transactional snapshots, validated before write. An internal revision rejects stale-tab writes instead of overwriting another tab’s changes. Refresh after that error; unsaved form input is retained until refresh.
- Duplicate-word JSON merges keep the current scheduling record authoritative; incoming logs remain audit records. Replace restores the full validated backup, including settings and buckets. Unknown versions, malformed words/cards/logs, duplicate IDs/names and orphan logs reject the import before any write.
- Mastered words are excluded from automatic review, reversible. Favorites independent. Mistakes include any Again log; stubborn means manual flag or at least four FSRS lapses.
- Quiz uses today’s new/due/completed words, with a labeled whole-library fallback if no current set. Scoring and random practice do not write cards or logs.
- Calendar and seven-day load show each card’s CURRENT next due date. Future grades can change it; do not extrapolate a fake fixed FSRS schedule.
- Main flow: book library → book → chapter → ordered 25-word groups. 《雅思词汇真经》去重整理版 contains 3,630 unique names, 22 sourced chapter boundaries and 155 app groups. Chapter tails remain shorter and groups never cross chapters. Source boundaries/limits: `docs/BOOK-SOURCE.md`.
- Default daily target is 2 groups (normally 50 words); selectable 1–10 groups, persisted. Today's plan includes groups completed today plus enough upcoming groups to reach the target, without sliding forward after completion. Chapter tails use actual word counts.
- `AppState.bookLearning` records book ID `ielts-bible-core-v1`, dailyGroups, an ordered completed-group/date prefix, and optional active group/confirmed-word cursor. Opening a book/group, importing or skipping a word does not increase learned count. Confirming all words commits completion and adds missing FSRS cards due tomorrow atomically. Existing cards/history/logs are retained. Mastery is distinct from initial-study completion.
- Every confirmed word saves its cursor. Partial groups do not add cards or count as learned until completed; reopening resumes the active cursor. Deleting an individual card does not erase historical initial-study completion. Clearing all words or restoring example data also resets book progress.
- Old v1/v2/v3 backups without book progress remain compatible and start book progress at zero; do not infer completion from old claims. New book fields are optional validated v3 fields and survive IndexedDB, JSON backup, replacement and merge. Merge retains the earliest completion date, the furthest valid cursor, and the local daily target when set (otherwise incoming target).
- Manual single/paste entry remains under 我的单词 → 录入新词. The old artificial 30-word book import and daily-word claim UI were removed. Exact dictionary coverage is 3,628 plus two short authored gap definitions; no publisher definitions were copied.
- License/provenance notices are in `app/public/licenses/NOTICE.txt`. The upstream sequence is from a GPL-3.0 repository; its specific data rights are unconfirmed. Before a proprietary/commercial release, resolve permissions/compatibility or replace with independently curated permissive data. No overall app license was selected in this continuation.

## Not implemented in this phase

Accounts, cloud sync, payments, admin console, native App Store packaging, automatic speech assessment. Gzip backup was optional and is not added; full JSON export/import is implemented.

## Deployment / next contributor

Work on `codex/continue-v3`; do not reapply the v2 ZIP or discard this source. Keep root production files separate until review. Before publishing, back up the live browser’s v2 data, deploy the preview artifact, bump the service-worker cache name for every release, and verify migration on the same origin/path. Service-worker updates wait for old sessions to close; they do not force reload an unfinished session.

On actual iPhone, separately check Safari speech voices, silent-mode behavior, Add to Home Screen, storage persistence, standalone launch, and offline reload. Desktop WebKit emulation is useful but does not replace a real-device check.

## Verification at handoff (2026-10-22 book flow)

- `npm test`: 29 core/content/book tests passed, including a reproduced/fixed backup-merge target regression.
- `npm run test:e2e`: 16/16 passed across mobile Chromium and mobile WebKit (eight scenarios each), including daily-target selection/reload, opening without learned credit, partial-group resume, full-group completion, next-group order and clearing progress; existing grading, backup, offline and stale-tab scenarios also passed.
- `npm run build`: TypeScript and Vite production build passed.
- Existing dependency audit: zero production findings; seven development-only advisories in inherited Tailwind 3 dependencies (five high, two moderate). No dependency change in this feature.
- Mobile screenshots of library, overview, first unit and revealed study card inspected; no horizontal overflow on the study screen.
- Actual iPhone hardware, Safari voices, standalone Add to Home Screen and device storage persistence still require device checks. Browser emulation does not verify those.
