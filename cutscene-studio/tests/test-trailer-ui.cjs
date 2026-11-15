const assert=require('node:assert/strict');
const rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{const browser=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[],missing=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)missing.push(r.url());});
 await page.addInitScript(()=>{window.trailerTicks=[];const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args){if(this.buffer?.duration<.04)trailerTicks.push({rate:this.playbackRate.value,loop:this.loop,time:performance.now()});return start.apply(this,args);};});
 await page.goto('http://127.0.0.1:8123/cutscene-studio/trailer.html');
 await page.waitForFunction(()=>window.lunaTrailerPreview?.ready,null,{timeout:90000});
 const scenes=await page.evaluate(()=>lunaTrailerPreview.scenes);assert.equal(scenes[0].kind,'black');assert.equal(scenes.at(-1).kind,'logo');
 assert.equal(scenes[0].duration,4.5,'longer quiet introduction');
 assert.deepEqual(scenes.filter(s=>s.file?.startsWith('pour-')).map(s=>s.file),['pour-gin','pour-soda','pour-beer']);
 assert(scenes.find(s=>s.file==='street').title.includes('0일차 퇴근길'));
 assert(scenes.filter(s=>s.montage==='guests'||s.montage==='emotions').every(s=>s.actor!=='chris'&&s.typingSpeed===30));
 assert.equal(scenes.filter(s=>s.kind==='bar'&&s.actor==='chris').length,1,'keep the requested opening Chris line');
 assert.equal(scenes.find(s=>s.file==='stir').duration,2.85);
 assert.equal(scenes.find(s=>s.file==='shake').duration,3.15);
 assert.equal(scenes.find(s=>s.file==='team').playbackRate,1.3);
 assert.equal(scenes.find(s=>s.kind==='emotions').duration,4);
 assert.equal(scenes.at(-2).kind,'black');assert(scenes.at(-2).duration>=1);
 assert.equal(scenes.find(s=>s.kind==='serve').duration,3.3);
 const game=page.frames().find(f=>f.url().includes('bar-playtest/'));
 const finalChris=scenes.find(s=>s.kind==='terrace'&&s.actor==='chris'),finalLuna=scenes.find(s=>s.kind==='terrace'&&s.actor==='luna');
 await page.evaluate(t=>lunaTrailerPreview.seek(t),finalChris.end-.01);
 const readTime=await game.evaluate(()=>{window.endingDialog=lunaCampaign.dialog;window.endingScene=lunaCampaign.host.querySelector('.terrace-scene');const d=lunaCampaign.dialog;return{full:d.chars===d.rows[0].text.length,duration:LunaOutsideStory.typing(d.rows[0].text,60).duration};});
 assert(readTime.full);assert(finalChris.duration-finalChris.speechDelay-readTime.duration>=1,'give Chris at least one second of fully revealed reading time');
 await page.evaluate(t=>lunaTrailerPreview.seek(t),finalLuna.start+.01);
 assert(await game.evaluate(()=>endingDialog===lunaCampaign.dialog&&endingScene===lunaCampaign.host.querySelector('.terrace-scene')),'speaker change keeps the same terrace and rain owner');
 assert.equal(await page.locator('#fade').evaluate(e=>Number(e.style.opacity)),0,'Chris to Luna has no fade');
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
   await page.evaluate(t=>lunaTrailerPreview.seek(t),s.start+4.3);
   if(s.npc!=='believer')assert.equal(await game.evaluate(()=>outsidePlaytest.model.story.speech.choice),true,'choices follow dialogue');
  }
  if(s.kind==='terrace')assert(await game.evaluate(()=>LunaOutsideRain.enabled(lunaCampaign.dialog.terraceWeather)),'every terrace is rainy');
  if(s.drink)assert.equal(await game.evaluate(()=>barGame.seats.M.glass),s.drink);
  if(['bar','terrace','outside','open','emotions','serve','logo'].includes(s.kind))await page.screenshot({path:`/tmp/luna-trailer-${i}-${s.kind}.png`});
 }
 // Intro uses the live exterior rain-glass renderer, including black/title cards.
 await page.evaluate(()=>lunaTrailerPreview.seek(.6));
 const earlyRain=await page.locator('#intro-window-rain').evaluate(e=>({hidden:e.hidden,opacity:Number(e.style.opacity)}));
 assert(!earlyRain.hidden&&earlyRain.opacity>0&&earlyRain.opacity<1,'rain fades in from initial black');
 await game.evaluate(()=>window.introSimulation=LunaRainGlass.inspect(parent.document.querySelector('#intro-window-rain')).simulation);
 for(const s of [scenes.find(s=>s.kind==='terrace'),scenes.find(s=>s.file==='team')]){
  await page.evaluate(t=>lunaTrailerPreview.seek(t),s.start+.2);
  assert(await game.evaluate(()=>introSimulation===LunaRainGlass.inspect(parent.document.querySelector('#intro-window-rain')).simulation),'continuous droplets, not a new layer');
  assert.equal(await page.locator('#fade').evaluate(e=>Number(e.style.opacity)),0,'no dip to black inside wet introduction');
 }
 const city=scenes.find(s=>s.text==='2069년, 서울 언더타운');assert(city);
 await page.evaluate(t=>lunaTrailerPreview.seek(t),city.start+1);
 assert.equal(await page.locator('#intro-window-rain').evaluate(e=>e.hidden),true,'Seoul card must be dry black');
 const emotional=scenes.find(s=>s.kind==='emotions');
 await page.evaluate(t=>lunaTrailerPreview.seek(t),emotional.start+1);
 const label=await page.locator('.emotion-card small').boundingBox(),word=await page.locator('.emotion-word').boundingBox();
 assert(word.y>label.y+label.height&&word.height>label.height,'larger emotion on its own line');
 const ending=scenes.at(-1);
 await page.evaluate(t=>lunaTrailerPreview.seek(t),ending.start+.75);
 assert.equal(await page.locator('#fade').evaluate(e=>Number(e.style.opacity)),.5,'slow logo reveal');
 assert.equal(await page.locator('.trailer-logo').getAttribute('data-glitch'),'false');
 await page.evaluate(t=>lunaTrailerPreview.seek(t),ending.start+1.95);
 assert.equal(await page.locator('.trailer-logo').getAttribute('data-glitch'),'true');
 await page.evaluate(t=>lunaTrailerPreview.seek(t),ending.start+2.03);
 assert.equal(await page.locator('.trailer-logo').getAttribute('data-glitch'),'false','immediate clean recovery');
 await page.evaluate(t=>{trailerTicks=[];return lunaTrailerPreview.seek(t);},scenes.find(s=>s.kind==='bar').start+.01);
 await page.locator('#play').click();await page.waitForTimeout(1000);await page.locator('#play').click();
 const ticks=await page.evaluate(()=>trailerTicks);assert(ticks.length>=3&&ticks.length<=17);
 assert(ticks.every(t=>t.rate===1&&!t.loop),'native dialogue one-shots, never fast looping');
 // Both sides of every hard cut stay fully visible, including craft and exterior cuts.
 for(let i=1;i<scenes.length;i++)if(scenes[i].montage&&scenes[i].montage===scenes[i-1].montage){
  for(const t of [scenes[i].start-.01,scenes[i].start+.01]){
   await page.evaluate(t=>lunaTrailerPreview.seek(t),t);
   assert.equal(await page.locator('#fade').evaluate(e=>Number(getComputedStyle(e).opacity)),0,'unwanted fade '+scenes[i].title);
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
  assert.equal(await page.locator('#fade').evaluate(e=>Number(e.style.opacity)),0,'hold before fading to the next card');
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
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);console.log('TRAILER_UI_OK',scenes.length,'scenes; hard cuts, local text glitch, ring-only opening, 20fps serving, silent popups, no missing resources');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
