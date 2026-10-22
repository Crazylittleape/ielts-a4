# Three-round learning verification — 2026-10-22

## Requirements and implementation

Each fixed book group runs through English recall, phonetic recall, and Chinese-to-English spelling in full rounds. Initial passes retain book order; mistakes queue at each round's end and cannot be bypassed. Failed retries rotate, including the single-remaining-word case. Three rounds and all retries must pass before group completion creates missing FSRS cards. Existing schedules and logs remain intact.

Legacy cursors default to round one; completed groups remain completed. Active round/base position/retry phase and indices survive validated JSON backup and transactional IndexedDB snapshots. Same-round backup merges conservatively union failures while later rounds supersede earlier ones.

## Evidence

- Core red: 14 new/changed assertions failed against the single-pass API and cursor validation before core implementation.
- Browser red: new three-round scenario failed because the first-round heading was absent in the previous build.
- Core green: 35 tests passed across all three test files.
- Browser green: 20 tests passed, 10 each on mobile Chromium and WebKit. The full 75-response base path plus extra retries, single-word repeated mistakes, reload, hidden targets, missing phonetic fallback and stale-tab feedback retention are covered alongside the existing migration/FSRS/backup/offline scenarios.
- TypeScript/Vite production build and whitespace validation passed.
- English/phonetic/spelling/error-feedback screenshots inspected at iPhone 13 viewport; all study modes report no horizontal overflow.
- Independent specification review passed after code inspection and an independent 35-test run. Independent quality review also passed, with no Critical, Important or Minor findings after reviewing state transitions, validation, merging, UI and save handling.

## Limits

Desktop mobile emulation does not validate a physical iPhone's keyboard, speech voices, silent-mode behavior, standalone installation or long-term storage. Upstream learning applications were studied at pinned source revisions, not run or experimentally evaluated. No upstream application code was copied. See LEARNING-MODES-RESEARCH.md for references.

Only the development branch is updated. Published root files remain the previous build under the user's branch-only instruction.
