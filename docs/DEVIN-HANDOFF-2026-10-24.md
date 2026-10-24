# IELTS A4 工作台：Devin 换账号交接单

更新时间：2026-10-24

## 新 Devin 的第一步

```sh
git clone https://github.com/Crazylittleape/ielts-a4.git
cd ielts-a4
git fetch origin
git checkout codex/continue-v3
git pull --ff-only origin codex/continue-v3
cd app
npm ci
npm test
npm run build
npm run test:e2e
```

不要 checkout `main`，不要 reset，先确认 HEAD 是 `793762c` 或更新的提交。源码在 `app/`；仓库根目录的旧静态文件不是当前开发入口。

## 当前成果

开发分支：`codex/continue-v3`

最新远程 HEAD：`793762c`

提交链：

- `3a45e6b`：组完成后手动挑选薄弱词加入 A4、跨午夜日期刷新、严格 focus 校验。
- `dda54b7`：撤销误加 A4、我的单词 A4 筛选、移除恢复示例数据。
- `422bb6d`：只提交明确评分、撤销恢复加入前排期、A4 生命周期、导入预览和覆盖前自动备份。
- `11de06c`：日历区分待复习、已完成、新增攻坚、预计到期；A4 日历不计入词书初学。
- `48f5504`：Dexie v1→v2 升级保护、versionchange/blocked 处理、最近 5 份自动备份、持久化存储请求。
- `1c22f27`：用户确认后更新 Service Worker、跨标签 revision 提醒、导入写入回滚测试。
- `793762c`：真实浏览器 Service Worker 更新 E2E、缓存切换、保留 IndexedDB 记录、断网刷新。

最近验证：71 项 Vitest 通过，生产构建通过，移动 Chromium/WebKit E2E 通过，`git diff --check` 通过。真机 iPhone 仍未验证。

## 产品不变量

- A4 是同一个 `WordItem`/`wordId`/FSRS 卡的手动重点攻坚状态，不是第二词库、第二调度器。
- 只有用户明确点击“加入 A4 攻坚”才加入；未选择的词不能自动进入 A4。
- 加入默认明天到期；成功评分退出当前攻坚；困难/忘记继续留在攻坚并按 FSRS 重新排期。
- 未评分词不能被页面按钮默认按 Good 提交；只有逐词评分或用户明确勾选后提交才写入排期。
- 撤销 A4：若加入后没有新评分/重置，恢复加入前排期；若已有新评分/重置，保留最新 FSRS 结果。
- 用户已有 IndexedDB 学习记录、FSRS 卡、revlog、词书进度不能被覆盖或按词名猜删。
- 新用户不自动灌入演示词。引导只能是只读说明，不写入词库。
- 过去日期显示真实记录；今天显示待复习/已完成/新增攻坚；未来只显示当前下次到期的预计。
- 不修改 `main`、GitHub Pages 或发布仓库 README，除非用户明确要求。

## 当前待办（用户最新明确需求）

### 1. 强化“随机”遮挡模式

当前 `app/src/A4View.tsx` 的 `randomSide()` 对每一行独立哈希，容易出现 8 行几乎全部遮中文、只一行遮英文。改为按当前页和随机 seed 生成受约束分配：

- 每行仍只遮一侧，点击可以偷看。
- 当前页至少 2 个词时，必须同时出现遮英文和遮中文。
- 8 词页尽量 4/4；允许奇数页为 3/4，但不能 7/1 或 8/0。
- 点击“乱序”或改变 seed 后重新分配。
- 补核心失败测试和移动 Chromium/WebKit E2E，测试分配约束，不要只测快照文案。

### 2. 例句和例句朗读

先检查 `app/src/data/dict.txt`、`book-sequence.json` 和来源说明。当前 `dict.txt` 是制表符字段的词头/音标/中文释义/词书元数据，未发现原始例句字段。

- 不要凭空编造例句。
- 不要引入来源不明或版权不清的例句数据。
- 若找到许可清楚的例句来源：扩展可选 `exampleEn`、`exampleZh`、`exampleSource` 字段，保留在 IndexedDB、v3 JSON 备份、覆盖恢复和合并导入中；在词书学习卡和 A4 卡增加可折叠例句、中文释义和 `speechSynthesis` 朗读按钮。
- 若没有可用来源：先实现可迁移的可选字段、UI 和 fixture 测试，并在 `docs/CONTINUE.md` 记录现有覆盖率和合法数据接入方案；没有例句的词不要显示伪造内容。
- 例句朗读复用现有朗读错误提示；真机 iOS 语音仍须标记为未验证。

## 关键文件

- `app/src/A4View.tsx`：A4 纸面、遮挡、评分、分页、随机模式。
- `app/src/BookView.tsx`：词书学习和 A4 选词。
- `app/src/lib.ts`：`WordItem`、FSRS、focus、备份解析/合并。
- `app/src/calendar.ts`：日历范围、日期标记、A4/全部复习投影。
- `app/src/db.ts`：Dexie 数据库、versionchange、revision、自动备份。
- `app/src/pwa.ts`：Service Worker 更新提示和跨标签通知。
- `app/tests/workspace.spec.ts`：移动 Chromium/WebKit E2E。
- `app/src/*test.ts`：核心、词书、focus、数据库、PWA 测试。
- `docs/CONTINUE.md`：完整长期设计决策和每轮验证记录。

## 交付要求

1. 先检查实际 HEAD、`git status` 和 `docs/CONTINUE.md`。
2. 先写会失败的有意义测试，再实现。
3. 运行 `npm test`、`npm run build`、`npm run test:e2e`、`git diff --check`。
4. 更新 `docs/CONTINUE.md`，写明数据来源、迁移和真机未验证风险。
5. 推送 `codex/continue-v3`；若新 Devin 账号仍无写权限，生成基于远程 HEAD 的 `git format-patch` 附件，不要声称已同步。
6. 回报准确 commit、文件、测试数字、例句来源/覆盖率和剩余风险。

## Mac 当前预览

构建后可在 `app/` 运行：

```sh
npm run preview -- --host 0.0.0.0
```

本机：`http://127.0.0.1:4173/`；同一 Wi-Fi 的 iPhone：`http://192.168.1.2:4173/`（IP 可能变化）。GitHub Pages `https://crazylittleape.github.io/ielts-a4/` 仍是 `main`，不是开发分支。
