const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});try{
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
 for(const variant of ['original','gpt']){
  await p.evaluate(variant=>{const c=lunaCampaign,g=barGame;c.session.uninstall();c.screen('developer');c.ui.variant=variant;g.reset(1,'regular',4,false,{variant});g.phase='regular';g.focus='R';g.seats.R={actor:'tom',id:'tom',state:'STORY',seated:true,coaster:true,glass:'dry_martini',glassEmpty:variant==='gpt',glassKind:'cocktail'};g.story={scene:{id:'fade'},index:0,steps:[{type:'exit',actor:'tom'},{type:'say',actor:'luna','text.ko':'잘 가요.'}]};c.render(true);},variant);
  await p.waitForFunction(()=>!barGame.cameraMoving&&!barGame.cameraLeft);
  await p.evaluate(()=>{barGame.pump();for(let i=0;i<6;i++)barGame.tick(.1);barGame.paused=true;lunaCampaign.render(true);});
  const fade=p.locator('[data-fading-seat=R]');await fade.waitFor();
  assert.equal(await fade.locator('img.coaster').count(),1);assert.equal(await fade.locator('.drink-art').count(),1);
  assert.equal(await fade.getAttribute('data-drop'),null);assert.equal(await fade.evaluate(e=>getComputedStyle(e).pointerEvents),'none');
  const start=await fade.evaluate(e=>Number(getComputedStyle(e).opacity));assert(start>.95);
  await p.waitForTimeout(250);assert.equal(await fade.evaluate(e=>Number(getComputedStyle(e).opacity)),start,'Pause freezes fade');
  await p.evaluate(()=>{barGame.paused=false;barGame.tick(.2);barGame.tick(.2);barGame.paused=true;lunaCampaign.render(true);});
  const middle=await fade.evaluate(e=>Number(getComputedStyle(e).opacity));assert(Math.abs(middle-.5)<.02);assert.equal(await p.evaluate(()=>barGame.seats.R),null);
  await p.evaluate(()=>{window.savedFadeTick=barGame.tick;barGame.tick=()=>{};barGame.paused=false;lunaCampaign.render(true);});
  await p.screenshot({path:'/private/tmp/table-fade-'+variant+'.png'});
  await p.evaluate(()=>{barGame.tick=window.savedFadeTick;delete window.savedFadeTick;barGame.paused=true;});
  await p.evaluate(()=>{barGame.paused=false;for(let i=0;i<5;i++)barGame.tick(.1);barGame.paused=true;lunaCampaign.render(true);});
  assert.equal(await fade.count(),0);assert.equal(await p.evaluate(()=>barGame.story.index),1);
 }
 assert.deepEqual(errors,[]);console.log('PASS original/GPT: shared coaster + drink opacity, empty glass retained, noninteractive cleanup, pause, removal and next dialogue');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
