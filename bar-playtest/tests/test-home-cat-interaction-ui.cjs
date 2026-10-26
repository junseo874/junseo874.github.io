const assert=require('node:assert/strict');
const runtime=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const browser=await runtime.load('playwright').chromium.launch({executablePath:runtime.chrome,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.stack));
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  if(await page.locator('.updates-confirm').isVisible())await page.locator('.updates-confirm').click();
  await page.evaluate(async()=>{
   lunaCampaign.screen('developer');Object.assign(outsidePlaytest.config,{day:2,flow:'out',place:'home'});await outsidePlaytest.start();
   const a=outsidePlaytest,m=a.model,N=LunaOutsideNeighborhood;
   barGame.progress.flags={};m.start({day:2,flow:'out',place:'home'});
   if(N.targets(m).length)throw Error('No cat before adoption');
   Object.assign(barGame.progress,{money:123,inventory:{tuna_can:2},flags:{boobi_adopted:true}});
   m.x=N.places.sofa.x;m.controlsTutorial=false;m.updateNear();a.snapCamera();a.tick(0);
   if(m.near?.id!=='neighborhood-home-cat')throw Error('Cat must be distinct from sofa');
  });
  const menu=page.locator('.world-choices');
  await page.keyboard.press('KeyE');
  await menu.locator('[data-choice="pet"]').waitFor({state:'visible'});
  assert.deepEqual(await menu.locator('[data-choice]').evaluateAll(nodes=>nodes.map(n=>n.dataset.choice)),['pet','cancel']);
  assert.equal(await menu.locator('.bd-balance').count(),0,'No wallet on a free petting menu');
  assert.equal(await page.evaluate(()=>outsidePlaytest.model.story.view().full),'냐옹');
  assert.equal(await page.evaluate(()=>outsidePlaytest.model.story.speech.id),'neighborhood/homeCat');
  await page.waitForTimeout(550);
  await page.screenshot({path:'/private/tmp/home-boobi-menu.png'});
  await menu.locator('[data-choice="cancel"]').click();
  assert(await page.evaluate(()=>!outsidePlaytest.model.story.blocking&&!outsidePlaytest.model.neighborhood.action));
  await page.keyboard.press('KeyE');await menu.locator('[data-choice="pet"]').waitFor({state:'visible'});
  await page.waitForTimeout(550);await page.keyboard.press('Enter');
  const visual=await page.evaluate(()=>{
   const a=outsidePlaytest,m=a.model,N=LunaOutsideNeighborhood;
   if(m.neighborhood.action?.name!=='pet')throw Error('Pet selection starts reaction');
   m.neighborhood.action.time=.65;a.tick(0);
   const canvas=document.querySelector('.outside-stage canvas'),ctx=canvas.getContext('2d'),f=a.pixelSurface.factor;
   const p=LunaPixelCamera.position(N.places.sofa.x,N.places.sofa.y,a.renderCamera);
   const rect=[Math.floor((p.x-35)*f),Math.floor((p.y-125)*f),Math.ceil(105*f),Math.ceil(145*f)];
   const snapshot=()=>Array.from(ctx.getImageData(...rect).data);
   const happy=snapshot(),action=m.neighborhood.action;
   m.neighborhood.action=null;a.tick(0);const idle=snapshot();m.neighborhood.action=action;a.tick(0);
   let changed=0,hearts=0;
   for(let i=0;i<happy.length;i+=4){
    if(Math.abs(happy[i]-idle[i])+Math.abs(happy[i+1]-idle[i+1])+Math.abs(happy[i+2]-idle[i+2])>25)changed++;
    if(happy[i]>170&&happy[i]>happy[i+1]*1.2&&happy[i+2]>happy[i+1]&&happy[i]>idle[i]+20)hearts++;
   }
   m.paused=true;m.tick(1);if(m.neighborhood.action.time!==.65)throw Error('Pause must freeze reaction');m.paused=false;
   return {changed,hearts};
  });
  assert(visual.changed>80&&visual.hearts>5,JSON.stringify(visual));
  await page.evaluate(()=>{outsidePlaytest.model.neighborhood.action.time=.65;outsidePlaytest.tick(0);});
  await page.screenshot({path:'/private/tmp/home-boobi-happy.png'});
  const result=await page.evaluate(()=>{
   const a=outsidePlaytest,m=a.model,N=LunaOutsideNeighborhood;
   m.paused=false;for(let i=0;i<40;i++)m.tick(.05);a.tick(0);
   if(m.neighborhood.action||m.story.blocking)throw Error('Reaction must end and release input');
   const x=m.x;m.tick(.1,{move:-1});if(m.x>=x)throw Error('Movement returns');
   const t=N.targets(m)[0];N.interact(m,t);if(m.story.view().full!=='냐옹')throw Error('Repeat interaction');
   if(m.story.choose('feed'))throw Error('No feeding/adoption action indoors');
   m.story.choose('pet');m.story.cancel();if(m.neighborhood.action)throw Error('Cancelled reaction must not linger');
   const restPending=!barGame.progress.flags.boobi_rest_seen;
   const money=barGame.progress.money,tuna=barGame.progress.inventory.tuna_can;
   barGame.progress.flags={boobi_revealed:true};m.start({day:2,flow:'out',place:'homeDoor'});
   N.interact(m,N.targets(m).find(t=>t.id==='neighborhood-cat'));
   return {restPending,money,tuna,outdoor:N.choiceView(m).options.map(o=>o.id),outdoorText:m.story.view().full};
  });
  assert.deepEqual(result,{restPending:true,money:123,tuna:2,outdoor:['pet','feed','cancel'],outdoorText:'야옹'});
  assert.deepEqual(errors,[]);
  console.log('HOME_CAT_OK: meow/two choices, cancel, pet face/tail/hearts, pause/end/cancel, repeat, rest unchanged, no inventory cost, outdoor menu preserved',visual);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
