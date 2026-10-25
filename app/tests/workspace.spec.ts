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
  await page.getByRole('button',{name:'当前：重点攻坚 · 切换全部到期复习'}).click();
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
  await page.getByRole('button',{name:/录入并加入复习/}).first().click();
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
  await page.clock.fastForward(61000);await expect(page.getByRole('region',{name:'本局总结'})).toContainText('总分 10');
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
  await page.getByRole('button',{name:'录入并加入复习',exact:true}).click();
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
  await page.getByRole('button', { name: '当前：重点攻坚 · 切换全部到期复习', exact: true }).click();
  await expect(page.getByRole('listitem')).toHaveCount(4);
});

test('today dashboard opens the exact all/focus counts and preserves focus review history', async ({ page }) => {
  const words = fixture.words.map((word, index) => ({ ...word, ...(index < 2 ? { focus: { active: true, addedAt: '2026-10-21', nextDate: today } } : {}) }));
  await start(page, { ...fixture, words });
  await page.getByRole('button', { name: '看板', exact: true }).click();
  await page.getByRole('button', { name: '今日全部复习 · 4 词', exact: true }).click();
  await expect(page.getByRole('listitem')).toHaveCount(4);
  await page.getByRole('button', { name: '当前：全部到期复习 · 切换重点攻坚', exact: true }).click();
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

test('group completion: one-tap missed/all batch with real counts, missed words persist across reload, tomorrow A4 shows exactly those', async ({ page }, testInfo) => {
  const bookLearning = { bookId: 'ielts-bible-core-v1', dailyGroups: 2, completed: {}, active: { groupId: 'u01-g01', seen: 23, round: 2, retry: [], inRetry: false }, missed: { 'u01-g01': [sequence[5]] } };
  await start(page, { ...fixture, bookLearning });
  await page.getByRole('button', { name: '雅思词汇真经', exact: true }).click();
  await page.getByRole('button', { name: '继续本组学习', exact: true }).click();
  await page.getByLabel('英文拼写', { exact: true }).fill('wrong');
  await page.getByRole('button', { name: '检查拼写', exact: true }).click();
  await expect(page.getByRole('button', { name: /加入/ })).toHaveCount(0);
  await page.getByRole('button', { name: '继续', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: '雅思词汇真经', exact: true }).click();
  await page.getByRole('button', { name: '继续本组学习', exact: true }).click();
  for (const word of [sequence[24], sequence[23]]) {
    await page.getByLabel('英文拼写', { exact: true }).fill(word);
    await page.getByRole('button', { name: '检查拼写', exact: true }).click();
    await page.getByRole('button', { name: '继续', exact: true }).click();
  }
  await expect(page.getByText('本组学习完成', { exact: true })).toBeVisible();
  await expect(page.getByRole('listitem')).toHaveCount(25);
  await expect(page.getByRole('listitem').filter({ hasText: '本次出错' })).toHaveCount(2);
  await expect(page.getByRole('button', { name: /^加入 A4/ })).toHaveCount(0);
  const before = await snapshot(page);
  expect(before.words).toHaveLength(29);
  expect((before.words as { focus?: { active: boolean }; review?: string }[]).filter(w => w.review === 'off')).toHaveLength(25);
  expect((before.words as { focus?: { active: boolean } }[]).some(w => w.focus?.active)).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('group-complete-batch.png'), fullPage: true });
  const missedBtn = page.getByRole('button', { name: '本组错词 2 词', exact: true });
  await expect(page.getByRole('button', { name: '本组全部 25 词', exact: true })).toBeVisible();
  await missedBtn.click();
  await expect(page.getByRole('status').filter({ hasText: '已加入 2 词，明天开始复习' })).toBeVisible();
  await missedBtn.click();
  await expect(page.getByRole('status').filter({ hasText: '没有新加入：2 词已在复习中' })).toBeVisible();
  const saved = await snapshot(page);
  expect((saved.words as { word: string; focus?: { active: boolean } }[]).filter(w => w.focus?.active).map(w => w.word).sort()).toEqual([sequence[5], sequence[23]].sort());
  expect(saved.revlog).toHaveLength(0);
  expect((saved.meta as { key: string; value: { groupPick?: string } }[]).find(m => m.key === 'settings')?.value.groupPick).toBe('missed');
  await page.getByRole('button', { name: '返回词书', exact: true }).click();
  await page.getByRole('button', { name: /第 1 单元 自然地理/ }).click();
  await page.getByRole('button', { name: /第 1 组 · 25 词/ }).click();
  await expect(page.getByText('已在复习 2 / 25 词', { exact: true })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: '本次出错' })).toHaveCount(2);
  await page.clock.setSystemTime(new Date('2026-10-23T09:00:00+08:00'));
  await page.reload();
  await page.getByRole('button', { name: /A4 刷词/ }).click();
  await expect(page.getByRole('listitem')).toHaveCount(2);
  await page.getByRole('button', { name: '看板', exact: true }).click();
  await expect(page.getByRole('button', { name: '今日 A4 攻坚 · 2 词', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '今日全部复习 · 6 词', exact: true })).toBeVisible();
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
test('old groups: missed history unavailable, all-batch keeps existing schedules; My Words batch-adds the filtered not-in-review words and undo returns them', async ({ page }, testInfo) => {
  const old = sequence.slice(0, 2).map((word, i) => ({ id: `old-${i}`, word, meaning: '旧词', phonetic: '', synonyms: '', createdAt: '2026-10-01', stage: 1, nextReviewDate: '2026-11-01', reviewHistory: ['2026-10-01'], isHard: false }));
  await start(page, { ...fixture, words: [...fixture.words, ...old], bookLearning: { bookId: 'ielts-bible-core-v1', dailyGroups: 2, completed: { 'u01-g01': '2026-10-20' } } });
  await page.getByRole('button', { name: '雅思词汇真经', exact: true }).click();
  await page.getByRole('button', { name: /第 1 单元 自然地理/ }).click();
  await page.getByRole('button', { name: /第 1 组 · 25 词/ }).click();
  await expect(page.getByRole('button', { name: '本组错词 · 记录不可用', exact: true })).toBeDisabled();
  await expect(page.getByText(/^历史错词记录不可用/)).toBeVisible();
  await page.getByRole('button', { name: '本组全部 25 词', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '已加入 25 词，明天开始复习（其中 2 词保留原复习日期）' })).toBeVisible();
  const words = (await snapshot(page)).words as { id: string; word: string; nextReviewDate: string; focus?: { active: boolean }; review?: string }[];
  expect(words.filter(w => w.id.startsWith('old-')).map(w => w.nextReviewDate)).toEqual(['2026-11-01', '2026-11-01']);
  expect(words.filter(w => w.focus?.active)).toHaveLength(25);
  expect(words.filter(w => w.focus?.active && !w.id.startsWith('old-')).every(w => w.nextReviewDate === '2026-10-23')).toBe(true);

  await page.getByRole('button', { name: '我的单词', exact: true }).click();
  await page.getByRole('button', { name: /^A4 攻坚 25$/ }).click();
  const row = page.getByRole('listitem').filter({ hasText: sequence[3] });
  await row.getByRole('button', { name: '移出 A4', exact: true }).click();
  await page.getByRole('button', { name: /^未加入复习 1$/ }).click();
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await expect(page.getByRole('listitem').first()).toContainText('已学 · 未加入复习');
  await expect(page.getByRole('button', { name: /^加入/ })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('bank-batch.png') });
  await page.getByRole('button', { name: '将筛选出的 1 个未复习词加入复习', exact: true }).click();
  await expect(page.getByRole('button', { name: /^未加入复习 0$/ })).toBeVisible();
  expect(((await snapshot(page)).words as { focus?: { active: boolean } }[]).filter(w => w.focus?.active)).toHaveLength(25);
  expect((await snapshot(page)).revlog).toHaveLength(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('not-in-review words stay out of home, A4, dashboard and the due count but remain searchable', async ({ page }) => {
  const off = ['epsilon', 'zeta'].map((word, i) => ({ id: `off-${i}`, word, meaning: `未选${i}`, phonetic: '', synonyms: '', createdAt: '2026-10-20', stage: 0, nextReviewDate: today, reviewHistory: ['2026-10-20'], isHard: false, review: 'off' }));
  await start(page, { ...fixture, words: [...fixture.words, ...off] });
  await expect(page.getByTestId('next-step')).toContainText('全部到期复习 · 4 词');
  await page.getByRole('button', { name: /A4 刷词/ }).click();
  await page.getByRole('button', { name: '当前：重点攻坚 · 切换全部到期复习' }).click();
  await expect(page.getByRole('listitem')).toHaveCount(4);
  await page.getByRole('button', { name: '看板', exact: true }).click();
  await expect(page.getByRole('button', { name: '今日全部复习 · 4 词', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '我的单词', exact: true }).click();
  await expect(page.getByText('共 6 词 · 顽固 0 · 今日待复习 4', { exact: true })).toBeVisible();
  await page.getByPlaceholder(/搜索英文/).fill('zeta');
  await expect(page.getByRole('listitem')).toHaveCount(1);
});

test('review density is saved, survives reload, and changes the next due date of later grades', async ({ page }, testInfo) => {
  await start(page);
  await page.getByRole('button', { name: '雅思词汇真经', exact: true }).click();
  await page.getByRole('button', { name: '强化', exact: true }).click();
  await expect(page.getByRole('button', { name: '强化', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('越密集，间隔越短、每日任务通常越多', { exact: false })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('density-settings.png'), fullPage: true });
  await page.reload();
  await page.getByRole('button', { name: '雅思词汇真经', exact: true }).click();
  await expect(page.getByRole('button', { name: '强化', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const due = async (word: string) => ((await snapshot(page)).words as { word: string; nextReviewDate: string }[]).find(w => w.word === word)!.nextReviewDate;
  const before = await due('beta');
  const grade = async (word: string) => {
    await page.getByRole('button', { name: /A4 刷词/ }).click();
    await page.getByRole('button', { name: '当前：重点攻坚 · 切换全部到期复习' }).click();
    await page.getByRole('button', { name: `记住：${word}`, exact: true }).click();
    await expect(page.getByText(/评分已保存/)).toBeVisible();
  };
  await grade('alpha');
  expect(await due('beta')).toBe(before);
  await page.getByRole('button', { name: '词书库', exact: true }).click();
  await page.getByRole('button', { name: '雅思词汇真经', exact: true }).click();
  await page.getByRole('button', { name: '轻松', exact: true }).click();
  await expect(page.getByRole('button', { name: '轻松', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await grade('beta');
  expect(await due('alpha') < await due('beta')).toBe(true);
  expect(((await snapshot(page)).meta as { key: string; value: { density?: string } }[]).find(m => m.key === 'settings')?.value.density).toBe('relaxed');
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

async function maskSides(page: Page) {
  return page.locator('li[data-masked]').evaluateAll(items => items.map(item => [item.querySelector('.font-serif')?.textContent ?? '', (item as HTMLElement).dataset.masked ?? ''] as const));
}
const sideCounts = (sides: (readonly [string, string])[]) => ({ en: sides.filter(([, s]) => s === 'en').length, cn: sides.filter(([, s]) => s === 'cn').length });
const focusWords = (n: number) => Array.from({ length: n }, (_, i) => ({ ...fixture.words[0], id: `mask-${i}`, word: `maskword${i}`, meaning: `遮挡释义${i}`, focus: { active: true, addedAt: '2026-10-21', nextDate: today } }));

test('random masking splits an 8-word page 4/4, is stable per seed and reassigns on shuffle', async ({ page }, info) => {
  await start(page, { ...fixture, words: focusWords(8) });
  await page.getByRole('button', { name: /A4 刷词/ }).click();
  await page.getByRole('button', { name: '🎲随机', exact: true }).click();
  const first = await maskSides(page);
  expect(first).toHaveLength(8);
  expect(sideCounts(first)).toEqual({ en: 4, cn: 4 });
  await expect(page.locator('li[data-masked="en"] .masked')).toHaveCount(4);
  await expect(page.locator('li[data-masked="cn"] .masked')).toHaveCount(4);
  await page.screenshot({ path: info.outputPath('A4-random-8.png'), fullPage: true });
  await page.getByRole('button', { name: '👁️全显', exact: true }).click();
  await expect(page.locator('.masked')).toHaveCount(0);
  await page.getByRole('button', { name: '🎲随机', exact: true }).click();
  expect(await maskSides(page)).toEqual(first);
  const firstMap = new Map(first);
  let changed = false;
  for (let i = 0; i < 6 && !changed; i++) {
    await page.getByRole('button', { name: '乱序', exact: true }).click();
    const next = await maskSides(page);
    expect(sideCounts(next)).toEqual({ en: 4, cn: 4 });
    changed = next.some(([word, side]) => firstMap.get(word) !== side);
  }
  expect(changed).toBe(true);
  const row = page.locator('li[data-masked="en"]').first();
  const word = await row.locator('.font-serif').textContent();
  await row.locator('button').first().click();
  await expect(page.locator('li[data-masked]').filter({ hasText: word! })).toHaveAttribute('data-masked', 'none');
  await page.getByRole('button', { name: `记住：${word}`, exact: true }).click();
  await expect(page.getByText('本页已评分 1 / 8', { exact: true })).toBeVisible();
  expect((await snapshot(page)).revlog).toHaveLength(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('random masking on a 2-word page always hides one English and one Chinese side', async ({ page }) => {
  await start(page, { ...fixture, words: focusWords(2) });
  await page.getByRole('button', { name: /A4 刷词/ }).click();
  await page.getByRole('button', { name: '🎲随机', exact: true }).click();
  for (let i = 0; i < 5; i++) {
    expect(sideCounts(await maskSides(page))).toEqual({ en: 1, cn: 1 });
    await expect(page.locator('.masked')).toHaveCount(2);
    await page.getByRole('button', { name: '乱序', exact: true }).click();
  }
});

test('A4 shows a collapsed, sourced example with read-aloud only for words that have one, and persists it', async ({ page }) => {
  await page.addInitScript(() => {
    const spoken: string[] = [];
    (window as unknown as { __spoken: string[] }).__spoken = spoken;
    (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = class { text: string; constructor(text: string) { this.text = text; } };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speak: (u: { text: string }) => spoken.push(u.text), cancel: () => {}, getVoices: () => [], onvoiceschanged: null } });
  });
  const words = focusWords(2);
  // Test fixture only; the shipped book has no example data.
  Object.assign(words[0], { exampleEn: 'Fixture sentence for maskword0.', exampleZh: '测试用例句。', exampleSource: 'E2E fixture' });
  await start(page, { ...fixture, words });
  await page.getByRole('button', { name: /A4 刷词/ }).click();
  await expect(page.getByTestId('example')).toHaveCount(1);
  const sentence = page.getByText('Fixture sentence for maskword0.', { exact: true });
  await expect(sentence).toBeHidden();
  await page.getByText('例句：maskword0', { exact: true }).click();
  await expect(sentence).toBeVisible();
  await expect(page.getByText('测试用例句。', { exact: true })).toBeVisible();
  await expect(page.getByText('来源：E2E fixture', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '朗读例句：maskword0', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken)).toEqual(['Fixture sentence for maskword0.']);
  await expect(page.getByRole('button', { name: '朗读例句：maskword1', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: '记住：maskword0', exact: true }).click();
  await expect(page.getByText('本页已评分 1 / 2', { exact: true })).toBeVisible();
  const saved = (await snapshot(page)).words as { word: string; exampleEn?: string; exampleSource?: string }[];
  expect(saved.find(w => w.word === 'maskword0')).toMatchObject({ exampleEn: 'Fixture sentence for maskword0.', exampleSource: 'E2E fixture' });
  expect(saved.find(w => w.word === 'maskword1')?.exampleEn).toBeUndefined();
});

test('book study cards show no invented example sentence', async ({ page }) => {
  await start(page, { ...fixture, words: [] });
  await page.getByRole('button', { name: '雅思词汇真经', exact: true }).click();
  await page.getByRole('button', { name: '开始今日学习', exact: true }).click();
  await page.getByRole('button', { name: '显示答案', exact: true }).click();
  await expect(page.getByRole('button', { name: '想起来了', exact: true })).toBeVisible();
  await expect(page.getByTestId('example')).toHaveCount(0);
  await expect(page.getByText(/^例句/)).toHaveCount(0);
});

const quizWord = (word: string, meaning: string, i: number) => ({ ...fixture.words[0], id: `quiz-${i}`, word, meaning });
async function openQuiz(page: Page) {
  await page.getByRole('button', { name: '60 秒配对', exact: true }).click();
}
async function matchPair(page: Page, word: string, meaning: string) {
  await page.getByRole('group', { name: '英文' }).getByRole('button', { name: word, exact: true }).click();
  await page.getByRole('group', { name: '中文' }).getByRole('button', { name: meaning, exact: true }).click();
}

test('60s challenge: rounds refill, wrong picks reset combo, double taps score once, time-up locks and summarises, restart resets, nothing is written', async ({ page }) => {
  const words = [['alpha', '第一个'], ['beta', '第二个'], ['gamma', '第三个'], ['delta', '第四个'], ['epsilon', '第五个']].map(([w, m], i) => quizWord(w, m, i));
  await start(page, { ...fixture, words });
  const before = await snapshot(page);
  await openQuiz(page);
  await page.getByRole('button', { name: '开始 60 秒挑战', exact: true }).click();
  await expect(page.getByRole('timer')).toHaveAttribute('aria-live', 'off');
  const en = page.getByRole('group', { name: '英文' }).getByRole('button');
  await expect(en).toHaveCount(4);
  const meaningOf = Object.fromEntries(words.map(w => [w.word, w.meaning]));
  const first = (await en.allTextContents())[0];
  const shown = await page.getByRole('group', { name: '中文' }).getByRole('button').allTextContents();
  await page.getByRole('group', { name: '英文' }).getByRole('button', { name: first, exact: true }).click();
  await page.getByRole('group', { name: '中文' }).getByRole('button', { name: shown.find(m => m !== meaningOf[first])!, exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '连击已重置' })).toBeVisible();
  await expect(page.getByRole('group', { name: '英文' }).getByRole('button', { pressed: true })).toHaveCount(0);
  await page.getByRole('group', { name: '英文' }).getByRole('button', { name: first, exact: true }).click();
  await page.getByRole('group', { name: '中文' }).getByRole('button', { name: meaningOf[first], exact: true }).dblclick();
  await expect(page.getByText('得分 10', { exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: '英文' }).getByRole('button', { name: first, exact: true })).toBeDisabled();
  await expect(page.getByRole('group', { name: '中文' }).getByRole('button', { name: meaningOf[first], exact: true })).toBeDisabled();
  for (const w of (await en.allTextContents()).filter(w => w !== first)) await matchPair(page, w, meaningOf[w]);
  await expect(page.getByText('第 2 轮', { exact: true })).toBeVisible();
  await expect(en).toHaveCount(4);
  for (const button of await en.all()) await expect(button).toBeEnabled();
  expect(new Set(await en.allTextContents()).size).toBe(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.clock.fastForward(61000);
  await expect(page.getByRole('group', { name: '英文' })).toHaveCount(0);
  const summary = page.getByRole('region', { name: '本局总结' });
  await expect(summary).toContainText('总分 ');
  await expect(summary).toContainText('匹配 4 对');
  await expect(summary).toContainText('正确率 80%');
  await expect(summary).toContainText('完成 1 轮');
  await page.getByRole('button', { name: '再来一局', exact: true }).click();
  await expect(page.getByText('得分 0', { exact: true })).toBeVisible();
  await expect(page.getByText('连击 0', { exact: true })).toBeVisible();
  await expect(page.getByText('第 1 轮', { exact: true })).toBeVisible();
  await expect(page.getByRole('timer')).toHaveText('剩余 60 秒');
  await page.clock.fastForward(61000);
  await expect(page.getByRole('region', { name: '本局总结' })).toContainText('匹配 0 对');
  expect(await snapshot(page)).toEqual(before);
  await page.getByRole('button', { name: '返回', exact: true }).click();
  await expect(page.getByRole('button', { name: '60 秒配对', exact: true })).toBeVisible();
});

test('60s challenge: duplicate meanings and fewer than 4 words still complete rounds without repeats in a round', async ({ page }) => {
  await start(page, { ...fixture, words: [quizWord('alpha', '同一个', 0), quizWord('beta', '同一个', 1), quizWord('gamma', '不同', 2)] });
  await openQuiz(page);
  await page.getByRole('button', { name: '开始 60 秒挑战', exact: true }).click();
  const en = page.getByRole('group', { name: '英文' }).getByRole('button');
  await expect(en).toHaveCount(2);
  for (let round = 1; round <= 3; round++) {
    await expect(page.getByText(`第 ${round} 轮`, { exact: true })).toBeVisible();
    const pair = await en.allTextContents();
    for (const w of pair) await matchPair(page, w, w === 'gamma' ? '不同' : '同一个');
  }
  await expect(page.getByText('第 4 轮', { exact: true })).toBeVisible();
  await expect(page.getByText('得分 90', { exact: true })).toBeVisible();
});

test('60s challenge cannot start with fewer than 2 distinct meanings and says why', async ({ page }) => {
  await start(page, { ...fixture, words: [quizWord('alpha', '同一个', 0), quizWord('beta', '同一个', 1)] });
  await openQuiz(page);
  await expect(page.getByRole('button', { name: '开始 60 秒挑战', exact: true })).toBeDisabled();
  await expect(page.getByText('至少需要 2 个释义不同的词', { exact: false })).toBeVisible();
});

test('60s challenge time does not extend while the page is hidden', async ({ page }) => {
  await start(page, { ...fixture });
  await openQuiz(page);
  await page.getByRole('button', { name: '开始 60 秒挑战', exact: true }).click();
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.clock.runFor(30000);
  await page.clock.setSystemTime(new Date('2026-10-22T12:01:30+08:00'));
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.getByRole('region', { name: '本局总结' })).toBeVisible();
  await expect(page.getByRole('group', { name: '英文' })).toHaveCount(0);
});

const a4Words = (n: number) => Array.from({ length: n }, (_, i) => ({ ...fixture.words[0], id: `a4-${i}`, word: `aword${i}`, meaning: `释义${i}`, focus: { active: true, addedAt: '2026-10-21', nextDate: today } }));

test('A4 keeps ticks and peeks across pages and modes, and one submit grades every ticked word once', async ({ page }) => {
  await start(page, { ...fixture, words: a4Words(10) });
  await page.getByRole('button', { name: /A4 刷词/ }).click();
  await page.getByRole('button', { name: '勾选记住：aword0', exact: true }).click();
  await page.getByRole('button', { name: /只看中/ }).click();
  await page.getByRole('listitem').filter({ hasText: '释义1' }).getByRole('button').first().click();
  await expect(page.getByRole('listitem').filter({ hasText: '释义1' })).toHaveAttribute('data-masked', 'none');
  await page.getByRole('button', { name: '下一张', exact: true }).click();
  await page.getByRole('button', { name: '勾选记住：aword9', exact: true }).click();
  await page.getByRole('button', { name: /只看英/ }).click();
  await page.getByRole('button', { name: /只看中/ }).click();
  await page.getByRole('button', { name: '上一张', exact: true }).click();
  await expect(page.getByRole('button', { name: '勾选记住：aword0', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('listitem').filter({ hasText: '释义1' })).toHaveAttribute('data-masked', 'none');
  await expect(page.getByText(/2 已勾选/)).toBeVisible();
  await page.getByRole('button', { name: '提交已勾选 2 词 · 按「记住」评分', exact: true }).click();
  await page.getByRole('button', { name: '好的', exact: true }).click();
  const saved = await snapshot(page);
  expect((saved.revlog as { wordId: string }[]).map(l => l.wordId).sort()).toEqual(['a4-0', 'a4-9']);
  await expect(page.getByRole('button', { name: /^忘记：/ })).toHaveCount(7);
});

test('A4 opened from a future dashboard day keeps its date and scope, is read-only, and back returns to the dashboard', async ({ page }) => {
  const words = [...a4Words(2), { ...a4Words(1)[0], id: 'future-1', word: 'later', meaning: '以后', nextReviewDate: '2026-10-25', focus: { active: true, addedAt: '2026-10-21', nextDate: '2026-10-25' } }];
  await start(page, { ...fixture, words });
  await page.getByRole('button', { name: '看板', exact: true }).click();
  await page.getByRole('button', { name: /^选择日期 2026-10-25/ }).click();
  await page.getByRole('button', { name: /^打开 A4 攻坚 · 1 词/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('10 月 25 日');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('重点攻坚 A4');
  await expect(page.getByText(/3 天后的预计安排 · 周日 · 1 词/)).toBeVisible();
  await expect(page.getByRole('button', { name: /^记住：/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '勾选记住：later', exact: true })).toBeDisabled();
  await expect(page.getByText(/已勾选/)).toHaveCount(0);
  await page.getByRole('button', { name: '返回', exact: true }).click();
  await expect(page.getByText('我的学习日历', { exact: true })).toBeVisible();
  expect((await snapshot(page)).revlog).toHaveLength(0);
});

test('an empty A4 says how to add words and offers the all-review scope and the book', async ({ page }) => {
  await start(page, { ...fixture });
  await page.getByRole('button', { name: /A4 刷词/ }).click();
  await expect(page.getByText('今天没有待复习的单词', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '查看全部到期复习 · 4 词', exact: true }).click();
  await expect(page.getByRole('listitem')).toHaveCount(4);
  await page.getByRole('button', { name: '当前：全部到期复习 · 切换重点攻坚', exact: true }).click();
  await page.getByRole('button', { name: '去词书学习并加入 A4', exact: true }).click();
  await expect(page.getByRole('button', { name: '雅思词汇真经', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('home next step follows real due words into A4 and the daily report counts real reviews', async ({ page }) => {
  await start(page, { ...fixture });
  const step = page.getByTestId('next-step');
  await expect(step).toContainText('全部到期复习 · 4 词');
  await expect(page.getByTestId('daily-report')).toContainText('已复习0 词');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await step.getByRole('button', { name: '开始到期复习 · 4 词', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('全部复习 A4');
  await expect(page.getByRole('listitem')).toHaveCount(4);
  await page.getByRole('button', { name: '记住：alpha', exact: true }).click();
  await expect(page.getByText(/评分已保存 · 下次复习 \d+ 月 \d+ 日/)).toBeVisible();
  await page.getByRole('button', { name: '返回', exact: true }).click();
  const report = page.getByTestId('daily-report');
  await expect(report).toContainText('已复习1 词');
  await expect(report).toContainText('其中记住1 词');
  await expect(step).toContainText('全部到期复习 · 3 词');
  expect((await snapshot(page)).revlog).toHaveLength(1);
});

test('home next step prefers A4 focus words over other due words', async ({ page }) => {
  await start(page, { ...fixture, words: [...fixture.words, ...a4Words(2)] });
  await page.getByTestId('next-step').getByRole('button', { name: '开始复习 A4 · 2 词', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('重点攻坚 A4');
  await expect(page.getByRole('listitem')).toHaveCount(2);
});

test('a fresh user is pointed at book group 1 and nothing demo is written', async ({ page }) => {
  await start(page, { ...fixture, words: [] });
  await expect(page.getByTestId('daily-report')).toHaveCount(0);
  const before = await snapshot(page);
  expect(before.words).toHaveLength(0);
  expect(before.revlog).toHaveLength(0);
  const button = page.getByTestId('next-step').getByRole('button', { name: /^开始学习：.+第 1 组$/ });
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('第 1 组');
  expect((await snapshot(page)).words).toHaveLength(0);
});

test('reduced motion: the A4 done stamp is a labelled dialog without animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await start(page, { ...fixture, words: a4Words(2) });
  await page.getByRole('button', { name: /A4 刷词/ }).click();
  await page.getByRole('button', { name: '勾选记住：aword0', exact: true }).click();
  await page.getByRole('button', { name: '提交已勾选 1 词 · 按「记住」评分', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '今日打卡完成' });
  await expect(dialog).toBeVisible();
  const close = dialog.getByRole('button', { name: '好的', exact: true });
  await expect(close).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(close).toBeFocused();
  const duration = await page.getByTestId('done-stamp').evaluate(el => parseFloat(getComputedStyle(el).animationDuration));
  expect(duration).toBeLessThan(0.05);
  await dialog.getByRole('button', { name: '好的', exact: true }).click();
  await expect(dialog).toHaveCount(0);
});

test('60s challenge announces the last 10 seconds once and the summary shows best combo', async ({ page }) => {
  await start(page, { ...fixture });
  await openQuiz(page);
  await expect(page.getByText('先点左侧英文', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '开始 60 秒挑战', exact: true }).click();
  await expect(page.getByRole('timer')).toHaveAttribute('aria-live', 'off');
  const en = page.getByRole('group', { name: '英文' }).getByRole('button');
  const meaningOf = Object.fromEntries(fixture.words.map(w => [w.word, w.meaning]));
  for (const w of (await en.allTextContents()).slice(0, 2)) await matchPair(page, w, meaningOf[w]);
  await expect(page.getByTestId('timer-announce')).toHaveText('');
  await page.clock.fastForward(50500);
  await expect(page.getByTestId('timer-announce')).toHaveText('还剩 10 秒');
  await page.clock.fastForward(11000);
  await expect(page.getByTestId('timer-announce')).toHaveText('时间到，本局结束');
  await expect(page.getByRole('region', { name: '本局总结' })).toContainText('最高连击 2');
});

test('batch review save failure rolls back every word and reports no success', async ({ page }) => {
  const words = sequence.slice(0, 25).map((word, i) => ({ ...fixture.words[0], id: `off-${i}`, word, review: 'off' }));
  await start(page, { ...fixture, words, bookLearning: { bookId: 'ielts-bible-core-v1', dailyGroups: 2, completed: { 'u01-g01': today }, missed: { 'u01-g01': [sequence[0], sequence[1]] } } });
  await page.getByRole('button', { name: '雅思词汇真经', exact: true }).click();
  await page.getByRole('button', { name: /第 1 单元 自然地理/ }).click();
  await page.getByRole('button', { name: /第 1 组 · 25 词/ }).click();
  const before = await snapshot(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, value, key) {
      if (this.name === 'cards') throw new DOMException('fixture write failed', 'QuotaExceededError');
      return key === undefined ? original.call(this, value) : original.call(this, value, key);
    };
  });
  await page.getByRole('button', { name: '本组全部 25 词', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('保存未完成');
  await expect(page.getByRole('status').filter({ hasText: '保存失败，没有加入任何词' })).toBeVisible();
  await expect(page.getByText('已在复习 0 / 25 词', { exact: true })).toBeVisible();
  expect(await snapshot(page)).toEqual(before);
});

async function wallpaperFile(page: Page) {
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1800; canvas.height = 900;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#206050'; ctx.fillRect(0, 0, 1800, 900);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  return { name: 'wallpaper.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') };
}

test('wallpaper persists across learning saves and offline reload, reset keeps all learning records', async ({ page, context }) => {
  await start(page);
  const before = await snapshot(page);
  await page.getByText('外观设置', { exact: true }).click();
  await expect(page.getByRole('button', { name: '上传壁纸', exact: true })).toBeEnabled();
  await page.getByLabel('选择壁纸图片').setInputFiles(await wallpaperFile(page));
  await expect(page.getByText('壁纸已保存，离线也可使用', { exact: false })).toBeVisible();
  await expect(page.getByTestId('wallpaper')).toHaveCount(1);
  expect(await snapshot(page)).toEqual(before);
  const preview = page.getByAltText('当前壁纸预览');
  expect(await preview.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1600);
  await page.getByRole('button', { name: '雅思词汇真经', exact: true }).click();
  await page.getByRole('button', { name: '强化', exact: true }).click();
  await expect(page.getByRole('button', { name: '强化', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const saved = await snapshot(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.getByTestId('wallpaper')).toHaveCount(1);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('wallpaper')).toHaveCount(1);
  await page.getByText('外观设置', { exact: true }).click();
  await page.getByRole('button', { name: '恢复默认背景', exact: true }).click();
  await expect(page.getByTestId('wallpaper')).toHaveCount(0);
  expect(await snapshot(page)).toEqual(saved);
  await page.reload();
  await expect(page.getByRole('heading', { name: '词书库', exact: true })).toBeVisible();
  await expect(page.getByTestId('wallpaper')).toHaveCount(0);
});

test('invalid wallpaper and storage failure keep the saved image and learning records', async ({ page }) => {
  await start(page);
  await page.getByText('外观设置', { exact: true }).click();
  const input = page.getByLabel('选择壁纸图片');
  const file = await wallpaperFile(page);
  await expect(page.getByRole('button', { name: '上传壁纸', exact: true })).toBeEnabled();
  await input.setInputFiles(file);
  await expect(page.getByAltText('当前壁纸预览')).toBeVisible();
  const previousUrl = await page.getByAltText('当前壁纸预览').getAttribute('src');
  const before = await snapshot(page);
  for (const invalid of [
    { name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') },
    { name: 'bad.png', mimeType: 'image/png', buffer: Buffer.from('corrupt image') },
    { name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(10 * 1024 * 1024 + 1) }
  ]) {
    await input.setInputFiles(invalid);
    await expect(page.getByRole('alert')).toContainText('壁纸未保存');
    await expect(page.getByAltText('当前壁纸预览')).toHaveAttribute('src', previousUrl!);
  }
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, value, key) {
      if (this.name === 'images') throw new DOMException('fixture full', 'QuotaExceededError');
      return key === undefined ? original.call(this, value) : original.call(this, value, key);
    };
  });
  await input.setInputFiles(file);
  await expect(page.getByRole('alert')).toContainText('壁纸未保存');
  await expect(page.getByAltText('当前壁纸预览')).toHaveAttribute('src', previousUrl!);
  expect(await snapshot(page)).toEqual(before);
  await page.reload();
  await expect(page.getByTestId('wallpaper')).toHaveCount(1);
  expect(await snapshot(page)).toEqual(before);
});
