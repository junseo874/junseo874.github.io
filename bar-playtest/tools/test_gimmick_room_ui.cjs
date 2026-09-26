const assert=require('assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{let b;try{
 b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[],missing=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))missing.push(r.url());});
 await p.addInitScript(()=>localStorage.setItem('luna.shake.sound.v1','2'));
 await p.goto(process.env.LUNA_TEST_URL||'http://127.0.0.1:8123/bar-playtest/?mode=minigames');
 for(const variant of ['original','gpt'])for(const kind of ['open','pour','fill_up']){
  await p.evaluate(({variant,kind})=>barGame.startMinigame(kind,variant),{variant,kind});
  await p.locator('.gimmick-room-background').waitFor();
  await p.waitForFunction(()=>document.querySelector('.gimmick-room-background')?.naturalWidth===490);
  const img=p.locator('.gimmick-room-background');
  assert((await img.getAttribute('src')).endsWith('a_e6775ed48afd.png'));
  assert.equal(await img.evaluate(e=>getComputedStyle(e).objectFit),'cover');
  assert.equal(await img.evaluate(e=>getComputedStyle(e).imageRendering),'pixelated');
  for(const [width,height]of [[1280,720],[960,540],[1440,900]]){
   await p.setViewportSize({width,height});await p.waitForTimeout(80);
   const a=await img.boundingBox(),s=await p.locator('.craft-screen').boundingBox();
   assert(Math.abs(a.width-s.width)<1&&Math.abs(a.height-s.height)<1);
   assert(Math.abs(a.width/a.height-16/9)<.001);
  }
  await p.setViewportSize({width:1280,height:720});
  if(kind!=='open'){
   assert.equal(await p.locator('.pour-workspace').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
   assert.equal(await p.locator('.pour-back').evaluate(c=>c.getContext('2d').getImageData(0,0,1,1).data[3]),0);
   await p.keyboard.down('Space');await p.waitForFunction(()=>barGame.gimmick.fluid.caughtMl>3);
  }else assert.equal(await p.locator('.opening-stage').evaluate(c=>c.getContext('2d').getImageData(0,0,1,1).data[3]),0);
  await p.screenshot({path:'/private/tmp/room-'+kind+'-'+variant+'.png'});
  await p.keyboard.up('Space');
 }
 await p.evaluate(()=>barGame.startMinigame('shake','original'));await p.locator('.shake-screen').waitFor();
 assert.equal(await p.locator('[data-act="shakeSound"][data-id="1"]').getAttribute('aria-pressed'),'true','Old v1 sound 2 must not override the new default');
 await p.locator('[data-act="shakeSound"][data-id="2"]').click();
 assert.equal(await p.evaluate(()=>localStorage.getItem('luna.shake.sound.v2')),'2');
 await p.reload();await p.evaluate(()=>barGame.startMinigame('shake','original'));await p.locator('.shake-screen').waitFor();
 assert.equal(await p.locator('[data-act="shakeSound"][data-id="2"]').getAttribute('aria-pressed'),'true','Explicit choices after this update remain persistent');
 await p.evaluate(()=>localStorage.removeItem('luna.shake.sound.v2'));await p.reload();
 await p.evaluate(()=>barGame.startMinigame('shake','original'));await p.locator('.shake-screen').waitFor();
 assert.equal(await p.locator('[data-act="shakeSound"][data-id="1"]').getAttribute('aria-pressed'),'true');
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
 console.log('GIMMICK_ROOM_UI_OK: correct supplied image, full-screen cover, pixel-art rendering, transparent foregrounds, both variants × 3 games × 3 sizes; sound 1 default, legacy reset, explicit choices retained.');
}finally{await b?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
