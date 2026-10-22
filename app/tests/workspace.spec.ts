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
