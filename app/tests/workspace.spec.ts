import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
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
test('migrate, grade once, bulk remainder and persist after reload',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);
  await page.getByRole('button',{name:/A4 刷词/}).click();
  await page.getByRole('button',{name:'当前：重点攻坚 · 切换全部 FSRS 到期'}).click();
  await page.getByRole('button',{name:'忘记',exact:true}).first().click();
  await expect(page.getByRole('button',{name:'忘记',exact:true})).toHaveCount(3);
  await page.getByRole('button',{name:/完成本页复习打卡/}).click();
  await expect(page.getByText('已保存 3 个词的复习评分，排期已更新')).toBeVisible();
  await page.getByRole('button',{name:'好的',exact:true}).click();
  expect((await snapshot(page)).revlog).toHaveLength(4);
  await page.reload();await expect(page.getByRole('button',{name:'学习统计',exact:true})).toBeVisible();
  expect((await snapshot(page)).revlog).toHaveLength(4);
  await page.getByRole('button',{name:/A4 刷词/}).click();
  await expect(page.getByRole('button',{name:/完成本页复习打卡/})).toHaveCount(0);
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
  await page.getByRole('button', { name: '选择日期 2026-10-23', exact: true }).click();
  await expect(page.getByRole('heading', { name: /^A4 攻坚 ·/ })).toHaveText(`A4 攻坚 · ${focusCount} 词（预计）`);
  if (!focusCount) return;
  await page.getByRole('button', { name: '打开 A4 攻坚 · 2 词', exact: true }).click();
  await expect(page.getByRole('listitem')).toHaveCount(2);
  await expect(page.getByRole('button', { name: '忘记', exact: true })).toHaveCount(0);
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
  await page.getByRole('button', { name: '记住', exact: true }).first().click();
  await expect(page.getByRole('listitem')).toHaveCount(2);
  await expect(page.getByRole('button', { name: '记住', exact: true })).toHaveCount(1);
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
  await page.getByRole('button', { name: /完成本页复习打卡 · 1 词/ }).click();
  await page.getByRole('button', { name: '好的', exact: true }).click();
  expect((await snapshot(page)).revlog).toHaveLength(1);
  await page.getByRole('button', { name: '上一张', exact: true }).click();
  await expect(page.getByRole('button', { name: '忘记', exact: true })).toHaveCount(8);
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
  await expect(page.getByRole('button', { name: `已加入 A4：${sequence[23]}`, exact: true })).toBeDisabled();
  await expect(page.getByText('已选 1 词加入 A4 · 明天只复习这些', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('book-focus-picker.png'), fullPage: true });
  const saved = await snapshot(page);
  expect(saved.words).toHaveLength(29);
  expect((saved.words as { word: string; focus?: { active: boolean } }[]).filter(w => w.focus?.active).map(w => w.word)).toEqual([sequence[23]]);
  await page.getByRole('button', { name: '返回词书', exact: true }).click();
  await page.getByRole('button', { name: /第 1 单元 自然地理/ }).click();
  await page.getByRole('button', { name: /第 1 组 · 25 词/ }).click();
  await expect(page.getByRole('button', { name: `已加入 A4：${sequence[23]}`, exact: true })).toBeDisabled();
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
