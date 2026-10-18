const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.stack));
  const hidden=value=>p.evaluate(value=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>value});document.dispatchEvent(new Event('visibilitychange'));},value);
  const blur=()=>p.evaluate(()=>window.dispatchEvent(new Event('blur')));
  await p.goto('http://127.0.0.1:8123/bar-playtest/');
  assert.equal(await p.evaluate(()=>LunaFocusSettings.enabled),true);
  await p.evaluate(()=>lunaCampaign.action('options'));
  const field=p.locator('[data-setting="focus"]');
  const setting={inputValue:async()=>{await p.locator('[data-settings-tab="game"]').click();return field.inputValue();},selectOption:async value=>{await p.locator('[data-settings-tab="game"]').click();return field.selectOption(value);}};assert.equal(await setting.inputValue(),'on');
  await setting.selectOption('off');await p.screenshot({path:'/private/tmp/focus-settings.png'});
  await p.reload();assert.equal(await p.evaluate(()=>LunaFocusSettings.enabled),false);
  await p.evaluate(()=>lunaCampaign.newGame('A'));await p.waitForFunction(()=>lunaCampaign.view==='prologue',null,{timeout:60000});
  await blur();assert.equal(await p.evaluate(()=>lunaCampaign.view),'prologue');
  const t=await p.evaluate(()=>lunaCampaign.cinema.time+(lunaCampaign.cinema.dialogueWait?.age||0));await hidden(true);await p.waitForTimeout(600);
  assert(await p.evaluate(t=>lunaCampaign.cinema.time+(lunaCampaign.cinema.dialogueWait?.age||0)>t+.2,t),'cutscene or its waiting dialogue advances in a hidden tab with auto-pause off');
  assert.equal(await p.evaluate(()=>barGame.hidden),false);await hidden(false);
  await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>lunaCampaign.view),'options');
  const paused=await p.evaluate(()=>lunaCampaign.cinema.time);await p.waitForTimeout(200);assert.equal(await p.evaluate(()=>lunaCampaign.cinema.time),paused);
  await setting.selectOption('on');await p.keyboard.press('Escape');await blur();assert.equal(await p.evaluate(()=>lunaCampaign.view),'options');
  await setting.selectOption('off');assert.equal(await p.evaluate(()=>lunaCampaign.view),'options','Changing the preference must not close a manually opened menu');
  await p.keyboard.press('Escape');
  await p.evaluate(()=>{const c=lunaCampaign,last=c.cinema.scene.clips.filter(c=>c.track==='phone-lines').at(-1);c.cinema.time=last.start;c.cinema.dialogueWait={id:last.id,age:99,revealed:true};c.advanceCinemaDialogue();});
  await p.waitForFunction(()=>outsidePlaytest.model.controlsTutorial);await p.waitForTimeout(2100);await p.keyboard.press('KeyE');await p.waitForTimeout(350);await p.keyboard.press('KeyE');await p.waitForFunction(()=>!outsidePlaytest.model.controlsTutorial);
  await p.keyboard.down('KeyA');await blur();await p.keyboard.up('KeyA');
  const x=await p.evaluate(()=>outsidePlaytest.model.x),time=await p.evaluate(()=>outsidePlaytest.model.time);
  await hidden(true);await p.waitForTimeout(550);assert.equal(await p.evaluate(()=>outsidePlaytest.model.x),x);
  assert(await p.evaluate(time=>outsidePlaytest.model.time>time+.2,time),'outside keeps ticking with no stuck movement: '+JSON.stringify(await p.evaluate(()=>({view:lunaCampaign.view,paused:outsidePlaytest.model.paused,enabled:LunaFocusSettings.enabled,tutorial:outsidePlaytest.model.controlsTutorial,time:outsidePlaytest.model.time}))));
  assert.equal(await p.evaluate(()=>outsidePlaytest.model.paused),false);await hidden(false);
  await p.keyboard.press('Escape');await setting.selectOption('on');await p.keyboard.press('Escape');await hidden(true);
  assert.equal(await p.evaluate(()=>lunaCampaign.view),'options');assert.equal(await p.evaluate(()=>outsidePlaytest.model.paused),true);
  const frozen=await p.evaluate(()=>outsidePlaytest.model.time);await p.waitForTimeout(300);assert.equal(await p.evaluate(()=>outsidePlaytest.model.time),frozen);
  await hidden(false);await setting.selectOption('off');await p.keyboard.press('Escape');
  // Standalone practice has its own settings screen and pause handler.
  await p.goto('http://127.0.0.1:8123/bar-playtest/?mode=minigames');
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(()=>barGame.startMinigame('shake','original'));await p.waitForTimeout(200);
  await p.keyboard.press('Escape');assert.equal(await setting.inputValue(),'off');await p.keyboard.press('Escape');
  await blur();assert.equal(await p.evaluate(()=>barGame.overlay),null);
  const before=await p.evaluate(()=>barGame.realTime);await hidden(true);await p.waitForTimeout(550);
  assert.equal(await p.evaluate(()=>barGame.isPaused()),false);assert(await p.evaluate(before=>barGame.realTime>before+.2,before));
  await hidden(false);await p.keyboard.press('Escape');await setting.selectOption('on');await p.keyboard.press('Escape');await blur();
  assert.equal(await p.evaluate(()=>barGame.overlay),'settings',JSON.stringify(await p.evaluate(()=>({enabled:LunaFocusSettings.enabled,phase:barGame.phase,view:lunaCampaign.view,finished:barGame.finished,outside:outsidePlaytest.active,errors:barGame.error}))));await hidden(true);assert.equal(await p.evaluate(()=>barGame.hidden),true);await hidden(false);
  // The exterior developer settings expose the same persisted value.
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(async()=>{Object.assign(outsidePlaytest.config,{place:'bar',day:1,flow:'out'});await outsidePlaytest.start();});await p.waitForFunction(()=>!outsidePlaytest.loading);
  await p.keyboard.press('Escape');assert.equal(await setting.inputValue(),'on');await setting.selectOption('off');await p.keyboard.press('Escape');await blur();
  assert.equal(await p.evaluate(()=>outsidePlaytest.model.paused),false);
  assert.deepEqual(errors,[]);console.log('PASS shared settings in title/main/exterior/practice / default on / persistence / blur and hidden tab on-off / actual background progression / input release / manual pause preserved');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
