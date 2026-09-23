const BASE=(process.env.LUNA_TEST_URL||'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('assert/strict');
(async()=>{let b;try{
  b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const p=await b.newPage({viewport:{width:1440,height:900}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));await p.goto(BASE);
  await p.evaluate(()=>barGame.reset(99,'practice',1));await p.locator('[data-act="selectRecipe"][data-id="dry_martini"]').click();
  assert.equal(await p.locator('.prep-recipe').count(),0);await p.locator('.recipe-toggle').click();
  await p.screenshot({path:'/private/tmp/bar-art-glass.png'});
  await p.locator('[data-act="tab"][data-id="tool"]').click();
  await p.locator('.shelf-item[data-id="shaker"]').hover();await p.locator('#ingredient-tip').waitFor();
  assert.equal(await p.locator('#ingredient-tip strong').textContent(),await p.evaluate(()=>barGame.name('shaker')));
  assert.equal(await p.locator('#ingredient-tip span').textContent(),await p.evaluate(()=>barGame.text(barGame.t.shelf_items.find(i=>i.id==='shaker'),'desc')));
  await p.screenshot({path:'/private/tmp/bar-art-tool.png'});
  await p.mouse.move(1400,10);await p.waitForTimeout(150);assert.equal(await p.locator('#ingredient-tip').count(),0);
  await p.locator('.prep-recipe [data-act="togglePrepRecipe"]').click();
  await p.locator('[data-act="tab"][data-id="liquor"]').click();
  await p.locator('.shelf-item[data-id="gin"]').hover();await p.screenshot({path:'/private/tmp/bar-art-liquor.png'});
  await p.locator('.shelf-item[data-id="gin"]').click();assert.deepEqual(await p.evaluate(()=>barGame.prep.ingredients),['gin']);
  await p.locator('.inventory-slot[data-id="gin"]').click();assert.deepEqual(await p.evaluate(()=>barGame.prep.ingredients),[]);
  const allLiquor=await p.evaluate(()=>barGame.itemsAvailable().filter(i=>i.kind==='ingredient'&&i.shelf_group==='liquor').map(i=>i.id));
  const page1=await p.locator('.shelf-slide[data-current="true"] .shelf-item').evaluateAll(es=>es.map(e=>e.dataset.id));
  await p.locator('[data-act="shelfPage"][data-id="1"]').click();const page2=await p.locator('.shelf-slide[data-current="true"] .shelf-item').evaluateAll(es=>es.map(e=>e.dataset.id));
  assert.deepEqual([...page1,...page2],allLiquor);
  await p.locator('[data-act="shelfCategory"][data-id="1"]').click();assert.equal(await p.locator('.shelf-slide[data-current="true"] .shelf-scene').getAttribute('data-category'),'fridge');
  // The enlarged shelf now crosses the pointer during the real 450ms camera slide.
  // Hover the final soda position, not a bottle passing under that point in transit.
  await p.waitForTimeout(550);
  await p.locator('.shelf-item[data-id="soda_water"]').hover();await p.screenshot({path:'/private/tmp/bar-art-fridge.png'});
  await p.evaluate(()=>{barGame.lang='en';});await p.waitForTimeout(150);assert.equal(await p.locator('#ingredient-tip span').textContent(),await p.evaluate(()=>barGame.text(barGame.t.shelf_items.find(i=>i.id==='soda_water'),'desc')));
  await p.setViewportSize({width:820,height:650});await p.screenshot({path:'/private/tmp/bar-art-compact.png'});
  await p.locator('.shelf-item[data-id="soda_water"]').click();await p.locator('[data-act="prepBack"]').click();assert.equal(await p.evaluate(()=>barGame.prep),null);
  await p.setViewportSize({width:1440,height:900});await p.evaluate(()=>{barGame.lang='ko';barGame.reset(99,'general',7);for(let i=0;i<100;i++)barGame.tick(.1);});await p.waitForTimeout(200);
  for(const gender of ['m','f']){
    await p.evaluate(gender=>{const g=barGame.seats.L;
      g.appearance={gender,ids:[],layers:['body','top_1','eyes_1','eyebrow_1','mouth_1','hair_1'].map(s=>'guest_'+gender+'_'+s)};
      g.lines=[barGame.makeLine(g.actor,'애니메이션과 파츠 위치를 확인하고 있습니다. 잠시 기다려 주세요.')];g.lineIndex=0;barGame.dialogSpeed=.15;
    },gender);await p.waitForTimeout(300);const actor=p.locator('.actor[data-talking="true"]').first();
    assert.equal(await actor.getAttribute('data-pose'),'talk');
    const frame=await actor.locator('[data-frame]').first().getAttribute('data-frame');await p.waitForTimeout(300);
    assert.notEqual(await actor.locator('[data-frame]').first().getAttribute('data-frame'),frame);
    await p.screenshot({path:'/private/tmp/bar-art-guest-'+gender+'.png'});
    await p.evaluate(()=>{barGame.paused=true});await p.waitForTimeout(150);const frozen=await actor.locator('[data-frame]').first().getAttribute('data-frame');
    await p.waitForTimeout(250);assert.equal(await actor.locator('[data-frame]').first().getAttribute('data-frame'),frozen);
    await p.evaluate(()=>barGame.paused=false);
  }
  await p.evaluate(()=>{const x=barGame.seats.L.appearance;x.layers=x.layers.map(k=>k.replace('eyes_1','eyes_4'));});await p.waitForTimeout(150);
  assert.equal(await p.locator('.actor[data-talking="true"]').first().getAttribute('data-pose'),'static-fallback');
  assert(await p.locator('[data-layer="guest_f_eyes_4"]').count());
  // Separate guests with the same personality must not all talk with the focused bubble.
  await p.evaluate(()=>{const g=barGame.seats.L;barGame.seats.R={...g,id:'second',appearance:{...g.appearance,layers:g.appearance.layers.slice()}}});
  await p.waitForTimeout(150);assert.equal(await p.locator('.actor[data-talking="true"]').count(),1);
  for(const who of ['chris','port','aili','samho','bubi']){
    await p.evaluate(who=>{barGame.reset(99,'practice',1);barGame.screen='bar';barGame.phase='regular';barGame.seats={L:{actor:who,state:'STORY'},M:null,R:null};barGame.dialogue=barGame.makeLine(who,'캐릭터의 기본 대화 애니메이션과 위치를 확인합니다.');barGame.dialogSpeed=.15;},who);
    await p.waitForTimeout(750);await p.screenshot({path:'/private/tmp/bar-art-'+who+'.png'});
    assert(await p.locator('.actor .actor-layer').count());
  }
  await p.evaluate(()=>{barGame.seats.R={actor:'port',state:'STORY'};});await p.waitForTimeout(750);await p.screenshot({path:'/private/tmp/bar-art-pair.png'});
  for(const [who,expression] of [['port','serious'],['port','joy'],['port','anger'],['port','event_surprise'],['chris','success'],['chris','fail'],['aili','success'],['aili','fail'],['samho','success'],['samho','fail'],['samho','drunk']]){
    await p.evaluate(([who,exp])=>{barGame.seats={L:{actor:who,state:'STORY'},M:null,R:null};barGame.dialogue=barGame.makeLine(who,'표정 리소스 위치 검수 중입니다.',null,exp);},[who,expression]);
    await p.waitForTimeout(750);assert(!(await p.locator('.actor').getAttribute('data-pose')).includes('idle'),who+' '+expression+' did not load');
    await p.screenshot({path:'/private/tmp/bar-art-'+who+'-'+expression+'.png'});
  }
  await p.evaluate(()=>{barGame.seats.L={actor:'samho',state:'STORY',glass:null};barGame.dialogue=null;});await p.waitForTimeout(750);
  await p.evaluate(()=>barGame.seats.L.glass='gin_tonic');await p.waitForTimeout(250);assert.equal(await p.locator('.actor').getAttribute('data-pose'),'drink_default');
  await p.screenshot({path:'/private/tmp/bar-art-samho-drink.png'});
  assert.deepEqual(errors,[]);const bad=await p.evaluate(()=>[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src));assert.deepEqual(bad,[]);
  console.log('ART_UI_OK: sourced hover KO/EN, hover lifetime, recipe toggle, native shelf sizing, paging, remove/back, male/female talk frames, pause, identity fallback, same-personality isolation, 5 regular actors.');
}finally{await b?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
