const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),assert=require('node:assert/strict'),fs=require('fs');
const base='/Users/lee/Desktop/project/junseo874.github.io/bar-playtest';
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)console.log('HTTP',r.status(),r.url());});p.on('console',m=>{if(m.type()==='error')console.log('console',m.text())});await p.goto('http://127.0.0.1:8123/bar-playtest/');await p.locator('[data-campaign="title"]').click();await p.locator('[data-campaign="new"]').click();await p.waitForFunction(()=>lunaCampaign.view==='prologue');
assert.equal(await p.locator('[data-campaign="skip-prologue"]').count(),0);
assert.equal(await p.locator('.campaign-skip').evaluate(e=>getComputedStyle(e).fontSize),'12px');
assert(await p.locator('.campaign-skip').evaluate(e=>e.classList.contains('is-visible')));
assert.equal(await p.evaluate(()=>lunaCampaign.cinema.scenes.length),1);
assert.deepEqual(await p.evaluate(()=>[...document.scripts].map(s=>s.src).filter(s=>/cinematic\/(scene[235]|stage[234])\.js/.test(s))),[]);
console.log('SCENES',await p.evaluate(()=>lunaCampaign.cinema.scenes.map(s=>({duration:s.end,lines:s.lines.length,first:s.lines[0].raw}))));
await p.waitForTimeout(5400);assert.equal(await p.locator('.campaign-skip').evaluate(e=>getComputedStyle(e).opacity),'0');
await p.keyboard.down('Space');await p.waitForTimeout(1100);let val=Number(await p.locator('[role="progressbar"]').getAttribute('aria-valuenow'));assert(val>25&&val<55);assert.equal(await p.evaluate(()=>lunaCampaign.view),'prologue');await p.keyboard.up('Space');assert.equal(await p.locator('[role="progressbar"]').getAttribute('aria-valuenow'),'0');await p.waitForTimeout(5400);assert.equal(await p.locator('.campaign-skip').evaluate(e=>getComputedStyle(e).opacity),'0');
// Holding while entering a pause must not carry over or skip after resuming.
await p.keyboard.down('Space');await p.waitForTimeout(600);await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>lunaCampaign.view),'options');const paused=await p.evaluate(()=>lunaCampaign.cinema.time);await p.waitForTimeout(300);assert.equal(await p.evaluate(()=>lunaCampaign.cinema.time),paused);await p.keyboard.up('Space');await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>lunaCampaign.cinemaHoldStart),null);
// Compare every scene with the exact source, including rendered canvas at fixed times.
const source=await b.newPage({viewport:{width:1720,height:954}});await source.goto('file:///Users/lee/Desktop/project/Cutscene/web/index.html');await source.waitForFunction(()=>window.CUT);
await p.evaluate(()=>{window.cinemaTick=lunaCampaign.tick;lunaCampaign.tick=()=>true;});
for(let i=0;i<1;i++){
await source.locator('#selScene').selectOption(String(i));const original=await source.evaluate(()=>({lines:CUT.scene().lines,end:CUT.scene().end}));const actual=await p.evaluate(i=>({lines:lunaCampaign.cinema.scenes[i].lines,end:lunaCampaign.cinema.scenes[i].end}),i);assert.deepEqual(actual,original);
for(const t of [2,original.end*.5,original.end-.1]){await source.evaluate(t=>CUT.seek(t),t);await p.evaluate(({i,t})=>{const c=lunaCampaign.cinema;c.index=i;c.scene=c.scenes[i];c.time=t;lunaCampaign.draw();},{i,t});assert.equal(await p.locator('canvas.campaign-prologue').evaluate(e=>e.toDataURL()),await source.locator('#px').evaluate(e=>e.toDataURL()),'Exact canvas scene '+(i+1)+' at '+t);}
await p.evaluate(i=>{const c=lunaCampaign.cinema;c.time=c.scene.lines.find(l=>l.actor)?.t+1||2;lunaCampaign.draw();},i);await p.screenshot({path:'/private/tmp/campaign-original-scene-'+(i+1)+'.png'});
}
console.log('PASS original lobby scene data and pixel-identical canvas');
// Resume the sole opening scene and verify the existing hold-to-skip behavior.
await p.evaluate(()=>{lunaCampaign.tick=window.cinemaTick;const c=lunaCampaign.cinema;c.index=0;c.scene=c.scenes[0];c.time=0;lunaCampaign.draw();});
await p.keyboard.down('Space');await p.waitForTimeout(1500);await p.screenshot({path:'/private/tmp/campaign-skip-hold.png'});assert.equal(await p.evaluate(()=>lunaCampaign.view),'prologue');await p.waitForTimeout(1700);await p.keyboard.up('Space');await p.waitForFunction(()=>lunaCampaign.view==='game');assert.equal(await p.evaluate(()=>barGame.day),0);assert.equal(await p.evaluate(()=>lunaCampaign.cinema),null);assert.equal(await p.evaluate(()=>lunaCampaign.bgm.audio.muted),false);
// Natural completion takes the same route without any input.
await p.evaluate(()=>lunaCampaign.newGame());await p.waitForFunction(()=>lunaCampaign.view==='prologue');await p.evaluate(()=>{const c=lunaCampaign.cinema;c.index=0;c.scene=c.scenes[0];c.time=c.scene.end-.001;lunaCampaign.draw();});await p.waitForFunction(()=>lunaCampaign.view==='game');assert.equal(await p.evaluate(()=>barGame.day),0);
assert.deepEqual(errors,[]);console.log('PASS hint 5s / short hold reset / ESC / 3s skip / lobby-only opening / direct day-zero completion / no JS errors');await source.close();}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
