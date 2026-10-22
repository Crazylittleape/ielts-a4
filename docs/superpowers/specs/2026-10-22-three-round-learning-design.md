# Three-round group learning design

User selected three full rounds per25-word group on2026-10-22. Source research: `docs/LEARNING-MODES-RESEARCH.md`.

## Behavior

1. English → mentally recall Chinese; reveal definition, then choose remembered/forgot.
2. Phonetic → mentally recall Chinese; hide the English target until reveal, then self-assess. For24 entries lacking a phonetic, label an English-cue fallback. Offer optional pronunciation; do not rely on it for completion.
3. Chinese definition → type the English target, submit to check, show expected/typed result, then continue. A forgotten answer is incorrect. No live letter hinting, automatic correction, or acceptance of unrelated synonyms.

The first pass in each round retains the book-group order. Failed word indices are queued once for that round's end; failed retries rotate to the end, passed retries leave the queue. This preserves gaps while other retry words exist. A sole remaining wrong word can repeat; learners can exit and resume any time. Each confirmed response saves round, base cursor, retry phase and pending indices atomically. Display round1/3 and current word or pending retries.

A group completes only after all three rounds and pending retries. Then add its unique word count to progress and create missing cards due tomorrow, preserving existing FSRS schedules/logs. Do not schedule FSRS for individual group attempts.

## State and compatibility

Extend optional active cursor with optional `round`0–2, `retry`unique word indices, `inRetry`. Missing fields in the old active cursor mean round0 with its existing seen count. Completed old groups remain completed. Validate cursors and retry indices during every snapshot/backup import. Keep state in the existing metadata transaction.

For same-group merged cursors, keep the furthest round; within a round, prefer retry phase over base phase, then the furthest base cursor. Union pending errors conservatively when both cursors are in the same round. Never reintroduce errors from earlier rounds into a later passed round. Local daily target remains authoritative when set.

## Verification

Core tests must prove25 confirmations only finish round1,75 correct basic responses complete one full group exactly once, failures cannot be bypassed, retry queues survive backup/reload, legacy cursors migrate without invented completion, and existing reviewed cards remain unchanged. Browser tests must prove cue hiding (including accessible names), remembered/forgot interaction, wrong spelling feedback and retry, within-round reload, round transitions and group progress. Verify mobile Chromium/WebKit and existing backup/offline/FSRS flows.

Continue only on `codex/continue-v3`; prepare updated preview/source/handoff artifacts and retain the current public deployment.
