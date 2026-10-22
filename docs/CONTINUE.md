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
- `AppState.bookLearning` records book ID `ielts-bible-core-v1`, dailyGroups, an ordered completed-group/date prefix, and optional active group/round/base-cursor/retry queue. Opening a book/group, importing or skipping a word does not increase learned count. Passing all three rounds and their retries commits completion and adds missing FSRS cards due tomorrow atomically. Existing cards/history/logs are retained. Mastery is distinct from initial-study completion.
- Every confirmed response saves its round, cursor and pending retries. Partial groups do not add cards or count as learned until completed; reopening resumes the active cursor. Deleting an individual card does not erase historical initial-study completion. Clearing all words or restoring example data also resets book progress.
- Group study uses three complete rounds: English → recall Chinese, phonetic → recall Chinese, Chinese → type English. The first two reveal then self-assess; the third checks a whole submitted spelling, shows expected/typed feedback and requires Continue before saving. Wrong/forgotten tasks reappear at that round's end; failed retries rotate and all retries must pass before the next round. No per-letter coaching. Case, whitespace and NFC equivalents normalize; real accents/hyphens remain meaningful.
- Active cursor extends `{groupId,seen}` with optional `round:0|1|2`, `retry:number[]`, `inRetry:boolean`. Legacy missing fields default to round 0; old completed groups remain completed. Base `seen` is 0..<group size with retry indices below it; retry phase uses `seen === group size` and a nonempty unique queue. All writes/imports validate these invariants. Merges favor later rounds, then retry phase, then further base position, unioning errors only within the winning round.
- 24 entries lack phonetics; their second-round cue explicitly reads “暂无音标，本题使用英文提示”. Hidden targets do not leak in speech-button accessible names. Spelling cues omit pronunciation until answered. Attempts do not write FSRS logs or create three copies of a word. Research source locations: `docs/LEARNING-MODES-RESEARCH.md`.
- Old v1/v2/v3 backups without book progress remain compatible and start book progress at zero; do not infer completion from old claims. New book fields are optional validated v3 fields and survive IndexedDB, JSON backup, replacement and merge. Merge retains the earliest completion date, the furthest valid round/phase/cursor with conservatively unioned same-round errors, and the local daily target when set (otherwise incoming target).
- Manual single/paste entry remains under 我的单词 → 录入新词. The old artificial 30-word book import and daily-word claim UI were removed. Exact dictionary coverage is 3,628 plus two short authored gap definitions; no publisher definitions were copied.
- License/provenance notices are in `app/public/licenses/NOTICE.txt`. The upstream sequence is from a GPL-3.0 repository; its specific data rights are unconfirmed. Before a proprietary/commercial release, resolve permissions/compatibility or replace with independently curated permissive data. No overall app license was selected in this continuation.

## Not implemented in this phase

Accounts, cloud sync, payments, admin console, native App Store packaging, automatic speech assessment. Gzip backup was optional and is not added; full JSON export/import is implemented.

## Deployment / next contributor

Work on `codex/continue-v3`; do not reapply the v2 ZIP or discard this source. Keep root production files separate until review. Before publishing, back up the live browser’s v2 data, deploy the preview artifact, bump the service-worker cache name for every release, and verify migration on the same origin/path. Service-worker updates wait for old sessions to close; they do not force reload an unfinished session.

On actual iPhone, separately check Safari speech voices, silent-mode behavior, Add to Home Screen, storage persistence, standalone launch, and offline reload. Desktop WebKit emulation is useful but does not replace a real-device check.

## Verification at handoff (2026-10-22 three-round learning)

- `npm test`: 35 core/content/book tests passed. New tests failed before implementation and cover three-round completion, retry rotation, spelling normalization, invalid cursors, old cursors, backup/IndexedDB restoration and conservative merges.
- `npm run test:e2e`: 20/20 passed across mobile Chromium and mobile WebKit (10 scenarios each), including three-round cue hiding, repeated misses with a single retry, wrong spelling feedback, retry reload, phonetic fallback and preserving feedback on stale-tab rejection. Existing grading, backup, offline and book flows still pass.
- `npm run build`: TypeScript and Vite production build passed. `git diff --check` passed.
- Screenshots of English, phonetic, spelling and incorrect-answer feedback inspected. No horizontal overflow in any of the three study modes at iPhone 13 viewport.
- Existing dependency audit: zero production findings; seven development-only advisories in inherited Tailwind 3 dependencies (five high, two moderate). No dependency change in this feature.
- Actual iPhone hardware, Safari voices, standalone Add to Home Screen, native keyboard behavior and device storage persistence still require device checks. Browser emulation does not verify those.
