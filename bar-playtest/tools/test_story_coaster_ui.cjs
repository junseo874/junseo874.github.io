const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.waitForFunction(()=>window.barGame&&window.lunaCampaign);if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
 for(const variant of ['original','gpt','campaign']){
  for(const actor of ['chris','tom']){
   await p.evaluate(({variant,actor})=>{
    lunaCampaign.session.uninstall();lunaCampaign.screen(variant==='campaign'?'game':'developer');if(variant==='campaign')lunaCampaign.session.install();
    const g=barGame;g.reset(1,'regular',4,false,{variant:variant==='gpt'?'gpt':'original'});g.phase='regular';g.focus='R';g.seats={L:null,M:null,R:{actor,id:actor,state:'STORY',seated:true,coaster:false}};
    g.story={scene:{id:'visitor-no-order'},index:0,steps:[{type:'say',actor,'text.ko':'오늘은 인사만 하러 왔어.'},{type:'coaster',actor},{type:'say',actor,'text.ko':'다음에 보자.'},{type:'exit',actor}]};g.pump();g.dialogue.chars=g.dialogue.text.length;lunaCampaign.render(true);
   },{variant,actor});
   await p.waitForFunction(()=>!barGame.cameraMoving&&!barGame.cameraLeft);
   assert.equal(await p.locator('.stack.service-popup').count(),0);assert.equal(await p.locator('.delivery-cue').count(),0);
   await p.keyboard.press('Space');await p.waitForFunction(()=>barGame.story.index===2);
   assert.equal(await p.locator('.stack.service-popup').count(),0);assert.equal(await p.evaluate(()=>barGame.seats.R.coaster),false);
  }
  await p.evaluate(variant=>{lunaCampaign.session.uninstall();lunaCampaign.view=variant==='campaign'?'game':'developer';lunaCampaign.host.hidden=true;lunaCampaign.app.inert=false;lunaCampaign.ui.variant=variant==='gpt'?'gpt':'original';if(variant==='campaign')lunaCampaign.session.install();const g=barGame;g.reset(1,'regular',4,false,{variant:lunaCampaign.ui.variant});g.phase='regular';g.seats={L:null,M:null,R:{actor:'tom',id:'tom',state:'STORY',seated:true,coaster:false}};g.focus='R';g.story={scene:{id:'coaster-test'},index:0,steps:[{type:'say',actor:'tom','text.ko':'안녕. 오늘도 한 잔 부탁할게.'},{type:'say',actor:'luna','text.ko':'어서 오세요. 무엇으로 드릴까요?'},{type:'coaster',actor:'tom'},{type:'order',actor:'tom',arg:'exact:dry_martini'},{type:'craft',actor:'tom'},{type:'serve',actor:'tom'},{type:'say',actor:'tom','text.ko':'고마워.'}]};g.pump();g.dialogue.chars=g.dialogue.text.length;lunaCampaign.render(true);},variant);
  await p.waitForFunction(()=>barGame.storyCoasterReady()&&!barGame.cameraMoving&&!barGame.cameraLeft);await p.locator('.stack[data-drag=coaster]').waitFor();
  await p.keyboard.press('Space');assert.equal(await p.evaluate(()=>barGame.story.index),0);assert(await p.locator('.guest-speech').isVisible());
  await p.screenshot({path:'/private/tmp/story-coaster-'+variant+'-before.png'});
  const src=await p.locator('.stack[data-drag=coaster]').boundingBox(),zone=await p.locator('[data-drop=R]').boundingBox();
  await p.mouse.move(src.x+src.width/2,src.y+src.height/2);await p.mouse.down();await p.mouse.move(zone.x+zone.width/2,zone.y+zone.height*.8,{steps:8});assert.equal(await p.locator('.dialogue-wrap').count(),0);
  assert(await p.locator('[data-drop=R] .delivery-arrow').isVisible());await p.screenshot({path:'/private/tmp/story-coaster-'+variant+'-drag.png'});
  await p.mouse.move(15,15);await p.mouse.up();assert.equal(await p.evaluate(()=>barGame.story.index),0);assert(await p.locator('.guest-speech').isVisible());
  await p.mouse.move(src.x+src.width/2,src.y+src.height/2);await p.mouse.down();await p.mouse.move(zone.x+zone.width/2,zone.y+zone.height*.8,{steps:8});await p.mouse.up();
  await p.waitForFunction(()=>barGame.story.index===1);assert(await p.evaluate(()=>barGame.seats.R.coaster));assert.equal(await p.locator('.stack[data-drag=coaster]').count(),0);assert.equal(await p.locator('[data-drop=R] .delivery-cue').count(),0);
  await p.evaluate(()=>{const g=barGame;g.dialogue.chars=g.dialogue.text.length;g.advance();g.drink={id:'review-drink',selected:'dry_martini',grade:'excellent',score:100,missingCore:[]};g.screen='bar';lunaCampaign.render(true);});
  await p.locator('.drink-tray[data-drag=drink]').waitFor();assert(await p.locator('[data-drop=R] .delivery-shadow').isVisible());
  const card=p.locator('.drink-tray'),skin=await card.evaluate(e=>getComputedStyle(e,':before').backgroundImage);assert(skin.includes('GRD_textbox_5.png'));
  const arrow=p.locator('.delivery-arrow');const y=await arrow.evaluate(e=>getComputedStyle(e).transform);await p.waitForTimeout(350);assert.notEqual(await arrow.evaluate(e=>getComputedStyle(e).transform),y);
  await p.waitForTimeout(2300);await p.screenshot({path:'/private/tmp/story-coaster-'+variant+'-drink.png'});
  const drink=await card.boundingBox();await p.mouse.move(drink.x+drink.width*.7,drink.y+drink.height/2);await p.mouse.down();await p.mouse.move(zone.x+zone.width/2,zone.y+zone.height*.8,{steps:8});await p.mouse.up();await p.waitForFunction(()=>barGame.drink===null);assert.equal(await p.evaluate(()=>barGame.transactions.length),1);
 }
 await p.setViewportSize({width:960,height:540});assert(await p.evaluate(()=>!barGame.error));
 await p.emulateMedia({reducedMotion:'reduce'});await p.evaluate(()=>{barGame.drink={selected:'dry_martini'};barGame.currentOrder={seat:'R'};barGame.screen='bar';barGame.transition=0;lunaCampaign.render(true);});
 await p.waitForFunction(()=>document.querySelector('.delivery-arrow'));assert.equal(await p.locator('.delivery-arrow').evaluate(e=>getComputedStyle(e).animationName),'none');
 assert.deepEqual(errors,[]);console.log('PASS original/GPT/campaign: first-line lock, drag hide/cancel/restore, delivery then next line, shared art cards, moving drop cue, drink delivery and reduced motion');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
