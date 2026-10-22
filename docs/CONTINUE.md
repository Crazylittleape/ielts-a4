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
- Book sequence: 3,630 unique English names; 121 artificial groups of 30, plus configurable next-unlearned claiming. 3,628 ECDICT matches; El Niño and shade-tolerant remain manual inputs. Do not copy publisher definitions.
- License/provenance notices are in `app/public/licenses/NOTICE.txt`. The upstream sequence is from a GPL-3.0 repository; its specific data rights are unconfirmed. Before a proprietary/commercial release, resolve permissions/compatibility or replace with independently curated permissive data. No overall app license was selected in this continuation.

## Not implemented in this phase

Accounts, cloud sync, payments, admin console, native App Store packaging, automatic speech assessment. Gzip backup was optional and is not added; full JSON export/import is implemented.

## Deployment / next contributor

Work on `codex/continue-v3`; do not reapply the v2 ZIP or discard this source. Keep root production files separate until review. Before publishing, back up the live browser’s v2 data, deploy the preview artifact, bump the service-worker cache name for every release, and verify migration on the same origin/path. Service-worker updates wait for old sessions to close; they do not force reload an unfinished session.

On actual iPhone, separately check Safari speech voices, silent-mode behavior, Add to Home Screen, storage persistence, standalone launch, and offline reload. Desktop WebKit emulation is useful but does not replace a real-device check.

## Verification at handoff (2026-10-22)

- `npm test`: 16/16 core/content tests passed.
- `npm run test:e2e`: 16/16 passed across mobile Chromium and mobile WebKit (8 scenarios each). Covers migration, one-grade-per-day, bulk remainder, reload, favorites/mastered reversal, built-in group/manual gaps, sequential daily claims, quiz timer/score and no scheduling writes, offline reload/mobile width, invalid/cancelled restore retention, stale-tab preservation.
- `npm run build`: TypeScript and Vite production build passed.
- `git diff --check`: passed.
- `npm ls --depth=0`: dependency tree valid.
- `npm audit --omit=dev`: 0 production dependency vulnerabilities reported. Full audit still reports 7 development-only advisories in inherited Tailwind 3 dependencies (5 high, 2 moderate). Resolving those requires a Tailwind major migration; this continuation preserves the UI and records that follow-up instead of mixing in an unrelated style/build migration.
- Manual visual inspection: 390px-wide home and A4 screenshots. Actual iPhone hardware and Add to Home Screen remain to verify.
- Requirements review passed after fixing imported-log schedule blocking, next-unlearned daily claiming, today's quiz scope, and preserving failed/cancelled restore input.
