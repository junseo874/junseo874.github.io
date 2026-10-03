const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),assert=require('node:assert/strict'),fs=require('fs');
const base='/Users/lee/Desktop/project/junseo874.github.io/bar-playtest';
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)console.log('HTTP',r.status(),r.url());});p.on('console',m=>{if(m.type()==='error')console.log('console',m.text())});await p.goto('http://127.0.0.1:8123/bar-playtest/');await p.locator('[data-campaign="title"]').click();await p.locator('[data-campaign="service:A"]').click();await p.locator('[data-campaign="new"]').click();await p.locator('[data-campaign="start-day:0"]').click();await p.waitForFunction(()=>lunaCampaign.view==='prologue');
assert.equal(await p.locator('[data-campaign="skip-prologue"]').count(),0);
assert.equal(await p.locator('.campaign-skip').evaluate(e=>getComputedStyle(e).fontSize),'12px');
assert(await p.locator('.campaign-skip').evaluate(e=>e.classList.contains('is-visible')));
assert.equal(await p.evaluate(()=>lunaCampaign.cinema.scenes.length),1);
assert.deepEqual(await p.evaluate(()=>[...document.scripts].map(s=>s.src).filter(s=>/cinematic\/scene[123]\.js/.test(s))),[]);
assert(await p.evaluate(()=>[...document.scripts].some(s=>/cinematic\/scene5\.js/.test(s.src))));
console.log('SCENES',await p.evaluate(()=>lunaCampaign.cinema.scenes.map(s=>({duration:s.end,lines:s.lines.length,first:s.lines[0].raw}))));
await p.waitForTimeout(5400);assert.equal(await p.locator('.campaign-skip').evaluate(e=>getComputedStyle(e).opacity),'0');
await p.keyboard.down('Space');await p.waitForTimeout(1100);let val=Number(await p.locator('[role="progressbar"]').getAttribute('aria-valuenow'));assert(val>25&&val<55);assert.equal(await p.evaluate(()=>lunaCampaign.view),'prologue');await p.keyboard.up('Space');assert.equal(await p.locator('[role="progressbar"]').getAttribute('aria-valuenow'),'0');await p.waitForTimeout(5400);assert.equal(await p.locator('.campaign-skip').evaluate(e=>getComputedStyle(e).opacity),'0');
// Holding while entering a pause must not carry over or skip after resuming.
await p.keyboard.down('Space');await p.waitForTimeout(600);await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>lunaCampaign.view),'options');const paused=await p.evaluate(()=>lunaCampaign.cinema.time);await p.waitForTimeout(300);assert.equal(await p.evaluate(()=>lunaCampaign.cinema.time),paused);await p.keyboard.up('Space');await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>lunaCampaign.cinemaHoldStart),null);
// Dream-only opening, requested dialogue, all fragments and text-only bubbles.
await p.evaluate(()=>{window.cinemaTick=lunaCampaign.tick;lunaCampaign.tick=()=>true;});
const data=await p.evaluate(()=>{const s=lunaCampaign.cinema.scene;return {lines:s.lines,cuts:s.cuts,end:s.end};});
assert.equal(data.lines[0].text,'루나, 활성화된 프로토콜은?');
assert.equal(data.lines.filter(l=>l.actor==='hound').length,0);
assert.equal(data.lines.length,5);
assert.equal(await p.locator('.campaign-cinema-ui .who').count(),0);
const moments=await p.evaluate(()=>{const s=lunaCampaign.cinema.scene;return [...s.lines.map(l=>l.t+1),...s.cuts.map(c=>c.t+.5),s.end-.1];});
for(const time of moments){
 await p.evaluate(time=>{lunaCampaign.cinema.time=time;lunaCampaign.draw();},time);
 assert.equal(await p.locator('.campaign-cinema-ui .who').count(),0);
 assert(await p.locator('canvas.campaign-prologue').evaluate(el=>el.getContext('2d').getImageData(0,0,480,270).data.some(v=>v!==0)));
}
await p.evaluate(()=>{const s=lunaCampaign.cinema.scene;lunaCampaign.cinema.time=s.lines[0].t+s.lines[0].dur-.2;lunaCampaign.draw();});
await p.screenshot({path:'/private/tmp/campaign-dream-question.png'});
assert.equal(await p.locator('.campaign-cinema-ui .ghost').textContent(),'루나, 활성화된 프로토콜은?');
await p.evaluate(()=>{const s=lunaCampaign.cinema.scene;lunaCampaign.cinema.time=s.cuts[2].t+2.3;lunaCampaign.draw();});
assert.equal(await p.locator('.campaign-cinema-ui .bubble.on').count(),0);
await p.screenshot({path:'/private/tmp/campaign-dream-hound.png'});
console.log('PASS dream fragments, protocol question, silent Hound entrance and dialogue-only bubbles');
// Resume the sole opening scene and verify the existing hold-to-skip behavior.
await p.evaluate(()=>{lunaCampaign.tick=window.cinemaTick;const c=lunaCampaign.cinema;c.index=0;c.scene=c.scenes[0];c.time=0;lunaCampaign.draw();});
await p.keyboard.down('Space');await p.waitForTimeout(1500);await p.screenshot({path:'/private/tmp/campaign-skip-hold.png'});assert.equal(await p.evaluate(()=>lunaCampaign.view),'prologue');await p.waitForTimeout(1700);await p.keyboard.up('Space');await p.waitForFunction(()=>lunaCampaign.view==='game');assert.equal(await p.evaluate(()=>barGame.day),0);assert.equal(await p.evaluate(()=>lunaCampaign.cinema),null);assert.equal(await p.evaluate(()=>lunaCampaign.bgm.audio.muted),false);
// Natural completion takes the same route without any input.
await p.evaluate(()=>lunaCampaign.newGame());await p.waitForFunction(()=>lunaCampaign.view==='prologue');await p.evaluate(()=>{const c=lunaCampaign.cinema;c.index=0;c.scene=c.scenes[0];c.time=c.scene.end-.001;lunaCampaign.draw();});await p.waitForFunction(()=>lunaCampaign.view==='game');assert.equal(await p.evaluate(()=>barGame.day),0);
assert.deepEqual(errors,[]);console.log('PASS hint 5s / short hold reset / ESC / 3s skip / dream-only opening / direct day-zero completion / no JS errors');}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
