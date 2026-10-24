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

## A4 重点攻坚（2026-10-22）

- 词书仍负责按原章节、原组顺序教学和回忆；A4 默认只显示用户手动点选的困难词，不再把整组词书当成第二套词库。
- `WordItem.focus` 只保存攻坚状态（`active`、`addedAt`、`nextDate`、`reason`），A4 通过同一个 `WordItem.id` 读取释义、音标、同义词和真经 List 标签；FSRS 卡和复习日志仍只有一套。
- 加入后安排到明天；重复点击幂等。A4 成功评分会退出当前攻坚清单但保留长期 FSRS 到期日；困难/忘记会继续保留并按 FSRS 重新排期。每个词每天最多评分一次。
- 词书回忆卡提供“加入 A4 攻坚 · 明天复习”，不点击就不会加入；A4 页可切换“重点攻坚 / 全部 FSRS 到期”，底部角标只统计当日攻坚到期词。
- 本次本地验证：`npm test` 36 项、`npm run build` 通过、移动 Chromium/WebKit E2E 20/20。新增核心测试覆盖同 ID、明日到期、重复加入、失败保留和成功退出。


## Personal calendar and paper (2026-10-23)

- Fresh workspaces contain no demo words/history. Existing local records, including indistinguishable old demo data, remain untouched. Accounts and cloud synchronization remain outside scope.
- `calendar.ts` projects AppState into all/focus calendars plus real completed book groups and actual word counts. Early-created focus cards do not count as completed initial study. Unique word/day counts come from real nonzero review logs, with legacy reviewHistory fallback; resets are excluded. Future entries show only the current next due prediction.
- Optional `ReviewEntry.focus` records focus membership at review time. Legacy logs without context are not retroactively classified as A4. Optional `WordItem.focusAddedDays` retains actual focus additions/re-additions. Both survive IndexedDB and v3 backups; invalid new fields reject import. Duplicate merges retain local schedule and focus metadata while preserving incoming historical evidence.
- Dashboard/date detail and A4 use shared date/scope selectors: today due plus done, past actual done, future predicted. Dashboard labels include completed cards in the opened page count; pending and completed counts are shown separately. Focus is a subset of all review and cannot be summed with it.
- Active focus additions are idempotent across days. A new addition synchronizes the shared card due date and focus date to tomorrow; reset synchronizes both. Successful review deactivates focus but preserves historical membership and long-term FSRS.
- Warm-white paper uses subtle procedural grain, neutral desk, fine edge, soft shadow, date/source/count heading and footer. Each page holds at most eight cards without reducing mobile font sizes. Submission only grades due cards on the displayed page; English long words wrap within their own column. Chinese fallback uses sans fonts, headwords retain Times New Roman.
- Verification: 42 Vitest tests, production TypeScript/Vite build, and 30 mobile Chromium/WebKit checks passed. Inspected full-page paper and long-word screenshots; verified no horizontal overflow, focus/all navigation, persistence, pagination, scope masking and offline reload. Actual iPhone hardware remains unverified.
- Release cache: `ielts-a4-v3-20261023-personal-paper-1`. Existing sessions finish before the new worker takes over; close all site/PWA windows and reopen to activate it.

## 组完成后挑选 A4 词（2026-10-24）

- 组学习完成页列出本组 25 词，本次回忆/拼写出错的词排在最前并标“本次出错”；每词一个“加入 A4”按钮，状态行显示“已选 N 词加入 A4 · 明天只复习这些”。不点击的词不进入 A4。
- 已完成的组可在单元页再次点开（“已完成 · 选词加入 A4”），用同一选择器补加。出错标记只存在于当前会话内存，不写入数据库、不反推历史。
- 拼写题检查后也显示“加入 A4 攻坚 · 明天复习”；已加入的词显示禁用的“已加入 A4 ✓”，避免重复点击的疑惑。
- `book.ts` 的 `focusBookWord(state, word, today, reason)` 是唯一的词书加入入口：已有卡直接 `addToFocus`（同 id、同 FSRS card、幂等）；尚无卡时只允许已完成组或当前学习组的词，按 `bookGroupTag(group)` 建卡，之后组完成不会重复建卡。未知词、未学组的词原样返回。
- v3 备份中 `focus` 字段格式非法（`active` 非布尔、日期无效、`reason` 非字符串等）时拒绝整份导入（“A4 攻坚状态无效”），v1/v2 旧备份仍宽松忽略。
- App 跨午夜仍打开时：`today` 每 30 秒/回到前台刷新，A4 与看板若停在“昨天=当时的今天”会跟随切到新的一天；用户手动选的其他日期不变。
- 验证：`npm test` 46 项、`npm run build`、移动 Chromium/WebKit E2E 34/34 通过；检查了完成页选择器截图，iPhone 13 视口无横向溢出。注意 E2E 用 `vite preview` 读取 `dist/`，改代码后必须先 `npm run build` 再跑 E2E。真机 iPhone（Safari 语音、主屏幕 standalone、原生键盘、长期存储、真实跨午夜唤醒）仍未验证。

## 撤销误加 A4、我的单词 A4 筛选（2026-10-24 第二轮）

- 新增 `removeFromFocus(word, day)`：只关闭当前攻坚，不改 FSRS card、`nextReviewDate` 和 revlog。当天加入又当天移出视为误点撤销，同时去掉当天的 `focusAddedDays`，日历“新增攻坚”不再计数；以前真实加入过的日期保留。之后可以重新加入。
- 已知取舍：加入 A4 时已把共享卡片的到期日提前到明天，撤销后不会恢复原来的更晚到期日，这个词明天仍出现在“全部复习”（不出现在 A4）。恢复原到期日需要新增数据字段，本轮没有做。
- 完成页/已完成组选择器里，已加入的词显示“已加入 ✓ 点按撤销”（`移出 A4：词`）。
- 我的单词新增“A4 攻坚 N”筛选，行内显示“A4 攻坚 · 日期 到期”和“移出 A4”按钮，可以集中查看、清理当前攻坚清单。
- 删除了“恢复示例数据”按钮：它会用示例词覆盖全部词库、进度和日志，和“不重新引入默认示例词、已有记录不能误删”冲突。`seedWords` 仍保留在 `lib.ts`，但界面上不再调用。“清空单词和进度”仍需二次确认。
- 新增 `src/focus.test.ts` 并加入 `npm test`。验证：`npm test` 48 项、`npm run build`、移动 Chromium/WebKit E2E 36/36 通过。

## A4 只提交明确评分、撤销恢复排期、攻坚生命周期（2026-10-24 第三轮）

- A4 页不再有“完成本页复习打卡”把未评分词默认按「记住」提交。只有两种方式会写 FSRS：逐词点“忘记/困难/记住/轻松”，或勾选圆圈后点“提交已勾选 N 词 · 按「记住」评分”（勾选本身就是用户明确表示记住）。页面显示“本页已评分 X / Y”；未评分词保留在今日待复习，可点“稍后处理”离开，排期不变。
- `addToFocus` 在 `focus.before` 里保存加入前的 `nextReviewDate`、card 和掌握标记。`scheduleReview`（评分）和 `hardReset`（重置）都会丢掉这份快照，所以 `removeFromFocus` 只在加入后没有新评分/重置时恢复原排期；已有新评分时保留最新 FSRS 结果。合并导入时不会把别处的快照套到本机卡片上。v3 备份里非法的 `before` 会拒绝导入（“A4 攻坚状态无效”）。没有快照的旧数据撤销时保持当前排期。
- `focusStatus(word, today, revlog)` 给出生命周期：攻坚中 · 某日到期 / 攻坚中 · 今日待复习 / 今日已完成 · 继续攻坚 / 今日已完成 · 已退出攻坚 / 已退出攻坚 · 历史加入 N 次。“今日已完成”只认 `ReviewEntry.focus === true` 的真实评分。`focusSummary` 汇总这些数字：A4 重点页顶部显示“今日待复习 · 今日已完成 · 未到期 · 已退出”；页面为空时提示“另有 N 词攻坚中，最早某日到期”。我的单词新增“攻坚记录”筛选，每行显示状态。
- 覆盖导入前，弹窗对比备份和当前的词数、A4 词数、复习日志数（不含重置）、词书完成组数；确认后先把当前记录存进 Dexie `backups` 表（数据库 version 2，不在快照表里，覆盖时不会被清掉），存储失败就取消覆盖。之后“我的单词”出现“下载覆盖前的自动备份”。合并导入后提示新增词数、保留本机排期的同名词数和新增日志数。严格校验没有放松。
- 新用户（无单词、无完成组）在词书库看到只读的“第一次使用 · 三步上手”，不写入任何数据。
- A4 评分按钮的 aria-label 带单词（如“记住：alpha”），勾选圆圈是“勾选记住：词”并带 aria-pressed。朗读出错（`SpeechSynthesisUtterance.onerror`，排除 interrupted/canceled）时提示检查静音开关、音量或系统英语语音。
- 验证：`npm test` 54 项、`npm run build`、移动 Chromium/WebKit E2E 44/44、`git diff --check` 通过；看过 A4 评分进度截图，iPhone 13 视口无横向溢出。
- 未验证：真机 iPhone Safari 静音模式下 `onerror` 是否真的触发（iOS 可能静默失败、不报错）、主屏幕 standalone、原生键盘、长期存储、真实锁屏跨午夜。看板/日历的“待复习/已完成/新增/预计”区分本轮没有改。

## 看板/日历区分待复习、已完成、新增攻坚、预计（2026-10-24 第四轮）

- 原问题：日历格子只显示一个数字——今天有待复习时只显示“待N”，已完成被隐藏；有完成数时“+”（新增攻坚）被隐藏；A4 攻坚范围的格子把词书初学词数也算进“✓”，A4 日历出现了没有 A4 记录的“✓25”。
- `calendar.ts` 新增 `dayMarks(calendar, scope, date, today)`，格子和日期详情共用：
  - 过去：只有真实记录——“✓ 已完成”“+ 新增攻坚”，全部复习范围另有“学 词书初学”；不会出现待复习或预计。
  - 今天：“待 待复习（含逾期）”“✓ 已完成”“+ 新增攻坚”同时显示。
  - 未来：只有“≈ 预计到期”，即每张卡当前的下次到期日，不推算多轮排期。
  - A4 范围从不计入词书初学。
- 格子按标记分行显示（最多 3–4 行，10px 加粗），日期按钮的读屏名称包含完整说明，例如“选择日期 2026-10-22：待复习 1 词，已完成 1 词，新增攻坚 1 词”。图例改为彩色符号 + 文字，并说明“过去真实记录、未来预计”。
- 日期详情新增 `day-breakdown` 行：“今天/真实记录/预计：…”，与格子同一数据。词条按钮标出状态（读屏名“词（已完成/待复习/预计）”；已完成为绿色带 ✓，预计为虚线框）。过去日期在 A4 范围列出“当日新增攻坚”的词。今日卡“今日加入”改为“今日新增攻坚”。
- 验证：`npm test` 57 项、`npm run build`、移动 Chromium/WebKit E2E 46/46、`git diff --check` 通过；看过 iPhone 视口日历截图，无横向溢出。真机 iPhone 上的字号/格子高度观感未验证。

## Dexie 升级保护、多份自动备份、存储持久化（2026-10-24 第五轮）

- 审查结论：
  - 构建是 `vite-plugin-singlefile`，JS/CSS 全部内联在 `index.html`，`sw.js` 安装时已缓存它，所以首次访问后离线可用，这部分没改。
  - Dexie v1→v2 只新增 `backups` 表，原有数据不动。`src/db.test.ts` 用原始 IndexedDB API 按旧版的 version 10 结构写入真实数据（词、FSRS 卡、A4 focus、revlog、词书进度、revision），再用当前代码打开：数据全部保留、revision 继续递增、不会重新读 localStorage。
  - 风险点：只保留 1 份自动备份，第二次覆盖导入就会把第一次的备份冲掉；“清空单词和进度”没有任何自动备份。
- 自动备份：`saveAutoBackup(json, day, reason, summary)` 每次新建一条（`auto-时间-序号`），不覆盖旧备份，保留最近 `MAX_AUTO_BACKUPS = 5` 份（上一版留下的 `before-import` 也会列出，算作最旧的一份）。覆盖导入和清空（有数据时）都会先备份，备份失败就取消操作。“我的单词 › 数据备份与恢复”列出每份备份（原因、时间、词数、A4 词数、日志数），可分别下载，文件名为 `ielts-a4-before-import|clear-日期.json`。
- 多窗口升级：
  - 旧窗口不让出连接时，Dexie 的 `blocked` 事件让读取页显示“请关闭其他打开的本站页面或主屏幕 App，读取会自动继续”，不报错、不新建空库。
  - 别的窗口打开了更新的数据库版本时，本页关闭连接，顶部提示刷新，之后的保存都会被拒绝（“请刷新本页”），不会写入旧结构。
- 打开后先调用 `navigator.storage.persisted()`，未持久化时再调用 `persist()`。备份区显示结果；未获持久保存时提示 iPhone 从 Safari 添加到主屏幕并定期导出。
- 验证：`npm test` 62 项（新增 `db.test.ts` 5 项，已加入 `npm test`）、`npm run build`、移动 Chromium/WebKit E2E 50/50、`git diff --check` 通过。
- 未验证：iOS Safari 上 `persist()` 的实际返回和逐出策略、主屏幕 App 与 Safari 标签同时打开时的升级阻塞、真机旧数据升级。

## Service worker 更新提示、跨标签即时提醒、写入回滚（2026-10-24 第六轮）

- 审查结论：
  - service worker 安装后不会 `skipWaiting`，新版本要等所有窗口都关掉才生效。iPhone 主屏幕 App 常驻后台，可能一直停在旧版本。
  - 跨标签冲突原来只在保存那一刻才拦下：旧标签上做完一次评分，点保存才报错，这次评分没存上。
  - 覆盖导入写入本来就在同一个 Dexie 事务里。新增测试模拟中途写入失败（`revlog.bulkPut` 抛 QuotaExceededError）：旧词、日志、revision 全部保留，之后的保存仍然正常。
  - 上一轮的 `db.on('ready')` 没加 sticky 参数，只在第一次打开时触发，数据库重新打开后不会清除“已被新版本接管”的标记。已改为 `on('ready', fn, true)`。
- 更新提示：
  - `src/pwa.ts` 的 `watchServiceWorker` 只在已有控制者（不是首次安装）且新 worker 进入 `installed` 后才提示。
  - 顶部显示“新版本已下载，学习记录不受影响 · 立即更新”，保存中不能点。
  - 点了之后才发 `SKIP_WAITING`；`controllerchange` 只在用户点过更新后才刷新页面，首次安装的 `clients.claim()` 不会触发刷新。
  - 缓存名改为 `ielts-a4-v3-20261024-update-prompt-1`，发布时照旧要改。
- 跨标签：`persistWorkspace` 成功后通过 `BroadcastChannel('ielts-a4-workspace')` 广播新的 revision。其他标签收到的 revision 和自己读到的不一致时，顶部显示“其他标签页已更新学习记录 · 刷新学习记录”。保存时的 revision 检查照旧保留，作为最后一道防线。
- 验证：`npm test` 70 项（新增 `pwa.test.ts` 6 项，`db.test.ts` 新增 2 项）、`npm run build`、移动 Chromium/WebKit E2E 52/52（新增跨标签提醒 1 项）、`git diff --check` 通过。
- 未验证：service worker 更新的整条流程只有单元测试（直接执行 `sw.js` 加模拟 registration），没有在浏览器里真的装一个新版本 worker 再切换过去。iPhone 主屏幕 App 的更新提示、iOS 对 BroadcastChannel 的支持（iOS 15.4 起才有）都没在真机上测过。
