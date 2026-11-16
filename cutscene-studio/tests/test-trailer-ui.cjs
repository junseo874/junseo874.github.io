const assert=require('node:assert/strict');
const rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{const browser=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[],missing=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)missing.push(r.url());});
 await page.addInitScript(()=>{window.trailerTicks=[];const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args){if(this.buffer?.duration<.04)trailerTicks.push({rate:this.playbackRate.value,loop:this.loop,time:performance.now()});return start.apply(this,args);};});
 await page.goto('http://127.0.0.1:8123/cutscene-studio/trailer.html');
 await page.waitForFunction(()=>window.lunaTrailerPreview?.ready,null,{timeout:90000});
 const scenes=await page.evaluate(()=>lunaTrailerPreview.scenes);assert.deepEqual(scenes.slice(0,4).map(s=>s.file||s.kind),['terrace','team','seoul-puddle','street-run']);assert.equal(scenes.at(-1).actor,'luna');
 assert.deepEqual(scenes.filter(s=>s.kind==='card').map(s=>s.text),['당신이 선택한 한잔','바를 찾는 손님들','당신이 만들어 가는 이야기']);
 assert.deepEqual(scenes.filter(s=>s.montage==='craft').map(s=>s.file||s.kind),['ingredients','open','pour-soda','stir','shake','serve']);
 assert(scenes.filter(s=>s.montage==='craft'&&s.kind!=='serve').every(s=>s.duration===2));
 const guests=scenes.filter(s=>s.montage==='guests');
 assert.equal(guests.length,7);assert(guests.every(s=>s.duration===2&&s.drink));assert(guests.some(s=>s.glassEmpty)&&guests.some(s=>!s.glassEmpty));
 assert.deepEqual(scenes.filter(s=>s.montage==='outside').map(s=>s.npc||s.file),['boss','believer','newspaper','shiba','boobi','yuna-memory']);
 assert(scenes.filter(s=>s.montage==='outside').every(s=>s.duration===2));
 assert.deepEqual(scenes.slice(-3).map(s=>s.file||s.actor||s.kind),['yuna-memory','chris','luna']);
 const game=page.frames().find(f=>f.url().includes('bar-playtest/'));
 const finalChris=scenes.find(s=>s.kind==='terrace'&&s.actor==='chris'),finalLuna=scenes.find(s=>s.kind==='terrace'&&s.actor==='luna');
 await page.evaluate(t=>lunaTrailerPreview.seek(t),finalChris.end-.01);
 const readTime=await game.evaluate(()=>{window.endingDialog=lunaCampaign.dialog;window.endingScene=lunaCampaign.host.querySelector('.terrace-scene');const d=lunaCampaign.dialog;return{full:d.chars===d.rows[0].text.length,duration:LunaOutsideStory.typing(d.rows[0].text,60).duration};});
 assert(readTime.full);assert(finalChris.duration-finalChris.speechDelay-readTime.duration>=1,'give Chris at least one second of fully revealed reading time');
 await page.evaluate(t=>lunaTrailerPreview.seek(t),finalLuna.start+.01);
 assert(await game.evaluate(()=>endingDialog===lunaCampaign.dialog&&endingScene===lunaCampaign.host.querySelector('.terrace-scene')),'speaker change keeps the same terrace and rain owner');
 assert.equal(await page.locator('#fade,#terrace-curtain').count(),0,'raw shots have no transition overlays');
 assert(await game.evaluate(()=>lunaCampaign.dialog.terraceTime>2.4),'animation clock continues');
 for(let i=0;i<scenes.length;i++){
  const s=scenes[i];await page.evaluate(async at=>{await lunaTrailerPreview.seek(at);},s.start+Math.min(1,s.duration*.5));
  await page.waitForTimeout(160);
  assert(await page.locator('#loading').isHidden(),'loading '+s.title);
  if(s.kind==='bar'){
   const data=await game.evaluate(()=>({text:barGame.dialogue?.text,chars:barGame.dialogue?.chars,paused:barGame.isPaused(),actor:document.querySelector('.actor')?.dataset.actor,pose:document.querySelector('.actor')?.dataset.pose}));
   assert(data.text,'missing speech '+s.actor);assert(data.chars>0);assert(await game.locator('.dialogue-wrap').count());
   assert(!data.paused,'pause overlay '+s.actor);console.log(s.actor,data.pose,data.text?.slice(0,35));
   if(s.montage&&data.text)assert.equal(data.chars,Math.min(data.text.length,Math.floor(Math.min(1,s.duration*.5)*30)));
  }
  if(s.kind==='outside'){
   assert(await game.locator('.outside-speech').count(),'no exterior bubble');
   await page.evaluate(t=>lunaTrailerPreview.seek(t),s.start+.1);
   assert.equal(await game.evaluate(()=>outsidePlaytest.model.story.speech.choice),false,'dialogue before choices');
   await page.evaluate(t=>lunaTrailerPreview.seek(t),s.end-.1);
   assert(await game.locator('.outside-speech').isVisible(),'NPC speaks through the excerpt');
   assert(!await game.evaluate(()=>outsidePlaytest.model.story.speech.choice));
  }
  if(s.kind==='terrace')assert(await game.evaluate(()=>LunaOutsideRain.enabled(lunaCampaign.dialog.terraceWeather)),'every terrace is rainy');
  if(s.kind==='bar'&&s.drink){assert.equal(await game.evaluate(()=>barGame.seats.M.glass),s.drink);assert.equal(await game.locator('.coaster-zone .drink-art').getAttribute('data-art-usage'),s.glassEmpty?'empty':'table');}
  if(['bar','terrace','outside','open','emotions','serve','logo'].includes(s.kind))await page.screenshot({path:`/tmp/luna-trailer-${i}-${s.kind}.png`});
 }
 // Pan on the opening shot and cut directly to the full-frame team logo.
 const [intro,team,puddle,street]=scenes,positions=[];
 await page.locator('#chapters button').first().click();
 await page.waitForFunction(()=>!lunaTrailerPreview.loading);
 assert.equal(await game.evaluate(()=>lunaCampaign.view),'scene');
 assert.equal(intro.duration,intro.panDuration);
 for(const t of [0,1,intro.duration-.01]){
  await page.evaluate(t=>lunaTrailerPreview.seek(t),t);
  positions.push(await game.locator('.terrace-scene').evaluate(e=>new DOMMatrix(getComputedStyle(e).transform).m41));
  assert(await page.locator('#game').isVisible());
 }
 assert(positions[0]<positions[1]&&positions[1]<positions[2]);
 await page.evaluate(t=>lunaTrailerPreview.seek(t),team.start+.02);
 assert(await page.locator('#game').isHidden());
 assert(await page.locator('#footage').evaluate(v=>v.currentTime<.06&&v.offsetLeft===0&&v.offsetWidth===1280));
 assert.equal(team.holdDuration,1);
 await page.evaluate(t=>lunaTrailerPreview.seek(t),team.start+team.holdAt+.08);
 await page.locator('#play').click();await page.waitForTimeout(350);
 assert(await page.locator('#footage').evaluate((v,at)=>v.paused&&Math.abs(v.currentTime-at)<.03,team.holdAt));
 await page.locator('#play').click();
 await page.evaluate(t=>lunaTrailerPreview.seek(t),team.end-.15);
 assert(await page.locator('#footage').evaluate((v,at)=>v.currentTime>at+.35,team.holdAt),'resume the original logo exit after the hold');
 for(const clip of [puddle,street]){
  await page.evaluate(t=>lunaTrailerPreview.seek(t),clip.start);
  assert(await page.locator('#footage').evaluate((v,d)=>v.readyState>=2&&v.duration>=d-.04,clip.duration));
 }
 assert.equal(puddle.title,'2069년, 한국 서울');
 const hero=scenes.find(s=>s.text==='당신이 선택한 한잔');
 await page.evaluate(t=>lunaTrailerPreview.seek(t),hero.start+1);
 assert.equal(await page.locator('#card h2').innerText(),hero.text);
 assert(await page.locator('#serve').isHidden()&&await page.locator('#footage').isHidden());
 const servingClip=scenes.find(s=>s.kind==='serve');
 await page.evaluate(t=>lunaTrailerPreview.seek(t),servingClip.start+.12);
 await page.locator('#play').click();await page.waitForTimeout(200);
 assert(await page.evaluate(()=>!lunaTrailerPreview.fxAudio.active),'hand-off is silent');
 await page.locator('#play').click();
 await page.evaluate(t=>{trailerTicks=[];return lunaTrailerPreview.seek(t);},scenes.find(s=>s.kind==='bar').start+.01);
 await page.locator('#play').click();await page.waitForTimeout(1000);await page.locator('#play').click();
 const ticks=await page.evaluate(()=>trailerTicks);assert(ticks.length>=3&&ticks.length<=17);
 assert(ticks.every(t=>t.rate===1&&!t.loop),'native dialogue one-shots, never fast looping');
 // Both sides of every hard cut stay fully visible, including craft and exterior cuts.
 for(let i=1;i<scenes.length;i++){
  for(const t of [scenes[i].start-.01,scenes[i].start+.01]){
   await page.evaluate(t=>lunaTrailerPreview.seek(t),t);
   assert(await page.locator('#loading').isHidden(),'loading flash '+scenes[i].title);
  }
 }
 const opening=scenes.find(s=>s.kind==='open');
 await page.evaluate(t=>lunaTrailerPreview.seek(t),opening.start+.1);
 assert.equal(await game.evaluate(()=>barGame.gimmick.openPhase),'rhythm');
 assert.equal(await game.locator('[data-opening-stage]').getAttribute('data-state'),'rhythm');
 await page.screenshot({path:'/tmp/luna-trailer-opening-ring.png'});
 await page.evaluate(t=>lunaTrailerPreview.seek(t),opening.start+.6);
 assert.equal(await game.evaluate(()=>barGame.gimmick.openPhase),'pop');
 await page.evaluate(t=>lunaTrailerPreview.seek(t),opening.start+.1);
 assert.equal(await game.evaluate(()=>barGame.gimmick.completed),false,'opening scrub resets completion');
 const serving=scenes.find(s=>s.kind==='serve'),drinks=new Set();
 for(let i=0;i<8;i++){
  const offset=(i+.5)*1.5/8;
  await page.evaluate(t=>lunaTrailerPreview.seek(t),serving.start+offset);
  assert.equal(Number(await page.locator('#serve').getAttribute('data-frame')),Math.floor(offset*20),'source 20fps');
  drinks.add(await page.locator('#serve').getAttribute('data-cocktail'));
 }
 assert.equal(drinks.size,8,'all eight cocktails at normal hand speed');
 for(const offset of [1.5,2.4,3.1]){
  await page.evaluate(t=>lunaTrailerPreview.seek(t),serving.start+offset);
  assert.equal(await page.locator('#serve').getAttribute('data-frame'),'29','hold the completed hand frame');
  assert.equal(await page.locator('#serve').getAttribute('data-cocktail'),'dry_martini','finish and hold on dry martini');
 }
 const muted=await game.evaluate(()=>{let sounds=0;const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(){sounds++;};try{LunaStoryNoticeAudio.play(()=>true);return sounds;}finally{AudioBufferSourceNode.prototype.start=start;}});
 assert.equal(muted,0,'preview popup sound must stay silent');
 const identity=scenes.find(s=>s.kind==='identity');await page.evaluate(t=>lunaTrailerPreview.seek(t),identity.start+2);assert.equal(await page.locator('#card h2').innerText(),'휴머노이드 실험체, LUNA-1185');
 await page.evaluate(t=>lunaTrailerPreview.seek(t),identity.start+2.1);
 const glitch=await page.evaluate(()=>({text:document.querySelector('#composition').classList.contains('text-glitch'),screen:document.querySelector('#composition').classList.contains('glitch'),overlay:getComputedStyle(document.querySelector('#glitch')).opacity,card:getComputedStyle(document.querySelector('#card')).transform,slice:getComputedStyle(document.querySelector('#card h2'),'::before').opacity}));
 assert(glitch.text);assert(!glitch.screen);assert.equal(glitch.overlay,'0');assert.equal(glitch.card,'none');assert(Number(glitch.slice)>0);
 await page.screenshot({path:'/tmp/luna-trailer-identity-slices.png'});
 await page.evaluate(t=>lunaTrailerPreview.seek(t),identity.start+3);assert.equal(await page.locator('#card h2').innerText(),'바 ‘언노운’의 바텐더, 루나');
 await page.evaluate(()=>lunaTrailerPreview.seek(0));await page.locator('#play').click();await page.waitForTimeout(500);assert(await page.evaluate(()=>lunaTrailerPreview.time)>.2);await page.locator('#play').click();const time=await page.evaluate(()=>lunaTrailerPreview.time);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>lunaTrailerPreview.time),time);
 await page.getByRole('link',{name:'편집 소스',exact:true}).click();
 const sources=page.locator('#chapters button');assert.equal(await sources.count(),scenes.length+2);
 for(let i=0;i<scenes.length+2;i++){
  await sources.nth(i).click();
  await page.waitForFunction(()=>document.getElementById('source-player').readyState>=1);
  const data=await page.locator('#source-player').evaluate(v=>[v.videoWidth,v.videoHeight,v.duration,v.currentSrc]);
  assert.deepEqual(data.slice(0,2),[1920,1080]);
  const expected=i===0?scenes.at(-1).end:i===scenes.length+1?puddle.duration:scenes[i-1].duration;
  assert(Math.abs(data[2]-expected)<.06,'source duration '+i);
  assert.equal(new URL(await page.locator('#source-download').getAttribute('href'),page.url()).href,data[3]);
 }
 const downloaded=page.waitForEvent('download');await page.locator('#source-download').click();
 assert((await downloaded).suggestedFilename().includes('무자막'));
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);console.log('TRAILER_UI_OK',scenes.length,'scenes; hard cuts, local text glitch, ring-only opening, 20fps serving, silent popups, no missing resources');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
