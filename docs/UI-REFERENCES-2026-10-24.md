# UI 参考调研（2026-10-24）

访问方式：Devin 云端 VM，移动端 UA，2026-10-24。只记录公开页面上实际能看到的内容。各 App 的内部学习页面需要登录或安装，均未查看。

| 产品 | URL | 观察到的内容 | 采用 / 舍弃 |
| --- | --- | --- | --- |
| Duolingo | https://www.duolingo.com/ | 官网写明“bite-sized lessons”、游戏化功能和提醒。 | 采用：首页一个明确任务、短反馈。舍弃：积分/XP、吉祥物提醒（没有真实数据支撑，也不联网）。 |
| Duolingo 博客 | https://blog.duolingo.com/how-duolingo-streak-builds-habit/ | 官方说明连续打卡用来养成习惯；断签会打击积极性，所以有 Streak Freeze（最多装备 2 个）；7 天连续的学习者完成课程的可能性高 3.6 倍。 | 舍弃连续打卡和冻结卡：项目约束禁止虚假连续天数，断签带来的负面情绪也与“不焦虑”目标冲突。 |
| Duolingo 博客 | https://blog.duolingo.com/streak-milestone-design-animation/ | 里程碑日有专门的庆祝动画；部分新用户看不懂“火焰”这个比喻。 | 采用：只在真实完成后给一次短反馈（A4 提交印章、组完成印章）。舍弃：比喻性图标和长动画。 |
| Anki 文档 | https://docs.ankiweb.net/studying.html | 每个评分按钮显示下次复习时间；牌组概览先显示今天到期的数量。 | 采用：评分后提示“下次复习 M 月 D 日”（取自同一 FSRS 卡的 nextReviewDate）；首页先显示到期数量。 |
| Anki 文档 | https://docs.ankiweb.net/leeches.html | 遗忘满 8 次标记为 leech，之后每 4 次提醒一次。 | 本项目已有“顽固词”，本轮不改规则。 |
| Anki 文档 | https://docs.ankiweb.net/deck-options.html | 有积压时建议先暂停学新词。 | 采用：首页下一步优先级为 A4 到期 → 全部到期 → 词书。 |
| 不背单词 | https://bbdc.cn/index | 官网写明：影视/新闻原声例句（轻听英语提供数据）、记忆算法动态安排、学完后做拼写测试。 | 学完一组再做拼写强化，与现有流程一致。舍弃：例句（没有许可清楚的来源）。 |
| 百词斩 | https://www.baicizhan.com/ | 官网写明图片模式、深度模式、按艾宾浩斯曲线规划每日复习、词根词缀与例句扩展。 | 只借鉴“一次一个词、扩展信息折叠”。不放图片和例句。 |
| Quizlet | https://quizlet.com/features/learn 、/features/match 、/features/flashcards 、help.quizlet.com | **全部返回 403 人机验证，无法查看。** | 不引用 Quizlet 的任何具体做法。 |
| 纸张排版 | https://edwardtufte.github.io/tufte-css/ | 简洁、旁注、图文紧密结合、精选字体。 | A4 保留衬线字、行分隔、页码和页眉，不做彩色卡片化。 |
| 无障碍 | https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion | reduced-motion 媒体查询。 | 全局 reduced-motion 覆盖所有动画和过渡。 |

## 模型核实

- 会话中没有返回底层模型名的工具；可选 agent 模式为 Normal / Fast / Fusion / Lite / Ultra / SWE-2 Medium / High / Max，这些不是模型名。
- Devin 文档中找不到 “Opus 5.5”，只出现了 “Opus 4.7” 和 “GPT 5.5”（https://docs.devin.ai/desktop/quick-review#available-models）。具体模型选择见 https://docs.devin.ai/cli/models#setting-the-model（Desktop/CLI 的 `/model`），本云端会话内无法切换。
- 因此本轮未使用、也未声称使用 Opus 5.5。
