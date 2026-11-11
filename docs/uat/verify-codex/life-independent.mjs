import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(new URL('../../../package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const out = process.env.VERIFY_OUT ?? 'docs/uat/verify-codex/independent-life-final2';
await mkdir(out, {recursive:true});
const browser = await chromium.launch({channel:'chrome',headless:true});
const results = {};
for (const vp of [{name:'mobile',width:390,height:844,isMobile:true,hasTouch:true},{name:'desktop',width:1280,height:800}]) {
 const context = await browser.newContext({baseURL:'http://localhost:4132',viewport:{width:vp.width,height:vp.height},isMobile:!!vp.isMobile,hasTouch:!!vp.hasTouch,locale:'zh-TW',timezoneId:'Asia/Taipei'});
 await context.addInitScript(() => {
  window.__auditLayoutShifts = [];
  new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__auditLayoutShifts.push({value:entry.value,startTime:entry.startTime}); }).observe({type:'layout-shift',buffered:true});
 });
 const page = await context.newPage(); let expectedFailure = false; const record = results[vp.name] = {states:[],errors:[]};
 page.on('pageerror', e => record.errors.push(e.message));
 page.on('console', m => {if(m.type()==='error' && !expectedFailure) record.errors.push(m.text());});
 page.on('response', r => {if(!expectedFailure && r.status()>=400 && r.url().includes('/api/')) record.errors.push(`${r.status()} ${new URL(r.url()).pathname}`)});
 async function snap(label) {
  await page.screenshot({path:`${out}/${vp.name}-${label}.png`});
  const state=await page.evaluate(() => {
   const visible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};
   const small=[...document.querySelectorAll('button,a')].filter(visible).map(e=>{const r=e.getBoundingClientRect();return {label:e.getAttribute('aria-label')||e.textContent.trim(),w:r.width,h:r.height}}).filter(r=>r.w<44||r.h<44);
   const primaries=[...document.querySelectorAll('.btn.primary')].filter(visible).filter(e=>{let r=e.getBoundingClientRect(); let x=r.left+r.width/2,y=r.top+Math.min(r.height/2,22);let hit=document.elementFromPoint(x,y);return hit&&(hit===e||e.contains(hit))}).map(e=>e.textContent.trim());
   return {text:document.body.innerText,small,primaries,overflow:document.documentElement.scrollWidth>innerWidth,layoutShifts:window.__auditLayoutShifts};
  }); record.states.push({label,...state});
 }
 try {
  await page.goto('/'); await page.getByRole('link',{name:'把牠撿回家'}).click();
  await page.getByLabel('Email').fill(`ind-life-${vp.name}-${Date.now()}@e2e.test`); await page.getByLabel('名字',{exact:true}).fill('小安'); await page.getByRole('button',{name:'開發用登入'}).click();
  await page.getByRole('link',{name:'把牠撿回家'}).click(); await page.getByRole('button',{name:'下一步'}).click(); await page.getByRole('button',{name:'下一步'}).click(); await page.getByLabel('角色名字').fill('小豆'); await page.getByRole('button',{name:'帶牠回家'}).click(); await page.getByRole('button',{name:'去找牠'}).click();
  await page.getByRole('link',{name:'小龍的今天'}).click(); await page.getByRole('button',{name:'陪牠去玩'}).waitFor(); await snap('today'); const initial = await (await page.request.get('/api/me/life')).json(); await page.reload(); await page.getByRole('button',{name:'陪牠去玩'}).waitFor(); await snap('today-reload'); assert.deepEqual((await (await page.request.get('/api/me/life')).json()).today, initial.today);
  const stories=[]; const choices=['逛逛小店','河邊動一動','聽一首小曲','去朋友家喝茶','廣場湊熱鬧','去霧丘鎮旅行','去星砂島出國玩'];
  for (let i=0;i<choices.length;i++) {
   await page.getByRole('button',{name:'陪牠去玩'}).click(); await page.getByRole('radio',{name:choices[i]}).click(); const previewText = await page.getByRole('dialog').locator('p').first().innerText(); stories.push(previewText); await snap(`preview-${i}`);
   if(i===0) {await page.getByRole('button',{name:'先待在家'}).click(); assert.equal((await (await page.request.get('/api/me/life')).json()).today.entries.length, 0); await page.getByRole('button',{name:'陪牠去玩'}).click(); await page.getByRole('radio',{name:choices[i]}).click();}
   await page.getByRole('button',{name:'就去這裡'}).click(); await page.getByRole('button',{name:'收好紀念品'}).waitFor(); assert.ok((await page.getByRole('dialog').innerText()).includes(previewText)); await snap(`result-${i}`); await page.getByRole('button',{name:'收好紀念品'}).click(); await page.reload(); await page.locator('.life-entry').last().waitFor(); assert.equal(await page.locator('.life-entry').count(),i+1); assert.ok((await page.locator('.life-entry').nth(i).innerText()).includes(previewText)); await snap(`saved-${i}`);
  }
  await page.getByRole('link',{name:'看看今天帶回來的'}).click(); await page.getByLabel('生活收藏進度').waitFor(); assert.equal(await page.getByLabel('生活收藏進度').innerText(),'7/7'); assert.equal((await (await page.request.get('/api/me')).json()).pet.stars,0); await snap('cabinet');
  const names=['雲朵圍巾','葉子哨','小鈴鐺','茶會合照','四季小燈','霧丘車票夾','星砂瓶'];
  for(let i=0;i<names.length;i++){await page.getByRole('button',{name:`${names[i]}，已收集`}).click();await snap(`item-${i}`); assert.ok((await page.getByRole('dialog').innerText()).includes(stories[i]), `收藏明細與當時的故事不一致: ${names[i]}`); if(i===0) await page.getByRole('button',{name:'穿上圍巾'}).click(); else if(i===4) await page.getByRole('button',{name:'擺在家裡'}).click(); else await page.getByRole('button',{name:'收好',exact:true}).click();}
  await page.getByRole('link',{name:'回小龍身邊'}).click(); await page.waitForURL('**/'); await page.getByLabel('穿著雲朵圍巾').waitFor(); await page.getByLabel('房間的四季小燈').waitFor(); await snap('decorated'); await page.reload(); await page.getByLabel('穿著雲朵圍巾').waitFor(); await page.getByLabel('房間的四季小燈').waitFor(); await snap('decorated-reload');
  await context.clearCookies(); await page.goto('/life'); await page.getByLabel('Email').fill(`ind-empty-${vp.name}-${Date.now()}@e2e.test`); await page.getByLabel('名字',{exact:true}).fill('小雨'); await page.getByRole('button',{name:'開發用登入'}).click();
  await page.goto('/life'); await page.getByRole('heading',{name:'小龍還在蛋裡'}).waitFor(); await snap('no-dragon');
  await page.getByRole('link',{name:'回小龍身邊'}).click(); await page.getByRole('link',{name:'把牠撿回家'}).click(); await page.getByRole('button',{name:'下一步'}).click(); await page.getByRole('button',{name:'下一步'}).click(); await page.getByLabel('角色名字').fill('小雨'); await page.getByRole('button',{name:'帶牠回家'}).click(); await page.getByRole('button',{name:'去找牠'}).click();
  expectedFailure=true; await page.route('**/api/me/life', route=>route.fulfill({status:503,json:{error:{code:'unavailable'}}})); await page.goto('/life'); await page.getByRole('button',{name:'再看一次'}).waitFor(); await snap('retry'); await page.unroute('**/api/me/life'); expectedFailure=false; await page.getByRole('button',{name:'再看一次'}).click(); await page.getByRole('button',{name:'陪牠去玩'}).waitFor();
  await page.goto('/life/cabinet'); assert.equal(await page.getByLabel('生活收藏進度').innerText(),'0/7'); await snap('empty-cabinet'); await page.getByRole('button',{name:'雲朵圍巾，還沒帶回家'}).click(); await snap('missing-item'); await page.keyboard.press('Escape'); assert.equal(await page.getByRole('button',{name:'雲朵圍巾，還沒帶回家'}).evaluate(e=>e===document.activeElement),true);
 } catch(e){
  record.fatal=String(e.stack||e);
  record.failureUrl=page.url();
  record.failureText=await page.locator('body').innerText().catch(()=>'無法讀取頁面');
  await page.screenshot({path:`${out}/${vp.name}-failure.png`}).catch(()=>{});
 }
 await context.close(); await writeFile(`${out}/raw.json`,JSON.stringify(results,null,2));
}
await browser.close();
if (Object.values(results).some(r => r.fatal || r.errors.length)) process.exitCode = 1;
