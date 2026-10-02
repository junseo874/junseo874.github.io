const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:8123/bar-playtest/');await p.locator('[data-campaign="title"]').click();await p.locator('[data-campaign="new"]').click();await p.locator('[data-campaign="start-day:0"]').click();await p.waitForFunction(()=>lunaCampaign.view==='prologue');
for(const skipped of [false,true]){
 if(skipped){await p.evaluate(()=>lunaCampaign.newGame());await p.waitForFunction(()=>lunaCampaign.view==='prologue');}
 const before=await p.evaluate(()=>{lunaCampaign.bgm.setVolume(.6);return localStorage.getItem('luna.bar.playtest.bgm.v1');});
 const start=await p.evaluate(skipped=>{const c=lunaCampaign;c.finishCinema(skipped);return{volume:c.bgm.audio.volume,gain:c.bgm.transitionGain,muted:c.bgm.audio.muted,target:c.bgm.volume};},skipped);
 assert.deepEqual(start,{volume:0,gain:0,muted:false,target:.6});
 await p.waitForTimeout(850);const partial=await p.evaluate(()=>lunaCampaign.bgm.audio.volume);assert(partial>0&&partial<.35,String(partial));
 await p.keyboard.press('Escape');const paused=await p.evaluate(()=>lunaCampaign.bgm.transitionGain);await p.waitForTimeout(150);assert.equal(await p.evaluate(()=>lunaCampaign.bgm.transitionGain),paused);
 await p.evaluate(()=>lunaCampaign.bgm.setVolume(.4));assert(Math.abs(await p.evaluate(()=>lunaCampaign.bgm.audio.volume)-.4*paused)<1e-8);await p.keyboard.press('Escape');
 const samples=[];while(await p.evaluate(()=>lunaCampaign.view==='awakening')){samples.push(await p.evaluate(()=>lunaCampaign.bgm.audio.volume));await p.waitForTimeout(180);}
 for(let i=1;i<samples.length;i++)assert(samples[i]>=samples[i-1]);assert.equal(await p.evaluate(()=>lunaCampaign.bgm.audio.volume),.4);assert.equal(await p.evaluate(()=>lunaCampaign.bgm.volume),.4);
 const saved=JSON.parse(await p.evaluate(()=>localStorage.getItem('luna.bar.playtest.bgm.v1')));assert.equal(saved.volume,.4);assert(!('transitionGain' in saved));console.log('PASS',skipped?'skip':'natural','fade samples',samples.map(v=>v.toFixed(3)));
}
 await p.evaluate(()=>{const b=lunaCampaign.bgm;b.setEnabled(false);b.setTransitionGain(0);b.setTransitionGain(.5);});assert(await p.evaluate(()=>lunaCampaign.bgm.audio.paused));assert.equal(await p.evaluate(()=>lunaCampaign.bgm.enabled),false);
 await p.evaluate(()=>lunaCampaign.toPicker());assert.equal(await p.evaluate(()=>lunaCampaign.bgm.transitionGain),1);assert.equal(await p.evaluate(()=>lunaCampaign.bgm.volume),.4);
 assert.deepEqual(errors,[]);console.log('PASS settings preserved, pause/resume, disabled music, cancelled-transition cleanup, no browser errors');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
