const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('assert/strict');
const BASE=process.env.LUNA_SITE_URL||'http://127.0.0.1:8123/';
(async()=>{let browser;try{
  browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[],missing=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.url().startsWith(BASE)&&r.status()>=400)missing.push(r.status()+' '+r.url());});
  await page.goto(BASE);await page.locator('.lobby').scrollIntoViewIfNeeded();
  const cards=await page.locator('.cards>a').evaluateAll(es=>es.map(e=>e.getAttribute('href')));
  assert.deepEqual(cards,['intro.html','direction.html','bar-playtest/','bar-playtest/?mode=minigames']);
  assert.equal(await page.locator('.sublinks a[href="simulator.html"]').count(),1);
  const preview=page.locator('.card[href="bar-playtest/"] img');await preview.scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>document.querySelector('.card[href="bar-playtest/"] img')?.naturalWidth>0);
  await page.screenshot({path:'/private/tmp/luna-site-lobby.png'});
  await page.locator('.card[href="bar-playtest/"]').click();
  await page.waitForFunction(()=>!!window.barGame&&!!window.barBgm);
  assert(new URL(page.url()).pathname.endsWith('/bar-playtest/'));
  assert.equal(await page.locator('.site-home').count(),0);
  await page.keyboard.press('Escape');assert.equal(await page.locator('.site-home').count(),1);await page.locator('#bgm-volume').waitFor();
  await page.waitForFunction(()=>barBgm.status==='playing');
  for(const [width,height] of [[1280,720],[1440,1000],[820,650]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(120);
    const box=await page.locator('.app-shell').boundingBox();assert(Math.abs(box.width/box.height-16/9)<.001);
    const link=await page.locator('.site-home').boundingBox();assert(link.x>=0&&link.y>=0&&link.x+link.width<=width);
  }
  await page.locator('[data-act="closeOverlay"]').click();
  await page.setViewportSize({width:1280,height:720});
  await page.evaluate(()=>{const g=barGame;g.reset(99,'general',7);for(let i=0;i<100;i++)g.tick(.1);g.dialogSpeed=.2;});
  await page.waitForTimeout(800);await page.screenshot({path:'/private/tmp/luna-site-playtest.png'});
  const before=await page.evaluate(()=>barBgm.audio.currentTime);
  await page.evaluate(()=>barGame.openRecipes());await page.waitForTimeout(200);
  assert(await page.evaluate(t=>barBgm.audio.currentTime>=t&&!barBgm.audio.paused,before));
  await page.keyboard.press('Escape');await page.locator('.site-home').click();await page.waitForURL('**/index.html');
  assert.equal(await page.locator('.cards>a').count(),4);
  await page.locator('.card[href="bar-playtest/?mode=minigames"]').click();await page.locator('.minigame-card').first().waitFor();assert.equal(await page.locator('.minigame-card').count(),5);
  for(const file of ['intro.html','direction.html','simulator.html','LUNA_TestTool.html']){
    await page.goto(new URL(file,BASE).href);await page.waitForTimeout(600);
    assert((await page.locator('body').innerText()).length>50,file+' rendered empty');
    const bad=await page.evaluate(()=>[...document.images].filter(i=>i.getAttribute('src')&&!i.getAttribute('src').includes('${')&&i.complete&&!i.naturalWidth).map(i=>i.getAttribute('src')));
    assert.deepEqual(bad,[],file+' image failures');
  }
  await page.goto(new URL('simulator.html',BASE).href);
  await page.locator('.title-help a[href="bar-playtest/"]').click();await page.waitForFunction(()=>!!window.barGame);
  assert.deepEqual(missing,[]);assert.deepEqual(errors,[]);
  console.log('SITE_BROWSER_OK: lobby/current/archive routes, return link, nested-path audio, three viewport sizes, preserved legacy pages, no JS errors or local HTTP failures.');
}finally{await browser?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
