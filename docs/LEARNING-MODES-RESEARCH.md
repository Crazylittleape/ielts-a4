# 多形式组内训练：源码参考（2026-10-22）

用户确认：一组25词分三轮练完，依次为英文→中文回忆、音标→中文回忆、中文→英文拼写。保留书→单元→组的次序。

本次直接阅读了下列固定版本中的流程、输入判定和存储模块；没有运行这些上游项目，也不据此声称其学习效果已被实验验证。

| 项目 | 固定提交 | 实际读到的实现 | 本项目采用的思路 |
|---|---|---|---|
| TypeWords | `1bcc2a2c0a169b37bea26b73f5a46a91d803558f` | 练习模板、阶段编排、错词清空动作、阶段游标和快照恢复 | 三轮状态和错题队列与词书进度分开保存 |
| Qwerty Learner | `1182426f2bd0a28c95302c33f9e19136b1262a70` | 单词重复、章节结束判断、遮词、大小写处理和逐字错误记录 | 明确完成条件和拼写判错；中文拼英文采用提交后反馈，避免边打边提示变成抄写 |
| Anki | `8d6e0a0f462f016889896ceaaab1be2aba182588` | 正反向模板、键入答案比对、Unicode规范化；同笔记卡片可按设置延后 | 同一个词可有不同检索方向；题型记录不能当作多份新词或多次日间FSRS评分 |
| 幕境 MuJing | `9ca8c14ef36bc9bdb37e197866681eb43e9e136b` | 正常学习、单元后听写、错词复习；音标/翻译/字幕显隐控制 | 每轮只展示必要线索；错词单独重试，保留原组边界 |

## 可核对的源码位置

TypeWords：
- [内置多阶段流程](https://github.com/zyronon/TypeWords/blob/1bcc2a2c0a169b37bea26b73f5a46a91d803558f/app/core/composables/practice-words/practice-flow-config.ts#L53)：system流程区分新词和复习，采用followWrite/listen/dictation等模板，阶段可以带wrongWordClear动作。
- [阶段游标与快照](https://github.com/zyronon/TypeWords/blob/1bcc2a2c0a169b37bea26b73f5a46a91d803558f/app/core/composables/practice-words/practice-flow-types.ts#L114)：保存node、step、loop及错词阶段，快照包含flowId。我们的固定三轮不需要照搬通用可配置流程引擎。
- [快照序列化与恢复](https://github.com/zyronon/TypeWords/blob/1bcc2a2c0a169b37bea26b73f5a46a91d803558f/app/core/composables/practice-words/practice-word-session.ts#L91)：工作词表、错词和阶段位置一起保存，恢复时验证结构。

Qwerty Learner：
- [完成和重复单词的判断](https://github.com/RealKai42/qwerty-learner/blob/1182426f2bd0a28c95302c33f9e19136b1262a70/src/pages/Typing/components/WordPanel/index.tsx#L54)。
- [拼写及错误记录](https://github.com/RealKai42/qwerty-learner/blob/1182426f2bd0a28c95302c33f9e19136b1262a70/src/pages/Typing/components/WordPanel/components/Word/index.tsx#L181)。它的逐字反馈适合打字训练；本项目的整词回忆题采用提交后检查。

Anki：
- [键入型卡片和正反向模板](https://github.com/ankitects/anki/blob/8d6e0a0f462f016889896ceaaab1be2aba182588/rslib/src/notetype/stock.rs#L123)。
- [答案比对与规范化](https://github.com/ankitects/anki/blob/8d6e0a0f462f016889896ceaaab1be2aba182588/rslib/src/typeanswer.rs#L38)。它提供比对显示，不等于自动把答题结果映射为FSRS评分。
- [同笔记卡片延后机制](https://github.com/ankitects/anki/blob/8d6e0a0f462f016889896ceaaab1be2aba182588/rslib/src/scheduler/queue/builder/burying.rs#L81)。该机制是长期复习的配置，不照搬成我们组内三轮的跳题规则。

MuJing：
- [学习/听写/错词策略](https://github.com/tangshimin/MuJing/blob/9ca8c14ef36bc9bdb37e197866681eb43e9e136b/src/main/kotlin/com/mujingx/ui/wordscreen/MemoryStrategy.kt#L22)。
- [听写线索显隐](https://github.com/tangshimin/MuJing/blob/9ca8c14ef36bc9bdb37e197866681eb43e9e136b/src/main/kotlin/com/mujingx/ui/wordscreen/DictationState.kt#L41)。
- [错词再练](https://github.com/tangshimin/MuJing/blob/9ca8c14ef36bc9bdb37e197866681eb43e9e136b/src/main/kotlin/com/mujingx/ui/wordscreen/WordScreen.kt#L1237)。

## 三种编排的取舍

用户已选“分三轮”：同词两次出现之间有其他词，阶段进度清楚，最容易与现有组进度兼容。交错题型可作后续选项，但会增加队列与恢复复杂度；逐词连续三种形式最简单，但后两次更容易依赖刚看到的答案。这些是产品设计取舍，不是本次代码阅读得出的效果实验结论。

## 本地数据检查与实施边界

现有3630词中有24词的音标为空。例：carbon dioxide、El Niño、shade-tolerant、ice cream。第二轮对这些词明确显示“暂无音标，本题使用英文提示”，保持题目和单词覆盖完整，不伪造音标。

音标并不能唯一确定单词/释义：数据中有ore/oar、cite/site/sight等同音词。因此前两轮由用户揭晓后自评；不对中文表述做机械字符串判错。第三轮以本词书目标拼写判定，允许大小写、首尾/重复空格和Unicode等价写法，保留真正的字母、连字符和重音差异。

每轮按原组顺序首次出题；错题在该轮末尾再出现，通过后移出待练队列。三轮全部通过才增加25个已学词（章末按实际数）。组内75次基本作答仍是25个新词；不会将其写成75条FSRS复习评分。

仅参考上述实现思路，新增实现独立编写。三个学习应用的许可证为GPL-3.0系列，Anki核心为AGPL-3.0-or-later；不复制其受许可证约束的源码到本项目。现有词表许可问题仍以NOTICE为准。
