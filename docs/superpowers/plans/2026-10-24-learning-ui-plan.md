# IELTS A4 Learning UI Implementation Plan

> **For agentic workers:** Use executing-plans to implement this plan task-by-task. The user selected Devin as the executor; no extra worker agents are needed.

**Goal:** 实现用户批准的 B 方向，交付有学习动力的首页与挑战、温暖可读的纸张 A4。

**Architecture:** 沿用 React 视图、现有展示数据和事件回调。集中调整样式、共享 UI 和相关页面，不新建数据模型或更改 FSRS。所有存储、评分和计时行为按当前实现回归验证。

**Tech Stack:** React 18、TypeScript、Tailwind/CSS、Lucide、Vite、Vitest、Playwright。

**Design:** `docs/superpowers/specs/2026-10-24-learning-ui-design.md`，用户已批准方向，直接执行常规实现决定。

## Task 1: Reference audit and baseline

Files: read `docs/CONTINUE.md`, `app/src/BookView.tsx`, `app/src/A4View.tsx`, `app/src/Practice.tsx`, `app/src/App.tsx`, `app/src/index.css`, `app/src/ui.tsx`, `app/tailwind.config.*`, `app/public/sw.js`; write `docs/UI-REFERENCES-2026-10-24.md`.

- [ ] Fetch `origin/codex/continue-v3`; inspect status; preserve local changes and use the remote's latest code, which contains `b53ad8d`.
- [ ] Verify requested model availability; report exact evidence and any limitation without pretending a mode is a model.
- [ ] Inspect at least three accessible public reference pages; record exact URLs, observed patterns, and decisions. Continue if a particular site is unavailable.
- [ ] In an isolated browser profile, capture the six baseline screens listed in the design; use test fixtures only inside that profile.
- [ ] Run `cd app && npm test && npm run build && npm run test:e2e`; expected baseline 84 unit and 76 mobile tests passing. Record deviations before implementation.

## Task 2: Shared visual system

Files: modify `app/src/index.css`, `app/src/ui.tsx`; modify Tailwind config only if semantic theme tokens are needed.

- [ ] Implement color/spacing/type hierarchy, primary and secondary actions, navigation focus/selected states and shared empty/error/saving states using existing components.
- [ ] Add localized interaction transitions and an explicit reduced-motion override for existing and new animations. Keep fonts and assets local.
- [ ] Check actual computed contrast, keyboard focus and 320px layouts; do not merely hide overflow to mask layout defects.
- [ ] Build and commit the shared layer, without unrelated component restructuring or dependency changes.

## Task 3: Home and word study

Files: modify `app/src/BookView.tsx`, `app/src/App.tsx` only for presentation wiring; reuse `app/src/book.ts` selectors.

- [ ] Create the primary daily task hierarchy using `dailyPlan`, `getBookProgress`, `getBookStats`; no fabricated streak, time estimate, energy or XP.
- [ ] Prioritize resume/start/finished states using the existing begin/answer callbacks. Preserve book selection, group settings and navigation semantics.
- [ ] Restyle book cover, study rounds and completion picker. Ensure recall and spelling screens reveal answers only at the existing step.
- [ ] Run relevant existing book E2E including initial empty state, three rounds, retry/resume and manual A4 selection. If a real interaction changes, add a focused failing regression first.
- [ ] Capture mobile and desktop screenshots and commit.

## Task 4: Paper A4

Files: modify `app/src/A4View.tsx`, paper-specific rules in `app/src/index.css`.

- [ ] Separate the toolbar from the paper and improve paper texture, margins, typography and page labels; prioritize readable mobile rows over literal A4 aspect ratio.
- [ ] Visually distinguish pending/rated/ticked cards and the four rating actions, while preserving handlers and date/scope rules.
- [ ] Check long words, long meanings, examples, eight rows, multi-page ticks, reveal state and fixed bottom navigation.
- [ ] Run A4 regression tests for 4/4 masking, tick/reveal persistence, all-page submission, future read-only and exact log counts; capture screenshots and commit.

## Task 5: Challenge and dashboard

Files: modify `app/src/Practice.tsx`, `app/src/Dashboard.tsx`; other views only where shared style consistency requires it.

- [ ] Give challenge idle/playing/result distinct hierarchy with timer, matching state, combo feedback and truthful result statistics. Preserve authoritative refs, deadline and scoring.
- [ ] Keep the timer out of per-second assertive announcements; make match outcomes and errors understandable to screen readers without hiding the clock.
- [ ] Harmonize dashboard progress/calendar and other existing actions. Maintain individual calendar meaning and dates.
- [ ] Run challenge regressions for duplicate meanings, time-up, rapid taps, replay and zero database writes; capture result screen and commit.

## Task 6: Release verification and delivery

Files: update `app/public/sw.js` cache version, `docs/CONTINUE.md`, and `app/tests/workspace.spec.ts` only where new behavior requires regression coverage.

- [ ] Bump app cache for this publication; run `npm test`, `npm run build`, `npm run test:e2e`, `git diff --check`.
- [ ] Inspect fresh/existing-user views at 320/375/390px and desktop, reduced motion, keyboard focus, and 200% text scaling. Save screenshot evidence without browser storage or private data.
- [ ] Verify user-confirmed SW update retains IndexedDB and offline reload works. Existing users must receive an update prompt rather than silently stay on the old interface.
- [ ] Provide actual model evidence, reference URLs, screenshot locations, checks, commit SHA and unresolved physical iPhone limitations.
- [ ] Push only `origin/codex/continue-v3`. If forbidden, export `git format-patch <starting-commit>..HEAD`, SHA-256 and final tree hash; paste complete patch content through readable MCP events if attachments are inaccessible.
- [ ] Codex reviews the final patch/build before publishing to the existing Tencent Nginx release directory and verifies https://ielts.yyd.me/ .
