import { test, expect, type Page } from '@playwright/test';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
const sequence: string[] = JSON.parse(readFileSync(new URL('../src/data/book-sequence.json', import.meta.url), 'utf8'));
const today = '2026-10-22';
const fixture = {words:[['alpha','第一个'],['beta','第二个'],['gamma','第三个'],['delta','第四个']].map(([word,meaning],i)=>({id:`word-${i}`,word,meaning,phonetic:'',synonyms:'',createdAt:'2026-10-20',stage:1,nextReviewDate:today,reviewHistory:['2026-10-20'],isHard:false})), skipped:[],settings:{dailyClaim:30,lastClaimDate:''}};
async function start(page: Page, initial: unknown = fixture) {
  await page.clock.install({time:new Date('2026-10-22T12:00:00+08:00')});
  await page.addInitScript(data=>{if(!localStorage.getItem('fixture')){localStorage.setItem('ielts_a4_workspace_v2',JSON.stringify(data));localStorage.setItem('fixture','1');}},initial);
  await page.goto('/');
  await expect(page.getByRole('button',{name:'学习统计',exact:true})).toBeVisible();
}
async function snapshot(page: Page) {
  return page.evaluate(async()=>{
    const db = await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('ielts-a4-v3');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    const read = (name:string)=>new Promise<unknown[]>((resolve,reject)=>{const request=db.transaction(name).objectStore(name).getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    const result={words:await read('words'),cards:await read('cards'),revlog:await read('revlog'),meta:await read('meta')};db.close();return result;
  });
}
test('migrate, grade once, submit explicitly ticked words and persist after reload',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);
  await page.getByRole('button',{name:/A4 刷词/}).click();
  await page.getByRole('button',{name:'当前：重点攻坚 · 切换全部 FSRS 到期'}).click();
  await page.getByRole('button',{name:/^忘记：/}).first().click();
  await expect(page.getByRole('button',{name:/^忘记：/})).toHaveCount(3);
  for (const word of ['beta','gamma','delta']) await page.getByRole('button',{name:`勾选记住：${word}`,exact:true}).click();
  await page.getByRole('button',{name:/提交已勾选 3 词/}).click();
  await expect(page.getByText('已保存 3 个词的复习评分，排期已更新')).toBeVisible();
  await page.getByRole('button',{name:'好的',exact:true}).click();
  expect((await snapshot(page)).revlog).toHaveLength(4);
  await page.reload();await expect(page.getByRole('button',{name:'学习统计',exact:true})).toBeVisible();
  expect((await snapshot(page)).revlog).toHaveLength(4);
  await page.getByRole('button',{name:/A4 刷词/}).click();
  await expect(page.getByRole('button',{name:/提交已勾选/})).toHaveCount(0);
  expect(errors).toEqual([]);
});
test('new word form completes, favorites/mastered are reversible and durable',async({page})=>{
  await start(page);await page.getByRole('button',{name:'我的单词',exact:true}).click();await page.getByRole('button',{name:'录入新词',exact:true}).click();
  await page.getByPlaceholder('ubiquitous',{exact:true}).fill('zebra');
  await page.getByLabel(/中文释义/).fill('n. 斑马');
  await page.getByRole('button',{name:/录入并排进FSRS日历/}).first().click();
  await expect(page.getByPlaceholder('ubiquitous',{exact:true})).toHaveValue('');
  await page.getByRole('button',{name:'我的单词',exact:true}).click();
  const row=page.getByRole('listitem').filter({has:page.getByRole('button',{name:'zebra',exact:true})});
  await row.getByRole('button',{name:'收藏',exact:true}).click();await expect(row.getByRole('button',{name:'取消收藏',exact:true})).toBeVisible();
  await row.getByRole('button',{name:'掌握',exact:true}).click();await expect(row.getByRole('button',{name:'恢复复习',exact:true})).toBeVisible();
  await page.reload();await page.getByRole('button',{name:'我的单词',exact:true}).click();
  await expect(row.getByRole('button',{name:'恢复复习',exact:true})).toBeVisible();
  await row.getByRole('button',{name:'恢复复习',exact:true}).click();await expect(row.getByRole('button',{name:'掌握',exact:true})).toBeVisible();
});
test('book library uses real units and opening a group does not count as learned',async({page})=>{
  await start(page);
  await expect(page.getByRole('heading',{name:'词书库',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'雅思词汇真经',exact:true}).click();
  await expect(page.getByText('已学 0 词',{exact:true})).toBeVisible();
  await expect(page.getByText('剩余 3630 词',{exact:true})).toBeVisible();
  await expect(page.getByText('今日计划 2 组 · 50 词',{exact:true})).toBeVisible();
  await page.getByLabel('每日学习组数',{exact:true}).selectOption('3');
  await expect(page.getByText('今日计划 3 组 · 75 词',{exact:true})).toBeVisible();
  await page.reload();await page.getByRole('button',{name:'雅思词汇真经',exact:true}).click();
  await expect(page.getByLabel('每日学习组数',{exact:true})).toHaveValue('3');
  await page.getByLabel('每日学习组数',{exact:true}).selectOption('2');
  await page.getByRole('button',{name:/第 1 单元 自然地理/}).click();
  await expect(page.getByRole('button',{name:/第 10 组 · 16 词/})).toBeDisabled();
  await page.getByRole('button',{name:/第 1 组 · 25 词/}).click();
  await expect(page.getByRole('heading',{name:'atmosphere',exact:true})).toBeVisible();
  expect((await snapshot(page)).words).toHaveLength(4);
  await page.reload();await page.getByRole('button',{name:'雅思词汇真经',exact:true}).click();
  await expect(page.getByText('已学 0 词',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'继续本组学习',exact:true}).click();
  await expect(page.getByRole('heading',{name:'atmosphere',exact:true})).toBeVisible();
});
test('matching score, deadline and free practice do not write scheduling data',async({page})=>{
  await start(page);const before=await snapshot(page);
  await page.getByRole('button',{name:'60 秒配对',exact:true}).click();await page.getByRole('button',{name:'开始 60 秒挑战',exact:true}).click();
  await page.getByRole('button',{name:'alpha',exact:true}).click();await page.getByRole('button',{name:'第一个',exact:true}).click();
  await expect(page.getByText('得分 10',{exact:true})).toBeVisible();
  await page.clock.fastForward(61000);await expect(page.getByText('本局结束，可以再来一局。')).toBeVisible();
  expect(await snapshot(page)).toEqual(before);
});
test('scoped PWA supports offline reload and mobile layout',async({page,context})=>{
  await start(page);await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.reload();await expect(page.getByRole('button',{name:'学习统计',exact:true})).toBeVisible();
  await context.setOffline(true);await page.reload();await expect(page.getByRole('button',{name:'学习统计',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await context.setOffline(false);
});
test('invalid and cancelled backup recovery preserve input and database',async({page})=>{
  await start(page);const before=await snapshot(page);
  await page.getByRole('button',{name:'我的单词',exact:true}).click();
  await page.getByRole('button',{name:'粘贴 JSON 恢复',exact:true}).click();
  const input=page.getByPlaceholder('{"words":[...]}');
  await input.fill('{broken');await page.getByRole('button',{name:'合并导入',exact:true}).click();
  await expect(input).toHaveValue('{broken');expect(await snapshot(page)).toEqual(before);
  await input.fill(JSON.stringify(fixture));await page.getByRole('button',{name:'覆盖',exact:true}).click();
  page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'覆盖恢复',exact:true}).click();
  await expect(input).toHaveValue(JSON.stringify(fixture));expect(await snapshot(page)).toEqual(before);
});
test('three rounds hide cues, retry errors, resume and complete only after spelling',async({page})=>{
  test.setTimeout(120000);
  await start(page);await page.getByRole('button',{name:'雅思词汇真经',exact:true}).click();
  await page.getByRole('button',{name:'开始今日学习',exact:true}).click();
  await expect(page.getByText('第 1 / 3 轮 · 英文回忆中文',{exact:true})).toBeVisible();
  for(let i=0;i<25;i++){
    await page.getByRole('button',{name:'显示答案',exact:true}).click();
    await page.getByRole('button',{name:i===0?'没想起':'想起来了',exact:true}).click();
  }
  await expect(page.getByText('错题重练 · 剩余 1 题',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'atmosphere',exact:true})).toBeVisible();
  expect((await snapshot(page)).words).toHaveLength(4);
  await page.reload();await page.getByRole('button',{name:'雅思词汇真经',exact:true}).click();
  await page.getByRole('button',{name:'继续本组学习',exact:true}).click();
  await expect(page.getByText('错题重练 · 剩余 1 题',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'显示答案',exact:true}).click();
  await page.getByRole('button',{name:'没想起',exact:true}).click();
  await expect(page.getByRole('button',{name:'显示答案',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'显示答案',exact:true}).click();
  await page.getByRole('button',{name:'想起来了',exact:true}).click();
  await expect(page.getByText('第 2 / 3 轮 · 音标回忆中文',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'atmosphere',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:/atmosphere/})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'朗读提示',exact:true})).toBeVisible();
  for(let i=0;i<25;i++){
    await page.getByRole('button',{name:'显示答案',exact:true}).click();
    await page.getByRole('button',{name:'想起来了',exact:true}).click();
  }
  await expect(page.getByText('第 3 / 3 轮 · 中文拼写英文',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'atmosphere',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:/朗读/})).toHaveCount(0);
  await page.getByLabel('英文拼写',{exact:true}).fill('atmospher');
  await page.getByRole('button',{name:'检查拼写',exact:true}).click();
  await expect(page.getByText('拼写有误，稍后重练',{exact:true})).toBeVisible();
  await expect(page.getByText('正确答案：atmosphere',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'继续',exact:true}).click();
  for(let i=1;i<25;i++){
    await page.getByLabel('英文拼写',{exact:true}).fill(sequence[i]);
    await page.getByRole('button',{name:'检查拼写',exact:true}).click();
    await expect(page.getByText('拼写正确',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'继续',exact:true}).click();
  }
  await expect(page.getByText('错题重练 · 剩余 1 题',{exact:true})).toBeVisible();
  expect((await snapshot(page)).words).toHaveLength(4);
  await page.reload();await page.getByRole('button',{name:'雅思词汇真经',exact:true}).click();
  await page.getByRole('button',{name:'继续本组学习',exact:true}).click();
  await page.getByRole('button',{name:'想不起来',exact:true}).click();
  await page.getByRole('button',{name:'继续',exact:true}).click();
  await expect(page.getByLabel('英文拼写',{exact:true})).toHaveValue('');
  await page.getByLabel('英文拼写',{exact:true}).fill(' ATMOSPHERE ');
  await page.getByRole('button',{name:'检查拼写',exact:true}).click();
  await page.getByRole('button',{name:'继续',exact:true}).click();
  await expect(page.getByText('本组学习完成',{exact:true})).toBeVisible();
  expect((await snapshot(page)).words).toHaveLength(29);
  expect((await snapshot(page)).revlog).toHaveLength(0);
  await page.getByRole('button',{name:'返回词书',exact:true}).click();
  await expect(page.getByText('已学 25 词',{exact:true})).toBeVisible();
  await expect(page.getByText('剩余 3605 词',{exact:true})).toBeVisible();
  await expect(page.getByText('今日已完成 1 / 2 组',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'开始今日学习',exact:true}).click();
  await expect(page.getByRole('heading',{name:'magnet',exact:true})).toBeVisible();
  await page.reload();await page.getByRole('button',{name:'雅思词汇真经',exact:true}).click();
  await expect(page.getByText('已学 25 词',{exact:true})).toBeVisible();
  expect((await snapshot(page)).words).toHaveLength(29);
  await page.getByRole('button',{name:'我的单词',exact:true}).click();
  await page.getByRole('button',{name:'清空单词和进度',exact:true}).click();
  await page.getByRole('button',{name:'确认清空单词和进度？',exact:true}).click();
  await page.reload();await page.getByRole('button',{name:'雅思词汇真经',exact:true}).click();
  await expect(page.getByText('已学 0 词',{exact:true})).toBeVisible();
  expect((await snapshot(page)).words).toHaveLength(0);
});
test('stale tab rejection retains new word form and existing records',async({page,context})=>{
  await start(page);
  const other=await context.newPage();await other.goto('/');await other.getByRole('button',{name:'我的单词',exact:true}).click();
  await other.getByRole('button',{name:'收藏',exact:true}).first().click();
  await expect(other.getByRole('button',{name:'取消收藏',exact:true})).toHaveCount(1);
  const before=await snapshot(page);
  await page.getByRole('button',{name:'我的单词',exact:true}).click();await page.getByRole('button',{name:'录入新词',exact:true}).click();
  await page.getByPlaceholder('ubiquitous',{exact:true}).fill('quokka');await page.getByLabel(/中文释义/).fill('短尾矮袋鼠');
  await page.getByRole('button',{name:'录入并排进FSRS日历',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('保存未完成');
  await expect(page.getByPlaceholder('ubiquitous',{exact:true})).toHaveValue('quokka');
  expect(await snapshot(page)).toEqual(before);
});

test('missing phonetic fallback is explicit',async({page})=>{
  const i=sequence.indexOf('carbon dioxide');
  const groupIndex=Math.floor(i/25);
  const completed=Object.fromEntries(Array.from({length:groupIndex},(_,n)=>[`u01-g${String(n+1).padStart(2,'0')}`,'2026-10-21']));
  const groupId=`u01-g${String(groupIndex+1).padStart(2,'0')}`;
  await start(page,{...fixture,bookLearning:{bookId:'ielts-bible-core-v1',dailyGroups:2,completed,active:{groupId,seen:i%25,round:1,retry:[],inRetry:false}}});
  await page.getByRole('button',{name:'雅思词汇真经',exact:true}).click();
  await page.getByRole('button',{name:'继续本组学习',exact:true}).click();
  await expect(page.getByText('暂无音标，本题使用英文提示',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'carbon dioxide',exact:true})).toBeVisible();
});

test('a failed spelling save preserves the answer and retry feedback',async({page,context})=>{
  await start(page,{...fixture,bookLearning:{bookId:'ielts-bible-core-v1',dailyGroups:2,completed:{},active:{groupId:'u01-g01',seen:0,round:2,retry:[],inRetry:false}}});
  await page.getByRole('button',{name:'雅思词汇真经',exact:true}).click();
  await page.getByRole('button',{name:'继续本组学习',exact:true}).click();
  await page.getByLabel('英文拼写',{exact:true}).fill('wrong');
  await page.getByRole('button',{name:'检查拼写',exact:true}).click();
  const other=await context.newPage();await other.goto('/');await other.getByRole('button',{name:'我的单词',exact:true}).click();
  await other.getByRole('button',{name:'收藏',exact:true}).first().click();
  await expect(other.getByRole('button',{name:'取消收藏',exact:true})).toHaveCount(1);
  const before=await snapshot(page);
  await page.getByRole('button',{name:'继续',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('保存未完成');
  await expect(page.getByLabel('英文拼写',{exact:true})).toHaveValue('wrong');
  await expect(page.getByText('拼写有误，稍后重练',{exact:true})).toBeVisible();
  expect(await snapshot(page)).toEqual(before);
});


test('fresh workspace has zero calendar history and no demo words', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-22T12:00:00+08:00') });
  await page.goto('/');
  await page.getByRole('button', { name: '看板', exact: true }).click();
  await expect(page.getByTestId('today-learning')).toHaveText('0 组 / 0 词');
  await expect(page.getByRole('button', { name: '今日 A4 攻坚 · 0 词', exact: true })).toBeVisible();
  expect((await snapshot(page)).words).toHaveLength(0);
  await page.getByRole('button', { name: '从词书开始学习', exact: true }).click();
  await expect(page.getByRole('heading', { name: '词书库', exact: true })).toBeVisible();
});

for (const groups of [1, 2]) test(`calendar personal progress: ${groups} groups with matching future A4 scope`, async ({ page }, info) => {
  const focusCount = groups === 2 ? 2 : 0;
  const words = fixture.words.map((word, index) => ({ ...word, nextReviewDate: '2026-10-23', ...(index < focusCount ? { focus: { active: true, addedAt: today, nextDate: '2026-10-23', reason: '词书薄弱词' }, tag: '雅思词汇真经 · 自然地理' } : {}) }));
  const completed = Object.fromEntries(Array.from({ length: groups }, (_, i) => [`u01-g${String(i + 1).padStart(2, '0')}`, today]));
  await start(page, { ...fixture, words, bookLearning: { bookId: 'ielts-bible-core-v1', dailyGroups: 2, completed } });
  await page.getByRole('button', { name: '看板', exact: true }).click();
  await expect(page.getByTestId('today-learning')).toHaveText(`${groups} 组 / ${groups * 25} 词`);
  await page.getByRole('button', { name: /^选择日期 2026-10-23/ }).click();
  await expect(page.getByRole('heading', { name: /^A4 攻坚 ·/ })).toHaveText(`A4 攻坚 · ${focusCount} 词（预计）`);
  if (!focusCount) return;
  await page.getByRole('button', { name: '打开 A4 攻坚 · 2 词', exact: true }).click();
  await expect(page.getByRole('listitem')).toHaveCount(2);
  await expect(page.getByRole('button', { name: /^忘记：/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('A4-paper.png'), fullPage: true });
  await page.getByRole('button', { name: '当前：重点攻坚 · 切换全部 FSRS 到期', exact: true }).click();
  await expect(page.getByRole('listitem')).toHaveCount(4);
});

test('today dashboard opens the exact all/focus counts and preserves focus review history', async ({ page }) => {
  const words = fixture.words.map((word, index) => ({ ...word, ...(index < 2 ? { focus: { active: true, addedAt: '2026-10-21', nextDate: today } } : {}) }));
  await start(page, { ...fixture, words });
  await page.getByRole('button', { name: '看板', exact: true }).click();
  await page.getByRole('button', { name: '今日全部复习 · 4 词', exact: true }).click();
  await expect(page.getByRole('listitem')).toHaveCount(4);
  await page.getByRole('button', { name: '当前：全部 FSRS 到期 · 切换重点攻坚', exact: true }).click();
  await expect(page.getByRole('listitem')).toHaveCount(2);
  await page.getByRole('button', { name: /^记住：/ }).first().click();
  await expect(page.getByRole('listitem')).toHaveCount(2);
  await expect(page.getByRole('button', { name: /^记住：/ })).toHaveCount(1);
  await page.reload();
  await page.getByRole('button', { name: '看板', exact: true }).click();
  await expect(page.getByText(/A4 攻坚：已完成 1 词/)).toBeVisible();
  const saved = await snapshot(page);
  expect(saved.revlog).toHaveLength(1);
});


test('readable paper paginates without losing cards or grading other pages', async ({ page }, info) => {
  const words = Array.from({ length: 9 }, (_, i) => ({ ...fixture.words[0], id: `page-word-${i}`, word: i === 0 ? 'electroencephalographically' : `vocabulary${i}`, meaning: '很长的中文释义用于确认手机屏幕上的换行与可读性', phonetic: '/ˌɪˌlɛktroʊ.ɛnˌsɛfəloʊˈɡræfɪkli/', tag: '雅思词汇真经 · 自然地理 · 第 1 组', focus: { active: true, addedAt: '2026-10-21', nextDate: today } }));
  await start(page, { ...fixture, words });
  await page.getByRole('button', { name: /A4 刷词/ }).click();
  await expect(page.getByRole('listitem')).toHaveCount(8);
  await expect(page.getByText('今日复习 · 本页 8 词 · 第 1 / 2 页', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.getByText('electroencephalographically', { exact: true }).evaluate(element => element.getBoundingClientRect().right <= element.closest('button')!.getBoundingClientRect().right)).toBe(true);
  await page.getByRole('listitem').first().screenshot({ path: info.outputPath('A4-longword.png') });
  await page.getByRole('button', { name: /只看中/ }).click();
  await expect(page.getByRole('listitem').first().locator('.masked')).toHaveCount(1);
  await page.getByRole('button', { name: /全显/ }).click();
  await page.screenshot({ path: info.outputPath('A4-study.png'), fullPage: true });
  await page.getByRole('button', { name: '下一张', exact: true }).click();
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await page.getByRole('button', { name: '勾选记住：vocabulary8', exact: true }).click();
  await page.getByRole('button', { name: /提交已勾选 1 词/ }).click();
  await page.getByRole('button', { name: '好的', exact: true }).click();
  expect((await snapshot(page)).revlog).toHaveLength(1);
  await page.getByRole('button', { name: '上一张', exact: true }).click();
  await expect(page.getByRole('button', { name: /^忘记：/ })).toHaveCount(8);
});

test('group completion picks only chosen weak words, and tomorrow A4 shows exactly those', async ({ page }, testInfo) => {
  const bookLearning = { bookId: 'ielts-bible-core-v1', dailyGroups: 2, completed: {}, active: { groupId: 'u01-g01', seen: 23, round: 2, retry: [], inRetry: false } };
  await start(page, { ...fixture, bookLearning });
  await page.getByRole('button', { name: '雅思词汇真经', exact: true }).click();
  await page.getByRole('button', { name: '继续本组学习', exact: true }).click();
  await page.getByLabel('英文拼写', { exact: true }).fill('wrong');
  await page.getByRole('button', { name: '检查拼写', exact: true }).click();
  await expect(page.getByRole('button', { name: '加入 A4 攻坚 · 明天复习', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '继续', exact: true }).click();
  for (const word of [sequence[24], sequence[23]]) {
    await page.getByLabel('英文拼写', { exact: true }).fill(word);
    await page.getByRole('button', { name: '检查拼写', exact: true }).click();
    await page.getByRole('button', { name: '继续', exact: true }).click();
  }
  await expect(page.getByText('本组学习完成', { exact: true })).toBeVisible();
  await expect(page.getByRole('listitem')).toHaveCount(25);
  await expect(page.getByRole('listitem').first()).toContainText(sequence[23]);
  await expect(page.getByRole('listitem').first()).toContainText('本次出错');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: `加入 A4：${sequence[23]}`, exact: true }).click();
  await expect(page.getByRole('button', { name: `移出 A4：${sequence[23]}`, exact: true })).toBeVisible();
  await expect(page.getByText('已选 1 词加入 A4 · 明天只复习这些', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('book-focus-picker.png'), fullPage: true });
  const saved = await snapshot(page);
  expect(saved.words).toHaveLength(29);
  expect((saved.words as { word: string; focus?: { active: boolean } }[]).filter(w => w.focus?.active).map(w => w.word)).toEqual([sequence[23]]);
  await page.getByRole('button', { name: '返回词书', exact: true }).click();
  await page.getByRole('button', { name: /第 1 单元 自然地理/ }).click();
  await page.getByRole('button', { name: /第 1 组 · 25 词/ }).click();
  await expect(page.getByRole('button', { name: `移出 A4：${sequence[23]}`, exact: true })).toBeVisible();
  await expect(page.getByRole('listitem')).toHaveCount(25);
  await page.clock.setSystemTime(new Date('2026-10-23T09:00:00+08:00'));
  await page.reload();
  await page.getByRole('button', { name: /A4 刷词/ }).click();
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await expect(page.getByRole('listitem').first()).toContainText(sequence[23]);
  await page.getByRole('button', { name: '看板', exact: true }).click();
  await expect(page.getByRole('button', { name: '今日 A4 攻坚 · 1 词', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '今日全部复习 · 29 词', exact: true })).toBeVisible();
});

test('an app left open overnight moves today’s A4 and dashboard to the new day', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: /A4 刷词/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('10 月 22 日');
  await page.clock.setSystemTime(new Date('2026-10-23T00:01:00+08:00'));
  await page.clock.fastForward(31000);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('10 月 23 日');
  await expect(page.getByText(/^今日任务/)).toBeVisible();
  await page.getByRole('button', { name: '看板', exact: true }).click();
  await expect(page.getByText(/^今天 · 2026-10-23/)).toBeVisible();
});
test('a mistaken A4 pick can be undone in the picker and in My Words, without demo-data reset', async ({ page }, testInfo) => {
  await start(page, { ...fixture, bookLearning: { bookId: 'ielts-bible-core-v1', dailyGroups: 2, completed: { 'u01-g01': today } } });
  await page.getByRole('button', { name: '雅思词汇真经', exact: true }).click();
  await page.getByRole('button', { name: /第 1 单元 自然地理/ }).click();
  await page.getByRole('button', { name: /第 1 组 · 25 词/ }).click();
  for (const word of sequence.slice(0, 2)) await page.getByRole('button', { name: `加入 A4：${word}`, exact: true }).click();
  await expect(page.getByText('已选 2 词加入 A4 · 明天只复习这些', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: `移出 A4：${sequence[1]}`, exact: true }).click();
  await expect(page.getByText('已选 1 词加入 A4 · 明天只复习这些', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: `加入 A4：${sequence[1]}`, exact: true })).toBeVisible();
  const active = async () => ((await snapshot(page)).words as { word: string; focus?: { active: boolean } }[]).filter(w => w.focus?.active).map(w => w.word);
  expect(await active()).toEqual([sequence[0]]);

  await page.getByRole('button', { name: '我的单词', exact: true }).click();
  await expect(page.getByRole('button', { name: '恢复示例数据' })).toHaveCount(0);
  await page.getByRole('button', { name: /^A4 攻坚 1$/ }).click();
  await expect(page.getByRole('listitem')).toHaveCount(1);
  const row = page.getByRole('listitem').first();
  await expect(row).toContainText(sequence[0]);
  await expect(row).toContainText('攻坚中 · 2026-10-23 到期');
  await page.screenshot({ path: testInfo.outputPath('bank-focus-filter.png') });
  await row.getByRole('button', { name: '移出 A4', exact: true }).click();
  await expect(page.getByRole('listitem')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^A4 攻坚 0$/ })).toBeVisible();
  expect(await active()).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.clock.setSystemTime(new Date('2026-10-23T09:00:00+08:00'));
  await page.reload();
  await page.getByRole('button', { name: /A4 刷词/ }).click();
  await expect(page.getByText('今天没有待复习的单词', { exact: true })).toBeVisible();
});

test('A4 never grades unrated words: progress shows rated/total and unrated words stay for later', async ({ page }, testInfo) => {
  const words = fixture.words.slice(0, 3).map(word => ({ ...word, focus: { active: true, addedAt: '2026-10-21', nextDate: today } }));
  await start(page, { ...fixture, words });
  await page.getByRole('button', { name: /A4 刷词/ }).click();
  await expect(page.getByText('本页已评分 0 / 3', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /完成本页复习打卡/ })).toHaveCount(0);
  await page.getByRole('button', { name: '记住：alpha', exact: true }).click();
  await expect(page.getByText('本页已评分 1 / 3', { exact: true })).toBeVisible();
  await expect(page.getByText(/未评分的 2 词保留在今日待复习/)).toBeVisible();
  await expect(page.getByText('今日待复习 2 · 今日已完成 1', { exact: false })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('A4-rated-progress.png'), fullPage: true });
  await page.getByRole('button', { name: '稍后处理', exact: true }).click();
  const saved = await snapshot(page);
  expect(saved.revlog).toHaveLength(1);
  const focused = (saved.words as { word: string; nextReviewDate: string; focus?: { active: boolean } }[]).filter(w => w.focus?.active);
  expect(focused.map(w => w.word).sort()).toEqual(['beta', 'gamma']);
  expect(focused.every(w => w.nextReviewDate === today)).toBe(true);
  await page.reload();
  await page.getByRole('button', { name: /A4 刷词/ }).click();
  await expect(page.getByText('本页已评分 1 / 3', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '勾选记住：beta', exact: true }).click();
  await page.getByRole('button', { name: '提交已勾选 1 词 · 按「记住」评分', exact: true }).click();
  await page.getByRole('button', { name: '好的', exact: true }).click();
  expect((await snapshot(page)).revlog).toHaveLength(2);
  await expect(page.getByRole('button', { name: '记住：gamma', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('A4 lifecycle explains words that are not on today’s page', async ({ page }) => {
  const words = fixture.words.map((word, index) => ({
    ...word,
    ...(index === 0 ? { nextReviewDate: '2026-10-23', focus: { active: true, addedAt: today, nextDate: '2026-10-23' }, focusAddedDays: [today] } : {}),
    ...(index === 1 ? { focus: { active: false, addedAt: '2026-10-20', nextDate: '2026-10-21' }, focusAddedDays: ['2026-10-20'] } : {})
  }));
  await start(page, { ...fixture, words });
  await page.getByRole('button', { name: /A4 刷词/ }).click();
  await expect(page.getByText('今天没有待复习的单词', { exact: true })).toBeVisible();
  await expect(page.getByText('另有 1 词攻坚中，最早 2026-10-23 到期', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '我的单词', exact: true }).click();
  await page.getByRole('button', { name: /^A4 攻坚 1$/ }).click();
  await expect(page.getByRole('listitem').first()).toContainText('攻坚中 · 2026-10-23 到期');
  await page.getByRole('button', { name: /^攻坚记录 2$/ }).click();
  await expect(page.getByRole('listitem')).toHaveCount(2);
  await expect(page.getByRole('listitem').filter({ hasText: 'beta' })).toContainText('已退出攻坚 · 历史加入 1 次');
});

test('replace import previews both sides and keeps an automatic pre-import backup; merge reports a summary', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: '我的单词', exact: true }).click();
  await page.getByRole('button', { name: '粘贴 JSON 恢复', exact: true }).click();
  const input = page.getByPlaceholder('{"words":[...]}');
  const extra = { ...fixture, words: [...fixture.words, { ...fixture.words[0], id: 'word-x', word: 'epsilon', meaning: '第五个' }] };
  await input.fill(JSON.stringify(extra));
  await page.getByRole('button', { name: '合并导入', exact: true }).click();
  await expect(page.getByText('合并完成：新增 1 词 · 已有 4 词保留本机排期 · 新增 0 条日志', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '粘贴 JSON 恢复', exact: true }).click();
  await input.fill(JSON.stringify(fixture));
  await page.getByRole('button', { name: '覆盖', exact: true }).click();
  let message = '';
  page.once('dialog', dialog => { message = dialog.message(); void dialog.accept(); });
  await page.getByRole('button', { name: '覆盖恢复', exact: true }).click();
  await expect(page.getByRole('button', { name: /^下载覆盖导入前的自动备份/ })).toBeVisible();
  expect(message).toContain('备份：4 词 · A4 0 词 · 复习日志 0 条 · 词书 0 组');
  expect(message).toContain('当前：5 词 · A4 0 词 · 复习日志 0 条 · 词书 0 组');
  expect((await snapshot(page)).words).toHaveLength(4);
  await page.reload();
  await page.getByRole('button', { name: '我的单词', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /^下载覆盖导入前的自动备份/ }).click();
  const file = await download;
  expect(file.suggestedFilename()).toContain('before-import');
  const text = readFileSync(await file.path(), 'utf8');
  expect(JSON.parse(text).words).toHaveLength(5);
});

test('a fresh workspace shows a read-only first-run guide and stores no demo words', async ({ page }) => {
  await start(page, { words: [], skipped: [], settings: { dailyClaim: 30, lastClaimDate: '' } });
  await expect(page.getByTestId('first-run-guide')).toContainText('第一次使用 · 三步上手');
  expect((await snapshot(page)).words).toHaveLength(0);
  await page.reload();
  await expect(page.getByTestId('first-run-guide')).toBeVisible();
  expect((await snapshot(page)).words).toHaveLength(0);
});

test('calendar cells and day detail separate pending, done, new A4 and predicted words', async ({ page }, testInfo) => {
  const focus = (addedAt: string, nextDate: string) => ({ focus: { active: true, addedAt, nextDate }, focusAddedDays: [addedAt], nextReviewDate: nextDate });
  const words = fixture.words.map((word, index) => ({ ...word, ...(index === 0 || index === 2 ? focus('2026-10-21', today) : index === 1 ? focus(today, '2026-10-23') : {}) }));
  await start(page, { ...fixture, words, bookLearning: { bookId: 'ielts-bible-core-v1', dailyGroups: 2, completed: { 'u01-g01': '2026-10-21' } } });
  await page.getByRole('button', { name: /A4 刷词/ }).click();
  await page.getByRole('button', { name: '记住：alpha', exact: true }).click();
  await page.getByRole('button', { name: '看板', exact: true }).click();
  await expect(page.getByRole('button', { name: '选择日期 2026-10-22：待复习 1 词，已完成 1 词，新增攻坚 1 词', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '选择日期 2026-10-21：新增攻坚 2 词', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '选择日期 2026-10-23：预计到期 1 词', exact: true })).toBeVisible();
  await expect(page.getByTestId('day-breakdown')).toHaveText('今天：待复习 1 词 · 已完成 1 词 · 新增攻坚 1 词');
  await expect(page.getByRole('button', { name: 'alpha（已完成）', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'gamma（待复习）', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('calendar-marks.png'), fullPage: true });
  await page.getByRole('button', { name: /^选择日期 2026-10-23/ }).click();
  await expect(page.getByTestId('day-breakdown')).toHaveText('预计：预计到期 1 词');
  await expect(page.getByRole('button', { name: 'beta（预计）', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^选择日期 2026-10-21/ }).click();
  await expect(page.getByTestId('day-breakdown')).toHaveText('真实记录：新增攻坚 2 词');
  await page.getByRole('button', { name: '全部复习', exact: true }).click();
  await expect(page.getByRole('button', { name: '选择日期 2026-10-21：词书初学 25 词', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '选择日期 2026-10-22：待复习 2 词，已完成 1 词', exact: true })).toBeVisible();
});

test('clearing and repeated replace imports each keep their own automatic backup', async ({ page }, testInfo) => {
  await start(page);
  await page.getByRole('button', { name: '我的单词', exact: true }).click();
  await page.getByRole('button', { name: '清空单词和进度', exact: true }).click();
  await page.getByRole('button', { name: '确认清空单词和进度？', exact: true }).click();
  await expect(page.getByRole('button', { name: /^下载清空前的自动备份/ })).toHaveCount(1);
  expect((await snapshot(page)).words).toHaveLength(0);
  const replace = async (data: unknown) => {
    await page.getByRole('button', { name: '粘贴 JSON 恢复', exact: true }).click();
    await page.getByPlaceholder('{"words":[...]}').fill(JSON.stringify(data));
    await page.getByRole('button', { name: '覆盖', exact: true }).click();
    page.once('dialog', dialog => void dialog.accept());
    await page.getByRole('button', { name: '覆盖恢复', exact: true }).click();
  };
  await replace(fixture);
  await expect(page.getByRole('button', { name: /^下载覆盖导入前的自动备份/ })).toHaveCount(1);
  await replace({ ...fixture, words: fixture.words.slice(0, 1) });
  await expect(page.getByRole('button', { name: /^下载覆盖导入前的自动备份/ })).toHaveCount(2);
  expect((await snapshot(page)).words).toHaveLength(1);
  await page.reload();
  await page.getByRole('button', { name: '我的单词', exact: true }).click();
  await expect(page.getByText(/^清空前 · .* · 4 词 · A4 0 词 · 日志 0 条$/)).toBeVisible();
  await expect(page.getByTestId('storage-status')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('auto-backups.png'), fullPage: true });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /^下载清空前的自动备份/ }).click();
  const file = await download;
  expect(file.suggestedFilename()).toContain('before-clear');
  expect(JSON.parse(readFileSync(await file.path(), 'utf8')).words).toHaveLength(4);
});

test('a newer database version opened in another tab makes this tab stop writing and ask for a refresh', async ({ page, context }) => {
  await start(page);
  await page.getByRole('button', { name: '我的单词', exact: true }).click();
  const other = await context.newPage();
  await other.goto('/');
  await expect(other.getByRole('button', { name: '学习统计', exact: true })).toBeVisible();
  await page.evaluate(() => new Promise<void>((resolve, reject) => { const r = indexedDB.open('ielts-a4-v3', 30); r.onsuccess = () => { r.result.close(); resolve(); }; r.onerror = () => reject(r.error); r.onblocked = () => reject(new Error('blocked')); }));
  await expect(other.getByRole('alert')).toContainText('新版本已在其他窗口打开');
});

test('a save in another tab warns this tab before it can act on stale records', async ({ page, context }) => {
  await start(page);
  const other = await context.newPage();
  await other.goto('/');
  await expect(other.getByRole('button', { name: '学习统计', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '我的单词', exact: true }).click();
  await page.getByRole('button', { name: '清空单词和进度', exact: true }).click();
  await page.getByRole('button', { name: '确认清空单词和进度？', exact: true }).click();
  await expect(other.getByRole('alert')).toContainText('其他标签页已更新学习记录');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await other.getByRole('button', { name: '刷新学习记录', exact: true }).click();
  await expect(other.getByRole('alert')).toHaveCount(0);
  expect(await other.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('a newly deployed service worker prompts first, then switches caches and keeps records and offline use', async ({ page, context }, testInfo) => {
  const dir = `__sw-update-${testInfo.project.name}__`;
  const dist = new URL('../dist/', import.meta.url);
  const root = new URL(`${dir}/`, dist);
  mkdirSync(root, { recursive: true });
  for (const f of ['index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) copyFileSync(new URL(f, dist), new URL(f, root));
  const sw = readFileSync(new URL('sw.js', dist), 'utf8');
  const oldCache = sw.match(/const CACHE = '([^']+)'/)![1];
  writeFileSync(new URL('sw.js', root), sw);
  try {
    await page.addInitScript(data => { if (!localStorage.getItem('fixture')) { localStorage.setItem('ielts_a4_workspace_v2', JSON.stringify(data)); localStorage.setItem('fixture', '1'); } }, fixture);
    await page.goto(`/${dir}/`);
    await expect(page.getByRole('button', { name: '学习统计', exact: true })).toBeVisible();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await expect(page.getByText('新版本已下载，学习记录不受影响。')).toHaveCount(0);
    expect((await snapshot(page)).words).toHaveLength(4);
    writeFileSync(new URL('sw.js', root), sw.replace(oldCache, `${oldCache}-next`));
    await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())!.update(); });
    await expect(page.getByText('新版本已下载，学习记录不受影响。')).toBeVisible();
    expect((await page.evaluate(() => caches.keys())).sort()).toEqual([oldCache, `${oldCache}-next`].sort());
    await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: '立即更新', exact: true }).click()]);
    await expect(page.getByRole('button', { name: '学习统计', exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => caches.keys())).toEqual([`${oldCache}-next`]);
    await expect(page.getByText('新版本已下载，学习记录不受影响。')).toHaveCount(0);
    expect((await snapshot(page)).words).toHaveLength(4);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('button', { name: '学习统计', exact: true })).toBeVisible();
    await context.setOffline(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
