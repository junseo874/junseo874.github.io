const BASE=(process.env.LUNA_TEST_URL||'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('assert/strict');
(async()=>{let browser;try{
  browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));await p.goto(BASE);
  for(const [width,height] of [[1280,720],[1440,900],[1920,1080],[820,650],[600,800]]){
    await p.setViewportSize({width,height});await p.waitForTimeout(80);
    const r=await p.locator('.app-shell').evaluate(e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height,logicalW:e.offsetWidth,logicalH:e.offsetHeight}});
    assert.equal(r.logicalW,1280);assert.equal(r.logicalH,720);assert(Math.abs(r.width/r.height-16/9)<.001);
    assert(r.width<=width+.1&&r.height<=height+.1);
  }
  await p.setViewportSize({width:1280,height:720});
  await p.evaluate(()=>barGame.reset(99,'practice',1));await p.locator('[data-act="selectRecipe"][data-id="gin_tonic"]').click();
  const active='.shelf-slide[data-current="true"]';
  assert.equal(await p.locator(active+' .shelf-scene').getAttribute('data-category'),'glass');
  // Persistent panels must animate through an intermediate position, not swap backgrounds.
  const x=()=>p.locator('.shelf-track').evaluate(e=>new DOMMatrixReadOnly(getComputedStyle(e).transform).m41);
  const start=await x();await p.keyboard.press('KeyD');await p.waitForTimeout(110);const moving=await x();
  await p.waitForTimeout(500);const end=await x();assert(moving<start&&moving>end,'Missing shelf slide interpolation');
  assert.equal(await p.locator(active+' .shelf-scene').getAttribute('data-category'),'tool');
  await p.locator(active+' [data-id="shaker"]').click();await p.locator(active+' [data-id="opener"]').click();
  assert.equal(await p.evaluate(()=>barGame.prep.tool),'shaker');assert.equal(await p.evaluate(()=>barGame.prep.opener),true);
  assert.equal(await p.locator('.inventory-slot[data-id="opener"]').count(),1);
  await p.locator('.inventory-slot[data-id="opener"]').click();assert.equal(await p.evaluate(()=>barGame.prep.opener),false);
  await p.locator(active+' [data-id="opener"]').hover();await p.screenshot({path:'/private/tmp/bar-layout-opener.png'});
  // Native opaque bottoms, including image padding, land on the specified shelf baseline.
  for(const category of ['glass','tool','liquor','fridge']){
    await p.locator('[data-act="tab"][data-id="'+category+'"]').click();await p.waitForTimeout(600);
    const rows=await p.locator(active+' .shelf-item').evaluateAll(es=>es.map(e=>{
      const sr=e.closest('.shelf-scene').getBoundingClientRect(),im=e.querySelector('img'),r=im.getBoundingClientRect();
      const art=barData.assets['item_'+e.dataset.id]||barData.assets.item_dummy;
      const opaqueBottom=r.top+r.height*art.alphaBBox[3]/art.h;
      const desired=sr.top+Number(e.dataset.baseline)/540*sr.height;
      return {id:e.dataset.id,error:Math.abs(opaqueBottom-desired)};
    }));assert(rows.length);for(const r of rows)assert(r.error<1,r.id+' shelf mismatch '+r.error);
    await p.mouse.move(1250,15);await p.screenshot({path:'/private/tmp/bar-layout-'+category+'.png'});
  }
  await p.keyboard.press('KeyA');await p.waitForTimeout(500);assert.equal(await p.locator(active+' .shelf-scene').getAttribute('data-category'),'liquor');
  assert.equal(await p.locator('.dummy-bottle').count(),0);
  const art=await p.evaluate(()=>({tequila:barData.assets.item_tequila,orange:barData.assets.item_orange_juice,opener:barData.assets.item_opener}));
  assert(art.tequila&&art.orange&&art.opener);
  await p.locator('[data-act="prepBack"]').click();assert.equal(await p.evaluate(()=>barGame.prep),null);
  // Move between seats: layer depths differ but opaque character bottoms stay at the table edge.
  await p.evaluate(()=>{barGame.reset(99,'general',7);for(let i=0;i<100;i++)barGame.tick(.1);barGame.paused=true;});await p.waitForTimeout(700);
  const positions=()=>p.locator('.bar-scene-layer').evaluateAll(es=>es.map(e=>({depth:Number(e.dataset.depth),x:new DOMMatrixReadOnly(getComputedStyle(e).transform).m41})));
  const before=await positions();await p.evaluate(()=>{barGame.focus='R'});await p.waitForTimeout(700);const after=await positions();
  const shift=after.map((e,i)=>e.x-before[i].x);assert(Math.abs(shift[0])<Math.abs(shift[1])&&Math.abs(shift[1])<Math.abs(shift[2]));
  await p.evaluate(()=>{barGame.focus='L';barGame.paused=false;const q=barGame.seats.L;q.coaster=true;q.glass='gin_tonic';barGame.seats.R={...q,id:'other'};barGame.dialogSpeed=.01;});
  await p.waitForTimeout(750);await p.screenshot({path:'/private/tmp/bar-layout-general-table.png'});
  const generalTable=await p.locator('.native-coaster[data-drop="L"]').evaluate(e=>{
    const im=e.querySelector('.drink-art'),c=e.querySelector('.coaster'),r=im.getBoundingClientRect(),cr=c.getBoundingClientRect();
    return {src:im.getAttribute('src'),drinkBottom:r.bottom,coasterTop:cr.top,coasterBottom:cr.bottom};
  });assert(generalTable.src.endsWith(await p.evaluate(()=>barData.assets.table_cocktail_gin_tonic.src)));
  assert(generalTable.drinkBottom>generalTable.coasterTop&&generalTable.drinkBottom<generalTable.coasterBottom);
  // Guest and player bubbles are intentionally at different heights and use opposite tails.
  await p.evaluate(()=>{barGame.reset(99,'practice',1);barGame.screen='bar';barGame.phase='regular';barGame.seats={L:{actor:'port',state:'STORY',coaster:true,glass:'gin_tonic'},M:null,R:null};barGame.dialogue=barGame.makeLine('port','오늘은 진토닉으로 부탁하지.');barGame.dialogue.chars=100;});
  await p.waitForTimeout(750);const guest=await p.locator('.dialogue-wrap').boundingBox();assert.equal(await p.locator('.speaker').count(),1);
  await p.screenshot({path:'/private/tmp/bar-layout-guest.png'});
  await p.evaluate(()=>{barGame.dialogue=barGame.makeLine('luna','네, 주문하신 진토닉 나왔습니다.');barGame.dialogue.chars=100;});await p.waitForTimeout(150);
  const player=await p.locator('.dialogue-wrap').boundingBox();assert(player.y>guest.y);assert.equal(await p.locator('.speaker').count(),1);assert.equal(await p.locator('.speaker').textContent(),'루나');
  assert.equal(await p.locator('.dialogue-wrap.player-speech').count(),1);await p.screenshot({path:'/private/tmp/bar-layout-player.png'});
  await p.evaluate(()=>{barGame.dialogue=null;barGame.choice={rows:[1,2,3,4].map(seq=>({seq,when:null,'text.ko':'선택지 '+seq+' · 오늘은 어떤 하루를 보내셨나요?','text.en':'Choice '+seq}))};});
  await p.waitForTimeout(150);await p.locator('.choices button').first().hover();await p.screenshot({path:'/private/tmp/bar-layout-choices.png'});
  const choices=await p.locator('.choices').boundingBox();assert(choices.y>300&&choices.y+choices.height<680);assert.equal(choices.width,800);
  assert.equal(await p.evaluate(()=>barData.webArtRules.animationCycleSeconds),1);
  assert.deepEqual(errors,[]);assert.deepEqual(await p.evaluate(()=>[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src)),[]);
  console.log('LAYOUT_OK: fixed 1280×720 at five viewport sizes, AD animated slides, provided dummy art, independent opener selection, opaque shelf baselines, parallax, tabletop drinks, guest/player bubbles, choices.');
}finally{await browser?.close();}})().catch(e=>{console.error(e);process.exitCode=1});
