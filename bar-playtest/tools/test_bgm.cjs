const BASE=(process.env.LUNA_TEST_URL||'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('assert/strict'),path=require('path');
(async()=>{let browser;try{
  browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  // file:// supports seeking; the preview's simple HTTP server has no Range support.
  // This lets real ended events test 12 full-length tracks without waiting 40 minutes.
  p.on('pageerror',e=>errors.push(e.message));await p.goto('file://'+path.resolve(__dirname,'../index.html'));
  assert.deepEqual(await p.evaluate(()=>({count:document.querySelectorAll('audio').length,index:barBgm.index,paused:barBgm.audio.paused,volume:barBgm.volume})),{count:1,index:-1,paused:true,volume:.3});
  await p.locator('[data-act="settings"]').click();
  await p.locator('#bgm-volume').waitFor();
  await p.waitForFunction(()=>barBgm.status==='playing'&&barBgm.audio.currentTime>0);
  await p.evaluate(()=>window.originalBgmAudio=barBgm.audio);
  // All four real AAC files must decode. Ending them naturally exercises shuffle.
  const order=[];
  const durations=[174.947,211.61,253.71,125.98];
  for(let n=0;n<12;n++){
    await p.waitForFunction(()=>barBgm.status==='playing'&&Number.isFinite(barBgm.audio.duration)&&barBgm.audio.readyState>=2);
    const track=await p.evaluate(()=>({index:barBgm.index,duration:barBgm.audio.duration}));
    order.push(track.index);assert(Math.abs(track.duration-durations[track.index])<.2,'Audio duration mismatch');
    await p.evaluate(()=>{barBgm.audio.currentTime=barBgm.audio.duration-.18;});
    await p.waitForFunction(previous=>barBgm.index!==previous&&barBgm.status==='playing',track.index);
  }
  for(let i=0;i<12;i+=4)assert.equal(new Set(order.slice(i,i+4)).size,4,'Repeated song inside shuffled round');
  for(let i=1;i<order.length;i++)assert.notEqual(order[i],order[i-1],'Consecutive duplicate song');
  console.log('BGM_SHUFFLE_OK:',order.join(','));
  const t=await p.evaluate(()=>barBgm.audio.currentTime);
  // Game resets, internal screens, overlays and pauses must not recreate/restart audio.
  for(const screen of ['ready','bar','recipe','prep','gimmick','result','settlement','gameover']){
    await p.evaluate(screen=>{
      const g=barGame;g.overlay=null;g.reset(99,'practice',1);
      if(screen==='ready'){g.reset(0,'full',1,false);return;}
      if(screen==='bar'){g.screen='bar';return;}
      if(screen==='recipe')return;
      g.selectCocktail('gin_tonic');
      if(screen==='prep')return;
      g.debugFill();g.startCraft();
      if(screen==='gimmick')return;
      g.debugCraft('excellent');
      if(screen==='result')return;
      g.reset(99,'general',1,true,{upkeepOverride:999999});g.finishDay();
      if(screen==='gameover')g.confirmDailySettlement();
    },screen);
    await p.waitForTimeout(140);
    assert(await p.evaluate(()=>barBgm.audio===originalBgmAudio&&!barBgm.audio.paused));
  }
  assert(await p.evaluate(t=>barBgm.audio.currentTime>t,t));
  // The terminal game-over modal intentionally blocks background toolbar clicks.
  await p.evaluate(()=>barGame.reset(99,'practice',1));await p.waitForTimeout(200);
  assert.deepEqual(errors,[]);
  await p.locator('[data-act="settings"]').click();
  await p.locator('#bgm-volume').focus();await p.keyboard.press('Home');
  for(let i=0;i<17;i++)await p.keyboard.press('ArrowRight');
  assert.equal(await p.evaluate(()=>barBgm.audio.volume),.17);
  await p.screenshot({path:'/private/tmp/bar-bgm-settings.png'});
  await p.locator('[data-act="bgm"]').click();
  const paused=await p.evaluate(()=>barBgm.audio.currentTime);await p.waitForTimeout(200);
  assert.equal(await p.evaluate(()=>barBgm.audio.paused),true);
  assert.equal(await p.evaluate(()=>barBgm.audio.currentTime),paused);
  await p.locator('[data-act="bgm"]').click();await p.waitForFunction(t=>barBgm.audio.currentTime>t,paused);
  await p.locator('[data-act="bgm"]').click();await p.reload();
  assert.deepEqual(await p.evaluate(()=>({enabled:barBgm.enabled,volume:barBgm.volume,index:barBgm.index})),{enabled:false,volume:.17,index:-1});
  await p.locator('[data-act="settings"]').click();await p.waitForTimeout(150);
  assert.equal(await p.evaluate(()=>barBgm.index),-1,'Disabled music started after gesture');
  await p.locator('[data-act="bgm"]').click();await p.waitForFunction(()=>barBgm.status==='playing');
  assert.deepEqual(errors,[]);

  const broken=await browser.newPage();let loads=0;
  await broken.route('**/assets/audio/*.m4a',route=>{loads++;return route.abort();});
  await broken.goto(BASE+"?test=bgm-missing");await broken.keyboard.press('Enter');
  await broken.waitForFunction(()=>barBgm.status==='error');assert.equal(loads,4);
  await broken.waitForTimeout(400);assert.equal(loads,4,'Missing audio entered infinite retry');
  assert.equal(await broken.evaluate(()=>barGame.error),null);
  await broken.unroute('**/assets/audio/*.m4a');await broken.locator('[data-act="settings"]').click();
  await broken.locator('[data-act="bgm"]').click();await broken.locator('[data-act="bgm"]').click();
  await broken.waitForFunction(()=>barBgm.status==='playing');

  const file=await browser.newPage();await file.goto(BASE+"?test=bgm-http");
  await file.keyboard.press('Enter');await file.waitForFunction(()=>barBgm.status==='playing'&&barBgm.audio.currentTime>0);
  assert.equal(await file.locator('audio').count(),1);
  console.log('BGM_OK: four real tracks decoded, 3 shuffled rounds, no consecutive duplicates, all screen transitions, mute/resume, volume/persistence, gesture start, bounded error/retry, file:// playback.');
}finally{await browser?.close();}})().catch(e=>{console.error(e);process.exitCode=1});
