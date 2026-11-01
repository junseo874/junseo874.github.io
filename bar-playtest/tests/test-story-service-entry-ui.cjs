const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const browser=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(()=>LunaFocusSettings.setEnabled(false));
  // Use every authored day 0–3 order/craft pair, including the opening tutorial.
  const cases=await p.evaluate(()=>barGame.t.scenes.filter(s=>Number(s.day)>=0&&Number(s.day)<=3).flatMap(scene=>{
   const rows=barGame.t.steps.filter(s=>s.context===scene.id).sort((a,b)=>+a.seq-+b.seq);
   return rows.flatMap((craft,i)=>{if(craft.type!=='craft')return [];const order=rows.slice(0,i).findLast(s=>s.type==='order');return order?[{day:+scene.day,phase:scene.phase==='bar_open'?'opening':'regular',scene:scene.id,order,craft}]:[];});
  }));
  assert(cases.length>=9);
  const setup=async(spec,mode='original',tutorial=false)=>{
   await p.evaluate(({spec,mode,tutorial})=>{
    const c=lunaCampaign,g=barGame;c.session.uninstall();c.session.install({developer:mode!=='main'});
    c.ui.variant=mode==='gpt'?'gpt':'original';g.reset(spec.day,'regular',42,false,{variant:c.ui.variant});
    Object.assign(g,{screen:'bar',phase:spec.phase,dialogue:null,choice:null,drink:null,overlay:null,error:null,tutorial:null,storyCoaster:null,transition:0,pendingTransition:null,cameraMoving:false,cameraLeft:0,finished:false,paused:false});
    g.progress.flags.day0_skip_tutorial=!tutorial;g.progress.flags.day0_recipe_taught=!tutorial;
    g.progress.flags.johnny_recipe_unlocked=true;
    g.seats={L:null,M:null,R:{id:spec.order.actor,actor:spec.order.actor,state:'STORY',seated:true,coaster:true,glass:null,expression:'default'}};g.focus='R';
    g.currentOrder=null;g.createStoryOrder(spec.order);
    // Isolate each authored craft branch; branch eligibility is covered by story tests.
    g.story={scene:{id:spec.scene},steps:[{...spec.craft,when:''},{type:'serve',actor:spec.order.actor},{type:'say',actor:spec.order.actor,'text.ko':'잘 마셨네.'}],index:0};
    g.lastStoryLine=null;g.pump();if(!tutorial)g.tutorial=null;
    LunaStoryNotices.clear();c.screen(c.playView);c.render(true);
   },{spec,mode,tutorial});
   await p.waitForFunction(()=>!barGame.cameraMoving&&!barGame.cameraLeft&&!barGame.transition);
   await p.locator('.service-handle').waitFor();
  };
  let count=0;
  for(const mode of ['original','gpt','main'])for(const spec of cases){
   await setup(spec,mode);
   assert.equal(await p.locator('.story-craft-prompt').count(),0);
   assert.equal(await p.locator('.bar-view [data-act="recipes"]').count(),0);
   assert(await p.locator('.service-handle').isEnabled());
   const before=await p.evaluate(()=>JSON.stringify(barGame.currentOrder));
   await p.locator('.service-handle').click();
   assert.equal(await p.evaluate(()=>barGame.overlay),'service');
   assert(await p.locator('#service-panel [data-act="recipes"]').evaluate(e=>e===document.activeElement));
   await p.keyboard.press('Escape');assert(await p.locator('.service-handle').evaluate(e=>e===document.activeElement));
   await p.keyboard.press('Tab');await p.locator('#service-panel [data-act="recipes"]').click();
   assert.equal(await p.evaluate(()=>barGame.screen),'recipe');
   await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>barGame.screen),'bar');
   assert.equal(await p.evaluate(()=>JSON.stringify(barGame.currentOrder)),before);
   await p.locator('.service-handle').click();await p.locator('#service-panel [data-act="recipes"]').click();
   const id=await p.evaluate(()=>barGame.currentOrder.cocktail);
   const preview=p.locator('[data-act="remixPreview"][data-id="'+id+'"]');if(await preview.count())await preview.click();
   await p.locator('[data-act="selectRecipe"][data-id="'+id+'"]').click();
   assert.equal(await p.evaluate(()=>barGame.screen),'prep');count++;
  }
  // Tutorial keeps its existing service → recipe gate, not a new center shortcut.
  for(const day of [0,1]){
   const spec=cases.find(s=>s.day===day&&s.craft.arg=== (day?'tutorial_beer':'tutorial_recipe'));assert(spec);
   await setup(spec,'original',true);assert.equal(await p.evaluate(()=>barGame.tutorial.kind),'recipe');
   await p.locator('.service-handle').click();assert.equal(await p.evaluate(()=>barGame.tutorial.serviceOpened),true);
   assert(await p.locator('#service-panel [data-act="sales"]').isDisabled());
   await p.locator('#service-panel [data-act="recipes"]').click();assert.equal(await p.evaluate(()=>barGame.tutorial.kind),'recipeSelect');
  }
  // The new story entry is hidden during speech, choices, camera motion and serving.
  const spec=cases.find(s=>s.day===1&&s.phase==='regular');
  for(const patch of [{dialogue:{actor:'luna',text:'대사',chars:2}},{choice:{rows:[]}},{drink:{selected:'bottle_beer'}},{cameraLeft:1},{transition:1}]){
   await setup(spec);
   assert.equal(await p.evaluate(patch=>{Object.assign(barGame,patch);lunaCampaign.render(true);return document.querySelectorAll('.service-handle').length;},patch),0,JSON.stringify(patch));
  }
  await setup(spec);await p.evaluate(()=>{barGame.paused=true;lunaCampaign.render(true);});assert(await p.locator('.service-handle').isDisabled());
  await setup(spec);await p.screenshot({path:'/private/tmp/story-service-entry.png'});
  await p.setViewportSize({width:960,height:540});await p.waitForFunction(()=>{const r=document.querySelector('.service-handle')?.getBoundingClientRect();return r&&r.left>=0&&r.bottom<=innerHeight;});
  await p.evaluate(()=>{barGame.reset(1,'general',42,true);lunaCampaign.render(true);});
  await p.locator('.service-handle').click();assert.equal(await p.evaluate(()=>barGame.overlay),'service');
  assert.deepEqual(errors,[]);console.log('STORY_SERVICE_ENTRY_OK',count,'authored order cases: no center CTA, left handle/click/Tab/close/recipe/prep, tutorial gates, speech/choice/camera/drink/pause guards, general service unchanged');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
