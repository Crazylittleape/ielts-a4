import { test, expect, type Page } from '@playwright/test';
const today = '2026-10-22';
const fixture = {words:[['alpha','第一个'],['beta','第二个'],['gamma','第三个'],['delta','第四个']].map(([word,meaning],i)=>({id:`word-${i}`,word,meaning,phonetic:'',synonyms:'',createdAt:'2026-10-20',stage:1,nextReviewDate:today,reviewHistory:['2026-10-20'],isHard:false})), skipped:[],settings:{dailyClaim:30,lastClaimDate:''}};
async function start(page: Page) {
  await page.clock.install({time:new Date('2026-10-22T12:00:00+08:00')});
  await page.addInitScript(data=>{if(!localStorage.getItem('fixture')){localStorage.setItem('ielts_a4_workspace_v2',JSON.stringify(data));localStorage.setItem('fixture','1');}},fixture);
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
  await start(page);await page.getByRole('button',{name:'录入',exact:true}).click();
  await page.getByPlaceholder('ubiquitous',{exact:true}).fill('zebra');
  await page.getByLabel(/中文释义/).fill('n. 斑马');
  await page.getByRole('button',{name:/录入并排进FSRS日历/}).first().click();
  await expect(page.getByPlaceholder('ubiquitous',{exact:true})).toHaveValue('');
  await page.getByRole('button',{name:'词库',exact:true}).click();
  const row=page.getByRole('listitem').filter({has:page.getByRole('button',{name:'zebra',exact:true})});
  await row.getByRole('button',{name:'收藏',exact:true}).click();await expect(row.getByRole('button',{name:'取消收藏',exact:true})).toBeVisible();
  await row.getByRole('button',{name:'掌握',exact:true}).click();await expect(row.getByRole('button',{name:'恢复复习',exact:true})).toBeVisible();
  await page.reload();await page.getByRole('button',{name:'词库',exact:true}).click();
  await expect(row.getByRole('button',{name:'恢复复习',exact:true})).toBeVisible();
  await row.getByRole('button',{name:'恢复复习',exact:true}).click();await expect(row.getByRole('button',{name:'掌握',exact:true})).toBeVisible();
});
test('built-in sequence import includes dictionary preview and artificial group labels',async({page})=>{
  await start(page);await page.getByRole('button',{name:'录入',exact:true}).click();await page.getByRole('button',{name:'真经词序',exact:true}).click();
  await expect(page.getByLabel('内置词组')).toHaveValue('1');
  await page.getByRole('button',{name:'查词典补全音标与释义',exact:true}).click();
  await expect(page.getByText('atmosphere',{exact:true})).toBeVisible();
  await page.getByPlaceholder('手填中文释义（留空则跳过）').fill('厄尔尼诺现象');
  await page.getByRole('button',{name:/排入FSRS日历/}).click();
  await expect(page.getByText(/已排入 30 个词/)).toBeVisible();
  expect((await snapshot(page)).words).toHaveLength(34);
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
  await page.getByRole('button',{name:'词库',exact:true}).click();
  await page.getByRole('button',{name:'粘贴 JSON 恢复',exact:true}).click();
  const input=page.getByPlaceholder('{"words":[...]}');
  await input.fill('{broken');await page.getByRole('button',{name:'合并导入',exact:true}).click();
  await expect(input).toHaveValue('{broken');expect(await snapshot(page)).toEqual(before);
  await input.fill(JSON.stringify(fixture));await page.getByRole('button',{name:'覆盖',exact:true}).click();
  page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'覆盖恢复',exact:true}).click();
  await expect(input).toHaveValue(JSON.stringify(fixture));expect(await snapshot(page)).toEqual(before);
});
test('daily book-sequence claiming continues past already imported words',async({page})=>{
  await start(page);await page.getByRole('button',{name:'录入',exact:true}).click();await page.getByRole('button',{name:'真经词序',exact:true}).click();
  await page.getByRole('button',{name:'10',exact:true}).click();
  await page.getByRole('button',{name:'按词序领取接下来 10 词',exact:true}).click();
  await expect(page.getByText(/已按词序领取 10 词/)).toBeVisible();
  await page.getByRole('button',{name:'按词序领取接下来 10 词',exact:true}).click();
  await expect.poll(async()=> (await snapshot(page)).words.length).toBe(24);
  expect(new Set((await snapshot(page)).words.map((word:any)=>word.word)).size).toBe(24);
});
test('stale tab rejection retains new word form and existing records',async({page,context})=>{
  await start(page);
  const other=await context.newPage();await other.goto('/');await other.getByRole('button',{name:'词库',exact:true}).click();
  await other.getByRole('button',{name:'收藏',exact:true}).first().click();
  await expect(other.getByRole('button',{name:'取消收藏',exact:true})).toHaveCount(1);
  const before=await snapshot(page);
  await page.getByRole('button',{name:'录入',exact:true}).click();
  await page.getByPlaceholder('ubiquitous',{exact:true}).fill('quokka');await page.getByLabel(/中文释义/).fill('短尾矮袋鼠');
  await page.getByRole('button',{name:'录入并排进FSRS日历',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('保存未完成');
  await expect(page.getByPlaceholder('ubiquitous',{exact:true})).toHaveValue('quokka');
  expect(await snapshot(page)).toEqual(before);
});
