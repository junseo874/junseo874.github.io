const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1550,height:1050},acceptDownloads:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html?tab=sounds');
  await page.waitForFunction(()=>window.resourceReview?.ready);
  assert.equal(await page.locator('#nav [aria-current=true]').getAttribute('data-group'),'common-sounds');
  const rows=await page.evaluate(()=>resourceReview.rows.filter(r=>r.audio));
  assert.equal(rows.length,38);assert.equal(new Set(rows.map(r=>r.audio.src)).size,rows.length);
  assert.equal(rows.filter(r=>r.audio.state==='archive').length,3);
  for(const r of rows)assert(r.audio.src.endsWith(r.audio.kind==='music'?'.mp3':'.wav'),'Format policy: '+r.audio.src);
  for(const r of rows)assert(fs.statSync(path.resolve(__dirname,'..',r.audio.src)).size>0,r.audio.src);
  const audioSettings=()=>page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([key])=>/bgm|sfx|dialogue.sound|street.*volume/.test(key))));
  const before=await audioSettings();
  const select=async src=>{await page.evaluate(src=>resourceReview.select(resourceReview.rows.find(r=>r.audio?.src===src).id),src);await page.waitForFunction(()=>document.querySelector('#sound-player')?.readyState>=1);};
  // Every format and file must be playable, including short dialogue ticks and MP3 music.
  for(const r of rows){await select(r.audio.src);assert(await page.evaluate(()=>Number.isFinite(document.querySelector('#sound-player').duration)&&document.querySelector('#sound-player').duration>0),r.audio.src);}
  await select('assets/audio/effects/ambience/street-loop.wav');
  assert(await page.locator('#sound-player').evaluate(a=>a.paused));
  await page.click('[data-sound-play]');
  await page.waitForFunction(()=>document.querySelector('#sound-player').currentTime>0);
  await page.check('[data-sound-loop]');assert(await page.locator('#sound-player').evaluate(a=>a.loop));
  await page.evaluate(()=>{window.previousSound=document.querySelector('#sound-player');previousSound.volume=.22;});
  await select('assets/audio/music/luna-track-01.mp3');
  assert(await page.evaluate(()=>previousSound.paused&&!previousSound.hasAttribute('src')));
  assert.equal(await page.locator('#sound-player').evaluate(a=>a.volume),.22);
  assert(!(await page.locator('#sound-player').evaluate(a=>a.loop)));
  await page.click('[data-sound-play]');await page.waitForFunction(()=>document.querySelector('#sound-player').currentTime>0);
  await page.click('[data-sound-stop]');assert(await page.locator('#sound-player').evaluate(a=>a.paused&&a.currentTime===0));
  for(const src of ['assets/audio/effects/click_clean.wav','assets/audio/effects/ambience/rain-loop.wav','assets/audio/music/luna-track-02.mp3','../assets/prototype/sound/LUNA_Track_02.mp3']){
   await select(src);const pending=page.waitForEvent('download');await page.locator('#inspect-downloads a').click();const download=await pending;
   assert.equal(download.suggestedFilename(),src.split('/').at(-1));assert.equal(await download.failure(),null);
   assert(fs.readFileSync(await download.path()).equals(fs.readFileSync(path.resolve(__dirname,'..',src))),src);
  }
  await page.click('[data-facet=soundKind][data-value=ui]');assert.equal(await page.locator('#grid .card').count(),8);
  await page.click('[data-facet=soundState][data-value=archive]');assert.equal(await page.locator('#grid .card').count(),2);
  await page.click('[data-filter-reset]');await page.fill('#search','change-clothes.wav');assert.equal(await page.locator('#grid .card').count(),1);
  await page.click('[data-filter-reset]');
  await select('assets/audio/effects/ambience/street-loop.wav');await page.click('[data-sound-play]');
  await page.evaluate(()=>{window.previousSound=document.querySelector('#sound-player');});
  await page.click('[data-group=bar-characters]');assert(await page.evaluate(()=>previousSound.paused&&!previousSound.hasAttribute('src')));
  await page.click('[data-group=common-sounds]');
  // Load failure is explicit and can be retried without leaving the inspector.
  await page.route('**/assets/audio/effects/home-door.wav',route=>route.abort());
  await page.evaluate(()=>resourceReview.select('sound:assets/audio/effects/home-door.wav'));
  await page.waitForFunction(()=>document.querySelector('[data-sound-status]').textContent.includes('불러오지 못했습니다'));
  await page.unroute('**/assets/audio/effects/home-door.wav');await page.click('[data-sound-play]');
  await page.waitForFunction(()=>document.querySelector('#sound-player').currentTime>0);
  await page.evaluate(()=>{window.previousSound=document.querySelector('#sound-player');});
  await page.click('[data-group=missing]');assert(await page.evaluate(()=>previousSound.paused));
  await page.click('[data-group=common-sounds]');assert.equal(await page.locator('#sound-player').count(),0);
  await select('assets/audio/effects/home-door.wav');
  assert.deepEqual(await audioSettings(),before,'Preview must not save over game audio settings');
  assert(await page.evaluate(()=>document.querySelector('#game').contentWindow.barBgm.audio.muted),'Hidden simulator BGM must remain muted');
  await page.screenshot({path:'/private/tmp/resource-sounds-desktop.png',fullPage:true});
  const csvPending=page.waitForEvent('download');await page.click('#export');const csv=fs.readFileSync(await (await csvPending).path(),'utf8');assert(csv.includes('assets/audio/effects/hover_clean.wav'));assert(csv.includes('src/shared/audio/hover-audio.js'));
  await page.setViewportSize({width:390,height:844});await select('assets/audio/effects/click_clean.wav');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('#inspector').screenshot({path:'/private/tmp/resource-sounds-mobile.png'});
  assert.deepEqual(errors,[]);
  console.log('PASS 38 audio files: metadata/decoding, audition, stop/switch, loop, filters, search, four byte-identical downloads, retry, unchanged settings, CSV and mobile layout');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
