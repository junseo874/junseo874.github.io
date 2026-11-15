const assert=require('assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{let browser;try{
 browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 const url=process.env.LUNA_TEST_URL||'http://127.0.0.1:8123/bar-playtest/';
 await p.goto(url+'?version=gpt');
 await p.locator(".updates-dismiss input").check();
 await p.locator('.updates-confirm').click();
 const nav=p.locator('.sim-nav');
 assert.equal(await p.locator('.remix-start').count(),0);
 const editor=await browser.newPage();
 await editor.goto(new URL('dialogue-editor.html?view=flow',url).href);
 async function metrics(rail,control){
  const {x,y,width,height}=await rail.boundingBox();
  const type=await control.evaluate(el=>{
   const css=getComputedStyle(el);
   return [css.fontFamily,css.fontSize,el.getBoundingClientRect().height];
  });
  return [x,y,width,height,...type];
 }
 for(const [width,height] of [[1600,900],[1024,768],[390,844]]){
  await Promise.all([p,editor].map(page=>page.setViewportSize({width,height})));
  const expected=await metrics(editor.locator('.studio-rail'),editor.locator('#map-mode'));
  await p.goto(url+'?dev=1');
  for(const id of ['original','minigames','outside','cutscenes','guest-appearance','dialogue-editors','resource-review','data-review']){
   const link=['dialogue-editors','resource-review','data-review'].includes(id);
   await nav.locator(link?'a[href="'+id+'.html"]':'[data-id="'+id+'"]').click();
   await nav.locator(link?'[aria-current="page"]':'[aria-pressed="true"][data-id="'+id+'"]').waitFor();
   assert.equal(await nav.locator('a,button').count(),8);
   assert.deepEqual(await metrics(nav,nav.locator('a,button').first()),expected,id+' should match the dialogue editor');
   const header=await p.locator('.sim-heading,body[data-sim-page] > header').boundingBox();
   assert(Math.abs(header.x-expected[2])<1 && header.y===0,id+' heading aligned with rail');
  }
 }
 await editor.close();
 await nav.locator('[href$="mode=guest-appearance"]').click();
 await p.locator('.guest-look-layout').waitFor();
 await nav.locator('[data-id="original"]').click();
 await p.locator('[data-act="day"][data-id="99"]').click();
 await p.locator('#start-mode').selectOption('practice');
 await p.locator('[data-act="start"]').click();
 await p.waitForFunction(()=>barGame.phase!=='ready');
 assert.equal(await p.evaluate(()=>barGame.mode),'practice');
 assert.deepEqual(errors,[]);
 console.log('SIMULATOR_NAV_OK: eight destinations, active state, three viewport sizes and bar practice.');
}finally{await browser?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
