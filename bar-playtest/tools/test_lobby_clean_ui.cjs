const assert=require('assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{let browser;try{
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.goto(process.env.LUNA_TEST_URL||'http://127.0.0.1:8123/bar-playtest/');
 for(const lang of ['ko','en'])for(const [width,height] of [[1280,720],[960,540],[1440,900]]){
  await p.setViewportSize({width,height});await p.evaluate(l=>barGame.lang=l,lang);
  for(const id of ['original','gpt','minigames']){
   await p.locator('[data-act="version"][data-id="'+id+'"]').click();await p.waitForTimeout(100);
   const screen=p.locator('.start-screen');
   assert.equal(await screen.locator('.intro,.eyebrow,.minigame-heading,.remix-feature-grid,.remix-budget-note,.remix-disclaimer').count(),0);
   const outer=await screen.boundingBox(),tabs=await p.locator('.version-tabs').boundingBox();
   assert(Math.abs(tabs.x+tabs.width/2-(outer.x+outer.width/2))<2,'Tabs centered');
   const card=await screen.locator(id==='minigames'?'.minigame-cards':'.start-card').boundingBox();
   assert(Math.abs(card.x+card.width/2-(outer.x+outer.width/2))<2,'Content centered');
   assert(card.y>=tabs.y+tabs.height,'No tab overlap');
   assert(card.y+card.height<=outer.y+outer.height+1,'Content fits');
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   if(id==='minigames'){
    assert.equal(await screen.locator('.minigame-card p').count(),5);
    assert((await screen.locator('.minigame-card p').allTextContents()).every(s=>s.length>0));
    assert.equal(await screen.locator('.minigame-options>p').count(),0);
   }else{
    const start=await screen.locator('[data-act="start"]').boundingBox();
    assert(start.y+start.height<=outer.y+outer.height,'Start button visible');
    assert.equal(await screen.locator('.day-list button').count(),5);
   }
   if(width===1280)await p.screenshot({path:'/private/tmp/lobby-clean-'+id+'-'+lang+'.png'});
  }
 }
 await p.setViewportSize({width:1280,height:720});
 for(const id of ['original','gpt']){
  await p.locator('[data-act="version"][data-id="'+id+'"]').click();
  await p.locator('[data-act="day"][data-id="99"]').click();
  await p.locator('#start-mode').selectOption('practice');
  await p.locator('[data-act="start"]').click();
  await p.waitForFunction(()=>barGame.phase!=='ready');
  assert.equal(await p.evaluate(()=>barGame.mode),'practice');
  await p.keyboard.press('Escape');await p.locator('[data-act="restart"]').click();await p.locator('[data-act="setup"]').click();
 }
 await p.locator('[data-act="version"][data-id="minigames"]').click();
 await p.locator('[data-act="miniStart"][data-id="pour"]').click();
 await p.locator('.fluid-screen').waitFor();
 assert.deepEqual(errors,[]);
 console.log('LOBBY_CLEAN_UI_OK: three centered tabs; removed intro/English headings; five skill descriptions; KO/EN × three viewports; preserved session and minigame start.');
}finally{await browser?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
