const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400&&r.url().includes('dialogue'))errors.push(r.status()+' '+r.url());});
 await page.addInitScript(()=>{window.playedTicks=[];const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args){if(this.buffer?.duration<.04)playedTicks.push({time:performance.now(),sample:this.buffer.getChannelData(0)[450]});return start.apply(this,args);};});
 try{
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  const updates=page.locator('.updates-confirm');if(await updates.isVisible())await updates.click();
  await page.mouse.click(10,10);await page.waitForFunction(()=>LunaDialogueAudio.ready);
  assert.equal(await page.evaluate(()=>LunaDialogueAudio.version),'low');
  // Live bar flow: first regular line must generate ticks during actual typing.
  await page.evaluate(()=>{barGame.reset(1,'regular',42);barGame.dialogSpeed=.5;});
  await page.waitForFunction(()=>playedTicks.length>=3);
  await page.keyboard.press('Escape');
  await page.locator('[data-dialogue-version]').waitFor({state:'visible'});
  await page.waitForTimeout(100);let count=await page.evaluate(()=>playedTicks.length);
  await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>playedTicks.length),count,'ESC pauses typing sound');
  await page.selectOption('[data-dialogue-version]','main');
  await page.locator('[data-dialogue-preview]').click();await page.waitForTimeout(700);
  assert(await page.evaluate(n=>playedTicks.length>=n+6,count));
  await page.screenshot({path:'/private/tmp/dialogue-integration-jrnn3y/bar-settings.png'});
  await page.selectOption('[data-dialogue-version]','off');assert(await page.locator('[data-dialogue-preview]').isDisabled());
  count=await page.evaluate(()=>playedTicks.length);await page.evaluate(()=>LunaDialogueAudio.reveal('테스트',0,3));await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>playedTicks.length),count);
  await page.selectOption('[data-dialogue-version]','low');await page.reload();await page.evaluate(()=>lunaCampaign.developer());if(await updates.isVisible())await updates.click();assert.equal(await page.evaluate(()=>LunaDialogueAudio.version),'low');
  await page.mouse.click(10,10);await page.waitForFunction(()=>LunaDialogueAudio.ready);
  // Exercise normal core reveal + instant-reveal + throttling without camera changes.
  await page.evaluate(()=>{window.testGame=new LunaCore.Game(barData);testGame.phase='regular';testGame.screen='bar';testGame.dialogue=testGame.makeLine('luna','가'.repeat(200));});
  await page.waitForTimeout(100);count=await page.evaluate(()=>playedTicks.length);
  await page.evaluate(()=>{testGame.typeLine(testGame.dialogue,.2);for(let i=0;i<20;i++)LunaDialogueAudio.reveal('가',0,1);});
  assert.equal(await page.evaluate(()=>playedTicks.length),count+1,'One sound per frame; never catch up in a burst');
  await page.waitForTimeout(100);count=await page.evaluate(()=>playedTicks.length);
  await page.evaluate(()=>{testGame.advance();testGame.typeLine(testGame.dialogue,.05);});assert.equal(await page.evaluate(()=>playedTicks.length),count,'Instant reveal stays silent');
  await page.keyboard.down('ControlLeft');await page.evaluate(()=>LunaDialogueAudio.reveal('가나다',0,3));assert.equal(await page.evaluate(()=>playedTicks.length),count);await page.keyboard.up('ControlLeft');
  await page.evaluate(()=>LunaSfx.setVolume(0));await page.evaluate(()=>LunaDialogueAudio.reveal('가나다',0,3));assert.equal(await page.evaluate(()=>playedTicks.length),count);await page.evaluate(()=>LunaSfx.setVolume(.8));
  await page.waitForTimeout(100);count=await page.evaluate(()=>playedTicks.length);
  await page.evaluate(()=>{testGame.phase='general';testGame.focus='M';const line=testGame.makeLine('guest','일반 손님 주문입니다.');testGame.seats.M={lines:[line],lineIndex:0};testGame.typeLine(line,.1);});
  assert.equal(await page.evaluate(()=>playedTicks.length),count+1,'General guest typing uses the same sound');
  // Outside uses its own live Story clock, with foreground and ambient conversations.
  await page.evaluate(()=>outsidePlaytest.start());await page.waitForFunction(()=>outsidePlaytest.active&&!outsidePlaytest.loading);
  const begin=()=>page.evaluate(()=>{const m=outsidePlaytest.model;m.paused=false;m.story.beginRows('sound-test',{x:m.x,y:m.y},[{type:'say',actor:'luna',text:'대사 출력음을 확인하고 있습니다. '.repeat(12)}]);});
  await begin();count=await page.evaluate(()=>playedTicks.length);await page.waitForTimeout(350);assert(await page.evaluate(n=>playedTicks.length>n,count),'Outside dialogue is audible');
  await page.keyboard.press('Escape');await page.locator('.outside-dialog [data-dialogue-version]').waitFor({state:'visible'});
  await page.waitForTimeout(100);count=await page.evaluate(()=>playedTicks.length);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>playedTicks.length),count);
  await page.selectOption('.outside-dialog [data-dialogue-version]','main');await page.screenshot({path:'/private/tmp/dialogue-integration-jrnn3y/outside-settings.png'});
  await page.keyboard.press('Escape');await page.evaluate(()=>outsidePlaytest.model.story.advance());await page.waitForTimeout(100);count=await page.evaluate(()=>playedTicks.length);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>playedTicks.length),count,'Outside instant reveal stays silent');
  await page.evaluate(()=>{const m=outsidePlaytest.model;m.story.cancel();m.backgroundStory.cancel();m.backgroundStory.beginRows('sound-ambient',{x:m.x,y:m.y},[{type:'say',actor:'npc_test',text:'주변에서 들리는 대화입니다. '.repeat(8)}]);});
  count=await page.evaluate(()=>playedTicks.length);await page.waitForTimeout(350);assert(await page.evaluate(n=>playedTicks.length>n,count),'Ambient dialogue is audible');
  // Main-game ESC/options use the same persisted selector.
  await page.evaluate(()=>{outsidePlaytest.exit(true);lunaCampaign.screen('options');});
  await page.locator('.campaign-card [data-dialogue-version]').waitFor({state:'visible'});
  assert.equal(await page.locator('.campaign-card [data-dialogue-version]').inputValue(),'main');
  await page.screenshot({path:'/private/tmp/dialogue-integration-jrnn3y/campaign-settings.png'});
  await page.evaluate(()=>lunaCampaign.scene([{actor:'luna',text:'테라스에서도 같은 출력음을 사용합니다. '.repeat(10)}],'음성 테스트','black',()=>{}));
  count=await page.evaluate(()=>playedTicks.length);await page.waitForTimeout(350);assert(await page.evaluate(n=>playedTicks.length>n,count),'Campaign dialogue typing is audible');
  assert.deepEqual(errors,[]);
  console.log('PASS: 12 decoded samples; live bar, outside and ambient typing; shared ESC settings, both versions, preview, persistence, off, volume, pause, Ctrl skip, instant reveal and rate limiting.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
