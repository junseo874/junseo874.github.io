const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[],missing=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)missing.push(r.url());});
 await p.addInitScript(()=>{window.audioStarts=0;const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args){audioStarts++;return start.apply(this,args);};});
 await p.goto('http://127.0.0.1:8123/bar-playtest/');await p.locator('[data-campaign="title"]').click();await p.locator('.title-logo.logo-ready').waitFor();
 assert.deepEqual(await p.locator('.title-choice').allTextContents(),['새 게임','이어하기','설정','종료']);
 const disabled=p.locator('.title-choice[data-campaign="continue"]');assert(await disabled.isDisabled());
 assert.match(await p.locator('.campaign-title').evaluate(e=>getComputedStyle(e,'::after').backgroundImage),/title-dots/);
 await p.waitForTimeout(450);await p.mouse.move(1100,650);const count=await p.evaluate(()=>audioStarts);
 await disabled.hover();await disabled.click({force:true});await p.waitForTimeout(150);
 assert.equal(await p.evaluate(()=>audioStarts),count,'Disabled continue never plays hover/click audio');
 assert.equal(await p.evaluate(()=>lunaCampaign.view),'title');assert.equal(await disabled.locator('.title-label').evaluate(e=>getComputedStyle(e).animationName),'none');
 assert.equal(await disabled.evaluate(e=>getComputedStyle(e,'::before').content),'none');
 await p.locator('[data-campaign="new"]').focus();await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.dataset.campaign),'options','Tab skips Continue');
 await p.keyboard.press('Enter');assert.equal(await p.evaluate(()=>lunaCampaign.view),'options');await p.locator('[data-campaign="resume"]').click();
 await p.mouse.move(1100,650);await p.waitForTimeout(450);
 await p.evaluate(()=>{const l=lunaCampaign.titleLogo;l.time=0;l.tick(0);l.tick=()=>{};});
 await p.screenshot({path:'/private/tmp/luna-title-resources.png'});
 await p.locator('.title-choice[data-campaign="options"]').hover();
 assert.equal(await p.locator('[data-campaign="new"]').evaluate(e=>getComputedStyle(e,'::before').content),'none','Only hovered menu highlighted');
 assert.equal(await p.locator('.title-choice[data-campaign="options"] .title-label').evaluate(e=>getComputedStyle(e).animationName),'title-signal');
 for(const viewport of [{width:820,height:650},{width:1920,height:1080}]){
  await p.setViewportSize(viewport);await p.waitForTimeout(100);const stage=await p.locator('.campaign-title').boundingBox();
  for(const e of await p.locator('.title-choice,.title-logo').all()){const r=await e.boundingBox();assert(r.x>=stage.x&&r.y>=stage.y&&r.x+r.width<=stage.x+stage.width&&r.y+r.height<=stage.y+stage.height);}
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }
 await p.locator('[data-campaign="new"]').click();await p.waitForFunction(()=>lunaCampaign.view==='prologue',null,{timeout:60000});assert.equal(await p.locator('[data-campaign^="story:"]').count(),0);await p.goto('http://127.0.0.1:8123/bar-playtest/');
 await p.locator('[data-campaign="title"]').click();assert(await disabled.isDisabled());await p.locator('.title-choice[data-campaign="picker"]').click();assert.equal(await p.evaluate(()=>lunaCampaign.view),'picker');
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);console.log('PASS title resources: four menu buttons, disabled/silent Continue, keyboard focus, one highlight, original text glitch, settings/new/exit navigation, compact/full HD bounds, no missing assets.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
