const assert=require('assert/strict');
const fs=require('fs');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const URL=process.env.LUNA_TEST_URL||'http://127.0.0.1:8123/bar-playtest/';
const KEY='luna.bar.updates.dismissed.v1';
const SOURCE=fs.readFileSync(require('path').join(__dirname,'../updates.js'),'utf8');
const context={window:{}};require('vm').runInNewContext(SOURCE.replace('root.LunaUpdates={mount};','root.LunaUpdates={mount,entries};'),context);
const expected=context.window.LunaUpdates.entries,latest=expected[0].id;
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto(URL);const modal=p.locator('#luna-updates');await modal.waitFor();
  assert.equal(await modal.locator('.updates-entry').count(),expected.length);
  assert((await modal.innerText()).includes('대화 진행 중 Ctrl을 누르고 있으면 대사를 빠르게 넘길 수 있습니다.'));
  assert.equal(await modal.locator('input').isChecked(),false);
  assert.equal(await p.evaluate(()=>document.activeElement.className),'updates-close');
  await p.screenshot({path:'/private/tmp/luna-updates-desktop.png'});
  for(const key of ['F2','Tab','Control','Space'])await p.keyboard.press(key);
  assert.equal(await p.evaluate(()=>barGame.phase),'ready');assert.equal(await p.evaluate(()=>barGame.overlay),null);
  assert.equal(await p.locator('.inspector').count(),0);
  assert(await p.evaluate(()=>document.getElementById('luna-updates').contains(document.activeElement)));
  await p.keyboard.press('Escape');await modal.waitFor({state:'detached'});assert.equal(await p.evaluate(()=>barGame.overlay),null);
  await p.locator('[data-act="version"][data-id="gpt"]').click();assert.equal(await modal.count(),0);
  await p.reload();await modal.waitFor();await modal.locator('.updates-confirm').click();
  await p.reload();await modal.waitFor();await modal.locator('input').check();
  assert.equal(await p.evaluate(k=>localStorage.getItem(k),KEY),latest);
  await modal.locator('.updates-confirm').click();await p.reload();assert.equal(await modal.count(),0);
  // Suppression is shared across the original, GPT and minigame lobby URLs.
  for(const query of ['?version=gpt','?mode=minigames']){await p.goto(URL+query);assert.equal(await modal.count(),0);}
  console.log('Initial popup, hotkey isolation, Escape, tabs, unchecked reload and checked suppression: PASS');
  const next={id:'test-next-release',date:'2026-09-28',title:'테스트용 신규 업데이트',text:'새 업데이트 확인'};
  const older=Array.from({length:16},(_,i)=>({id:'older-'+i,date:'2026-09-26',title:'이전 업데이트 '+i,text:'스크롤 검증용 이전 내역입니다. '.repeat(3)}));
  const injected=SOURCE.replace('const entries=[','const entries=['+JSON.stringify(next)+',').replace("const storageKey=",'entries.push(...'+JSON.stringify(older)+');\nconst storageKey=');
  await p.route('**/updates.js*',r=>r.fulfill({contentType:'application/javascript',body:injected}));
  await p.goto(URL);await modal.waitFor();assert.equal(await modal.locator('input').isChecked(),false);
  assert.equal(await modal.locator('.updates-entry').first().getAttribute('data-update-id'),'test-next-release');
  assert.equal(await modal.locator('.updates-entry').nth(1).getAttribute('data-update-id'),latest);
  const footer=await modal.locator('.updates-footer').boundingBox();
  await modal.locator('.updates-list').evaluate(e=>{e.scrollTop=e.scrollHeight;});await p.waitForTimeout(150);
  assert(await modal.locator('.updates-list').evaluate(e=>e.scrollTop>0));
  assert.deepEqual(await modal.locator('.updates-footer').boundingBox(),footer);
  await p.screenshot({path:'/private/tmp/luna-updates-history.png'});
  for(const [width,height] of [[960,540],[390,844],[844,390]]){
   await p.setViewportSize({width,height});const box=await modal.boundingBox();
   assert(box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1);
   const confirm=await modal.locator('.updates-confirm').boundingBox();assert(confirm.y+confirm.height<=height);
   assert.equal(await modal.evaluate(e=>e.scrollWidth>e.clientWidth),false);
  }
  await p.setViewportSize({width:390,height:844});await p.screenshot({path:'/private/tmp/luna-updates-mobile.png'});
  await modal.locator('input').check();await p.reload();assert.equal(await modal.count(),0);
  console.log('New release resets suppression, newest first, older history scroll, fixed footer and responsive fit: PASS');
  await p.evaluate(k=>localStorage.setItem(k,'older-release'),KEY);await p.reload();await modal.waitFor();
  await modal.locator('input').check();await modal.locator('input').uncheck();assert.equal(await p.evaluate(k=>localStorage.getItem(k),KEY),null);
  await modal.locator('.updates-confirm').click();await p.reload();await modal.waitFor();
  const blocked=await browser.newPage();await blocked.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('Blocked');};Storage.prototype.setItem=()=>{throw Error('Blocked');};});
  await blocked.goto(URL);await blocked.locator('#luna-updates').waitFor();await blocked.locator('#luna-updates input').check();await blocked.locator('.updates-confirm').click();
  await blocked.locator('[data-act="start"]').click();await blocked.waitForFunction(()=>barGame.phase!=='ready');await blocked.close();
  assert.deepEqual(errors,[]);console.log('Uncheck, storage denied fallback, start gameplay and browser errors: PASS');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
