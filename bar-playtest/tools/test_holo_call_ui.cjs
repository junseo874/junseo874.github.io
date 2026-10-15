const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[],missing=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)missing.push(r.url());});
 await p.goto('http://127.0.0.1:8123/bar-playtest/');await p.evaluate(()=>lunaCampaign.newGame());
 await p.waitForFunction(()=>['prologue','load-error'].includes(lunaCampaign.view),null,{timeout:60000});assert.equal(await p.evaluate(()=>lunaCampaign.view),'prologue');
 const clips=await p.evaluate(()=>{const s=lunaCampaign.cinema.scene;StudioModel.validate(s);return {on:s.clips.find(c=>c.assetId==='opening-holo-on'),idle:s.clips.find(c=>c.assetId==='opening-holo-idle'),off:s.clips.find(c=>c.assetId==='opening-holo-off'),lines:s.clips.filter(c=>c.track==='phone-lines'),wake:s.clips.find(c=>c.actor==='home-luna'&&c.rotation===0),end:s.end};});
 assert.equal(clips.wake.facing,'left','Standing Luna faces the hologram on her left');
 assert.equal(clips.on.start,Math.round((clips.wake.start+.5)*100)/100);assert(Math.abs(clips.on.start+clips.on.duration-clips.idle.start)<.001);
 assert(Math.abs(clips.idle.start+clips.idle.duration-clips.off.start)<.001);assert(Math.abs(clips.off.start+clips.off.duration-clips.end)<.001);
 assert(clips.lines.every(c=>c.wait&&c.actor===(c.remote?'phone':'home-luna')));
 assert(await p.evaluate(()=>Array.from({length:11},(_,i)=>{const t=i*.8/11+.001;return StudioHoloCall.frame('on',t).step+StudioHoloCall.frame('off',t).step===10;}).every(Boolean)));
 async function seek(time,line){await p.evaluate(({time,line})=>{const c=lunaCampaign;c.cinema.time=time;c.cinema.dialogueWait=line?{id:line.id,age:99,revealed:true}:null;c.cinema.player.render(time,null,false,0,c.cinema.dialogueWait);}, {time,line});}
 await seek(clips.on.start+.23);await p.screenshot({path:'/private/tmp/luna-holo-opening.png'});
 await seek(clips.lines[0].start,clips.lines[0]);await p.waitForTimeout(150);await p.screenshot({path:'/private/tmp/luna-holo-chris.png'});
 const remote=await p.locator('.studio-speech-bubble:not([hidden])').boundingBox();assert(remote);
 assert(await p.evaluate(()=>{const s=StudioModel.sample(lunaCampaign.cinema.scene,lunaCampaign.cinema.time);return s.actors.phone.active&&s.dialogue.actor==='phone';}));
 const t=await p.evaluate(()=>lunaCampaign.cinema.time);await p.waitForTimeout(1100);assert.equal(await p.evaluate(()=>lunaCampaign.cinema.time),t);
 await seek(clips.lines[1].start,clips.lines[1]);await p.screenshot({path:'/private/tmp/luna-holo-luna.png'});
 const local=await p.locator('.studio-speech-bubble:not([hidden])').boundingBox();assert(local);assert(local.x+local.width/2>remote.x+remote.width/2+90,'Bubbles anchor to distinct speakers');
 assert(await p.evaluate(()=>StudioModel.sample(lunaCampaign.cinema.scene,lunaCampaign.cinema.time).dialogue.actor==='home-luna'));
 const last=clips.lines.at(-1);await seek(last.start,last);await p.keyboard.press('KeyE');
 assert.equal(await p.evaluate(()=>lunaCampaign.view),'prologue');assert.equal(await p.evaluate(()=>outsidePlaytest.model.controlsTutorial),false);
 assert(await p.evaluate(()=>StudioModel.sample(lunaCampaign.cinema.scene,lunaCampaign.cinema.time).actors.phone.assetId==='opening-holo-off'));
 await p.waitForTimeout(250);await p.screenshot({path:'/private/tmp/luna-holo-closing.png'});
 await p.keyboard.press('Space');await p.waitForFunction(()=>lunaCampaign.view==='game'&&outsidePlaytest.model.controlsTutorial);
 assert.equal(await p.evaluate(()=>!!lunaCampaign.memoryTransition),false);assert.equal(await p.locator('.campaign-memory-transition').count(),0);
 // The editor and developer library use the same timeline/renderer.
 await p.goto('http://127.0.0.1:8123/cutscene-studio/?template=opening&revision=holo-call-20261016');await p.waitForFunction(()=>window.cutsceneStudio?.ready);
 assert(await p.evaluate(()=>{StudioModel.validate(cutsceneStudio.project);return cutsceneStudio.project.clips.filter(c=>c.assetId?.startsWith('opening-holo-')).length===3;}));
 await p.evaluate(()=>{const c=cutsceneStudio.project.clips.find(c=>c.track==='phone-lines');cutsceneStudio.seek(c.start+2);});
 await p.locator('#stage').screenshot({path:'/private/tmp/luna-holo-studio.png'});
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);console.log('PASS holo opening/idle/reverse shutdown, separate speaker anchors, manual waits, no premature tutorial or fade, shared editor playback');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
