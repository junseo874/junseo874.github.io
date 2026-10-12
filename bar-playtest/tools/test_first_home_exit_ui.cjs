const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.stack));
await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.waitForFunction(()=>!!window.outsidePlaytest);
if(await p.locator('.updates-close').count())await p.locator('.updates-close').click();
await p.evaluate(async()=>{Object.assign(outsidePlaytest.config,{place:'home',day:0,flow:'in'});await outsidePlaytest.start();});await p.waitForFunction(()=>!outsidePlaytest.loading);
assert.equal(await p.evaluate(()=>outsidePlaytest.model.story.speech),null);
await p.keyboard.press('KeyE');await p.waitForFunction(()=>outsidePlaytest.model.story.speech?.id==='day0_first_home_exit');
assert(await p.evaluate(()=>outsidePlaytest.model.scene==='street'&&!outsidePlaytest.model.transition&&!outsidePlaytest.model.story.speech.auto));
await p.waitForTimeout(1800);const cue=p.locator('.outside-speech .dialogue-advance-cue');assert(await cue.isVisible());
assert.equal(await p.locator('.outside-speech-text').textContent(),'바의 위치는 엘리베이터를 타고 내려가서 우측으로 쭉 가면 된다고 했어.');
const x=await p.evaluate(()=>outsidePlaytest.model.x);await p.keyboard.down('KeyD');await p.waitForTimeout(200);await p.keyboard.up('KeyD');assert.equal(await p.evaluate(()=>outsidePlaytest.model.x),x);
await p.keyboard.press('KeyE');assert.equal(await p.evaluate(()=>outsidePlaytest.model.story.speech.index),1);await p.waitForTimeout(600);assert.equal(await p.locator('.outside-speech-text').textContent(),'가게 이름은 언노운...');
await p.screenshot({path:'/private/tmp/first-home-exit.png'});
await p.keyboard.press('KeyE');assert.equal(await p.evaluate(()=>outsidePlaytest.model.story.speech),null);
// Enter the house and leave again: no repeated route dialogue.
await p.keyboard.press('KeyE');await p.waitForFunction(()=>outsidePlaytest.model.scene==='home'&&!outsidePlaytest.model.transition);await p.keyboard.press('KeyE');await p.waitForFunction(()=>outsidePlaytest.model.scene==='street'&&!outsidePlaytest.model.transition);assert.equal(await p.evaluate(()=>outsidePlaytest.model.story.speech),null);
const exclusions=await p.evaluate(()=>{const out=[];for(const day of [0,1,2,3])for(const flow of ['in','out']){if(day===0&&flow==='in')continue;const m=new LunaOutside.Model({place:'home',day,flow});m.interact();for(let i=0;i<20;i++)m.tick(.05);out.push(m.story.speech?.id==='day0_first_home_exit');}return out;});assert(exclusions.every(x=>!x));
// Campaign progression and carried flags retain the one-shot across model recreation.
await p.evaluate(()=>{lunaCampaign.session.active=true;lunaCampaign.session.developer=false;lunaCampaign.session.carry={flags:{}};delete barGame.progress.flags.day0_first_home_exit;const m=new LunaOutside.Model({place:'home',day:0,flow:'in'});m.interact();for(let i=0;i<20;i++)m.tick(.05);if(!m.story.blocking||!barGame.progress.flags.day0_first_home_exit||!lunaCampaign.session.carry.flags.day0_first_home_exit)throw Error('campaign flag missing');const n=new LunaOutside.Model({place:'home',day:0,flow:'in'});n.interact();for(let i=0;i<20;i++)n.tick(.05);if(n.story.speech)throw Error('campaign repeat');lunaCampaign.session.active=false;});
assert.deepEqual(errors,[]);console.log('PASS first home exit / two manual lines / movement lock / cue / no repeat / day-route exclusions / carried campaign flag');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
