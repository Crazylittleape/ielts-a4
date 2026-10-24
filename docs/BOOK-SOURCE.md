# 《雅思词汇真经》去重整理版

This prototype has 3,630 distinct English headwords, 22 chapters and 155 app study groups. The title shown in the UI is 雅思词汇真经, with the edition explicitly labelled 去重整理版. A 4,000-word total was an example in the product discussion, not this dataset's actual size.

## Sources and boundaries

- English sequence: [Qwerty Learner transcription](https://github.com/RealKai42/qwerty-learner/blob/1182426f2bd0a28c95302c33f9e19136b1262a70/public/dicts/IELTSVocabularyBible.json). 3,673 source occurrences become 3,630 unique names by lowercase deduplication preserving first occurrence. `app/src/data/book-sequence.json` is unchanged by this feature.
- Chapter headings/boundaries: [my-ielts transcription](https://github.com/hefengxian/my-ielts/blob/5cef573933663c4673c6e0093f1df04e68018b1a/src/pages/vocabulary/vocabulary.txt), pinned at `5cef573933663c4673c6e0093f1df04e68018b1a`. The complete 22-chapter reference was used; the older `hefengxian/ielts-vocabulary` repository only had the first 11 chapters and was not used for final offsets.
- `book-units.json` stores half-open offsets into the unchanged sequence. All 3,630 entries map to contiguous chapters. `book.test.ts` verifies every chapter's first/last word, total coverage, order, grouping and tails. No definitions or examples were copied from the chapter reference.
- Definitions/phonetics: ECDICT at `bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b`, using exact case-insensitive names. Two short definitions were authored for this prototype: `El Niño` → `n. 厄尔尼诺现象`, `shade-tolerant` → `adj. 耐阴的`.

The alignment compared ordered names after lowercase/accent normalization, with regional spelling variants reconciled only for chapter assignment. The input names themselves were preserved. Each chapter begins at its matched first headword; app groups restart there in chunks of 25. Thus chapter boundaries are sourced from the transcription, while the 25-word boundaries are a product rule, not printed book subgroups.

## Evidence limits

This is a web transcription aligned to another web transcription, not a publisher-verified edition or print run. The reference contains 3,674 occurrences, including `surprising` absent from the Qwerty sequence and repeated appearances removed by deduplication. Those do not silently get inserted or moved into this version. Repeated headwords in later chapters and their possible distinct senses are not represented separately. Changing the sequence later requires an explicit content version and progress migration; do not change `ielts-bible-core-v1` in place.

The repository/data licensing boundary remains documented in `app/public/licenses/NOTICE.txt`; this work does not establish publisher permission or closed-source commercial clearance.

## Chapter coverage

| 单元 | 词数 | 组数 | 最后一组 |
|---|---:|---:|---:|
| u01 自然地理 | 241 | 10 | 16 |
| u02 植物研究 | 130 | 6 | 5 |
| u03 动物保护 | 167 | 7 | 17 |
| u04 太空探索 | 75 | 3 | 25 |
| u05 学校教育 | 400 | 16 | 25 |
| u06 科技发明 | 118 | 5 | 18 |
| u07 文化历史 | 79 | 4 | 4 |
| u08 语言演化 | 67 | 3 | 17 |
| u09 娱乐运动 | 172 | 7 | 22 |
| u10 物品材料 | 151 | 7 | 1 |
| u11 时尚潮流 | 112 | 5 | 12 |
| u12 饮食健康 | 169 | 7 | 19 |
| u13 建筑场所 | 129 | 6 | 4 |
| u14 交通旅行 | 133 | 6 | 8 |
| u15 国家政府 | 148 | 6 | 23 |
| u16 社会经济 | 169 | 7 | 19 |
| u17 法律法规 | 114 | 5 | 14 |
| u18 沙场争锋 | 211 | 9 | 11 |
| u19 社会角色 | 120 | 5 | 20 |
| u20 行为动作 | 261 | 11 | 11 |
| u21 身心健康 | 412 | 17 | 12 |
| u22 时间日期 | 52 | 3 | 2 |

## Reproducibility

Reference file SHA-256: `b0e0907caa0372d1552ac825c050a4fd6164b2ec642347051e45fd421ac6739e`.

The source reference is available at the pinned link above. Download with `gh api repos/hefengxian/my-ielts/contents/src/pages/vocabulary/vocabulary.txt?ref=5cef573933663c4673c6e0093f1df04e68018b1a -H "Accept: application/vnd.github.raw+json"`. Lines with `|` are words; nonempty nonseparator lines (`---`, `+++`, `===`) are chapter headings. Verify the ordered chapter-start names against `book.test.ts` and the offsets against the unchanged sequence.

## Example sentences

None are bundled: coverage is 0 / 3,630. ECDICT and the Qwerty sequence contain no examples; the my-ielts reference has examples but declares no license and they are not copied. `app/src/data/book-examples.json` holds sourced examples keyed by headword (`exampleEn`, optional `exampleZh`, required `exampleSource`); `examples.test.ts` rejects entries that are not real book headwords or lack a source. See `docs/CONTINUE.md` (例句字段) for the candidate licensed source and integration steps.
